import Link from 'next/link';
import { buildMetadata } from '@/components/Meta';
import { ClarityPageType } from '@/components/ClarityPageType';
import { getAllPosts } from '@/lib/blog';

export const metadata = buildMetadata({
  title: 'Blog',
  description: 'Notes from the All The Mail team.',
  canonical: '/blog',
});

// Blog index. Lists every published post in reverse-chronological order.
// Page itself is statically generated at build time — getAllPosts() runs
// against the filesystem during the build, not at request time.
export default function BlogIndexPage() {
  const posts = getAllPosts();
  return (
    <main className="p-8">
      <ClarityPageType type="blog" />
      <h1 className="text-2xl mb-6">Blog</h1>
      {posts.length === 0 ? (
        <p className="text-sm opacity-60">No posts yet.</p>
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="hover:underline">
                <span className="font-medium">{post.title}</span>
                <span className="ml-2 text-xs opacity-60">
                  {new Date(post.date).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
