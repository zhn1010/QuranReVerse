import { ChatThreadScreen } from '@/components/chat-thread';
import { getQfUserSessionSummary } from '@/lib/server/qf/user';

export const dynamic = 'force-dynamic';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const [{ chatId }, auth] = await Promise.all([params, getQfUserSessionSummary('chat_page')]);

  return <ChatThreadScreen auth={auth} chatId={chatId} />;
}
