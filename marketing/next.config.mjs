import createMDX from '@next/mdx';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }]],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // .ts/.tsx for code, .mdx for blog posts authored as Markdown
  pageExtensions: ['ts', 'tsx', 'mdx'],

  // Faster Rust-based MDX compiler — the JS one works too, but mdxRs is
  // 10-20× quicker on cold builds and we don't use any plugin features
  // that require the JS path.
  experimental: {
    mdxRs: true,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Strict React mode catches effect double-firing in dev — same posture
  // as the CRA app at /frontend.
  reactStrictMode: true,
};

export default withMDX(nextConfig);
