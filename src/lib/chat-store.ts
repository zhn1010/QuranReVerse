import type { ApiResponse } from '@/lib/antidote-types';

const CHAT_HISTORY_KEY = 'sakinah:chat-history';
const HISTORY_UPDATED_EVENT = 'sakinah:history-updated';

export type ChatThreadStatus = 'completed' | 'error' | 'pending';

export type LocalChatThread = {
  createdAt: string;
  error: string | null;
  eventContent: string;
  id: string;
  result: ApiResponse | null;
  status: ChatThreadStatus;
  title: string;
  updatedAt: string;
  userFeeling: string;
};

function isBrowser() {
  return typeof window !== 'undefined';
}

function sortThreads(threads: LocalChatThread[]) {
  return [...threads].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
}

function readThreadsUnsafe() {
  if (!isBrowser()) {
    return [] as LocalChatThread[];
  }

  try {
    const raw = window.localStorage.getItem(CHAT_HISTORY_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is LocalChatThread => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const record = item as Record<string, unknown>;

      return (
        typeof record.id === 'string' &&
        typeof record.eventContent === 'string' &&
        typeof record.userFeeling === 'string' &&
        typeof record.title === 'string' &&
        typeof record.createdAt === 'string' &&
        typeof record.updatedAt === 'string' &&
        (record.status === 'pending' || record.status === 'completed' || record.status === 'error')
      );
    });
  } catch {
    return [];
  }
}

function writeThreadsUnsafe(threads: LocalChatThread[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(sortThreads(threads)));
  invalidateSnapshot();
  window.dispatchEvent(new Event(HISTORY_UPDATED_EVENT));
}

let cachedSnapshot: LocalChatThread[] | null = null;

export function listChatThreads() {
  if (cachedSnapshot === null) {
    cachedSnapshot = sortThreads(readThreadsUnsafe());
  }
  return cachedSnapshot;
}

function invalidateSnapshot() {
  cachedSnapshot = null;
}

const EMPTY_THREADS: LocalChatThread[] = [];

export function getServerSnapshot() {
  return EMPTY_THREADS;
}

export function getChatThread(id: string) {
  return readThreadsUnsafe().find((thread) => thread.id === id) ?? null;
}

export function createPendingChatThread({
  eventContent,
  id,
  userFeeling,
}: {
  eventContent: string;
  id: string;
  userFeeling: string;
}) {
  const now = new Date().toISOString();
  const thread: LocalChatThread = {
    createdAt: now,
    error: null,
    eventContent,
    id,
    result: null,
    status: 'pending',
    title: 'New reflection',
    updatedAt: now,
    userFeeling,
  };

  const threads = readThreadsUnsafe().filter((entry) => entry.id !== id);
  writeThreadsUnsafe([thread, ...threads]);

  return thread;
}

export function saveChatThread(thread: LocalChatThread) {
  const threads = readThreadsUnsafe().filter((entry) => entry.id !== thread.id);
  writeThreadsUnsafe([{ ...thread, updatedAt: new Date().toISOString() }, ...threads]);
}

export function completeChatThread(id: string, result: ApiResponse) {
  const existing = getChatThread(id);

  if (!existing) {
    return null;
  }

  const nextThread: LocalChatThread = {
    ...existing,
    error: null,
    result,
    status: 'completed',
    title: result.chat_title?.trim() || existing.title,
    updatedAt: new Date().toISOString(),
  };

  saveChatThread(nextThread);

  return nextThread;
}

export function failChatThread(id: string, error: string) {
  const existing = getChatThread(id);

  if (!existing) {
    return null;
  }

  const nextThread: LocalChatThread = {
    ...existing,
    error,
    status: 'error',
    updatedAt: new Date().toISOString(),
  };

  saveChatThread(nextThread);

  return nextThread;
}

export function resetChatThreadToPending(id: string) {
  const existing = getChatThread(id);

  if (!existing) {
    return null;
  }

  const nextThread: LocalChatThread = {
    ...existing,
    error: null,
    result: null,
    status: 'pending',
    updatedAt: new Date().toISOString(),
  };

  saveChatThread(nextThread);

  return nextThread;
}

export function subscribeToChatHistory(onChange: () => void) {
  if (!isBrowser()) {
    return () => undefined;
  }

  const handleChange = () => {
    invalidateSnapshot();
    onChange();
  };

  window.addEventListener('storage', handleChange);
  window.addEventListener(HISTORY_UPDATED_EVENT, handleChange);

  return () => {
    window.removeEventListener('storage', handleChange);
    window.removeEventListener(HISTORY_UPDATED_EVENT, handleChange);
  };
}
