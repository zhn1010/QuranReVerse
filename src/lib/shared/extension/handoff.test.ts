import { describe, expect, it } from 'vitest';
import {
  createExtensionHandoffResultMessage,
  parseExtensionReflectPayload,
  stripExtensionRequestParams,
} from '@/lib/shared/extension/handoff';

describe('parseExtensionReflectPayload', () => {
  it('accepts a well-formed extension handoff payload', () => {
    expect(
      parseExtensionReflectPayload({
        payload: {
          eventContent: 'Selected text',
          requestId: 'req-1',
          source: 'extension',
          userFeeling: 'uneasy',
        },
        type: 'SAKINAH_EXTENSION_REFLECT',
      }),
    ).toEqual({
      eventContent: 'Selected text',
      requestId: 'req-1',
      source: 'extension',
      userFeeling: 'uneasy',
    });
  });

  it('ignores malformed payloads', () => {
    expect(
      parseExtensionReflectPayload({
        payload: {
          eventContent: 'Selected text',
          source: 'extension',
          userFeeling: 'uneasy',
        },
        type: 'SAKINAH_EXTENSION_REFLECT',
      }),
    ).toBeNull();
  });
});

describe('stripExtensionRequestParams', () => {
  it('removes extension handoff parameters and preserves the rest', () => {
    const url = new URL('https://sakinah.now/?source=extension&request=req-1&foo=bar');

    expect(stripExtensionRequestParams(url)).toBe(true);
    expect(url.toString()).toBe('https://sakinah.now/?foo=bar');
  });

  it('returns false when there is nothing to remove', () => {
    const url = new URL('https://sakinah.now/?foo=bar');

    expect(stripExtensionRequestParams(url)).toBe(false);
    expect(url.toString()).toBe('https://sakinah.now/?foo=bar');
  });
});

describe('createExtensionHandoffResultMessage', () => {
  it('creates an acknowledgment payload for the content script', () => {
    expect(
      createExtensionHandoffResultMessage({
        requestId: 'req-1',
        status: 'accepted',
      }),
    ).toEqual({
      payload: {
        requestId: 'req-1',
        status: 'accepted',
      },
      type: 'SAKINAH_EXTENSION_HANDOFF_RESULT',
    });
  });
});
