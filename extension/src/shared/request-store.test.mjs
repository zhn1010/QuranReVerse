import { describe, expect, it } from 'vitest';
import {
  createConfirmedRequest,
  createDraftRecord,
  getRequestFromState,
  pruneExtensionState,
} from './request-store.mjs';

describe('extension request store', () => {
  it('creates a draft record from selected text', () => {
    expect(createDraftRecord('  selected text  ', 10)).toEqual({
      createdAt: 10,
      eventContent: 'selected text',
    });
  });

  it('creates a confirmed request with a request id', () => {
    expect(
      createConfirmedRequest(
        {
          eventContent: 'Something heavy',
          userFeeling: ' uneasy ',
        },
        {
          createId: () => 'req-1',
          now: 12,
        },
      ),
    ).toEqual({
      createdAt: 12,
      eventContent: 'Something heavy',
      requestId: 'req-1',
      userFeeling: 'uneasy',
    });
  });

  it('prunes expired drafts and requests', () => {
    expect(
      pruneExtensionState(
        {
          draft: {
            createdAt: 0,
            eventContent: 'old',
          },
          requests: {
            fresh: {
              createdAt: 1,
              eventContent: 'fresh',
              requestId: 'fresh',
              userFeeling: '',
            },
            stale: {
              createdAt: -1000 * 60 * 60,
              eventContent: 'stale',
              requestId: 'stale',
              userFeeling: '',
            },
          },
        },
        2,
      ),
    ).toEqual({
      draft: {
        createdAt: 0,
        eventContent: 'old',
      },
      requests: {
        fresh: {
          createdAt: 1,
          eventContent: 'fresh',
          requestId: 'fresh',
          userFeeling: '',
        },
      },
    });
  });

  it('looks up a request by request id after pruning', () => {
    expect(
      getRequestFromState(
        {
          draft: null,
          requests: {
            'req-1': {
              createdAt: 5,
              eventContent: 'selected',
              requestId: 'req-1',
              userFeeling: '',
            },
          },
        },
        'req-1',
        7,
      ),
    ).toEqual({
      createdAt: 5,
      eventContent: 'selected',
      requestId: 'req-1',
      userFeeling: '',
    });
  });
});
