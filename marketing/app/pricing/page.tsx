import { buildMetadata } from '@/components/Meta';

export const metadata = buildMetadata({
  title: 'Pricing',
  description: 'Multi-account Gmail at $15/mo. 7-day free trial.',
  canonical: '/pricing',
});

// Pricing page. Content TBD.
export default function PricingPage() {
  return <main className="p-8"><h1 className="text-2xl">Pricing placeholder</h1></main>;
}
