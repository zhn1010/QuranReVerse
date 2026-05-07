import { parseAyahSelection } from '@/lib/ayah';
import type { QfSessionCookie } from '@/lib/qf/auth';
import {
  buildBookmarkIdsByVerseNumber,
  mapAyahBookmarks,
  normalizeCollectionBookmark,
} from '@/lib/qf/bookmarks';
import { logBookmarkPayloadDebug, qfApiFetch } from '@/lib/qf/client';
import { isQfAuthDebugEnabled, qfAuthDebug } from '@/lib/qf/config';
import { ensureVerseCollection, getExistingVerseCollection } from '@/lib/qf/collections-api';
import { getQfUserSession } from '@/lib/qf/session';
import type { QfAyahBookmark, QfBookmark, QfPagination } from '@/lib/qf/types';

const QF_BOOKMARK_MUSHAF_ID = 5;

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

  return {
    bookmarks: mapAyahBookmarks(bookmarks),
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
