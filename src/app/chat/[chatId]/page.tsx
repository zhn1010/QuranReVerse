import { ChatThreadScreen } from '@/components/chat-thread-screen';
import { getQfUserSessionSummary } from '@/lib/qf-user';

export const dynamic = 'force-dynamic';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const [{ chatId }, auth] = await Promise.all([params, getQfUserSessionSummary()]);

  return <ChatThreadScreen auth={auth} chatId={chatId} />;
}
