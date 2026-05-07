import { afterEach, describe, expect, it, vi } from 'vitest';
import { getQfConfig } from '@/lib/server/qf/config';

const ORIGINAL_ENV = { ...process.env };

function resetQfEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.QF_ENV;
  delete process.env.QF_USER_AUTH_BASE_URL;
  delete process.env.QF_USER_API_BASE_URL;
  delete process.env.QURAN_API_BASE_URL;
  delete process.env.QF_USER_CLIENT_ID;
  delete process.env.QURAN_CLIENT_ID;
  delete process.env.QF_USER_CLIENT_SECRET;
  delete process.env.QURAN_CLIENT_SECRET;
  delete process.env.QF_USER_SCOPES;
  delete process.env.QF_AUTH_DEBUG;
}

describe('getQfConfig', () => {
  afterEach(() => {
    resetQfEnv();
    vi.restoreAllMocks();
  });

  it('uses production defaults and Quran env fallbacks', () => {
    resetQfEnv();
    process.env.QURAN_CLIENT_ID = 'client-id';
    process.env.QURAN_CLIENT_SECRET = 'client-secret';

    expect(getQfConfig()).toEqual({
      apiBaseUrl: 'https://apis.quran.foundation',
      authBaseUrl: 'https://oauth2.quran.foundation',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      scopes: 'openid offline_access user collection bookmark note',
    });
  });

  it('uses the prelive environment when requested', () => {
    resetQfEnv();
    process.env.QF_ENV = 'prelive';
    process.env.QURAN_CLIENT_ID = 'client-id';
    process.env.QURAN_CLIENT_SECRET = 'client-secret';

    expect(getQfConfig()).toMatchObject({
      apiBaseUrl: 'https://apis-prelive.quran.foundation',
      authBaseUrl: 'https://prelive-oauth2.quran.foundation',
    });
  });

  it('prefers explicit QF overrides over shared Quran env vars', () => {
    resetQfEnv();
    process.env.QURAN_CLIENT_ID = 'shared-client';
    process.env.QURAN_CLIENT_SECRET = 'shared-secret';
    process.env.QF_USER_CLIENT_ID = 'qf-client';
    process.env.QF_USER_CLIENT_SECRET = 'qf-secret';
    process.env.QF_USER_AUTH_BASE_URL = 'https://auth.example.test';
    process.env.QF_USER_API_BASE_URL = 'https://api.example.test';
    process.env.QF_USER_SCOPES = 'openid profile';

    expect(getQfConfig()).toEqual({
      apiBaseUrl: 'https://api.example.test',
      authBaseUrl: 'https://auth.example.test',
      clientId: 'qf-client',
      clientSecret: 'qf-secret',
      scopes: 'openid profile',
    });
  });

  it('throws clear errors when credentials are missing', () => {
    resetQfEnv();

    expect(() => getQfConfig()).toThrow(
      'Missing Quran Foundation API credentials. Set QURAN_CLIENT_ID or QF_USER_CLIENT_ID.',
    );

    process.env.QURAN_CLIENT_ID = 'client-id';

    expect(() => getQfConfig()).toThrow(
      'Missing Quran Foundation API credentials. Set QURAN_CLIENT_SECRET or QF_USER_CLIENT_SECRET.',
    );
  });
});
