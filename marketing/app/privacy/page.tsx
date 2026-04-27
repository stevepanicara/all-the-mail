import { buildMetadata } from '@/components/Meta';

export const metadata = buildMetadata({
  title: 'Privacy',
  description: 'Privacy policy for All The Mail.',
  canonical: '/privacy',
});

// Privacy policy. Content TBD — port from /frontend/src/Privacy.jsx.
export default function PrivacyPage() {
  return <main className="p-8"><h1 className="text-2xl">Privacy placeholder</h1></main>;
}
