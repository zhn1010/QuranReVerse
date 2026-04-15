import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sakinah.now',
  description:
    'Sakinah.now offers Quran-centered reflection paths that help you move from overwhelm to inner calm.',
  icons: {
    icon: [
      { type: 'image/png', url: '/SakinahLogo.png' },
      { type: 'image/svg+xml', url: '/SakinahLogo.svg' },
    ],
    apple: [{ url: '/SakinahLogo.png' }],
    shortcut: ['/SakinahLogo.png'],
  },
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
