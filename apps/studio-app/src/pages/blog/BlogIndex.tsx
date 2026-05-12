import { Link } from "react-router-dom";
import { BLOG } from "../content.js";
import { LandingTopNav } from "../shared/LandingTopNav.js";
import { formatDate } from "../shared/formatDate.js";
import "./Blog.css";

export function BlogIndex() {
  return (
    <div className="kukui-blog">
      <LandingTopNav />
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
                  <time className="kukui-blog__date" dateTime={meta.date}>
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
