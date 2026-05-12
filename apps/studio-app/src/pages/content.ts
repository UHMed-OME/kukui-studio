/**
 * Shared markdown loader for docs and blog. Reads .md files at build
 * time via Vite's import.meta.glob (?raw), parses YAML-ish frontmatter,
 * and returns {meta, body} entries. The loader runs once at module
 * eval and is shared by every page that imports from here.
 *
 * Why hand-roll the frontmatter parser instead of gray-matter:
 * gray-matter uses Node's Buffer and js-yaml, both of which bloat the
 * browser bundle. Our frontmatter is shallow (key: value pairs of
 * strings, numbers, or ISO dates), so 20 lines of code suffice.
 */

export type DocMeta = {
  slug: string;
  title: string;
  description: string;
  order: number;
  updated: string;
};

export type BlogMeta = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author?: string;
};

export type ContentEntry<M> = {
  meta: M;
  body: string;
};

const DOC_FILES = import.meta.glob("../content/docs/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const BLOG_FILES = import.meta.glob("../content/blog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function parseFrontmatter(source: string): { frontmatter: Record<string, string>; body: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: source };
  const fm = match[1] ?? "";
  const body = match[2] ?? "";
  const frontmatter: Record<string, string> = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    if (!key) continue;
    let val = (m[2] ?? "").trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    frontmatter[key] = val;
  }
  return { frontmatter, body };
}

function slugFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/, "");
}

function loadDocs(): ContentEntry<DocMeta>[] {
  const entries: ContentEntry<DocMeta>[] = [];
  for (const [path, raw] of Object.entries(DOC_FILES)) {
    const { frontmatter, body } = parseFrontmatter(raw);
    const slug = slugFromPath(path);
    entries.push({
      meta: {
        slug,
        title: frontmatter.title ?? slug,
        description: frontmatter.description ?? "",
        order: Number(frontmatter.order ?? 99),
        updated: frontmatter.updated ?? "",
      },
      body,
    });
  }
  entries.sort((a, b) => a.meta.order - b.meta.order);
  return entries;
}

function loadBlog(): ContentEntry<BlogMeta>[] {
  const entries: ContentEntry<BlogMeta>[] = [];
  for (const [path, raw] of Object.entries(BLOG_FILES)) {
    const { frontmatter, body } = parseFrontmatter(raw);
    const slug = slugFromPath(path);
    entries.push({
      meta: {
        slug,
        title: frontmatter.title ?? slug,
        excerpt: frontmatter.excerpt ?? "",
        date: frontmatter.date ?? "",
        author: frontmatter.author,
      },
      body,
    });
  }
  // Newest first.
  entries.sort((a, b) => b.meta.date.localeCompare(a.meta.date));
  return entries;
}

export const DOCS: ContentEntry<DocMeta>[] = loadDocs();
export const BLOG: ContentEntry<BlogMeta>[] = loadBlog();

export function findDoc(slug: string): ContentEntry<DocMeta> | undefined {
  return DOCS.find((d) => d.meta.slug === slug);
}

export function findBlogPost(slug: string): ContentEntry<BlogMeta> | undefined {
  return BLOG.find((b) => b.meta.slug === slug);
}
