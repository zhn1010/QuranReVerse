import { describe, expect, it } from 'vitest';
import {
  deriveQfSessionSummaryFromProfilePayload,
  getRecord,
  readAvatarFromProfile,
} from '@/lib/qf/profile';

describe('getRecord', () => {
  it('returns only plain object records', () => {
    expect(getRecord({ ok: true })).toEqual({ ok: true });
    expect(getRecord(null)).toBeNull();
    expect(getRecord(['not', 'a', 'record'])).toBeNull();
  });
});

describe('readAvatarFromProfile', () => {
  it('prefers nested medium avatar urls over other fields', () => {
    expect(
      readAvatarFromProfile({
        avatarUrl: 'https://example.com/direct.png',
        avatarUrls: {
          medium: 'https://example.com/medium.png',
          small: 'https://example.com/small.png',
        },
      }),
    ).toMatchObject({
      avatarSource: 'avatarUrls.medium',
      avatarUrl: 'https://example.com/medium.png',
    });
  });

  it('falls back to snake_case avatar fields when needed', () => {
    expect(
      readAvatarFromProfile({
        avatar_url: 'https://example.com/snake.png',
      }),
    ).toMatchObject({
      avatarSource: 'avatar_url',
      avatarUrl: 'https://example.com/snake.png',
    });
  });
});

describe('deriveQfSessionSummaryFromProfilePayload', () => {
  it('uses nested profile data for avatar selection and display name', () => {
    const resolution = deriveQfSessionSummaryFromProfilePayload(
      {
        data: {
          account: {
            avatarUrls: {
              small: 'https://example.com/account-small.png',
            },
            firstName: 'Amina',
            lastName: 'Khan',
          },
          profile: {
            avatarUrl: 'https://example.com/profile.png',
            username: 'amina',
          },
        },
      },
      'Sakinah.now',
    );

    expect(resolution.summary).toEqual({
      avatarUrl: 'https://example.com/profile.png',
      collectionName: 'Sakinah.now',
      displayName: 'amina',
      isAuthenticated: true,
    });
    expect(resolution.diagnostics.avatarFromRecordLabel).toBe('payload.data.profile');
  });

  it('falls back to the selected record username when no full name exists', () => {
    const resolution = deriveQfSessionSummaryFromProfilePayload(
      {
        data: {
          username: 'quiet-heart',
        },
      },
      'Sakinah.now',
    );

    expect(resolution.summary.displayName).toBe('quiet-heart');
    expect(resolution.summary.avatarUrl).toBeNull();
  });
});
