import { ExtensionGuideScreen } from '@/components/extension-guide-screen';
import { getQfUserSessionSummary } from '@/lib/qf-user';

export const dynamic = 'force-dynamic';

export default async function ExtensionPage() {
  const auth = await getQfUserSessionSummary();

  return <ExtensionGuideScreen auth={auth} />;
}
