import { buildMetadata } from '@/components/Meta';
import { ClarityPageType } from '@/components/ClarityPageType';
import { LPLayout } from '@/components/lp/LPLayout';
import { LPCta } from '@/components/lp/LPCta';

export const metadata = buildMetadata({
  title: 'Superhuman Alternative for Multiple Google Accounts',
  description:
    "All The Mail does what Superhuman doesn't — a unified inbox across multiple Gmail accounts. $15/month vs $30.",
  canonical: '/lp/superhuman-alternative',
});

const COMPARISON = [
  { feature: 'Unified multi-account inbox', us: true,  them: false },
  { feature: 'Cross-account search',         us: true,  them: false },
  { feature: 'Price',                         us: '$15/mo', them: '$30/mo' },
];

export default function LandingSuperhumanAlternative() {
  return (
    <LPLayout>
      <ClarityPageType type="lp" />

      <section className="px-6 pt-20 pb-12 md:pt-32 md:pb-16 max-w-3xl mx-auto text-center">
        <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight leading-tight mb-5">
          The email client Superhuman forgot to build
        </h1>
        <p className="text-lg md:text-xl text-ink/70 max-w-2xl mx-auto mb-10 leading-relaxed">
          Superhuman is fast. It doesn&apos;t unify multiple Google accounts. All The Mail does — for half the price.
        </p>
        <LPCta size="lg" />
      </section>

      {/* Comparison table — direct, three rows, no marketing fluff */}
      <section className="px-6 pb-20 max-w-2xl mx-auto">
        <div className="border border-ink/10 rounded-md overflow-hidden">
          <div className="grid grid-cols-3 bg-ink/5 text-xs uppercase tracking-wide font-medium text-ink/60">
            <div className="px-4 py-3">Feature</div>
            <div className="px-4 py-3 text-center">All The Mail</div>
            <div className="px-4 py-3 text-center">Superhuman</div>
          </div>
          {COMPARISON.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-3 items-center text-sm md:text-base ${i < COMPARISON.length - 1 ? 'border-b border-ink/10' : ''}`}
            >
              <div className="px-4 py-4 text-ink/85">{row.feature}</div>
              <div className="px-4 py-4 text-center font-medium">
                {typeof row.us === 'boolean' ? (row.us ? <span className="text-signal">✓</span> : <span className="text-ink/30">✗</span>) : <span>{row.us}</span>}
              </div>
              <div className="px-4 py-4 text-center text-ink/60">
                {typeof row.them === 'boolean' ? (row.them ? <span className="text-signal">✓</span> : <span className="text-ink/30">✗</span>) : <span>{row.them}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24 text-center">
        <LPCta size="lg" />
      </section>
    </LPLayout>
  );
}
