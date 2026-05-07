import { QF_BOOKMARK_COLLECTION_NAME } from '@/lib/shared/constants/app';
import type { QfCachedCollection, QfSessionCookie } from '@/lib/server/qf/auth';
import { pickPreferredVerseCollection } from '@/lib/server/qf/bookmarks';
import { qfApiFetch, readApiResponse } from '@/lib/server/qf/client';
import { qfAuthDebug } from '@/lib/server/qf/config';
import type { QfCollection, QfPagination } from '@/lib/shared/qf/types';

function rememberVerseCollection(session: QfSessionCookie, collection: QfCollection): QfSessionCookie {
  return {
    ...session,
    bookmarkCollection: {
      id: collection.id,
      name: collection.name,
      updatedAt: collection.updatedAt,
    },
  };
}

function readCachedVerseCollection(session: QfSessionCookie): QfCachedCollection | null {
  if (
    session.bookmarkCollection?.id &&
    session.bookmarkCollection.name === QF_BOOKMARK_COLLECTION_NAME &&
    session.bookmarkCollection.updatedAt
  ) {
    return session.bookmarkCollection;
  }

  return null;
}

export async function listAyahCollections(session: QfSessionCookie) {
  const allCollections: QfCollection[] = [];
  let activeSession = session;
  let after: string | null = null;
  let page = 1;

  while (true) {
    const searchParams = new URLSearchParams({
      first: '20',
      sortBy: 'alphabetical',
      type: 'ayah',
    });

    if (after) {
      searchParams.set('after', after);
    }

    qfAuthDebug('listing ayah collections page', {
      after,
      page,
      pageSize: searchParams.get('first'),
      sortBy: searchParams.get('sortBy'),
    });

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

    qfAuthDebug('listed ayah collections page', {
      accumulatedCollectionCount: allCollections.length,
      hasNextPage: Boolean(payload.pagination?.hasNextPage),
      page,
      receivedCollectionCount: payload.data?.length ?? 0,
    });

    if (!payload.pagination?.hasNextPage || !payload.pagination.endCursor) {
      break;
    }

    after = payload.pagination.endCursor;
    page += 1;
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
  const cachedCollection = readCachedVerseCollection(session);

  if (cachedCollection) {
    qfAuthDebug('using cached verse collection', {
      collectionId: cachedCollection.id,
      collectionName: cachedCollection.name,
      updatedAt: cachedCollection.updatedAt,
    });

    return {
      collection: cachedCollection,
      session,
    };
  }

  qfAuthDebug('cached verse collection missing; listing collections', {
    hasBookmarkCollection: Boolean(session.bookmarkCollection),
  });

  const { collections, session: listedSession } = await listAyahCollections(session);
  const existingCollection = pickPreferredVerseCollection(collections, QF_BOOKMARK_COLLECTION_NAME);

  return {
    collection: existingCollection ?? null,
    session: existingCollection ? rememberVerseCollection(listedSession, existingCollection) : listedSession,
  };
}

export async function ensureVerseCollection(session: QfSessionCookie) {
  const { collection: existingCollection, session: listedSession } =
    await getExistingVerseCollection(session);

  if (existingCollection) {
    return {
      collection: existingCollection,
      session: rememberVerseCollection(listedSession, existingCollection),
    };
  }

  const { collection, session: createdSession } = await createCollection(
    listedSession,
    QF_BOOKMARK_COLLECTION_NAME,
  );

  return {
    collection,
    session: rememberVerseCollection(createdSession, collection),
  };
}
