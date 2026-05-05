import { parseAyahSelection } from '@/lib/ayah';
import { QF_BOOKMARK_COLLECTION_NAME } from '@/lib/app-constants';
import { QfSessionCookie } from '@/lib/qf/auth';
import {
  buildBookmarkIdsByVerseNumber,
  mapAyahBookmarks,
  normalizeCollectionBookmark,
  pickPreferredVerseCollection,
} from '@/lib/qf/bookmarks';
import { logBookmarkPayloadDebug, qfApiFetch, readApiResponse } from '@/lib/qf/client';
import { isQfAuthDebugEnabled, qfAuthDebug } from '@/lib/qf/config';
import { normalizeQfNote, normalizeQfNotesFromPayload } from '@/lib/qf/notes';
import { buildLoginRedirect, handleAuthCallback, logoutQfUser } from '@/lib/qf/oauth';
import { deriveQfSessionSummaryFromProfilePayload } from '@/lib/qf/profile';
import { getQfUserSession, persistQfUserSession } from '@/lib/qf/session';
import type {
  QfAyahBookmark,
  QfBookmark,
  QfCollection,
  QfNoteAttachedEntity,
  QfPagination,
  QfSavedNote,
  QfSessionSummary,
} from '@/lib/qf/types';

export { QF_BOOKMARK_COLLECTION_NAME };
export type { QfAyahBookmark, QfNoteAttachedEntity, QfSavedNote, QfSessionSummary };
export {
  buildLoginRedirect,
  getQfUserSession,
  handleAuthCallback,
  logoutQfUser,
  persistQfUserSession,
};
const QF_BOOKMARK_MUSHAF_ID = 5;

async function listAyahCollections(session: QfSessionCookie) {
  const allCollections: QfCollection[] = [];
  let activeSession = session;
  let after: string | null = null;

  while (true) {
    const searchParams = new URLSearchParams({
      first: '20',
      sortBy: 'alphabetical',
      type: 'ayah',
    });

    if (after) {
      searchParams.set('after', after);
    }

    const { response, session: updatedSession } = await qfApiFetch(
      activeSession,
      `/auth/v1/collections?${searchParams.toString()}`,
    );
    const payload = await readApiResponse<{
      data?: QfCollection[];
      pagination?: QfPagination;
      success?: boolean;
    }>(response);

    activeSession = updatedSession;
    allCollections.push(...(payload.data ?? []));

    if (!payload.pagination?.hasNextPage || !payload.pagination.endCursor) {
      break;
    }

    after = payload.pagination.endCursor;
  }

  return { collections: allCollections, session: activeSession };
}

