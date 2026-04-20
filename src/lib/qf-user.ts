import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import {
  clearSession,
  createSession,
  getSession,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRATION_SECONDS,
} from '@/lib/session';

const QF_PRELIVE_AUTH_BASE_URL = 'https://prelive-oauth2.quran.foundation';
const QF_PRELIVE_API_BASE_URL = 'https://apis-prelive.quran.foundation';
const QF_PRODUCTION_AUTH_BASE_URL = 'https://oauth2.quran.foundation';
const QF_PRODUCTION_API_BASE_URL = 'https://apis.quran.foundation';
const QF_BOOKMARK_COLLECTION_NAME = 'Sakinah.now';
const QF_BOOKMARK_MUSHAF_ID = 5;
const AUTH_FLOW_COOKIE_NAME = 'qf_oauth_flow';
const USER_SESSION_COOKIE_NAME = 'qf_user_session';
const AUTH_FLOW_MAX_AGE_SECONDS = 60 * 15;
const DEFAULT_QF_SCOPES = ['openid', 'offline_access', 'user', 'collection', 'bookmark', 'note'];

type PendingAuthFlow = {
  codeVerifier: string;
  createdAt: number;
  nonce: string;
  redirectUri: string;
  returnTo: string;
  state: string;
};

type QfSessionCookie = {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  user: {
    sub?: string;
  };
};

type QfTokenResponse = {
  access_token: string;
  expires_in: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

type QfCollection = {
  id: string;
  name: string;
  updatedAt: string;
};

type QfPagination = {
  endCursor?: string;
  hasNextPage?: boolean;
};

type QfBookmark = {
  createdAt: string;
  group: string;
  id: string;
  isInDefaultCollection: boolean;
  isReading: boolean | null;
  key: number;
  type: string;
  verseNumber: number | null;
};

function normalizeCollectionBookmark(raw: unknown): QfBookmark | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const verseNumber = typeof record.verseNumber === 'number' ? record.verseNumber : null;
  const nestedBookmarkType =
    typeof record.bookmarkType === 'object' && record.bookmarkType
      ? (record.bookmarkType as Record<string, unknown>).type
      : undefined;
  const nestedBookmarkGroup =
    typeof record.bookmarkGroup === 'object' && record.bookmarkGroup
      ? (record.bookmarkGroup as Record<string, unknown>).name
      : undefined;
  const bookmarkType =
    typeof record.type === 'string'
      ? record.type
      : typeof record.bookmarkType === 'string'
        ? record.bookmarkType
        : typeof nestedBookmarkType === 'string'
          ? nestedBookmarkType
          : verseNumber !== null
            ? 'ayah'
            : undefined;
  const bookmarkGroup =
    typeof record.group === 'string'
      ? record.group
      : typeof record.bookmarkGroup === 'string'
        ? record.bookmarkGroup
        : typeof nestedBookmarkGroup === 'string'
          ? nestedBookmarkGroup
          : '';

  if (typeof record.id !== 'string' || typeof record.createdAt !== 'string') {
    return null;
  }

  if (typeof bookmarkType !== 'string') {
    return null;
  }

  if (typeof record.key !== 'number') {
    return null;
  }

  const isInDefaultCollection =
    typeof record.isInDefaultCollection === 'boolean' ? record.isInDefaultCollection : false;
  const isReading = typeof record.isReading === 'boolean' ? record.isReading : null;

  return {
    createdAt: record.createdAt,
    group: bookmarkGroup,
    id: record.id,
    isInDefaultCollection,
    isReading,
    key: record.key,
    type: bookmarkType,
    verseNumber,
  };
}

export type QfSessionSummary = {
  avatarUrl: string | null;
  collectionName: string;
  displayName: string | null;
  isAuthenticated: boolean;
};

type QfProfile = {
  avatarUrls?: {
    large?: string;
    medium?: string;
    small?: string;
  };
  firstName?: string;
  lastName?: string;
  username?: string;
};

function isQfAuthDebugEnabled() {
  return process.env.QF_AUTH_DEBUG === 'true';
}

