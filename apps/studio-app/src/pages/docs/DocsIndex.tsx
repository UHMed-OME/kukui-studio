import { Link } from "react-router-dom";
import { DOCS } from "../content.js";

export function DocsIndex() {
  return (
    <div className="kukui-docs__index">
      <h1>Documentation</h1>
      <p className="kukui-docs__lede">
        Everything you need to author activities, upload them to your LMS, and
        self-host an instance of Kukui Studio for your institution.
      </p>
      <ul className="kukui-docs__index-list">
        {DOCS.map(({ meta }) => (
          <li key={meta.slug} className="kukui-docs__index-card">
            <Link to={`/docs/${meta.slug}`}>
              <h3>{meta.title}</h3>
              <p>{meta.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
