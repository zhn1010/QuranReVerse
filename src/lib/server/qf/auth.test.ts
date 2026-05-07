import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCodeChallenge,
  buildSessionFromTokenResponse,
  extractTokenScopes,
  getRedirectUri,
  parseJwtPayload,
  sanitizeReturnTo,
  sealCookieValue,
  unsealCookieValue,
  type PendingAuthFlow,
} from '@/lib/server/qf/auth';

const ORIGINAL_ENV = { ...process.env };

function createJwt(payload: Record<string, unknown>) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${encodedPayload}.signature`;
}

describe('qf auth helpers', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.QF_USER_REDIRECT_URI;
    delete process.env.QF_SESSION_SECRET;
    vi.useRealTimers();
  });

  it('parses jwt payloads and extracts scopes', () => {
    const token = createJwt({ scope: 'openid user' });

    expect(parseJwtPayload(token)).toEqual({ scope: 'openid user' });
    expect(
      extractTokenScopes({
        access_token: token,
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    ).toEqual({
      accessTokenScope: 'openid user',
      responseScope: null,
    });
  });

  it('supports array scp claims and ignores invalid jwt input', () => {
    expect(
      extractTokenScopes({
        access_token: createJwt({ scp: ['bookmark', 'note'] }),
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    ).toEqual({
      accessTokenScope: 'bookmark note',
      responseScope: null,
    });
    expect(parseJwtPayload('not-a-token')).toBeNull();
  });

  it('sanitizes return paths and resolves redirect uris safely', () => {
    expect(sanitizeReturnTo('/chat/1')).toBe('/chat/1');
    expect(sanitizeReturnTo('https://example.com')).toBe('/');
    expect(sanitizeReturnTo('//evil.example')).toBe('/');

    expect(getRedirectUri('https://sakinah.now/chat/1')).toBe(
      'https://sakinah.now/api/qf/auth/callback',
    );
    expect(
      getRedirectUri(
        'https://sakinah.now/chat/1',
        'https://sakinah.now/api/qf/auth/callback?foo=bar',
      ),
    ).toBe('https://sakinah.now/api/qf/auth/callback?foo=bar');
    expect(
      getRedirectUri('https://sakinah.now/chat/1', 'https://other-origin.example/callback'),
    ).toBe('https://sakinah.now/api/qf/auth/callback');
  });

  it('builds deterministic code challenges', () => {
    expect(buildCodeChallenge('abc')).toBe('ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0');
  });

  it('round-trips sealed cookie values', () => {
    process.env.QF_SESSION_SECRET = '12345678901234567890123456789012';

    const payload: PendingAuthFlow = {
      codeVerifier: 'verifier',
      createdAt: 1,
      nonce: 'nonce',
      redirectUri: 'https://sakinah.now/api/qf/auth/callback',
      returnTo: '/chat/1',
      state: 'state',
    };

    expect(unsealCookieValue<PendingAuthFlow>(sealCookieValue(payload))).toEqual(payload);
  });

  it('builds sessions from token responses and validates nonce', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-05T10:00:00.000Z'));

    const session = buildSessionFromTokenResponse(
      {
        access_token: 'access-token',
        expires_in: 3600,
        id_token: createJwt({ nonce: 'expected', sub: 'user-123' }),
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
      },
      'expected',
    );

    expect(session).toEqual({
      accessToken: 'access-token',
      expiresAt: Date.now() + 3600 * 1000,
      refreshToken: 'refresh-token',
      user: {
        sub: 'user-123',
      },
    });

    expect(() =>
      buildSessionFromTokenResponse(
        {
          access_token: 'access-token',
          expires_in: 3600,
          id_token: createJwt({ nonce: 'wrong' }),
          token_type: 'Bearer',
        },
        'expected',
      ),
    ).toThrow('Quran Foundation ID token nonce validation failed.');
  });
});
