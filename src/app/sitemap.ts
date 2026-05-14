import type { MetadataRoute } from 'next';
import { getCanonicalUrl } from '@/lib/site-metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: getCanonicalUrl('/'),
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: getCanonicalUrl('/extension'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];
}