async function createCollection(session: QfSessionCookie, name: string) {
  const { response, session: updatedSession } = await qfApiFetch(session, '/auth/v1/collections', {
    body: JSON.stringify({ name }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = await readApiResponse<{ data?: QfCollection; success?: boolean }>(response);

  if (!payload.data) {
    throw new Error('Quran Foundation did not return the created collection.');
  }

  return { collection: payload.data, session: updatedSession };
}

async function getExistingVerseCollection(session: QfSessionCookie) {
  const { collections, session: listedSession } = await listAyahCollections(session);
  const existingCollection = pickPreferredVerseCollection(collections, QF_BOOKMARK_COLLECTION_NAME);

  return {
    collection: existingCollection ?? null,
    session: listedSession,
  };
}

async function ensureVerseCollection(session: QfSessionCookie) {
  const { collection: existingCollection, session: listedSession } =
    await getExistingVerseCollection(session);

  if (existingCollection) {
    return {
      collection: existingCollection,
      session: listedSession,
    };
  }

  return createCollection(listedSession, QF_BOOKMARK_COLLECTION_NAME);
}

async function addAyahBookmark(
  session: QfSessionCookie,
  collectionId: string,
  surahNo: number,
  verseNumber: number,
) {
  const { response, session: updatedSession } = await qfApiFetch(
    session,
    `/auth/v1/collections/${collectionId}/bookmarks`,
    {
      body: JSON.stringify({
        key: surahNo,
        mushaf: QF_BOOKMARK_MUSHAF_ID,
        type: 'ayah',
        verseNumber,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );

  // Treat "already bookmarked" responses as a successful no-op so the UI
  // can still reflect that the ayah is saved in the target collection.
  if (!response.ok && response.status !== 409) {
    const details = await response.text();
    throw new Error(`Failed to add ayah bookmark: ${response.status} ${details}`);
  }

  return updatedSession;
}

async function listCollectionAyahBookmarks(session: QfSessionCookie, collectionId: string) {
  const allBookmarks: QfBookmark[] = [];
  let activeSession = session;
  let after: string | null = null;

  while (true) {
    const searchParams = new URLSearchParams({
      first: '20',
      sortBy: 'verseKey',
    });

    if (after) {
      searchParams.set('after', after);
    }

    const { response, session: updatedSession } = await qfApiFetch(
      activeSession,
      `/auth/v1/collections/${collectionId}?${searchParams.toString()}`,
    );

    if (!response.ok) {
      const details = await response.text();
      qfAuthDebug('list collection bookmarks failed', {
        collectionId,
        details: details.slice(0, 700),
        hasAfter: Boolean(after),
        sortBy: searchParams.get('sortBy'),
        status: response.status,
      });
      throw new Error(`Quran Foundation API request failed: ${response.status} ${details}`);
    }

    const payload = (await response.json()) as {
      data?: {
        bookmarks?: unknown[];
      };
      pagination?: QfPagination;
      success?: boolean;
    };

    logBookmarkPayloadDebug(collectionId, payload);

    activeSession = updatedSession;

    const normalizedBookmarks = (payload.data?.bookmarks ?? [])
      .map((bookmark) => normalizeCollectionBookmark(bookmark))
      .filter((bookmark): bookmark is QfBookmark => Boolean(bookmark));

    allBookmarks.push(...normalizedBookmarks);

    if (!payload.pagination?.hasNextPage || !payload.pagination.endCursor) {
      break;
    }

    after = payload.pagination.endCursor;
  }

  return { bookmarks: allBookmarks, session: activeSession };
}

async function removeCollectionBookmark(
  session: QfSessionCookie,
  collectionId: string,
  bookmarkId: string,
) {
  const { response, session: updatedSession } = await qfApiFetch(
    session,
    `/auth/v1/collections/${collectionId}/bookmarks/${bookmarkId}`,
    {
      method: 'DELETE',
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to remove collection bookmark: ${response.status} ${details}`);
  }

  return updatedSession;
}

export async function getQfUserSessionSummary(): Promise<QfSessionSummary> {
  const session = await getQfUserSession();

  if (!session) {
    return {
      avatarUrl: null,
      collectionName: QF_BOOKMARK_COLLECTION_NAME,
      displayName: null,
      isAuthenticated: false,
    };
  }

  try {
    const profilePaths = ['/quran-reflect/v1/users/profile', '/auth/v1/profile'];
    let payload: Record<string, unknown> | null = null;
    let resolvedProfilePath: string | null = null;
    let lastProfileError: Error | null = null;

    for (const profilePath of profilePaths) {
      try {
        const { response } = await qfApiFetch(session, profilePath);

        qfAuthDebug('profile request completed', {
          ok: response.ok,
          path: profilePath,
          responseUrl: response.url,
          status: response.status,
        });

        payload = await readApiResponse<Record<string, unknown>>(response);
        resolvedProfilePath = profilePath;
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        qfAuthDebug('profile request failed for path', {
          message,
          path: profilePath,
        });
        lastProfileError = error instanceof Error ? error : new Error(message);
      }
    }

    if (!payload) {
      throw lastProfileError ?? new Error('Unable to load profile from known profile endpoints.');
    }

    qfAuthDebug('profile request resolved', {
      path: resolvedProfilePath,
    });

    const resolution = deriveQfSessionSummaryFromProfilePayload(
      payload,
      QF_BOOKMARK_COLLECTION_NAME,
    );

    qfAuthDebug('profile payload inspected for avatar', {
      ...resolution.diagnostics,
      hasAvatarUrl: Boolean(resolution.summary.avatarUrl),
    });

    return resolution.summary;
  } catch (error) {
    qfAuthDebug('failed to load user profile summary', {
      message: error instanceof Error ? error.message : String(error),
    });

    return {
      avatarUrl: null,
      collectionName: QF_BOOKMARK_COLLECTION_NAME,
      displayName: null,
      isAuthenticated: true,
    };
  }
}

export async function bookmarkAyahsInSakinahCollection(surahNo: number, ayahNo: string) {
  const selection = parseAyahSelection(ayahNo);
  const session = await getQfUserSession();

  qfAuthDebug('bookmark request received', {
    ayahNo,
    hasSelection: Boolean(selection),
    hasSession: Boolean(session),
    surahNo,
  });

  if (!session) {
    throw new Error('You need to connect your Quran Foundation account first.');
  }

  if (!selection) {
    throw new Error('Invalid ayah selection.');
  }

  const { collection, session: collectionSession } = await ensureVerseCollection(session);
  let activeSession = collectionSession;

  for (let verseNumber = selection.from; verseNumber <= selection.to; verseNumber += 1) {
    activeSession = await addAyahBookmark(activeSession, collection.id, surahNo, verseNumber);
  }

  return {
    collection,
    savedCount: selection.to - selection.from + 1,
    session: activeSession,
  };
}

export async function getAyahBookmarksInSakinahCollection(surahNo: number, ayahNo: string) {
  const selection = parseAyahSelection(ayahNo);
  const session = await getQfUserSession();

  qfAuthDebug('bookmark status request received', {
    ayahNo,
    hasSelection: Boolean(selection),
    hasSession: Boolean(session),
    surahNo,
  });

  if (!session) {
    throw new Error('You need to connect your Quran Foundation account first.');
  }

  if (!selection) {
    throw new Error('Invalid ayah selection.');
  }

  const { collection, session: collectionSession } = await getExistingVerseCollection(session);

  if (!collection) {
    return {
      bookmarkIdsByVerseNumber: {},
      collection: null,
      session: collectionSession,
    };
  }

  const { bookmarks, session: listedSession } = await listCollectionAyahBookmarks(
    collectionSession,
    collection.id,
  );

  qfAuthDebug('bookmark status collection loaded', {
    collectionId: collection.id,
    collectionName: collection.name,
    selectionFrom: selection.from,
    selectionTo: selection.to,
    surahNo,
    totalBookmarksLoaded: bookmarks.length,
  });

  for (const bookmark of bookmarks) {
    if (isQfAuthDebugEnabled()) {
      qfAuthDebug('bookmark status evaluating', {
        bookmarkId: bookmark.id,
        bookmarkKey: bookmark.key,
        bookmarkType: bookmark.type,
        bookmarkVerseNumber: bookmark.verseNumber,
        selectionFrom: selection.from,
        selectionTo: selection.to,
        surahNo,
      });
    }

    // Keep per-bookmark debug logging before applying the shared mapper.
  }

  const idsByVerseNumber = buildBookmarkIdsByVerseNumber(bookmarks, surahNo, selection);

  qfAuthDebug('bookmark status computed', {
    collectionId: collection.id,
    matchedCount: Object.keys(idsByVerseNumber).length,
    selectionFrom: selection.from,
    selectionTo: selection.to,
    surahNo,
  });

  return {
    bookmarkIdsByVerseNumber: idsByVerseNumber,
    collection,
    session: listedSession,
  };
}

export async function listAyahBookmarksInSakinahCollection() {
  const session = await getQfUserSession();

  if (!session) {
    throw new Error('You need to connect your Quran Foundation account first.');
  }

  const { collection, session: collectionSession } = await getExistingVerseCollection(session);

  if (!collection) {
    return {
      bookmarks: [] as QfAyahBookmark[],
      collection: null,
      session: collectionSession,
    };
  }

  const { bookmarks, session: listedSession } = await listCollectionAyahBookmarks(
    collectionSession,
    collection.id,
  );

  const ayahBookmarks = mapAyahBookmarks(bookmarks);

  return {
    bookmarks: ayahBookmarks,
    collection,
    session: listedSession,
  };
}

export async function removeAyahBookmarksFromSakinahCollection(surahNo: number, ayahNo: string) {
  const selection = parseAyahSelection(ayahNo);
  const session = await getQfUserSession();

  qfAuthDebug('remove bookmark request received', {
    ayahNo,
    hasSelection: Boolean(selection),
    hasSession: Boolean(session),
    surahNo,
  });

  if (!session) {
    throw new Error('You need to connect your Quran Foundation account first.');
  }

  if (!selection) {
    throw new Error('Invalid ayah selection.');
  }

  const {
    bookmarkIdsByVerseNumber,
    collection,
    session: listedSession,
  } = await getAyahBookmarksInSakinahCollection(surahNo, ayahNo);

  let activeSession = listedSession;
  let removedCount = 0;

  if (!collection) {
    return {
      collection: null,
      removedCount: 0,
      session: activeSession,
    };
  }

  for (let verseNumber = selection.from; verseNumber <= selection.to; verseNumber += 1) {
    const bookmarkId = bookmarkIdsByVerseNumber[verseNumber];
    if (!bookmarkId) {
      continue;
    }

    activeSession = await removeCollectionBookmark(activeSession, collection.id, bookmarkId);
    removedCount += 1;
  }

  return {
    collection,
    removedCount,
    session: activeSession,
  };
}

export async function listNotesInQfAccount() {
  const session = await getQfUserSession();

  if (!session) {
    throw new Error('You need to connect your Quran Foundation account first.');
  }

  const { response, session: updatedSession } = await qfApiFetch(session, '/auth/v1/notes');
  const payload = await readApiResponse<{
    data?: unknown[] | { notes?: unknown[] };
    success?: boolean;
  }>(response);
  const notes = normalizeQfNotesFromPayload(payload);

  return {
    notes,
    session: updatedSession,
  };
}

export async function updateNoteInQfAccount(noteId: string, body: string) {
  const session = await getQfUserSession();

  if (!session) {
    throw new Error('You need to connect your Quran Foundation account first.');
  }

  const { response, session: updatedSession } = await qfApiFetch(
    session,
    `/auth/v1/notes/${noteId}`,
    {
      body: JSON.stringify({
        body,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    },
  );

  const result = await readApiResponse<{
    data?: unknown;
    success?: boolean;
  }>(response);

  return {
    note: normalizeQfNote(result.data),
    session: updatedSession,
  };
}

export async function deleteNoteInQfAccount(noteId: string) {
  const session = await getQfUserSession();

  if (!session) {
    throw new Error('You need to connect your Quran Foundation account first.');
  }

  const { response, session: updatedSession } = await qfApiFetch(
    session,
    `/auth/v1/notes/${noteId}`,
    {
      method: 'DELETE',
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to delete note: ${response.status} ${details}`);
  }

  return {
    session: updatedSession,
    success: true,
  };
}

export async function createNoteInQfAccount(
  body: string,
  ranges: string[],
  attachedEntity: QfNoteAttachedEntity | null,
) {
  const session = await getQfUserSession();

  qfAuthDebug('note creation request received', {
    bodyLength: body.length,
    hasAttachedEntity: Boolean(attachedEntity),
    rangesCount: ranges.length,
  });

  if (!session) {
    throw new Error('You need to connect your Quran Foundation account first.');
  }

  const payload: Record<string, unknown> = {
    body,
    saveToQR: false,
  };

  if (attachedEntity) {
    payload.attachedEntity = attachedEntity;
  }

  if (ranges.length > 0) {
    payload.ranges = ranges;
  }

  const { response, session: updatedSession } = await qfApiFetch(session, '/auth/v1/notes', {
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const result = await readApiResponse<{
    data?: {
      body?: string;
      createdAt?: string;
      id?: string;
    };
    success?: boolean;
  }>(response);

  return {
    note: result.data ?? null,
    session: updatedSession,
  };
}
