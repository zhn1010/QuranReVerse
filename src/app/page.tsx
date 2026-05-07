import { ChatHomeScreen } from '@/components/chat-home-screen';
import { getQfUserSessionSummary } from '@/lib/server/qf/user';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const auth = await getQfUserSessionSummary('home_page');

  return <ChatHomeScreen auth={auth} />;
}
