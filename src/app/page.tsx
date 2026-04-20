import { ChatHomeScreen } from '@/components/chat-home-screen';
import { getQfUserSessionSummary } from '@/lib/qf-user';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const auth = await getQfUserSessionSummary();

  return <ChatHomeScreen auth={auth} />;
}
