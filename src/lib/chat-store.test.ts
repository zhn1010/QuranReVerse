import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAT_HISTORY_STORAGE_KEY } from '@/lib/app-constants';

async function loadChatStore() {
  return import('@/lib/chat-store');
}

function createResult(overrides?: Partial<{ chat_title: string }>) {
  return {
    antidotes: [],
    chat_title: overrides?.chat_title ?? 'Restored calm',
    detected_language_code: 'en',
    diagnosis: {
      god_centric_reframe: 'Allah is enough.',
      materialistic_narrative: 'I am behind.',
      spiritual_drift: 'comparison',
    },
    reflection_guide: null,
    selected_reflection: null,
  };
}

class MemoryStorage {
  private readonly store = new Map<string, string>();

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

function installWindowStub() {
  const eventTarget = new EventTarget();
  const localStorage = new MemoryStorage();

  Object.assign(globalThis, {
    window: {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
      localStorage,
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
    },
  });
}

describe('chat-store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    installWindowStub();
    window.localStorage.clear();
  });

  it('creates a pending thread and persists it to localStorage', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-05T10:00:00.000Z'));

    const chatStore = await loadChatStore();

    chatStore.createPendingChatThread({
      eventContent: 'Something happened',
      id: 'thread-1',
      userFeeling: 'Uneasy',
    });

    expect(chatStore.getChatThread('thread-1')).toMatchObject({
      eventContent: 'Something happened',
      id: 'thread-1',
      status: 'pending',
      title: 'New reflection',
      userFeeling: 'Uneasy',
    });

    expect(JSON.parse(window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY) ?? '[]')).toHaveLength(
      1,
    );
  });

  it('sorts threads by most recent update and uses the returned chat title', async () => {
    vi.useFakeTimers();

    const chatStore = await loadChatStore();

    vi.setSystemTime(new Date('2026-05-05T10:00:00.000Z'));
    chatStore.createPendingChatThread({
      eventContent: 'Older event',
      id: 'thread-1',
      userFeeling: 'Older feeling',
    });

    vi.setSystemTime(new Date('2026-05-05T11:00:00.000Z'));
    chatStore.createPendingChatThread({
      eventContent: 'Newer event',
      id: 'thread-2',
      userFeeling: 'Newer feeling',
    });

    vi.setSystemTime(new Date('2026-05-05T12:00:00.000Z'));
    chatStore.completeChatThread('thread-1', createResult({ chat_title: '  Grounded again  ' }));

    expect(chatStore.listChatThreads().map((thread) => thread.id)).toEqual([
      'thread-1',
      'thread-2',
    ]);
    expect(chatStore.getChatThread('thread-1')?.title).toBe('Grounded again');
  });

  it('notifies subscribers when chat history changes', async () => {
    const chatStore = await loadChatStore();
    const onChange = vi.fn();
    const unsubscribe = chatStore.subscribeToChatHistory(onChange);

    chatStore.createPendingChatThread({
      eventContent: 'Event',
      id: 'thread-1',
      userFeeling: 'Feeling',
    });

    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();

    chatStore.createPendingChatThread({
      eventContent: 'Another event',
      id: 'thread-2',
      userFeeling: 'Another feeling',
    });

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
