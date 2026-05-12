import { Navigate, useParams } from "react-router-dom";
import { findDoc } from "../content.js";
import { Prose } from "../shared/Prose.js";

export function DocPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/docs" replace />;
  const entry = findDoc(slug);
  if (!entry) return <Navigate to="/docs" replace />;
  return (
    <div className="kukui-docs__page">
      <Prose>{entry.body}</Prose>
      {entry.meta.updated ? (
        <p className="kukui-docs__updated">Last updated · {entry.meta.updated}</p>
      ) : null}
    </div>
  );
}
