import { buildMetadata } from '@/components/Meta';
import { ClarityPageType } from '@/components/ClarityPageType';
import { LPLayout } from '@/components/lp/LPLayout';
import { LPCta } from '@/components/lp/LPCta';

export const metadata = buildMetadata({
  title: 'Gmail Unified Inbox for Multiple Accounts',
  description:
    "Gmail doesn't have a combined inbox for multiple accounts. All The Mail fixes that. Connect all your Google accounts and see everything at once.",
  canonical: '/lp/gmail-unified-inbox',
});

export default function LandingGmailUnifiedInbox() {
  return (
    <LPLayout>
      <ClarityPageType type="lp" />

      <section className="px-6 pt-20 pb-16 md:pt-32 md:pb-24 max-w-3xl mx-auto text-center">
        <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight leading-tight mb-5">
          The unified Gmail inbox Google never built
        </h1>
        <p className="text-lg md:text-xl text-ink/70 max-w-2xl mx-auto mb-10 leading-relaxed">
          Gmail is great for one account. For two, three, or four — it falls apart. All The Mail fixes that.
        </p>
        <LPCta size="lg" />
      </section>

      <section className="px-6 pb-20 max-w-3xl mx-auto">
        <ul className="space-y-5 text-base md:text-lg">
          {[
            "Every account's inbox in one combined view",
            'Real-time — not forwarding, not IMAP polling',
            'Gmail-native: labels, categories, and shortcuts intact',
          ].map((b) => (
            <li key={b} className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-signal flex-shrink-0" aria-hidden />
              <span className="text-ink/85">{b}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="px-6 pb-24 text-center">
        <LPCta size="lg" />
      </section>
    </LPLayout>
  );
}
