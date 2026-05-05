'use client';

import { useState } from 'react';
import { ChatShell } from '@/components/chat-shell';
import type { QfSessionSummary } from '@/lib/qf-user';
import { ChatHomeExamples, type ChatHomeExample } from './chat-home-examples';
import { ChatHomeForm } from './chat-home-form';
import { ChatHomeIntroModal } from './chat-home-intro-modal';

export function ChatHomeScreen({ auth }: { auth: QfSessionSummary }) {
  const [selectedExample, setSelectedExample] = useState<ChatHomeExample | null>(null);

  return (
    <ChatShell auth={auth}>
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl flex-col items-start justify-center px-4 pb-[16vh] sm:px-6">
        <div className="mb-10">
          <p className="text-lg text-(--ink-soft)">
            Salaam{auth.displayName ? ` ${auth.displayName.split(' ')[0]}` : ''}
          </p>
          <h1 className="mt-1 text-3xl font-medium tracking-[-0.03em] text-(--ink-strong) sm:text-4xl">
            What is weighing on your heart?
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
