import type { Metadata } from 'next';
import { ChatHomeScreen } from '@/components/chat-home-screen';
import { createPageMetadata } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createPageMetadata({
  title: 'Quran-Centered Reflection for Inner Calm',
  description:
    'Share what unsettled your heart and move through a guided Quran-centered reflection toward steadier sight and inner calm.',
  keywords: [
    'Quran reflection app',
    'Islamic reflection',
    'Muslim emotional support',
    'spiritual calm',
    'inner peace in Islam',
    'Quranic guidance',
    'guided reflection',
  ],
  pathname: '/',
});

export default function Home() {
  return <ChatHomeScreen />;
}
