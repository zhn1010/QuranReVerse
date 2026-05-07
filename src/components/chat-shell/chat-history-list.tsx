'use client';

import Link from 'next/link';
import type { LocalChatThread } from '@/lib/client/chat/store';

export function ChatHistoryList({
  activeChatId,
  history,
  onNavigate,
}: {
  activeChatId?: string;
  history: LocalChatThread[];
  onNavigate: () => void;
}) {
  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-(--line) px-4 py-5 text-sm leading-7 text-(--ink-soft)">
        Your reflection history will appear here.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1">
      {history.map((thread) => {
        const isActive = thread.id === activeChatId;

        return (
          <Link
            className={`block rounded-2xl px-3 py-3 transition ${
              isActive
                ? 'bg-white text-(--ink-strong) shadow-(--shadow-pop)'
                : 'text-(--ink-soft) hover:bg-white/70 hover:text-(--ink-strong)'
            }`}
            href={`/chat/${thread.id}`}
            key={thread.id}
            onClick={onNavigate}
          >
            <p className="line-clamp-1 text-sm font-semibold">{thread.title || 'Reflection'}</p>
            <p className="mt-1 line-clamp-1 text-xs text-(--ink-soft)">
              {new Date(thread.updatedAt).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
              })}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
