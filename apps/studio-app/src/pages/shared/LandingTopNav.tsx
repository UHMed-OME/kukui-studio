import { Link } from "react-router-dom";

/**
 * Shared top nav used across Landing, Docs, and Blog. Mirrors the
 * Landing's own nav (brand + GitHub + Open Studio) so internal
 * navigation feels continuous. The `active` prop highlights the
 * matching section link.
 */
export function LandingTopNav({ active }: { active?: "docs" | "blog" }) {
  return (
    <header className="kukui-landing__nav">
      <Link to="/" className="kukui-landing__brand" aria-label="Kukui Studio">
        <img
          className="kukui-landing__brand-logo"
          src={`${import.meta.env.BASE_URL}kukui-logo.svg`}
          alt=""
          aria-hidden="true"
        />
        <span className="kukui-landing__brand-stack">
          <span className="kukui-landing__brand-word">Kukui</span>
          <span className="kukui-landing__brand-tag">Studio</span>
        </span>
      </Link>
      <nav className="kukui-landing__nav-links" aria-label="Primary">
        <Link
          to="/docs"
          className={active === "docs" ? "is-active" : undefined}
        >
          Docs
        </Link>
        <Link
          to="/blog"
          className={active === "blog" ? "is-active" : undefined}
        >
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
