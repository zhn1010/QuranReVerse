import { describe, expect, it } from 'vitest';
import {
  getErrorMessage,
  getQfErrorStatus,
  isQfAuthenticationErrorMessage,
  isQfUpstreamTimeoutErrorMessage,
} from '@/lib/server/qf/route';

describe('qf route error helpers', () => {
  it('recognizes QF authentication and connection-expiration errors', () => {
    expect(isQfAuthenticationErrorMessage('Your Quran Foundation connection expired.')).toBe(true);
    expect(
      isQfAuthenticationErrorMessage('You need to connect your Quran Foundation account first.'),
    ).toBe(true);
    expect(isQfAuthenticationErrorMessage('Unexpected upstream failure.')).toBe(false);
  });

  it('recognizes upstream timeout errors', () => {
    expect(
      isQfUpstreamTimeoutErrorMessage(
        'Quran Foundation request timed out after 15000ms: https://apis.quran.foundation/auth/v1/collections',
      ),
    ).toBe(true);
    expect(isQfUpstreamTimeoutErrorMessage('Unexpected upstream failure.')).toBe(false);
  });

  it('maps auth-related errors to 401, timeouts to 504, and others to 500', () => {
    expect(getQfErrorStatus(new Error('connection expired'))).toBe(401);
    expect(getQfErrorStatus(new Error('connect your Quran Foundation'))).toBe(401);
    expect(
      getQfErrorStatus(
        new Error(
          'Quran Foundation request timed out after 15000ms: https://apis.quran.foundation/auth/v1/collections',
        ),
      ),
    ).toBe(504);
    expect(getQfErrorStatus(new Error('Unexpected error'))).toBe(500);
  });

  it('normalizes unknown thrown values into strings', () => {
    expect(getErrorMessage('plain text')).toBe('plain text');
  });
});
