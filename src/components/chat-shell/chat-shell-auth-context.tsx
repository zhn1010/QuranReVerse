'use client';

import { createContext, useContext } from 'react';
import type { QfSessionSummary } from '@/lib/qf-user';

const ChatShellAuthContext = createContext<QfSessionSummary | null>(null);

export function ChatShellAuthProvider({
  auth,
  children,
}: {
  auth: QfSessionSummary;
  children: React.ReactNode;
}) {
  return <ChatShellAuthContext.Provider value={auth}>{children}</ChatShellAuthContext.Provider>;
}

export function useChatShellAuth() {
  const auth = useContext(ChatShellAuthContext);

  if (!auth) {
    throw new Error('useChatShellAuth must be used within ChatShellAuthProvider.');
  }

  return auth;
}
