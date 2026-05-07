import { NextResponse } from 'next/server';
import {
  createSession,
  getSession,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRATION_SECONDS,
} from '@/lib/server/session/store';
import { qfAuthDebug } from '@/lib/server/qf/config';
import type { QfSessionCookie } from '@/lib/server/qf/auth';

export async function getQfUserSession(): Promise<QfSessionCookie | null> {
  const redisSession = await getSession();
  const bookmarkCollection =
    typeof redisSession?.data.qfBookmarkCollectionId === 'string' &&
    typeof redisSession?.data.qfBookmarkCollectionName === 'string' &&
    typeof redisSession?.data.qfBookmarkCollectionUpdatedAt === 'string'
      ? {
          id: redisSession.data.qfBookmarkCollectionId,
          name: redisSession.data.qfBookmarkCollectionName,
          updatedAt: redisSession.data.qfBookmarkCollectionUpdatedAt,
        }
      : undefined;

  qfAuthDebug('reading user session from redis', {
    hasCachedBookmarkCollection: Boolean(bookmarkCollection),
    hasSessionData: Boolean(redisSession),
    sessionResolved: Boolean(redisSession),
  });

  if (!redisSession) {
    return null;
  }

  return {
    accessToken: redisSession.data.accessToken as string,
    bookmarkCollection,
    expiresAt: redisSession.data.expiresAt as number,
    refreshToken: redisSession.data.refreshToken as string | undefined,
    user: {
      sub: redisSession.data.quranFoundationId as string | undefined,
    },
  };
}

export async function persistQfUserSession(response: NextResponse, session: QfSessionCookie) {
  const sessionId = await createSession({
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    qfBookmarkCollectionId: session.bookmarkCollection?.id,
    qfBookmarkCollectionName: session.bookmarkCollection?.name,
    qfBookmarkCollectionUpdatedAt: session.bookmarkCollection?.updatedAt,
    quranFoundationId: session.user.sub,
    refreshToken: session.refreshToken,
  });

  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    maxAge: SESSION_EXPIRATION_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