function maskIdentifier(value: string | undefined) {
  if (!value) {
    return '(missing)';
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function qfAuthDebug(message: string, details?: Record<string, unknown>) {
  if (!isQfAuthDebugEnabled()) {
    return;
  }

  console.log('[qf-auth]', message, details ?? {});
}

function getUtf8ByteLength(value: string) {
  return Buffer.byteLength(value, 'utf8');
}

function estimateCookieHeaderSize(name: string, value: string) {
  // Approximation of Set-Cookie header bytes with current attributes.
  const attributes = '; Path=/; HttpOnly; SameSite=Lax; Secure';
  return getUtf8ByteLength(`${name}=${value}${attributes}`);
}

function logCookiePayloadDiagnostics(
  name: string,
  payload: PendingAuthFlow | QfSessionCookie,
  sealedValue: string,
) {
  if (!isQfAuthDebugEnabled()) {
    return;
  }

  const payloadJson = JSON.stringify(payload);
  const payloadBytes = getUtf8ByteLength(payloadJson);
  const sealedBytes = getUtf8ByteLength(sealedValue);
  const decodedSealedBytes = Buffer.from(sealedValue, 'base64url').length;
  const estimatedHeaderBytes = estimateCookieHeaderSize(name, sealedValue);
  const details: Record<string, unknown> = {
    cookieName: name,
    decodedSealedBytes,
    estimatedHeaderBytes,
    payloadBytes,
    sealedBytes,
  };

  if (name === USER_SESSION_COOKIE_NAME && 'accessToken' in payload) {
    const session = payload as QfSessionCookie;
    details.accessTokenBytes = getUtf8ByteLength(session.accessToken ?? '');
    details.refreshTokenBytes = getUtf8ByteLength(session.refreshToken ?? '');
    details.userJsonBytes = getUtf8ByteLength(JSON.stringify(session.user ?? {}));
  }

  qfAuthDebug('cookie payload diagnostics', details);
}

function getQfConfig() {
  const environment = process.env.QF_ENV === 'prelive' ? 'prelive' : 'production';
  const authBaseUrl =
    process.env.QF_USER_AUTH_BASE_URL ??
    (environment === 'prelive' ? QF_PRELIVE_AUTH_BASE_URL : QF_PRODUCTION_AUTH_BASE_URL);
  const apiBaseUrl =
    process.env.QF_USER_API_BASE_URL ??
    process.env.QURAN_API_BASE_URL ??
    (environment === 'prelive' ? QF_PRELIVE_API_BASE_URL : QF_PRODUCTION_API_BASE_URL);
  const clientId = process.env.QF_USER_CLIENT_ID ?? process.env.QURAN_CLIENT_ID;
  const clientSecret = process.env.QF_USER_CLIENT_SECRET ?? process.env.QURAN_CLIENT_SECRET;

  if (!clientId) {
    throw new Error(
      'Missing Quran Foundation API credentials. Set QURAN_CLIENT_ID or QF_USER_CLIENT_ID.',
    );
  }

  if (!clientSecret) {
    throw new Error(
      'Missing Quran Foundation API credentials. Set QURAN_CLIENT_SECRET or QF_USER_CLIENT_SECRET.',
    );
  }

  const config = {
    apiBaseUrl,
    authBaseUrl,
    clientId,
    clientSecret,
    scopes: process.env.QF_USER_SCOPES?.trim() || DEFAULT_QF_SCOPES.join(' '),
  };

  qfAuthDebug('resolved config', {
    apiBaseUrl: config.apiBaseUrl,
    authBaseUrl: config.authBaseUrl,
    clientId: maskIdentifier(config.clientId),
    hasClientSecret: Boolean(config.clientSecret),
    scopes: config.scopes,
  });

  return config;
}

function getSessionSecret() {
  const secret = process.env.QF_SESSION_SECRET;

  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'Missing required environment variable: QF_SESSION_SECRET (minimum 32 characters)',
    );
  }

  return createHash('sha256').update(secret).digest();
}

function sealCookieValue(payload: PendingAuthFlow | QfSessionCookie) {
  const key = getSessionSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

function unsealCookieValue<T>(value: string | undefined): T | null {
  if (!value) {
    return null;
  }

  try {
    const buffer = Buffer.from(value, 'base64url');
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', getSessionSecret(), iv);

    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      'utf8',
    );

    return JSON.parse(decrypted) as T;
  } catch {
    return null;
  }
}

