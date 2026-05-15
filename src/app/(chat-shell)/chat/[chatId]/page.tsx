import type { Metadata } from 'next';
import { ChatThreadScreen } from '@/components/chat-thread';
import { createPageMetadata } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createPageMetadata({
  title: 'Private Reflection Thread',
  description: 'A private Sakinah.now reflection thread.',
  pathname: '/chat',
  index: false,
});

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;

  return <ChatThreadScreen chatId={chatId} />;
}
