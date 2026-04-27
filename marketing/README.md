# All The Mail — Marketing Site

Next.js (App Router) marketing site that lives at `allthemail.io`. The
React CRA app is the sibling `frontend/` folder and lives at
`app.allthemail.io` after the cutover.

## Setup

```bash
cd marketing
npm install
cp .env.local.example .env.local   # fill in IDs as they come online
npm run dev                         # starts on :3002 to avoid colliding with /frontend on :3001
```

## Deploy target

Vercel project, separate from the CRA project. Root directory: `marketing/`.

## Stack

- Next.js 15 (App Router, statically generated)
- TypeScript, strict mode
- Tailwind CSS for utility styling; brand tokens shared with `/frontend/src/brand.css`
- MDX blog posts in `content/blog/*.mdx` (filename → slug, gray-matter frontmatter)
- `app/sitemap.ts` and `app/robots.ts` for native Next sitemap/robots
- GA4 + GTM via `components/Analytics.tsx`, env-gated and prod-only

## Structure

```
app/                      # App Router root
  layout.tsx              # Root <html>, metadata defaults, GA/GTM
  page.tsx                # /
  pricing/page.tsx        # /pricing
  blog/page.tsx           # /blog index
  blog/[slug]/page.tsx    # /blog/<slug> — generateStaticParams from filesystem
  privacy/page.tsx        # /privacy
  terms/page.tsx          # /terms
  lp/                     # Google Ads landing pages (no nav/footer)
    multiple-gmail-accounts/page.tsx
    superhuman-alternative/page.tsx
    gmail-unified-inbox/page.tsx
  sitemap.ts              # /sitemap.xml
  robots.ts               # /robots.txt
  globals.css             # Tailwind + brand vars

components/
  Meta.tsx                # buildMetadata() helper for per-page metadata
  Analytics.tsx           # GA4 + GTM <Script> wrappers (afterInteractive)

lib/
  blog.ts                 # fs reads + frontmatter parsing for content/blog/
  site.ts                 # SITE_URL, APP_URL, brand constants

content/
  blog/                   # author .mdx files here

public/                   # static assets — favicon, OG images, etc.
```

## Per-page metadata

Pages export a `metadata` object built via `buildMetadata`:

```tsx
import { buildMetadata } from '@/components/Meta';

export const metadata = buildMetadata({
  title: 'Pricing',
  description: 'Multi-account Gmail at $15/mo. 7-day free trial.',
  canonical: '/pricing',
});
```

The root layout sets `title.template: '%s | All The Mail'`, so `'Pricing'`
renders as `<title>Pricing | All The Mail</title>` automatically.
