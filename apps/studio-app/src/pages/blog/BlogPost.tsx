import { Link, Navigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { findBlogPost } from "../content.js";
import { LandingTopNav } from "../shared/LandingTopNav.js";
import { MarkdownLink } from "../shared/MarkdownLink.js";
import "./Blog.css";

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/blog" replace />;
  const entry = findBlogPost(slug);
  if (!entry) return <Navigate to="/blog" replace />;
  return (
    <div className="kukui-blog">
      <LandingTopNav active="blog" />
      <main className="kukui-blog__main kukui-blog__main--post">
        <p className="kukui-blog__back">
          <Link to="/blog">← All posts</Link>
        </p>
        <article className="kukui-blog__post">
          <header>
            <time className="kukui-blog__date" dateTime={entry.meta.date}>
              {formatDate(entry.meta.date)}
            </time>
          </header>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{ a: MarkdownLink }}
          >
            {entry.body}
          </ReactMarkdown>
        </article>
      </main>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
