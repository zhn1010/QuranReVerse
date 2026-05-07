import { validateAntidoteInput } from '@/lib/client/antidotes/api-client';
import { createPendingChatThread } from '@/lib/client/chat/store';

export type ReflectionStartInput = {
  eventContent: string;
  userFeeling: string;
};

export type ReflectionStartResult =
  | {
      chatId: string;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export async function startReflectionFromInput(
  { eventContent, userFeeling }: ReflectionStartInput,
  {
    createId = () => crypto.randomUUID(),
    createPendingChat = createPendingChatThread,
    navigate,
    validateInput = validateAntidoteInput,
  }: {
    createId?: () => string;
    createPendingChat?: typeof createPendingChatThread;
    navigate: (path: string) => void;
    validateInput?: typeof validateAntidoteInput;
  },
): Promise<ReflectionStartResult> {
  const normalizedEvent = eventContent.trim();
  const normalizedFeeling = userFeeling.trim();

  if (!normalizedEvent) {
    return {
      error: 'Please describe what happened in a sentence or two.',
      ok: false,
    };
  }

  try {
    await validateInput({
      eventContent: normalizedEvent,
      userFeeling: normalizedFeeling,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Please share a bit more context so the reflection can be meaningful.',
      ok: false,
    };
  }

  const chatId = createId();
  createPendingChat({
    eventContent: normalizedEvent,
    id: chatId,
    userFeeling: normalizedFeeling,
  });
  navigate(`/chat/${chatId}`);

  return {
    chatId,
    ok: true,
  };
}
