import { Navigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { findDoc } from "../content.js";
import { MarkdownLink } from "../shared/MarkdownLink.js";

export function DocPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/docs" replace />;
  const entry = findDoc(slug);
  if (!entry) return <Navigate to="/docs" replace />;
  return (
    <div className="kukui-docs__page">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: MarkdownLink }}
      >
        {entry.body}
      </ReactMarkdown>
      {entry.meta.updated ? (
        <p className="kukui-docs__updated">Last updated · {entry.meta.updated}</p>
      ) : null}
    </div>
  );
}
