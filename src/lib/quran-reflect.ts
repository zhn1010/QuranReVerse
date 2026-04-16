import { unstable_cache } from 'next/cache';

const QURAN_REFLECT_AUTH_BASE_URL = 'https://oauth2.quran.foundation';
const QURAN_REFLECT_API_BASE_URL = 'https://apis.quran.foundation';
const ENGLISH_LANGUAGE_ID = 2;
const REFLECTION_POST_TYPE_ID = 1;
const RELATED_REFLECTION_LIMIT = 10;
const RELATED_REFLECTION_TAB = 'popular';
const VERIFIED_ONLY = true;
const REFLECTION_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

type QuranReflectTokenCache = {
  expiresAt: number;
  key: string;
  value: string;
};

export type RelatedReflection = {
  authorName: string;
  body: string;
  commentsCount: number;
  createdAt: string | null;
  id: number;
  languageName: string | null;
  likesCount: number;
  postTypeName: string | null;
  references: ReflectionReference[];
};

export type ReflectionReference = {
  chapterId: number;
  from: number;
  id: string;
  to: number;
};

let tokenCache: QuranReflectTokenCache | null = null;

function getRequiredEnv(
  primaryName: string,
  fallbackName?: 'QURAN_CLIENT_ID' | 'QURAN_CLIENT_SECRET',
) {
  const primaryValue = process.env[primaryName];

  if (primaryValue) {
    return primaryValue;
  }

  if (fallbackName) {
    const fallbackValue = process.env[fallbackName];

    if (fallbackValue) {
      return fallbackValue;
    }
  }

  throw new Error(
    fallbackName
      ? `Missing required environment variable: ${primaryName} (or fallback ${fallbackName})`
      : `Missing required environment variable: ${primaryName}`,
  );
}

function getQuranReflectConfig() {
  return {
    apiBaseUrl: process.env.QURAN_API_BASE_URL ?? QURAN_REFLECT_API_BASE_URL,
    authBaseUrl: process.env.QURAN_ENDPOINT ?? QURAN_REFLECT_AUTH_BASE_URL,
    clientId: getRequiredEnv('QURAN_CLIENT_ID'),
    clientSecret: getRequiredEnv('QURAN_CLIENT_SECRET'),
  };
}

async function getAccessToken() {
  const { authBaseUrl, clientId, clientSecret } = getQuranReflectConfig();
  const tokenCacheKey = `${authBaseUrl}:${clientId}`;

  if (
    tokenCache &&
    tokenCache.key === tokenCacheKey &&
    tokenCache.expiresAt > Date.now() + 30_000
  ) {
    return tokenCache.value;
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'post.read',
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
      `Quran Reflect token request failed: ${response.status} ${response.statusText} ${details}`,
    );
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new Error('Quran Reflect token response did not include access_token.');
  }

  tokenCache = {
    expiresAt: Date.now() + (payload.expires_in ?? 300) * 1000,
    key: tokenCacheKey,
    value: payload.access_token,
  };

  return tokenCache.value;
}

function buildFeedUrl(surahNo: number, from: number, to: number, limit: number) {
  const { apiBaseUrl } = getQuranReflectConfig();
  const url = new URL('/quran-reflect/v1/posts/feed', apiBaseUrl);

  url.searchParams.set('tab', RELATED_REFLECTION_TAB);
  url.searchParams.set('page', '1');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('languages', String(ENGLISH_LANGUAGE_ID));
  url.searchParams.set('filter[postTypeIds]', String(REFLECTION_POST_TYPE_ID));
  url.searchParams.set('filter[verifiedOnly]', String(VERIFIED_ONLY));
  url.searchParams.set('filter[references][0][chapterId]', String(surahNo));
  url.searchParams.set('filter[references][0][from]', String(from));
  url.searchParams.set('filter[references][0][to]', String(to));

  return url;
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

function getAuthorName(post: {
  author?: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  };
}) {
  const displayName = post.author?.displayName?.trim();

  if (displayName) {
    return displayName;
  }

  const fullName = [post.author?.firstName, post.author?.lastName]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();

  if (fullName) {
    return fullName;
  }

  return post.author?.username?.trim() || 'Unknown author';
}

async function fetchRelatedReflectionsForAyah(
  surahNo: number,
  ayahNo: string,
  limit = RELATED_REFLECTION_LIMIT,
): Promise<RelatedReflection[]> {
  const selection = parseAyahSelection(ayahNo);

  if (!selection) {
    return [];
  }

  const { clientId } = getQuranReflectConfig();
  const token = await getAccessToken();
  const response = await fetch(buildFeedUrl(surahNo, selection.from, selection.to, limit), {
    headers: {
      Accept: 'application/json',
      'x-auth-token': token,
      'x-client-id': clientId,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Quran Reflect feed request failed: ${response.status} ${response.statusText} ${details}`,
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{
      author?: {
        displayName?: string;
        firstName?: string;
        lastName?: string;
        username?: string;
      };
      body?: string;
      commentsCount?: number;
      createdAt?: string;
      id: number;
      languageName?: string;
      likesCount?: number;
      postTypeName?: string;
      references?: Array<{
        chapterId?: number;
        from?: number;
        id?: string;
        to?: number;
      }>;
    }>;
  };

  return (payload.data ?? []).slice(0, limit).map((post) => ({
    authorName: getAuthorName(post),
    body: post.body ?? '',
    commentsCount: post.commentsCount ?? 0,
    createdAt: post.createdAt ?? null,
    id: post.id,
    languageName: post.languageName ?? null,
    likesCount: post.likesCount ?? 0,
    postTypeName: post.postTypeName ?? null,
    references: (post.references ?? [])
      .filter(
        (reference) =>
          Number.isInteger(reference.chapterId) &&
          typeof reference.id === 'string' &&
          Number.isInteger(reference.from) &&
          Number.isInteger(reference.to),
      )
      .map((reference) => ({
        chapterId: reference.chapterId ?? 0,
        from: reference.from ?? 0,
        id: reference.id ?? '',
        to: reference.to ?? 0,
      })),
  }));
}

const getCachedRelatedReflectionsForAyah = unstable_cache(
  fetchRelatedReflectionsForAyah,
  ['quran-reflect-related-reflections'],
  {
    revalidate: REFLECTION_CACHE_TTL_SECONDS,
    tags: ['quran-reflect-related-reflections'],
  },
);

export async function getRelatedReflectionsForAyah(
  surahNo: number,
  ayahNo: string,
  limit = RELATED_REFLECTION_LIMIT,
) {
  return getCachedRelatedReflectionsForAyah(surahNo, ayahNo, limit);
}
