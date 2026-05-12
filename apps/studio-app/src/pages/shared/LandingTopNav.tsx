import { Link, useLocation } from "react-router-dom";
import { BrandWordmark } from "./BrandWordmark.js";

/**
 * Shared top nav used across Landing, Docs, and Blog. The active section
 * is derived from `useLocation()` so renaming a route never leaves a
 * stale highlight.
 */
export function LandingTopNav() {
  const { pathname } = useLocation();
  const docsActive = pathname.startsWith("/docs");
  const blogActive = pathname.startsWith("/blog");

  return (
    <header className="kukui-landing__nav">
      <BrandWordmark />
      <nav className="kukui-landing__nav-links" aria-label="Primary">
        <Link to="/docs" className={docsActive ? "is-active" : undefined}>
          Docs
        </Link>
        <Link to="/blog" className={blogActive ? "is-active" : undefined}>
          Blog
        </Link>
        <a
          href="https://github.com/UHMed-OME/kukui-studio"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <Link to="/studio" className="kukui-landing__cta-secondary">
          Open Studio
        </Link>
      </nav>
    </header>
  );
}
