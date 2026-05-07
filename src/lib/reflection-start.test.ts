import { describe, expect, it, vi } from 'vitest';
import type { InputValidationResponse } from '@/lib/antidotes/types';
import { startReflectionFromInput } from '@/lib/reflection-start';

describe('startReflectionFromInput', () => {
  it('creates a pending thread and navigates for valid input', async () => {
    const validateInput = vi.fn(async (): Promise<InputValidationResponse> => ({
      decision: 'valid',
      reason_code: 'meaningful',
      reply_message: '',
    }));
    const createPendingChat = vi.fn();
    const navigate = vi.fn();

    await expect(
      startReflectionFromInput(
        {
          eventContent: '  Something I read upset me.  ',
          userFeeling: ' uneasy ',
        },
        {
          createId: () => 'chat-1',
          createPendingChat,
          navigate,
          validateInput,
        },
      ),
    ).resolves.toEqual({
      chatId: 'chat-1',
      ok: true,
    });

    expect(validateInput).toHaveBeenCalledWith({
      eventContent: 'Something I read upset me.',
      userFeeling: 'uneasy',
    });
    expect(createPendingChat).toHaveBeenCalledWith({
      eventContent: 'Something I read upset me.',
      id: 'chat-1',
      userFeeling: 'uneasy',
    });
    expect(navigate).toHaveBeenCalledWith('/chat/chat-1');
  });

  it('returns the inline validation error when the event text is empty', async () => {
    const validateInput = vi.fn();
    const createPendingChat = vi.fn();
    const navigate = vi.fn();

    await expect(
      startReflectionFromInput(
        {
          eventContent: '   ',
          userFeeling: '',
        },
        {
          createPendingChat,
          navigate,
          validateInput,
        },
      ),
    ).resolves.toEqual({
      error: 'Please describe what happened in a sentence or two.',
      ok: false,
    });

    expect(validateInput).not.toHaveBeenCalled();
    expect(createPendingChat).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('returns the server validation message without navigating', async () => {
    const validateInput = vi.fn(async () => {
      throw new Error('Please share what happened and how it affected you.');
    });
    const createPendingChat = vi.fn();
    const navigate = vi.fn();

    await expect(
      startReflectionFromInput(
        {
          eventContent: 'help',
          userFeeling: '',
        },
        {
          createPendingChat,
          navigate,
          validateInput,
        },
      ),
    ).resolves.toEqual({
      error: 'Please share what happened and how it affected you.',
      ok: false,
    });

    expect(createPendingChat).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
