'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChatLoadingState, createInitialLoadingStepStatus, type PipelineStepKey, type PipelineStepStatus } from '@/components/chat-loading-state';
import { ChatResultView } from '@/components/chat-result-view';
import { ChatShell } from '@/components/chat-shell';
import { PromptSummaryCard } from '@/components/prompt-summary-card';
import type { ApiResponse } from '@/lib/antidote-types';
import {
  completeChatThread,
  failChatThread,
  getChatThread,
  resetChatThreadToPending,
  type LocalChatThread,
} from '@/lib/chat-store';
import type { QfSessionSummary } from '@/lib/qf-user';

type PipelineStepEvent = {
  label: string;
  status: Exclude<PipelineStepStatus, 'pending'>;
  step: PipelineStepKey;
  type: 'step';
};

type PipelineResultEvent = {
  data: ApiResponse;
  type: 'result';
};

type PipelineErrorEvent = {
  error: string;
  type: 'error';
};

type PipelineStreamEvent = PipelineErrorEvent | PipelineResultEvent | PipelineStepEvent;

export function ChatThreadScreen({
  auth,
  chatId,
}: {
  auth: QfSessionSummary;
  chatId: string;
}) {
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
        const response = await fetch('/api/antidotes', {
          body: JSON.stringify({
            eventContent: activeThread.eventContent,
            userFeeling: activeThread.userFeeling,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error || 'Request failed.');
        }

        if (!response.body) {
          throw new Error('No stream received from server.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResult: ApiResponse | null = null;

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trim();

            if (!line) {
              continue;
            }

            const event = JSON.parse(line) as PipelineStreamEvent;

            if (event.type === 'step') {
              setLoadingStepStatus((prev) => ({
                ...prev,
                [event.step]: event.status,
              }));
              continue;
            }

            if (event.type === 'result') {
              finalResult = event.data;
              continue;
            }

            if (event.type === 'error') {
              throw new Error(event.error || 'Request failed.');
            }
          }
        }

        if (!finalResult && buffer.trim()) {
          const tailEvent = JSON.parse(buffer.trim()) as PipelineStreamEvent;

          if (tailEvent.type === 'result') {
            finalResult = tailEvent.data;
          } else if (tailEvent.type === 'error') {
            throw new Error(tailEvent.error || 'Request failed.');
          }
        }

        if (!finalResult) {
          throw new Error('No result returned from server.');
        }

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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {!thread ? (
          <section className="rounded-[2rem] border border-dashed border-(--line) bg-white/70 p-8 text-sm leading-7 text-(--ink-soft)">
            This local reflection thread could not be found. <Link className="underline" href="/">Start a new one</Link>.
          </section>
        ) : (
          <>
            <PromptSummaryCard eventContent={thread.eventContent} userFeeling={thread.userFeeling} />

            {thread.status === 'pending' ? (
              <ChatLoadingState stepStatus={loadingStepStatus} />
            ) : thread.status === 'error' ? (
              <section className="rounded-[2rem] border border-[rgba(140,32,32,0.18)] bg-[rgba(140,32,32,0.06)] p-6">
                <p className="text-base font-semibold text-[rgb(110,28,28)]">Could not prepare this reading.</p>
                <p className="mt-2 text-sm leading-7 text-[rgb(110,28,28)]">{thread.error}</p>
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
              </section>
            ) : thread.result ? (
              <ChatResultView
                auth={auth}
                chatPath={`/chat/${chatId}`}
                eventContent={thread.eventContent}
                result={thread.result}
                userFeeling={thread.userFeeling}
              />
            ) : null}
          </>
        )}
      </div>
    </ChatShell>
  );
}
