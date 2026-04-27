import { notFound } from 'next/navigation';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { buildMetadata } from '@/components/Meta';
import { getAllPosts, getPostBySlug } from '@/lib/blog';

// Pre-render every blog slug at build time. New posts require a redeploy
// — not a problem since the marketing site is static and Vercel rebuilds
// on every git push.
export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

// Per-post metadata, generated at build from the post's frontmatter.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return buildMetadata({
    title: post.meta.title,
    description: post.meta.description,
    ogImage: post.meta.ogImage,
    canonical: `/blog/${post.meta.slug}`,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  // Compile the MDX content server-side. We use next-mdx-remote/rsc rather
  // than relying on the @next/mdx loader for /content/blog/* because the
  // file lives outside /app and is read dynamically via fs (the loader is
  // for routes, not arbitrary fs reads).
  const { content } = await compileMDX({
    source: post.content,
    options: {
      parseFrontmatter: false,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }]],
      },
    },
  });

  return (
    <main className="p-8 max-w-prose mx-auto">
      <article className="prose">
        <h1>{post.meta.title}</h1>
        <p className="text-xs opacity-60">
          {new Date(post.meta.date).toLocaleDateString()}
        </p>
        {content}
      </article>
    </main>
  );
}
