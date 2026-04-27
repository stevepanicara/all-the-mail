// Single source of truth for site-wide constants. Imported by Meta,
// sitemap, robots, and any page that needs to know its own canonical URL.

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://allthemail.io';

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://app.allthemail.io';

export const SITE_NAME = 'All The Mail';

export const SITE_TAGLINE = 'Every account. One inbox.';

export const DEFAULT_OG_IMAGE = '/og-default.png';
