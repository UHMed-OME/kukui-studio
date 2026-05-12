import { Link, Outlet, useLocation } from "react-router-dom";
import { DOCS } from "../content.js";
import { LandingTopNav } from "../shared/LandingTopNav.js";
import "./Docs.css";

export function DocsLayout() {
  const { pathname } = useLocation();
  return (
    <div className="kukui-docs">
      <LandingTopNav active="docs" />
      <main className="kukui-docs__main">
        <aside className="kukui-docs__sidebar" aria-label="Documentation">
          <h2 className="kukui-docs__sidebar-title">Documentation</h2>
          <nav>
            <ul>
              <li>
                <Link
                  to="/docs"
                  className={
                    pathname === "/docs"
                      ? "kukui-docs__nav-link is-active"
                      : "kukui-docs__nav-link"
                  }
                >
                  Overview
                </Link>
              </li>
              {DOCS.map(({ meta }) => {
                const to = `/docs/${meta.slug}`;
                return (
                  <li key={meta.slug}>
                    <Link
                      to={to}
                      className={
                        pathname === to
                          ? "kukui-docs__nav-link is-active"
                          : "kukui-docs__nav-link"
                      }
                    >
                      {meta.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
        <article className="kukui-docs__content">
          <Outlet />
        </article>
      </main>
    </div>
  );
}
