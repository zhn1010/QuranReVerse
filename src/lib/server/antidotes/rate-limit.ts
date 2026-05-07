import { Redis } from '@upstash/redis';
import { getSession } from '@/lib/server/session/store';

const redis = new Redis({
  token: process.env.KV_REST_API_TOKEN!,
  url: process.env.KV_REST_API_URL!,
});

function readDailyLimitFromEnv(key: string, fallback: number) {
  const raw = process.env[key]?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

const ANONYMOUS_DAILY_LIMIT = readDailyLimitFromEnv('ANONYMOUS_DAILY_LIMIT', 4);
const AUTHENTICATED_DAILY_LIMIT = readDailyLimitFromEnv('AUTHENTICATED_DAILY_LIMIT', 10);

export async function checkAntidoteRateLimit(
  request: Request,
): Promise<{ allowed: true } | { allowed: false; reason: string; limit: number }> {
  const session = await getSession();
  const isAuthenticated = Boolean(session?.data?.quranFoundationId);
  const userId = session?.data?.quranFoundationId;
  const today = new Date().toISOString().split('T')[0];

  if (isAuthenticated && userId) {
    if (AUTHENTICATED_DAILY_LIMIT < 0) {
      return { allowed: true };
    }

    const key = `rate_limit:user:${userId}:${today}`;
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, 60 * 60 * 24);
    }

    if (current > AUTHENTICATED_DAILY_LIMIT) {
      return {
        allowed: false,
        limit: AUTHENTICATED_DAILY_LIMIT,
        reason: `You have reached your daily limit of ${AUTHENTICATED_DAILY_LIMIT} reflections. Please try again tomorrow.`,
      };
    }
  } else {
    if (ANONYMOUS_DAILY_LIMIT < 0) {
      return { allowed: true };
    }

    const fingerprint =
      request.headers.get('x-browser-fingerprint') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const key = `rate_limit:fingerprint:${fingerprint}:${today}`;
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, 60 * 60 * 24);
    }

    if (current > ANONYMOUS_DAILY_LIMIT) {
      return {
        allowed: false,
        limit: ANONYMOUS_DAILY_LIMIT,
        reason: `You have reached your daily limit of ${ANONYMOUS_DAILY_LIMIT} reflections. Sign in with Quran Foundation for ${AUTHENTICATED_DAILY_LIMIT} reflections per day.`,
      };
    }
  }

  return { allowed: true };
}
