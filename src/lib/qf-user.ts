import { QF_BOOKMARK_COLLECTION_NAME } from '@/lib/app-constants';
import { qfApiFetch, readApiResponse } from '@/lib/qf/client';
import {
  bookmarkAyahsInSakinahCollection,
  getAyahBookmarksInSakinahCollection,
  listAyahBookmarksInSakinahCollection,
  removeAyahBookmarksFromSakinahCollection,
} from '@/lib/qf/collections';
import { qfAuthDebug } from '@/lib/qf/config';
import { normalizeQfNote, normalizeQfNotesFromPayload } from '@/lib/qf/notes';
import { buildLoginRedirect, handleAuthCallback, logoutQfUser } from '@/lib/qf/oauth';
import { deriveQfSessionSummaryFromProfilePayload } from '@/lib/qf/profile';
import { getQfUserSession, persistQfUserSession } from '@/lib/qf/session';
import type {
  QfAyahBookmark,
  QfNoteAttachedEntity,
  QfSavedNote,
  QfSessionSummary,
} from '@/lib/qf/types';

export { QF_BOOKMARK_COLLECTION_NAME };
export type { QfAyahBookmark, QfNoteAttachedEntity, QfSavedNote, QfSessionSummary };
export {
  buildLoginRedirect,
  bookmarkAyahsInSakinahCollection,
  getAyahBookmarksInSakinahCollection,
  getQfUserSession,
  handleAuthCallback,
  listAyahBookmarksInSakinahCollection,
  logoutQfUser,
  persistQfUserSession,
  removeAyahBookmarksFromSakinahCollection,
};

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
