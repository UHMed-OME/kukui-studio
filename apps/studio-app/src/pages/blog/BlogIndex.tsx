import { Link } from "react-router-dom";
import { BLOG } from "../content.js";
import { LandingTopNav } from "../shared/LandingTopNav.js";
import "./Blog.css";

export function BlogIndex() {
  return (
    <div className="kukui-blog">
      <LandingTopNav active="blog" />
      <main className="kukui-blog__main">
        <header className="kukui-blog__header">
          <h1 className="kukui-blog__title">Blog</h1>
          <p className="kukui-blog__lede">
            Release notes, design write-ups, and educator-focused posts on
            building interactive activities with Kukui.
          </p>
        </header>
        {BLOG.length === 0 ? (
          <p className="kukui-blog__empty">No posts yet — check back soon.</p>
        ) : (
          <ul className="kukui-blog__list">
            {BLOG.map(({ meta }) => (
              <li key={meta.slug} className="kukui-blog__card">
                <Link to={`/blog/${meta.slug}`}>
                  <time
                    className="kukui-blog__date"
                    dateTime={meta.date}
                  >
                    {formatDate(meta.date)}
                  </time>
                  <h2 className="kukui-blog__card-title">{meta.title}</h2>
                  {meta.excerpt ? (
                    <p className="kukui-blog__excerpt">{meta.excerpt}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  // Parse YYYY-MM-DD directly to avoid timezone shifts that "new Date('2026-05-12')"
  // introduces (parses as UTC midnight, then localizes — can flip the day).
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
