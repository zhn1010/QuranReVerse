const QF_PRELIVE_AUTH_BASE_URL = 'https://prelive-oauth2.quran.foundation';
const QF_PRELIVE_API_BASE_URL = 'https://apis-prelive.quran.foundation';
const QF_PRODUCTION_AUTH_BASE_URL = 'https://oauth2.quran.foundation';
const QF_PRODUCTION_API_BASE_URL = 'https://apis.quran.foundation';
const DEFAULT_QF_SCOPES = ['openid', 'offline_access', 'user', 'collection', 'bookmark', 'note'];

export type QfConfig = {
  apiBaseUrl: string;
  authBaseUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
};

export function maskIdentifier(value: string | undefined) {
  if (!value) {
    return '(missing)';
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function isQfAuthDebugEnabled() {
  return process.env.QF_AUTH_DEBUG === 'true';
}

export function qfAuthDebug(message: string, details?: Record<string, unknown>) {
  if (!isQfAuthDebugEnabled()) {
    return;
  }

  console.log('[qf-auth]', message, details ?? {});
}

export function getQfConfig(): QfConfig {
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
