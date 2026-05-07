import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  clearSession,
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRATION_SECONDS,
} from '@/lib/session';
import {
  AUTH_FLOW_COOKIE_NAME,
  AUTH_FLOW_MAX_AGE_SECONDS,
  buildCodeChallenge,
  buildSessionFromTokenResponse,
  getRedirectUri,
  PendingAuthFlow,
  QfSessionCookie,
  randomBase64Url,
  sanitizeReturnTo,
  sealCookieValue,
  unsealCookieValue,
  USER_SESSION_COOKIE_NAME,
} from '@/lib/qf/auth';
import { getQfConfig, maskIdentifier, qfAuthDebug } from '@/lib/qf/config';
import { exchangeToken } from '@/lib/qf/client';

function getUtf8ByteLength(value: string) {
  return Buffer.byteLength(value, 'utf8');
}

function estimateCookieHeaderSize(name: string, value: string) {
  const attributes = '; Path=/; HttpOnly; SameSite=Lax; Secure';
  return getUtf8ByteLength(`${name}=${value}${attributes}`);
}

function logCookiePayloadDiagnostics(
  name: string,
  payload: PendingAuthFlow | QfSessionCookie,
  sealedValue: string,
) {
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

export async function buildLoginRedirect(requestUrl: string, returnTo: string | null) {
  const { authBaseUrl, clientId, scopes } = getQfConfig();
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = buildCodeChallenge(codeVerifier);
  const state = randomBase64Url(16);
  const nonce = randomBase64Url(16);
  const redirectUri = getRedirectUri(requestUrl);
  const normalizedReturnTo = sanitizeReturnTo(returnTo);
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
    returnTo: normalizedReturnTo,
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
      returnTo: normalizedReturnTo,
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
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    quranFoundationId: session.user.sub,
    refreshToken: session.refreshToken,
  });

  console.log(
    `[qf-auth] Retrieved sessionId ${sessionId} from createSession. Proceeding to set on response.`,
  );

  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    maxAge: SESSION_EXPIRATION_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
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
