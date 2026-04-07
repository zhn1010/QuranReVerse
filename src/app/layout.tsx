import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReVerse Quran Test',
  description: 'A Next.js test page using @quranjs/api with Quran Foundation OAuth credentials.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
