import { buildMetadata } from '@/components/Meta';

export const metadata = buildMetadata({
  title: 'Terms',
  description: 'Terms of service for All The Mail.',
  canonical: '/terms',
});

// Terms of service. Content TBD — port from /frontend/src/Terms.jsx.
export default function TermsPage() {
  return <main className="p-8"><h1 className="text-2xl">Terms placeholder</h1></main>;
}
