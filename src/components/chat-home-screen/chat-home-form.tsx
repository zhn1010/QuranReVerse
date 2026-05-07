'use client';

import { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagicStarsIcon, SendArrowIcon } from '@/components/icons';
import { streamInferredFeeling } from '@/lib/client/antidotes/browser';
import type { ExtensionReflectPayload } from '@/lib/shared/extension/handoff';
import { startReflectionFromInput } from '@/lib/client/chat/start';
import { detectTextDirection, getDirectionStyles } from '@/lib/shared/reflection/ui';

const FEELING_GUESS_MIN_EVENT_LENGTH = 20;

export function ChatHomeForm({
  extensionRequest = null,
  initialEvent = '',
  initialFeeling = '',
}: {
  extensionRequest?: ExtensionReflectPayload | null;
  initialEvent?: string;
  initialFeeling?: string;
}) {
  const router = useRouter();
  const [eventContent, setEventContent] = useState(initialEvent);
  const [userFeeling, setUserFeeling] = useState(initialFeeling);
  const [isGuessingFeeling, setIsGuessingFeeling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const eventFieldId = useId();
  const feelingFieldId = useId();
  const handledExtensionRequestIdRef = useRef<string | null>(null);
  const feelingGuessAbortControllerRef = useRef<AbortController | null>(null);
  const feelingFieldRef = useRef<HTMLTextAreaElement | null>(null);

  const eventDirection = detectTextDirection(eventContent);
  const normalizedEventContent = eventContent.trim();
  const normalizedUserFeeling = userFeeling.trim();
  const feelingInputDirection = detectTextDirection(userFeeling || eventContent);
  const shouldShowFeelingHint = normalizedUserFeeling.length === 0;
  const canGuessFeeling =
    normalizedEventContent.length >= FEELING_GUESS_MIN_EVENT_LENGTH &&
    shouldShowFeelingHint &&
    !isSubmitting &&
    !isGuessingFeeling;

  function cancelFeelingGuess() {
    feelingGuessAbortControllerRef.current?.abort();
    feelingGuessAbortControllerRef.current = null;
    setIsGuessingFeeling(false);
  }

  function syncFeelingFieldHeight() {
    const field = feelingFieldRef.current;

    if (!field) {
      return;
    }

    field.style.height = 'auto';
    field.style.height = `${Math.max(field.scrollHeight, 24)}px`;
  }

  useLayoutEffect(() => {
    syncFeelingFieldHeight();
  }, [userFeeling]);

  async function submitReflection({
    eventContent: nextEventContent,
    userFeeling: nextUserFeeling,
  }: {
    eventContent: string;
    userFeeling: string;
  }) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setValidationMessage('');

    const result = await startReflectionFromInput(
      {
        eventContent: nextEventContent,
        userFeeling: nextUserFeeling,
      },
      {
        navigate: (path) => router.push(path),
      },
    );

    if (!result.ok) {
      setValidationMessage(result.error);
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    return () => {
      feelingGuessAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!extensionRequest) {
      return;
    }

    if (handledExtensionRequestIdRef.current === extensionRequest.requestId) {
      return;
    }

    handledExtensionRequestIdRef.current = extensionRequest.requestId;
    setEventContent(extensionRequest.eventContent);
    setUserFeeling(extensionRequest.userFeeling);
    void submitReflection({
      eventContent: extensionRequest.eventContent,
      userFeeling: extensionRequest.userFeeling,
    });
  }, [extensionRequest]);

  async function guessFeeling() {
    if (!canGuessFeeling) {
      return;
    }

    const abortController = new AbortController();
    feelingGuessAbortControllerRef.current?.abort();
    feelingGuessAbortControllerRef.current = abortController;
    setIsGuessingFeeling(true);
    setValidationMessage('');

    try {
      await streamInferredFeeling(
        {
          eventContent: normalizedEventContent,
        },
        {
          onChunk: (text) => {
            setUserFeeling(text);
          },
          signal: abortController.signal,
        },
      );
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      setValidationMessage(
        error instanceof Error ? error.message : 'Could not guess the feeling right now.',
      );
    } finally {
      if (feelingGuessAbortControllerRef.current === abortController) {
        feelingGuessAbortControllerRef.current = null;
        setIsGuessingFeeling(false);
      }
    }
  }

  return (
    <form
      className="w-full"
      onSubmit={async (event) => {
        event.preventDefault();

        await submitReflection({
          eventContent,
          userFeeling,
        });
      }}
    >
      <div className="overflow-hidden rounded-2xl border border-(--border-soft) bg-white shadow-(--shadow-card)">
        <div className="px-5 pt-4 pb-2 sm:px-6">
          <label className="sr-only" htmlFor={eventFieldId}>
            Describe what happened
          </label>
          <textarea
            className={`min-h-24 w-full resize-none bg-transparent text-base leading-7 text-(--ink-strong) outline-none placeholder:text-(--ink-placeholder) ${getDirectionStyles(
              eventDirection,
            )}`}
            dir={eventDirection}
            id={eventFieldId}
            onChange={(inputEvent) => {
              cancelFeelingGuess();
              setEventContent(inputEvent.target.value);
              if (validationMessage) {
                setValidationMessage('');
              }
            }}
            placeholder="Describe what happened, what you read, or what has been sitting heavily on your heart..."
            value={eventContent}
          />
        </div>

        <div className="flex items-end gap-3 border-t border-(--border-subtle) px-5 py-3 sm:px-6">
          <label className="sr-only" htmlFor={feelingFieldId}>
            How are you feeling
          </label>
          <div className="relative min-w-0 flex-1">
            <textarea
              className={`min-h-6 w-full resize-none overflow-hidden bg-transparent text-sm leading-6 text-(--ink-strong) outline-none transition-[height] duration-200 ease-out ${getDirectionStyles(
                feelingInputDirection,
              )}`}
              dir={feelingInputDirection}
              id={feelingFieldId}
              ref={feelingFieldRef}
              onChange={(inputEvent) => {
                cancelFeelingGuess();
                setUserFeeling(inputEvent.target.value);
                if (validationMessage) {
                  setValidationMessage('');
                }
              }}
              rows={1}
              value={userFeeling}
            />
            {shouldShowFeelingHint ? (
              <div
                className={`pointer-events-none absolute inset-0 flex items-center ${getDirectionStyles(
                  feelingInputDirection,
                )}`}
              >
                <div
                  className={`flex max-w-full items-center gap-2 text-sm leading-6 text-(--ink-placeholder) ${
                    feelingInputDirection === 'rtl' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <span className="truncate">Describe your feelings</span>
                  {normalizedEventContent.length >= FEELING_GUESS_MIN_EVENT_LENGTH ? (
                    <>
                      <span className="shrink-0 opacity-60">or</span>
                      <button
                        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-(--border-soft) bg-(--surface-muted) px-3 py-1 text-xs font-medium text-(--ink-soft) transition hover:border-(--border-strong) hover:bg-white hover:text-(--ink-strong) disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isSubmitting || isGuessingFeeling}
                        onClick={() => {
                          void guessFeeling();
                        }}
                        type="button"
                      >
                        <MagicStarsIcon className="h-3.5 w-3.5 shrink-0" />
                        {isGuessingFeeling ? 'Detecting...' : 'Detect automatically'}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
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
      <p className="px-1 pt-3 text-xs leading-6 text-(--ink-soft)">
        Human-written reflections are translated when needed. Your reflection history stays on this
        device and is not sent to our servers.
      </p>
    </form>
  );
}
