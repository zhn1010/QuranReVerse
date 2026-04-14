import AntidoteWorkbench from '@/components/antidote-workbench';
import { getQfUserSessionSummary } from '@/lib/qf-user';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const auth = await getQfUserSessionSummary();

  return <AntidoteWorkbench initialAuth={auth} />;
}
