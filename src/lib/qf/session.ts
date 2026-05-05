import { NextResponse } from 'next/server';
import {
  createSession,
  getSession,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRATION_SECONDS,
} from '@/lib/session';
import { qfAuthDebug } from '@/lib/qf/config';
import type { QfSessionCookie } from '@/lib/qf/auth';

export async function getQfUserSession(): Promise<QfSessionCookie | null> {
  const redisSession = await getSession();

  qfAuthDebug('reading user session from redis', {
    hasSessionData: Boolean(redisSession),
    sessionResolved: Boolean(redisSession),
  });

  if (!redisSession) {
    return null;
  }

  return {
    accessToken: redisSession.data.accessToken as string,
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
