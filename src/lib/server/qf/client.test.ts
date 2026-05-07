import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/server/session/store', () => ({
  clearSession: vi.fn(),
}));

import { qfApiFetch } from '@/lib/server/qf/client';
import type { QfSessionCookie } from '@/lib/server/qf/auth';

const ORIGINAL_ENV = { ...process.env };

const SESSION: QfSessionCookie = {
  accessToken: 'access-token',
  expiresAt: Date.now() + 60_000,
  refreshToken: 'refresh-token',
  user: {
    sub: 'user-123',
  },
};

function createAbortableFetchMock() {
  return vi.fn((_input: string | URL | Request, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      const handleAbort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));

      if (init?.signal?.aborted) {
        handleAbort();
        return;
      }

      init?.signal?.addEventListener('abort', handleAbort, { once: true });
    });
  });
}

describe('qf client timeouts', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.QF_FETCH_TIMEOUT_MS;
    delete process.env.QF_USER_API_BASE_URL;
    delete process.env.QF_USER_CLIENT_ID;
    delete process.env.QF_USER_CLIENT_SECRET;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fails fast when a qf api request hangs', async () => {
    vi.useFakeTimers();
    process.env.QF_FETCH_TIMEOUT_MS = '25';
    process.env.QF_USER_API_BASE_URL = 'https://apis.quran.foundation';
    process.env.QF_USER_CLIENT_ID = 'client-id';
    process.env.QF_USER_CLIENT_SECRET = 'client-secret';

    const fetchMock = createAbortableFetchMock();
    const requestPromise = qfApiFetch(
      SESSION,
      '/quran-reflect/v1/users/profile',
      undefined,
      fetchMock as typeof fetch,
    );
    const rejectionExpectation = expect(requestPromise).rejects.toThrow(
      'Quran Foundation request timed out after 25ms: https://apis.quran.foundation/quran-reflect/v1/users/profile',
    );

    await vi.advanceTimersByTimeAsync(25);

    await rejectionExpectation;
  });
});
