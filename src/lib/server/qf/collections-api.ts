import { QF_BOOKMARK_COLLECTION_NAME } from '@/lib/shared/constants/app';
import type { QfSessionCookie } from '@/lib/server/qf/auth';
import { pickPreferredVerseCollection } from '@/lib/server/qf/bookmarks';
import { qfApiFetch, readApiResponse } from '@/lib/server/qf/client';
import type { QfCollection, QfPagination } from '@/lib/shared/qf/types';

export async function listAyahCollections(session: QfSessionCookie) {
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

export async function createCollection(session: QfSessionCookie, name: string) {
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

export async function getExistingVerseCollection(session: QfSessionCookie) {
  const { collections, session: listedSession } = await listAyahCollections(session);
  const existingCollection = pickPreferredVerseCollection(collections, QF_BOOKMARK_COLLECTION_NAME);

  return {
    collection: existingCollection ?? null,
    session: listedSession,
  };
}

export async function ensureVerseCollection(session: QfSessionCookie) {
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
