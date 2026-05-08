import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

function createJsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

describe('getRelatedReflectionsForAyah', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    process.env.QURAN_CLIENT_ID = 'test-client-id';
    process.env.QURAN_CLIENT_SECRET = 'test-client-secret';
    process.env.QURAN_REFLECT_REQUEST_TIMEOUT_MS = '50';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.QURAN_CLIENT_ID;
    delete process.env.QURAN_CLIENT_SECRET;
    delete process.env.QURAN_REFLECT_REQUEST_TIMEOUT_MS;
  });

  it('times out the feed request instead of waiting indefinitely', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);

      if (url.includes('/oauth2/token')) {
        return createJsonResponse({
          access_token: 'token',
          expires_in: 300,
        });
      }

      return await new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { getRelatedReflectionsForAyah } = await import('@/lib/quran-reflect');
    const resultPromise = getRelatedReflectionsForAyah(2, '255');
    const rejectionExpectation = expect(resultPromise).rejects.toThrow(
      'Quran Reflect feed request timed out after 50ms',
    );

    await vi.advanceTimersByTimeAsync(60);

    await rejectionExpectation;
  });
});
