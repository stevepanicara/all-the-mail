import Link from 'next/link';
import type { ReactNode } from 'react';

// Minimal chrome for paid-ad landing pages: no top nav, no real footer.
// Keeping the page free of escape routes is the entire point — every
// click should go to the trial CTA, not a navigation menu. The only
// outbound links are Privacy + Terms, deliberately small at the bottom
// so they're available without competing with the CTA.

export function LPLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <main className="flex-1 flex flex-col">{children}</main>
      <footer className="py-6 text-center text-xs text-ink/40">
        <Link href="/privacy" className="hover:text-ink/70 mx-2">Privacy</Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="hover:text-ink/70 mx-2">Terms</Link>
      </footer>
    </div>
  );
}
