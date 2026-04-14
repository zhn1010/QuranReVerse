import { Redis } from '@upstash/redis';
import { cookies } from 'next/headers';

// Initialize the Redis client using the Vercel KV environment variables
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export const SESSION_COOKIE_NAME = 'reverse_session_id';
export const SESSION_EXPIRATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Define the shape of your session data
export type SessionData = {
  // Add required fields as you need them
  userId?: string;
  quranFoundationId?: string;
  role?: string;
  [key: string]: any;
};

/**
 * Creates a new session or updates an existing one,
 * saves data to Redis, and sets the signed cookie.
 */
export async function createSession(data: SessionData, existingSessionId?: string) {
  // Use crypto.randomUUID for built-in secure ID generation
  const sessionId = existingSessionId || crypto.randomUUID();

  // Store the session data in Redis using the sessionId as the key.
  // We use `ex` to automatically expire the Redis key when the session expires.
  console.log(`[session] Attempting to store session in Redis: session:${sessionId}`);
  try {
    await redis.set(`session:${sessionId}`, data, {
      ex: SESSION_EXPIRATION_SECONDS,
    });
    console.log(`[session] Successfully stored session in Redis.`);
  } catch (err) {
    console.error(`[session] Failed to store session in Redis:`, err);
  }

  // Set the cookie containing ONLY the session ID
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_EXPIRATION_SECONDS,
      path: '/',
    });
    console.log(`[session] successfully called cookies() API to set ${SESSION_COOKIE_NAME}`);
  } catch (err) {
    console.error(`[session] Failed to use cookies().set:`, err);
  }

  return sessionId;
}

/**
 * Reads the session cookie, fetches the data from Redis, and returns it.
 */
export async function getSession(): Promise<{ id: string; data: SessionData } | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  // Fetch the session data from Redis
  const sessionData = await redis.get<SessionData>(`session:${sessionId}`);

  if (!sessionData) {
    return null;
  }

  return { id: sessionId, data: sessionData };
}

/**
 * Retrieves the session ID without fetching the data payload from Redis.
 */
export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

/**
 * Updates an existing session in Redis without invalidating the cookie.
 */
export async function updateSession(data: Partial<SessionData>) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  // Retrieve current data to merge updates
  const currentData = await redis.get<SessionData>(`session:${sessionId}`);
  
  if (!currentData) {
    return null;
  }

  const updatedData = {
    ...currentData,
    ...data,
  };

  await redis.set(`session:${sessionId}`, updatedData, {
    ex: SESSION_EXPIRATION_SECONDS,
  });

  return updatedData;
}

/**
 * Deletes the session from Redis and clears the cookie.
 */
export async function clearSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    // Delete the data from Redis
    await redis.del(`session:${sessionId}`);
  }

  // Clear the cookie
  cookieStore.delete(SESSION_COOKIE_NAME);
}
