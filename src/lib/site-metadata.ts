import type { Metadata } from 'next';

const DEFAULT_SITE_ORIGIN = 'https://sakinah.now';

export const siteName = 'Sakinah.now';
export const siteDescription =
  'Guided Quran-centered reflection with relevant ayahs, nafs-driven reading support, and human-written reflections from QuranReflect.com.';
export const siteKeywords = [
  'Quran reflection',
  'Quranic reflection',
  'Quranic guidance',
  'guided Quran reflection',
  'Quran-centered reflection',
  'Islamic reflection',
  'browser extension for Quran reflection',
  'Quran reflection extension',
  'Quranic antidote',
  'Nafs-driven reading',
  'relevant Quran ayahs',
  'human-written reflections',
  'QuranReflect.com',
  'sakinah',
  'inner calm',
];

function normalizeSiteOrigin(value: string) {
  const withProtocol =
    value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;

  return withProtocol.endsWith('/') ? withProtocol.slice(0, -1) : withProtocol;
}

export function getSiteOrigin() {
  return normalizeSiteOrigin(
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? DEFAULT_SITE_ORIGIN,
  );
}

export function getSiteUrl() {
  return new URL(`${getSiteOrigin()}/`);
}

export function getCanonicalUrl(pathname = '/') {
  return new URL(pathname, getSiteUrl()).toString();
}

type PageMetadataOptions = {
  description: string;
  index?: boolean;
  keywords?: string[];
  pathname: string;
  title: string;
};

export function createPageMetadata({
  description,
  index = true,
  keywords,
  pathname,
  title,
}: PageMetadataOptions): Metadata {
  const canonical = getCanonicalUrl(pathname);

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: index
      ? undefined
      : {
          index: false,
          follow: false,
          noarchive: true,
          nocache: true,
        },
  };
}

export function getStructuredData() {
  const siteUrl = getSiteOrigin();

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      url: siteUrl,
      description: siteDescription,
      inLanguage: 'en',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: siteName,
      url: siteUrl,
      description: siteDescription,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web',
    },
  ];
}
