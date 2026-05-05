'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPendingChatThread } from '@/lib/chat-store';
import { detectTextDirection, getDirectionStyles } from '@/lib/reflection-ui';

export function ChatHomeForm({
  initialEvent = '',
  initialFeeling = '',
}: {
  initialEvent?: string;
  initialFeeling?: string;
}) {
  const router = useRouter();
  const [eventContent, setEventContent] = useState(initialEvent);
  const [userFeeling, setUserFeeling] = useState(initialFeeling);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();

        if (isSubmitting) {
          return;
        }

        const normalizedEvent = eventContent.trim();
        const normalizedFeeling = userFeeling.trim();

        if (!normalizedEvent) {
          return;
        }

        setIsSubmitting(true);

        const chatId = crypto.randomUUID();
        createPendingChatThread({
          eventContent: normalizedEvent,
          id: chatId,
          userFeeling: normalizedFeeling,
        });
        router.push(`/chat/${chatId}`);
      }}
    >
      <div className="overflow-hidden rounded-2xl border border-(--border-soft) bg-white shadow-(--shadow-card)">
        <div className="px-5 pt-4 pb-2 sm:px-6">
          <textarea
            className={`min-h-24 w-full resize-none bg-transparent text-base leading-7 text-(--ink-strong) outline-none placeholder:text-(--ink-placeholder) ${getDirectionStyles(
              detectTextDirection(eventContent),
            )}`}
            dir={detectTextDirection(eventContent)}
            onChange={(inputEvent) => setEventContent(inputEvent.target.value)}
            placeholder="Describe the event, post, or conversation that pulled you off-center..."
            value={eventContent}
          />
        </div>

        <div className="flex items-center gap-3 border-t border-(--border-subtle) px-5 py-3 sm:px-6">
          <input
            className={`min-w-0 flex-1 bg-transparent text-sm leading-6 text-(--ink-strong) outline-none placeholder:text-(--ink-placeholder) ${getDirectionStyles(
              detectTextDirection(userFeeling),
            )}`}
            dir={detectTextDirection(userFeeling)}
            onChange={(inputEvent) => setUserFeeling(inputEvent.target.value)}
            placeholder="How are you feeling? (optional)"
            type="text"
            value={userFeeling}
          />
          <button
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-(--ink-strong) text-white transition hover:bg-(--accent) active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!eventContent.trim() || isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
