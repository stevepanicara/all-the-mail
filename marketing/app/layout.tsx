import type { Metadata, Viewport } from 'next';
import { Analytics } from '@/components/Analytics';
import { AttributionTracker } from '@/components/AttributionTracker';
import { Clarity } from '@/components/Clarity';
import { SITE_URL, SITE_NAME, SITE_TAGLINE } from '@/lib/site';
import './globals.css';

// Root layout. Every page renders inside this shell. Metadata defaults
// here are inherited and overridden per-page via the Metadata export
// pattern (see components/Meta.tsx for the helper).
//
// metadataBase: lets Next emit absolute URLs for OG images / canonicals
// without each page having to spell out the host.
//
// title.template: pages export `title: 'Pricing'` and the rendered
// <title> becomes "Pricing | All The Mail". The default applies to the
// root page (/) which doesn't override.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AttributionTracker />
        {children}
        <Analytics />
        <Clarity />
      </body>
    </html>
  );
}
