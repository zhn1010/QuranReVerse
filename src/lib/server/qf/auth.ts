import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const AUTH_FLOW_COOKIE_NAME = 'qf_oauth_flow';
export const AUTH_FLOW_MAX_AGE_SECONDS = 60 * 15;
export const USER_SESSION_COOKIE_NAME = 'qf_user_session';

type JwtScopePayload = {
  scope?: string;
  scp?: string | string[];
};

export type PendingAuthFlow = {
  codeVerifier: string;
  createdAt: number;
  nonce: string;
  redirectUri: string;
  returnTo: string;
  state: string;
};

export type QfCachedCollection = {
  id: string;
  name: string;
  updatedAt: string;
};

export type QfSessionCookie = {
  accessToken: string;
  bookmarkCollection?: QfCachedCollection;
  expiresAt: number;
  refreshToken?: string;
  user: {
    sub?: string;
  };
};

export type QfTokenResponse = {
  access_token: string;
  expires_in: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

export function extractTokenScopes(tokenResponse: QfTokenResponse) {
  const accessTokenPayload = parseJwtPayload(tokenResponse.access_token) as JwtScopePayload | null;
  const rawClaim = accessTokenPayload?.scope ?? accessTokenPayload?.scp;
  const accessTokenScope = Array.isArray(rawClaim)
    ? rawClaim.join(' ')
    : typeof rawClaim === 'string'
      ? rawClaim
      : null;

  return {
    accessTokenScope,
    responseScope: tokenResponse.scope ?? null,
  };
}

export function randomBase64Url(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function buildCodeChallenge(codeVerifier: string) {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

export function parseJwtPayload(token: string | undefined) {
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

export function sanitizeReturnTo(value: string | null) {
  if (value && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }

  return '/';
}

export function getRedirectUri(
  requestUrl: string,
  configuredRedirect = process.env.QF_USER_REDIRECT_URI,
) {
  const requestOriginRedirect = new URL('/api/qf/auth/callback', requestUrl).toString();
  const normalizedConfiguredRedirect = configuredRedirect?.trim();

  if (!normalizedConfiguredRedirect) {
    return requestOriginRedirect;
  }

  try {
    const configuredUrl = new URL(normalizedConfiguredRedirect);
    const requestOrigin = new URL(requestUrl).origin;

    if (configuredUrl.origin !== requestOrigin) {
      return requestOriginRedirect;
    }

    return configuredUrl.toString();
  } catch {
    return requestOriginRedirect;
  }
}

export function getSessionSecret() {
  const secret = process.env.QF_SESSION_SECRET;

  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'Missing required environment variable: QF_SESSION_SECRET (minimum 32 characters)',
    );
  }

  return createHash('sha256').update(secret).digest();
}

export function sealCookieValue(payload: PendingAuthFlow | QfSessionCookie) {
  const key = getSessionSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function unsealCookieValue<T>(value: string | undefined): T | null {
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

export function buildSessionFromTokenResponse(
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
