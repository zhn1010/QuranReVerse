'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SendArrowIcon } from '@/components/icons';
import { validateAntidoteInput } from '@/lib/antidotes/browser';
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
  const [validationMessage, setValidationMessage] = useState('');
  const eventFieldId = useId();
  const feelingFieldId = useId();

  return (
    <form
      className="w-full"
      onSubmit={async (event) => {
        event.preventDefault();

        if (isSubmitting) {
          return;
        }

        const normalizedEvent = eventContent.trim();
        const normalizedFeeling = userFeeling.trim();

        if (!normalizedEvent) {
          setValidationMessage('Please describe what happened in a sentence or two.');
          return;
        }

        setIsSubmitting(true);
        setValidationMessage('');

        try {
          await validateAntidoteInput({
            eventContent: normalizedEvent,
            userFeeling: normalizedFeeling,
          });
        } catch (error) {
          setValidationMessage(
            error instanceof Error
              ? error.message
              : 'Please share a bit more context so the reflection can be meaningful.',
          );
          setIsSubmitting(false);
          return;
        }

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
          <label className="sr-only" htmlFor={eventFieldId}>
            Describe what happened
          </label>
          <textarea
            className={`min-h-24 w-full resize-none bg-transparent text-base leading-7 text-(--ink-strong) outline-none placeholder:text-(--ink-placeholder) ${getDirectionStyles(
              detectTextDirection(eventContent),
            )}`}
            dir={detectTextDirection(eventContent)}
            id={eventFieldId}
            onChange={(inputEvent) => {
              setEventContent(inputEvent.target.value);
              if (validationMessage) {
                setValidationMessage('');
              }
            }}
            placeholder="Describe the event, post, or conversation that pulled you off-center..."
            value={eventContent}
          />
        </div>

        <div className="flex items-center gap-3 border-t border-(--border-subtle) px-5 py-3 sm:px-6">
          <label className="sr-only" htmlFor={feelingFieldId}>
            How are you feeling
          </label>
          <input
            className={`min-w-0 flex-1 bg-transparent text-sm leading-6 text-(--ink-strong) outline-none placeholder:text-(--ink-placeholder) ${getDirectionStyles(
              detectTextDirection(userFeeling),
            )}`}
            dir={detectTextDirection(userFeeling)}
            id={feelingFieldId}
            onChange={(inputEvent) => {
              setUserFeeling(inputEvent.target.value);
              if (validationMessage) {
                setValidationMessage('');
              }
            }}
            placeholder="How are you feeling? (optional)"
            type="text"
            value={userFeeling}
          />
          <button
            aria-label={isSubmitting ? 'Preparing reflection' : 'Start reflection'}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-(--ink-strong) text-white transition hover:bg-(--accent) active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!eventContent.trim() || isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <SendArrowIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      {validationMessage ? (
        <p aria-live="polite" className="px-1 pt-3 text-sm leading-6 text-(--ink-soft)">
          {validationMessage}
        </p>
      ) : null}
    </form>
  );
}
