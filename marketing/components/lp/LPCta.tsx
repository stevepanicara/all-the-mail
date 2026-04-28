import { API_URL } from '@/lib/site';

// The only call-to-action on a paid-ad landing page. Single button,
// single destination: the backend OAuth start endpoint, which kicks
// off the 14-day card-upfront trial. Any visitor who clicks here lands
// in our funnel; that's the whole point of the LP.
//
// The atm_attribution cookie (set on the marketing site by
// AttributionTracker) rides along the OAuth round-trip via its
// .allthemail.io apex scope, so the React app reads it back after
// callback completes and forwards it to Stripe metadata at checkout.
// Result: a click from /lp/superhuman-alternative attributes the
// conversion to that LP via the landing_path field on the cookie.

export function LPCta({ size = 'lg' as 'lg' | 'md' }) {
  const sizing = size === 'lg' ? 'px-7 py-4 text-base' : 'px-5 py-3 text-sm';
  return (
    <a
      href={`${API_URL}/auth/google`}
      className={`inline-flex items-center justify-center bg-signal text-paper font-medium rounded-md hover:opacity-90 transition-opacity ${sizing}`}
    >
      Start 14-day free trial
    </a>
  );
}