function randomBase64Url(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

function buildCodeChallenge(codeVerifier: string) {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

function parseJwtPayload(token: string | undefined) {
  if (!token) {
    return null;
  }

  const parts = token.split('.');

  if (parts.length < 2) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function sanitizeReturnTo(value: string | null) {
  if (value && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }

  return '/';
}

function getRedirectUri(requestUrl: string) {
  const requestOriginRedirect = new URL('/api/qf/auth/callback', requestUrl).toString();
  const configuredRedirect = process.env.QF_USER_REDIRECT_URI?.trim();

  if (!configuredRedirect) {
    return requestOriginRedirect;
  }

  try {
    const configuredUrl = new URL(configuredRedirect);
    const requestOrigin = new URL(requestUrl).origin;

    if (configuredUrl.origin !== requestOrigin) {
      qfAuthDebug('configured redirect origin mismatch; using request origin redirect', {
        configuredOrigin: configuredUrl.origin,
        configuredPathname: configuredUrl.pathname,
        requestOrigin,
      });

      return requestOriginRedirect;
    } else {
      qfAuthDebug('configured redirect origin matches request origin; using configured redirect', {
        configuredRedirect,
        requestOrigin,
      });
      return configuredUrl.toString();
    }
  } catch {
    qfAuthDebug('invalid configured redirect uri; using request origin redirect', {
      configuredRedirect,
    });
    return requestOriginRedirect;
  }
}

function setEncryptedCookie(
  response: NextResponse,
  name: string,
  payload: PendingAuthFlow | QfSessionCookie,
  maxAge: number,
) {
  const sealedValue = sealCookieValue(payload);
  logCookiePayloadDiagnostics(name, payload, sealedValue);

  response.cookies.set({
    httpOnly: true,
    maxAge,
    name,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    value: sealedValue,
  });
}

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set({
    expires: new Date(0),
    httpOnly: true,
    name,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    value: '',
  });
}

async function exchangeToken(params: URLSearchParams) {
  const { authBaseUrl, clientId, clientSecret } = getQfConfig();

  const headers: HeadersInit = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  } else {
    params.set('client_id', clientId);
  }

  qfAuthDebug('exchanging token', {
    authBaseUrl,
    grantType: params.get('grant_type'),
    hasClientSecret: Boolean(clientSecret),
    hasCode: Boolean(params.get('code')),
    hasCodeVerifier: Boolean(params.get('code_verifier')),
    redirectUri: params.get('redirect_uri'),
  });

  const response = await fetch(`${authBaseUrl}/oauth2/token`, {
    body: params.toString(),
    headers,
    method: 'POST',
  });

  if (!response.ok) {
    const details = await response.text();
    qfAuthDebug('token exchange failed', {
      details,
      status: response.status,
      wwwAuthenticate: response.headers.get('www-authenticate'),
    });
    throw new Error(`Quran Foundation token exchange failed: ${response.status} ${details}`);
  }

  qfAuthDebug('token exchange succeeded', {
    status: response.status,
  });

  return (await response.json()) as QfTokenResponse;
}

function buildSessionFromTokenResponse(
  tokenResponse: QfTokenResponse,
  nonce?: string,
): QfSessionCookie {
  const payload = parseJwtPayload(tokenResponse.id_token);

  if (nonce && payload?.nonce !== nonce) {
    throw new Error('Quran Foundation ID token nonce validation failed.');
  }

  return {
    accessToken: tokenResponse.access_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    refreshToken: tokenResponse.refresh_token,
    user: {
      sub: typeof payload?.sub === 'string' ? payload.sub : undefined,
    },
  };
}

async function refreshSession(session: QfSessionCookie) {
  if (!session.refreshToken) {
    throw new Error('User session does not include a refresh token.');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
  });

  let tokenResponse: QfTokenResponse;

  try {
    tokenResponse = await exchangeToken(params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('invalid_grant')) {
      await clearSession();
      throw new Error('Your Quran Foundation connection expired. Please reconnect.');
    }

    throw error;
  }

  const refreshedSession = buildSessionFromTokenResponse(tokenResponse);

  return {
    ...session,
    accessToken: refreshedSession.accessToken,
    expiresAt: refreshedSession.expiresAt,
    refreshToken: refreshedSession.refreshToken ?? session.refreshToken,
    user: {
      ...session.user,
      ...refreshedSession.user,
    },
  };
}

