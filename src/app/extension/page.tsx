import type { Metadata } from 'next';
import { ExtensionGuideScreen } from '@/components/extension-guide-screen';
import { getQfUserSessionSummary } from '@/lib/qf-user';
import { createPageMetadata } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createPageMetadata({
  title: 'Quran Reflection Browser Companion',
  description:
    'Carry difficult text into guided Quranic reflection with relevant ayahs, nafs-driven reading support, and human-written reflections from QuranReflect.com.',
  keywords: [
    'Quran reflection browser extension',
    'browser extension for Quranic reflection',
    'Chrome extension for Quran reflection',
    'Firefox extension for Quran reflection',
    'guided Quran reflection',
    'Quranic guidance',
    'Nafs-driven reading',
    'relevant Quran ayahs',
    'human-written reflections from QuranReflect.com',
    'Islamic browser companion',
  ],
  pathname: '/extension',
});

export default async function ExtensionPage() {
  const auth = await getQfUserSessionSummary();

  return <ExtensionGuideScreen auth={auth} />;
}
