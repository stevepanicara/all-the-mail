// Filesystem-backed blog index. Reads /content/blog/*.mdx at build time,
// parses frontmatter via gray-matter, returns sorted metadata.
//
// Slug resolution: filename without extension. A leading YYYY-MM-DD- prefix
// is allowed (and recommended for natural sort order on disk) but stripped
// off the public URL.
//   content/blog/2026-04-27-launch.mdx
//   → slug "2026-04-27-launch"
//   → URL /blog/2026-04-27-launch
//
// Drafts: any post with `draft: true` in frontmatter is excluded from the
// public index in production. Visible in dev so you can iterate.

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export type BlogPostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO 8601
  ogImage?: string;
  draft?: boolean;
};

export type BlogPost = {
  meta: BlogPostMeta;
  content: string;
};

function readBlogDir(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'));
}

function fileToMeta(filename: string): BlogPostMeta {
  const slug = filename.replace(/\.mdx?$/, '');
  const filePath = path.join(BLOG_DIR, filename);
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data } = matter(raw);
  return {
    slug,
    title: String(data.title ?? slug),
    description: String(data.description ?? ''),
    date: data.date ? new Date(data.date).toISOString() : new Date(0).toISOString(),
    ogImage: data.ogImage ? String(data.ogImage) : undefined,
    draft: !!data.draft,
  };
}

export function getAllPosts(): BlogPostMeta[] {
  const isProd = process.env.NODE_ENV === 'production';
  return readBlogDir()
    .map(fileToMeta)
    .filter((m) => (isProd ? !m.draft : true))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPostBySlug(slug: string): BlogPost | null {
  const candidate = readBlogDir().find((f) => f.replace(/\.mdx?$/, '') === slug);
  if (!candidate) return null;
  const filePath = path.join(BLOG_DIR, candidate);
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);
  return {
    meta: {
      slug,
      title: String(data.title ?? slug),
      description: String(data.description ?? ''),
      date: data.date ? new Date(data.date).toISOString() : new Date(0).toISOString(),
      ogImage: data.ogImage ? String(data.ogImage) : undefined,
      draft: !!data.draft,
    },
    content,
  };
}
