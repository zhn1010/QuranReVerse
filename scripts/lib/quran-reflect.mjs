import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Language, QuranClient } from '@quranjs/api';

export const DEFAULT_AUTH_BASE_URL = 'https://oauth2.quran.foundation';
export const DEFAULT_API_BASE_URL = 'https://apis.quran.foundation';
export const REFLECTION_POST_TYPE_ID = 1;
export const DEFAULT_QURAN_REFLECT_TAB = 'popular';
export const DEFAULT_QURAN_REFLECT_LANGUAGES = [2];

export function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getQuranFoundationConfig() {
  return {
    clientId: getRequiredEnv('QURAN_CLIENT_ID'),
    clientSecret: getRequiredEnv('QURAN_CLIENT_SECRET'),
    authBaseUrl: process.env.QURAN_ENDPOINT ?? DEFAULT_AUTH_BASE_URL,
    apiBaseUrl: process.env.QURAN_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  };
}

function parseIntegerList(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0);
}

export function getQuranReflectDefaultFeedOptions() {
  const configuredLanguages = parseIntegerList(process.env.QURAN_REFLECT_DEFAULT_LANGUAGES);

  return {
    languages:
      configuredLanguages.length > 0 ? configuredLanguages : DEFAULT_QURAN_REFLECT_LANGUAGES,
    postTypeIds: parseIntegerList(process.env.QURAN_REFLECT_DEFAULT_POST_TYPE_IDS),
    tab: process.env.QURAN_REFLECT_DEFAULT_TAB ?? DEFAULT_QURAN_REFLECT_TAB,
  };
}

export function parseOptionalIntegerList(value, optionName) {
  const parsed = parseIntegerList(value);

  if (!value || parsed.length > 0) {
    return parsed;
  }

  throw new Error(`Invalid ${optionName} value: ${value}`);
}

export async function getAccessToken({ authBaseUrl, clientId, clientSecret, scope }) {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope,
  });

  const response = await fetch(`${authBaseUrl}/oauth2/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Token request failed with ${response.status} ${response.statusText}. ${details}`.trim(),
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('Token response did not include access_token.');
  }

  return data.access_token;
}

export function buildFeedUrl({
  apiBaseUrl,
  chapterId,
  from,
  languages,
  limit,
  page,
  postTypeIds,
  tab = 'public',
  to,
  verifiedOnly,
}) {
  const url = new URL('/quran-reflect/v1/posts/feed', apiBaseUrl);

  url.searchParams.set('tab', tab);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('filter[references][0][chapterId]', String(chapterId));
  url.searchParams.set('filter[references][0][from]', String(from));
  url.searchParams.set('filter[references][0][to]', String(to));

  if (Array.isArray(languages) && languages.length > 0) {
    url.searchParams.set('languages', languages.join(','));
  }

  if (Array.isArray(postTypeIds) && postTypeIds.length > 0) {
    url.searchParams.set('filter[postTypeIds]', postTypeIds.join(','));
  }

  if (verifiedOnly) {
    url.searchParams.set('filter[verifiedOnly]', 'true');
  }

  return url;
}

export async function fetchReflectionFeedPage({
  apiBaseUrl,
  chapterId,
  clientId,
  from,
  languages,
  limit = 20,
  page = 1,
  postTypeIds,
  tab = 'public',
  to,
  token,
  verifiedOnly,
}) {
  const url = buildFeedUrl({
    apiBaseUrl,
    chapterId,
    from,
    languages,
    limit,
    page,
    postTypeIds,
    tab,
    to,
    verifiedOnly,
  });

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-auth-token': token,
      'x-client-id': clientId,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Feed request failed for ${chapterId}:${from}-${to} on page ${page} with ${response.status} ${response.statusText}. ${details}`.trim(),
    );
  }

  return response.json();
}

export async function fetchReflectionCountForAyah({
  apiBaseUrl,
  ayah,
  chapterId,
  clientId,
  languages,
  limit = 1,
  postTypeIds = [REFLECTION_POST_TYPE_ID],
  tab = 'public',
  token,
  verifiedOnly,
}) {
  const payload = await fetchReflectionFeedPage({
    apiBaseUrl,
    chapterId,
    clientId,
    from: ayah,
    languages,
    limit,
    page: 1,
    postTypeIds,
    tab,
    to: ayah,
    token,
    verifiedOnly,
  });

  return Number(payload.total ?? 0);
}

export async function fetchChapters({ authBaseUrl, clientId, clientSecret }) {
  const client = new QuranClient({
    authBaseUrl,
    clientId,
    clientSecret,
    defaults: {
      language: Language.ENGLISH,
    },
  });

  return client.chapters.findAll();
}
