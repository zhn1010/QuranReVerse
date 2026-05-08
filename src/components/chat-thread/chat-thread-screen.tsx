'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChatResultView } from '@/components/chat-result-view';
import { ChatShell } from '@/components/chat-shell';
import { requestAntidoteStream } from '@/lib/antidotes/browser';
import { getBrowserFingerprint } from '@/lib/browser-fingerprint';
import {
  completeChatThread,
  failChatThread,
  getChatThread,
  resetChatThreadToPending,
  type LocalChatThread,
} from '@/lib/chat-store';
import type { QfSessionSummary } from '@/lib/qf-user';
import { detectTextDirection, getDirectionStyles } from '@/lib/reflection-ui';
import {
  ChatLoadingState,
  createInitialLoadingStepStatus,
  type PipelineStepKey,
  type PipelineStepStatus,
} from './chat-loading-state';

export function ChatThreadScreen({ auth, chatId }: { auth: QfSessionSummary; chatId: string }) {
  const [thread, setThread] = useState<LocalChatThread | null>(null);
  const [loadingStepStatus, setLoadingStepStatus] = useState<
    Record<PipelineStepKey, PipelineStepStatus>
  >(createInitialLoadingStepStatus());
  const startedRef = useRef<string | null>(null);

  useEffect(() => {
    setThread(getChatThread(chatId));
  }, [chatId]);

  useEffect(() => {
    if (!thread || thread.status !== 'pending') {
      return;
    }

    const activeThread = thread;

    if (startedRef.current === chatId) {
      return;
    }

    startedRef.current = chatId;
    setLoadingStepStatus(createInitialLoadingStepStatus());

    const controller = new AbortController();

    async function run() {
      try {
        const fingerprint = await getBrowserFingerprint();
        const finalResult = await requestAntidoteStream(
          {
            eventContent: activeThread.eventContent,
            fingerprint,
            userFeeling: activeThread.userFeeling,
          },
          {
            onStep: (event) => {
              setLoadingStepStatus((prev) => ({
                ...prev,
                [event.step]: event.status,
              }));
            },
            signal: controller.signal,
          },
        );

        const nextThread = completeChatThread(chatId, finalResult);
        setThread(nextThread);
        setLoadingStepStatus(
          Object.fromEntries(
            Object.keys(createInitialLoadingStepStatus()).map((key) => [key, 'completed']),
          ) as Record<PipelineStepKey, PipelineStepStatus>,
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unexpected request error.';
        const nextThread = failChatThread(chatId, message);
        setThread(nextThread);
      }
    }

    run();

    return () => {
      controller.abort();
    };
  }, [chatId, thread]);

  return (
    <ChatShell activeChatId={chatId} auth={auth}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-16">
        {!thread ? (
          <div
            className="w-full rounded-2xl bg-(--surface-subtle-soft) px-5 py-4 text-sm leading-7 text-(--ink-soft)"
            role="status"
          >
            This local reflection thread could not be found.{' '}
            <Link className="underline" href="/">
              Start a new one
            </Link>
            .
          </div>
        ) : (
          <>
            <div className="w-full rounded-2xl border border-(--border-subtle) bg-(--surface-bubble) px-5 py-4">
              <p
                className={`text-sm leading-7 text-(--ink-strong) ${getDirectionStyles(
                  detectTextDirection(thread.eventContent),
                )}`}
                dir={detectTextDirection(thread.eventContent)}
              >
                {thread.eventContent}
              </p>
              {thread.userFeeling ? (
                <p
                  className={`mt-2 border-t border-(--border-subtle) pt-2 text-sm leading-7 text-(--ink-strong) ${getDirectionStyles(
                    detectTextDirection(thread.userFeeling),
                  )}`}
                  dir={detectTextDirection(thread.userFeeling)}
                >
                  {thread.userFeeling}
                </p>
              ) : null}
            </div>

            {thread.status === 'pending' ? (
              <ChatLoadingState stepStatus={loadingStepStatus} />
            ) : thread.status === 'error' ? (
              <div
                aria-live="assertive"
                className="w-full rounded-2xl border border-(--border-danger) bg-(--surface-danger) px-5 py-4"
                role="alert"
              >
                <p className="text-sm font-semibold text-(--ink-danger)">
                  Could not prepare this reading.
                </p>
                <p className="mt-2 text-sm leading-7 text-(--ink-danger)">{thread.error}</p>
                <button
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-(--ink-strong) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--accent)"
                  onClick={() => {
                    const nextThread = resetChatThreadToPending(chatId);
                    startedRef.current = null;
                    setThread(nextThread);
                    setLoadingStepStatus(createInitialLoadingStepStatus());
                  }}
                  type="button"
                >
                  Retry
                </button>
              </div>
            ) : thread.result ? (
              <div className="flex flex-col gap-4">
                <ChatResultView
                  auth={auth}
                  chatPath={`/chat/${chatId}`}
                  eventContent={thread.eventContent}
                  result={thread.result}
                  userFeeling={thread.userFeeling}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </ChatShell>
  );
}
