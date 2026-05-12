import { Link, Navigate, useParams } from "react-router-dom";
import { findBlogPost } from "../content.js";
import { LandingTopNav } from "../shared/LandingTopNav.js";
import { Prose } from "../shared/Prose.js";
import { formatDate } from "../shared/formatDate.js";
import "./Blog.css";

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/blog" replace />;
  const entry = findBlogPost(slug);
  if (!entry) return <Navigate to="/blog" replace />;
  return (
    <div className="kukui-blog">
      <LandingTopNav />
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
          <Prose>{entry.body}</Prose>
        </article>
      </main>
    </div>
  );
}
