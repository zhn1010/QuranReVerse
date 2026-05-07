import { clearSession } from '@/lib/server/session/store';
import {
  buildSessionFromTokenResponse,
  extractTokenScopes,
  randomBase64Url,
  type QfSessionCookie,
  type QfTokenResponse,
} from '@/lib/server/qf/auth';
import { getQfConfig, isQfAuthDebugEnabled, qfAuthDebug } from '@/lib/server/qf/config';

const DEFAULT_QF_FETCH_TIMEOUT_MS = 15_000;

function getQfFetchTimeoutMs() {
  const rawValue = process.env.QF_FETCH_TIMEOUT_MS?.trim();
  const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return DEFAULT_QF_FETCH_TIMEOUT_MS;
}

function buildAbortError(message: string) {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function isAbortLikeError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function createMergedAbortSignal(timeoutMs: number, upstreamSignal?: AbortSignal) {
  const controller = new AbortController();
  let didTimeout = false;

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort(buildAbortError(`Timed out after ${timeoutMs}ms.`));
  }, timeoutMs);

  const handleUpstreamAbort = () => {
    controller.abort(
      upstreamSignal?.reason instanceof Error
        ? upstreamSignal.reason
        : buildAbortError('The upstream signal aborted the request.'),
    );
  };

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      handleUpstreamAbort();
    } else {
      upstreamSignal.addEventListener('abort', handleUpstreamAbort, { once: true });
    }
  }

  return {
    didTimeout: () => didTimeout,
    dispose() {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener('abort', handleUpstreamAbort);
    },
    signal: controller.signal,
  };
}

async function fetchWithQfTimeout(
  url: string,
  init: RequestInit | undefined,
  fetchImpl: typeof fetch,
  metadata: {
    logLabel: string;
    logMetadata: Record<string, unknown>;
  },
) {
  const requestId = randomBase64Url(6);
  const timeoutMs = getQfFetchTimeoutMs();
  const startedAt = Date.now();
  const timeoutController = createMergedAbortSignal(timeoutMs, init?.signal ?? undefined);
  const requestInit = {
    ...init,
    signal: timeoutController.signal,
  } satisfies RequestInit;

  qfAuthDebug(`${metadata.logLabel} starting`, {
    ...metadata.logMetadata,
    requestId,
    timeoutMs,
    url,
  });

  try {
    const response = await fetchImpl(url, requestInit);

    qfAuthDebug(`${metadata.logLabel} completed`, {
      ...metadata.logMetadata,
      durationMs: Date.now() - startedAt,
      ok: response.ok,
      requestId,
      status: response.status,
      timeoutMs,
      url: response.url || url,
    });

    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (timeoutController.didTimeout()) {
      qfAuthDebug(`${metadata.logLabel} timed out`, {
        ...metadata.logMetadata,
        durationMs,
        requestId,
        timeoutMs,
        url,
      });
      throw new Error(`Quran Foundation request timed out after ${timeoutMs}ms: ${url}`);
    }

    qfAuthDebug(`${metadata.logLabel} failed`, {
      ...metadata.logMetadata,
      durationMs,
      isAbortError: isAbortLikeError(error),
      message: error instanceof Error ? error.message : String(error),
      requestId,
      timeoutMs,
      url,
    });

    throw error;
  } finally {
    timeoutController.dispose();
  }
}

export async function exchangeToken(params: URLSearchParams, fetchImpl: typeof fetch = fetch) {
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

  const response = await fetchWithQfTimeout(
    `${authBaseUrl}/oauth2/token`,
    {
      body: params.toString(),
      headers,
      method: 'POST',
    },
    fetchImpl,
    {
      logLabel: 'qf token exchange request',
      logMetadata: {
        grantType: params.get('grant_type'),
      },
    },
  );

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
    ...extractTokenScopes(await response.clone().json()),
    status: response.status,
  });

  return (await response.json()) as QfTokenResponse;
}

export async function refreshSession(session: QfSessionCookie, fetchImpl: typeof fetch = fetch) {
  if (!session.refreshToken) {
    throw new Error('User session does not include a refresh token.');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
  });

  let tokenResponse: QfTokenResponse;

  try {
    tokenResponse = await exchangeToken(params, fetchImpl);
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

export async function qfApiFetch(
  session: QfSessionCookie,
  path: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch,
): Promise<{ response: Response; session: QfSessionCookie }> {
  const { apiBaseUrl, clientId } = getQfConfig();
  let activeSession = session;

  qfAuthDebug('qf api request starting', {
    hasRefreshToken: Boolean(activeSession.refreshToken),
    hasSessionUserSub: Boolean(activeSession.user.sub),
    method: init?.method ?? 'GET',
    path,
    tokenExpiresInMs: activeSession.expiresAt - Date.now(),
  });

  if (activeSession.expiresAt <= Date.now() + 30_000 && activeSession.refreshToken) {
    activeSession = await refreshSession(activeSession, fetchImpl);
    qfAuthDebug('qf api request session refreshed before request', {
      path,
      tokenExpiresInMs: activeSession.expiresAt - Date.now(),
    });
  }

  const execute = async (token: string, attempt: 'initial' | 'retry') =>
    fetchWithQfTimeout(
      `${apiBaseUrl}${path}`,
      {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          'x-auth-token': token,
          'x-client-id': clientId,
        },
      },
      fetchImpl,
      {
        logLabel: 'qf api fetch',
        logMetadata: {
          attempt,
          method: init?.method ?? 'GET',
          path,
        },
      },
    );

  let response = await execute(activeSession.accessToken, 'initial');

  const shouldInspect403Body = response.status === 403 && activeSession.refreshToken;
  const firstResponseBodyPreview = shouldInspect403Body
    ? await response
        .clone()
        .text()
        .then((text) => text.slice(0, 700))
        .catch(() => '')
    : '';
  const isInsufficientScope = firstResponseBodyPreview.includes('insufficient_scope');

  if (shouldInspect403Body) {
    qfAuthDebug('qf api 403 diagnostic', {
      bodyPreview: firstResponseBodyPreview,
      isInsufficientScope,
      path,
    });
  }

  if ((response.status === 401 || response.status === 403) && activeSession.refreshToken) {
    if (response.status === 403 && isInsufficientScope) {
      qfAuthDebug('qf api request forbidden due to scope; skipping refresh retry', {
        path,
      });
      return { response, session: activeSession };
    }

    qfAuthDebug('qf api request unauthorized; retrying with refreshed token', {
      path,
      status: response.status,
    });
    activeSession = await refreshSession(activeSession, fetchImpl);
    response = await execute(activeSession.accessToken, 'retry');
    qfAuthDebug('qf api request retry completed', {
      ok: response.ok,
      path,
      status: response.status,
      url: response.url,
    });
  }

  return { response, session: activeSession };
}

export async function readApiResponse<T>(response: Response) {
  if (!response.ok) {
    const details = await response.text();
    qfAuthDebug('qf api response not ok', {
      bodyPreview: details.slice(0, 700),
      status: response.status,
      url: response.url,
      wwwAuthenticate: response.headers.get('www-authenticate'),
    });
    throw new Error(`Quran Foundation API request failed: ${response.status} ${details}`);
  }

  return (await response.json()) as T;
}

export function logBookmarkPayloadDebug(
  collectionId: string,
  payload: {
    data?: {
      bookmarks?: unknown[];
    };
  },
) {
  if (!isQfAuthDebugEnabled()) {
    return;
  }

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
