import { ChatShell } from '@/components/chat-shell';
import { getQfUserSessionSummary } from '@/lib/qf-user';

export default async function ChatShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getQfUserSessionSummary();

  return <ChatShell auth={auth}>{children}</ChatShell>;
}
