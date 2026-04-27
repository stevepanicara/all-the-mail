import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';
import { SITE_URL } from '@/lib/site';

// Generated at build time. Next emits /sitemap.xml from this file.
// Includes every static route plus every published (non-draft) blog post.

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }[] = [
  { path: '',                                priority: 1.0, changeFrequency: 'weekly' },
  { path: '/pricing',                        priority: 0.9, changeFrequency: 'monthly' },
  { path: '/blog',                           priority: 0.8, changeFrequency: 'weekly' },
  { path: '/privacy',                        priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms',                          priority: 0.3, changeFrequency: 'yearly' },
  { path: '/lp/multiple-gmail-accounts',     priority: 0.7, changeFrequency: 'monthly' },
  { path: '/lp/superhuman-alternative',      priority: 0.7, changeFrequency: 'monthly' },
  { path: '/lp/gmail-unified-inbox',         priority: 0.7, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticEntries = STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  const blogEntries = getAllPosts().map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...blogEntries];
}