async function qfApiFetch(
  session: QfSessionCookie,
  path: string,
  init?: RequestInit,
): Promise<{ response: Response; session: QfSessionCookie }> {
  const { apiBaseUrl, clientId } = getQfConfig();
  let activeSession = session;

  if (activeSession.expiresAt <= Date.now() + 30_000 && activeSession.refreshToken) {
    activeSession = await refreshSession(activeSession);
  }

  const execute = async (token: string) =>
    fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        'x-auth-token': token,
        'x-client-id': clientId,
      },
    });

  let response = await execute(activeSession.accessToken);

  if ((response.status === 401 || response.status === 403) && activeSession.refreshToken) {
    activeSession = await refreshSession(activeSession);
    response = await execute(activeSession.accessToken);
  }

  return { response, session: activeSession };
}

async function readApiResponse<T>(response: Response) {
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Quran Foundation API request failed: ${response.status} ${details}`);
  }

  return (await response.json()) as T;
}

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

function pickPreferredVerseCollection(collections: QfCollection[]) {
  return collections
    .filter((collection) => collection.name === QF_BOOKMARK_COLLECTION_NAME)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];
}

async function getExistingVerseCollection(session: QfSessionCookie) {
  const { collections, session: listedSession } = await listAyahCollections(session);
  const existingCollection = pickPreferredVerseCollection(collections);

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

function parseAyahSelection(ayahNo: string) {
  const match = /^(\d+)(?:-(\d+))?$/u.exec(ayahNo.trim());

  if (!match) {
    return null;
  }

  const from = Number.parseInt(match[1], 10);
  const to = match[2] ? Number.parseInt(match[2], 10) : from;

  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return null;
  }

  return { from, to };
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

    if (isQfAuthDebugEnabled()) {
      const dataRecord =
        payload.data && typeof payload.data === 'object'
          ? (payload.data as Record<string, unknown>)
          : null;
      const rawBookmarks = Array.isArray(dataRecord?.bookmarks)
        ? (dataRecord?.bookmarks as unknown[])
        : [];
      qfAuthDebug('list collection bookmarks payload', {
        collectionId,
        dataKeys: dataRecord ? Object.keys(dataRecord) : null,
        pageBookmarkCount: rawBookmarks.length,
        sampleBookmark: rawBookmarks[0] ?? null,
      });
    }

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

export async function buildLoginRedirect(requestUrl: string, returnTo: string | null) {
  const { authBaseUrl, clientId, scopes } = getQfConfig();
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = buildCodeChallenge(codeVerifier);
  const state = randomBase64Url(16);
  const nonce = randomBase64Url(16);
  const redirectUri = getRedirectUri(requestUrl);
  const params = new URLSearchParams({
    client_id: clientId,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    nonce,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    state,
  });
  const response = NextResponse.redirect(`${authBaseUrl}/oauth2/auth?${params.toString()}`);

  qfAuthDebug('starting login redirect', {
    authBaseUrl,
    clientId: maskIdentifier(clientId),
    redirectUri,
    returnTo: sanitizeReturnTo(returnTo),
    scopes,
  });

  setEncryptedCookie(
    response,
    AUTH_FLOW_COOKIE_NAME,
    {
      codeVerifier,
      createdAt: Date.now(),
      nonce,
      redirectUri,
      returnTo: sanitizeReturnTo(returnTo),
      state,
    },
    AUTH_FLOW_MAX_AGE_SECONDS,
  );

  return response;
}

export async function handleAuthCallback(
  requestUrl: string,
  code: string | null,
  state: string | null,
) {
  const cookieStore = await cookies();
  const pendingFlow = unsealCookieValue<PendingAuthFlow>(
    cookieStore.get(AUTH_FLOW_COOKIE_NAME)?.value,
  );

  qfAuthDebug('received auth callback', {
    hasCode: Boolean(code),
    hasPendingFlow: Boolean(pendingFlow),
    pendingRedirectUri: pendingFlow?.redirectUri,
    stateMatches: Boolean(pendingFlow && state && pendingFlow.state === state),
  });

  if (!pendingFlow || !code || !state || pendingFlow.state !== state) {
    qfAuthDebug('callback validation failed', {
      hasCode: Boolean(code),
      hasPendingFlow: Boolean(pendingFlow),
      hasState: Boolean(state),
      pendingRedirectUri: pendingFlow?.redirectUri,
      stateMatches: Boolean(pendingFlow && state && pendingFlow.state === state),
    });
    return NextResponse.redirect(new URL('/?auth=failed', requestUrl));
  }

  const params = new URLSearchParams({
    code,
    code_verifier: pendingFlow.codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: pendingFlow.redirectUri,
  });
  const tokenResponse = await exchangeToken(params);
  const session = buildSessionFromTokenResponse(tokenResponse, pendingFlow.nonce);
  const redirectUrl = new URL(pendingFlow.returnTo || '/', requestUrl);
  redirectUrl.searchParams.set('auth', 'connected');

  const response = NextResponse.redirect(redirectUrl);

  qfAuthDebug('auth callback completed', {
    redirectTo: redirectUrl.toString(),
    userSub: session.user.sub ? maskIdentifier(session.user.sub) : '(missing)',
  });

  const sessionId = await createSession({
    quranFoundationId: session.user.sub,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
  });

  console.log(
    `[qf-auth] Retrieved sessionId ${sessionId} from createSession. Proceeding to set on response.`,
  );

  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_EXPIRATION_SECONDS,
    path: '/',
  });

  console.log(
    `[qf-auth] Set cookie on NextResponse. Headers dump:`,
    Array.from(response.headers.entries()),
  );

  clearCookie(response, AUTH_FLOW_COOKIE_NAME);

  return response;
}

export async function logoutQfUser(requestUrl: string) {
  const response = NextResponse.redirect(new URL('/', requestUrl));

  await clearSession();
  clearCookie(response, AUTH_FLOW_COOKIE_NAME);
  clearCookie(response, SESSION_COOKIE_NAME);

  return response;
}

export async function getQfUserSession(): Promise<QfSessionCookie | null> {
  const redisSession = await getSession();

  qfAuthDebug('reading user session from redis', {
    hasSessionData: Boolean(redisSession),
    sessionResolved: Boolean(redisSession),
  });

  if (!redisSession) {
    return null;
  }

  // Restore backwards-compatible shape for existing functions
  return {
    accessToken: redisSession.data.accessToken as string,
    expiresAt: redisSession.data.expiresAt as number,
    refreshToken: redisSession.data.refreshToken as string | undefined,
    user: {
      sub: redisSession.data.quranFoundationId as string | undefined,
    },
  };
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
    const { response } = await qfApiFetch(session, '/auth/v1/profile');
    const payload = await readApiResponse<Record<string, unknown>>(response);
    const profileRecord =
      payload.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>)
        : payload;
    const profile = profileRecord as QfProfile;
    const displayName = [profile.firstName, profile.lastName]
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .join(' ')
      .trim();
    const avatarUrl =
      profile.avatarUrls?.medium ?? profile.avatarUrls?.small ?? profile.avatarUrls?.large ?? null;

    return {
      avatarUrl,
      collectionName: QF_BOOKMARK_COLLECTION_NAME,
      displayName: displayName || profile.username || null,
      isAuthenticated: true,
    };
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

  const idsByVerseNumber: Record<number, string> = {};

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

    if (bookmark.type !== 'ayah') {
      continue;
    }

    if (bookmark.key !== surahNo) {
      continue;
    }

    if (!bookmark.verseNumber) {
      continue;
    }

    if (bookmark.verseNumber < selection.from || bookmark.verseNumber > selection.to) {
      continue;
    }

    idsByVerseNumber[bookmark.verseNumber] = bookmark.id;
  }

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

export type QfNoteAttachedEntity = {
  entityId: string;
  entityMetadata?: Record<string, unknown>;
  entityType: 'reflection';
};

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

export async function persistQfUserSession(response: NextResponse, session: QfSessionCookie) {
  const sessionId = await createSession({
    quranFoundationId: session.user.sub,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
  });

  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_EXPIRATION_SECONDS,
    path: '/',
  });
}
