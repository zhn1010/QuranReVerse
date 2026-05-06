'use client';

import { useEffect, useState } from 'react';
import { ChatShell } from '@/components/chat-shell';
import { HOME_TITLE_INDEX_STORAGE_KEY } from '@/lib/app-constants';
import type { QfSessionSummary } from '@/lib/qf-user';
import { ChatHomeExamples, type ChatHomeExample } from './chat-home-examples';
import { ChatHomeForm } from './chat-home-form';
import { ChatHomeIntroModal } from './chat-home-intro-modal';

const HOME_TITLES = [
  'What unsettled your heart today?',
  'What pulled you away from sakinah?',
  'What has been sitting heavily on your heart?',
  'What moment are you still carrying with you?',
  'What has been difficult to let go of?',
  'What has been clouding your heart lately?',
  'What left you feeling restless today?',
  'What has shaken your sense of peace?',
  'What are you carrying in silence today?',
  'What has your heart been wrestling with?',
  'What has been weighing on you lately?',
  'What do you need help seeing through a Quranic lens?',
] as const;

export function ChatHomeScreen({ auth }: { auth: QfSessionSummary }) {
  const [selectedExample, setSelectedExample] = useState<ChatHomeExample | null>(null);
  const [homeTitle, setHomeTitle] = useState<(typeof HOME_TITLES)[number]>(HOME_TITLES[0]);

  useEffect(() => {
    try {
      const rawIndex = window.localStorage.getItem(HOME_TITLE_INDEX_STORAGE_KEY);
      const parsedIndex = Number.parseInt(rawIndex ?? '-1', 10);
      const nextIndex = Number.isFinite(parsedIndex)
        ? (parsedIndex + 1) % HOME_TITLES.length
        : 0;

      setHomeTitle(HOME_TITLES[nextIndex]);
      window.localStorage.setItem(HOME_TITLE_INDEX_STORAGE_KEY, String(nextIndex));
    } catch {
      setHomeTitle(HOME_TITLES[0]);
    }
  }, []);

  return (
    <ChatShell auth={auth}>
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl flex-col items-start justify-center px-4 pb-[16vh] sm:px-6">
        <div className="mb-10">
          <p className="text-lg text-(--ink-soft)">
            Salaam{auth.displayName ? ` ${auth.displayName.split(' ')[0]}` : ''}
          </p>
          <h1 className="mt-1 text-3xl font-medium tracking-[-0.03em] text-(--ink-strong) sm:text-4xl">
            {homeTitle}
          </h1>
        </div>

        <ChatHomeForm
          key={selectedExample?.label ?? 'empty'}
          initialEvent={selectedExample?.event}
          initialFeeling={selectedExample?.feeling}
        />
        <ChatHomeExamples onSelect={setSelectedExample} />
      </section>

      <ChatHomeIntroModal />
    </ChatShell>
  );
}
