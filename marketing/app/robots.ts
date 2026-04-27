import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Generated at build time. Next emits /robots.txt from this file.
// Allow all crawlers; point them at the sitemap.

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
