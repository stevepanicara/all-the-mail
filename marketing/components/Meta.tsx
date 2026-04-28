import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '@/lib/site';

// Build a Next.js Metadata object with sensible OG/Twitter/canonical
// defaults. Pages call this in their `export const metadata = ...`.
//
// Why this over a JSX <Meta> component: the App Router renders metadata
// during streaming SSR — manual <head> manipulation interferes with that
// pipeline. The metadata-export pattern produces equivalent HTML and
// stays compatible with Next's optimizations (deduplication, automatic
// canonical handling, etc.).
//
// Usage:
//   export const metadata = buildMetadata({
//     title: 'Pricing',
//     description: 'Multi-account Gmail at $15/mo. 14-day free trial.',
//     ogImage: '/og/pricing.png',  // optional; falls back to DEFAULT_OG_IMAGE
//     canonical: '/pricing',        // optional; absolute URL also works
//   });
//
// The root layout.tsx sets metadataBase + title.template so a page that
// passes title: 'Pricing' renders as "<Pricing> | All The Mail" without
// each page having to know the suffix.

export type BuildMetadataInput = {
  title: string;
  description: string;
  ogImage?: string;
  canonical?: string;
};

function absoluteUrl(maybeRelative: string): string {
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  if (maybeRelative.startsWith('/')) return `${SITE_URL}${maybeRelative}`;
  return `${SITE_URL}/${maybeRelative}`;
}

export function buildMetadata({
  title,
  description,
  ogImage = DEFAULT_OG_IMAGE,
  canonical,
}: BuildMetadataInput): Metadata {
  const ogImageUrl = absoluteUrl(ogImage);
  return {
    title,
    description,
    alternates: canonical ? { canonical: absoluteUrl(canonical) } : undefined,
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      url: canonical ? absoluteUrl(canonical) : undefined,
      images: [{ url: ogImageUrl }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}
