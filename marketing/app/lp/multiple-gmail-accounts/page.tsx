import { buildMetadata } from '@/components/Meta';
import { ClarityPageType } from '@/components/ClarityPageType';
import { LPLayout } from '@/components/lp/LPLayout';
import { LPCta } from '@/components/lp/LPCta';

export const metadata = buildMetadata({
  title: 'Manage Multiple Gmail Accounts in One Inbox',
  description:
    'Stop switching between Gmail tabs. All The Mail puts every Google account into one unified inbox. 7-day free trial.',
  canonical: '/lp/multiple-gmail-accounts',
});

export default function LandingMultipleGmailAccounts() {
  return (
    <LPLayout>
      <ClarityPageType type="lp" />

      {/* Above-the-fold hero — single CTA, fully visible on first viewport */}
      <section className="px-6 pt-20 pb-16 md:pt-32 md:pb-24 max-w-3xl mx-auto text-center">
        <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight leading-tight mb-5">
          One inbox for all your Gmail accounts
        </h1>
        <p className="text-lg md:text-xl text-ink/70 max-w-2xl mx-auto mb-10 leading-relaxed">
          Stop switching tabs. See every account&apos;s email, docs, and calendar in one place.
        </p>
        <LPCta size="lg" />
      </section>

      {/* Three benefit bullets — kept tight, no extra prose between them */}
      <section className="px-6 pb-20 max-w-3xl mx-auto">
        <ul className="space-y-5 text-base md:text-lg">
          {[
            'Combined inbox from all connected Google accounts',
            'Search across every account simultaneously',
            'Compose from any account without switching',
          ].map((b) => (
            <li key={b} className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-signal flex-shrink-0" aria-hidden />
              <span className="text-ink/85">{b}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Bottom CTA — second chance to convert without scrolling back up */}
      <section className="px-6 pb-24 text-center">
        <LPCta size="lg" />
      </section>
    </LPLayout>
  );
}
