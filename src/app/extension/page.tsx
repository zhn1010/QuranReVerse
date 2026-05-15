import type { Metadata } from 'next';
import { ExtensionGuideScreen } from '@/components/extension-guide-screen';
import { getQfUserSessionSummary } from '@/lib/qf-user';
import { createPageMetadata } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createPageMetadata({
  title: 'Chrome Extension for Quran Reflection',
  description:
    'Install the Sakinah.now Chrome extension to carry difficult text into guided Quranic reflection with relevant ayahs and human-written reflections from QuranReflect.com.',
  keywords: [
    'Quran reflection browser extension',
    'browser extension for Quranic reflection',
    'Chrome extension for Quran reflection',
    'Chrome Web Store Quran reflection',
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
