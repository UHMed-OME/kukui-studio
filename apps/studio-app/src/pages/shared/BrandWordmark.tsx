import { Link } from "react-router-dom";
import { useResolvedColorScheme } from "./useColorScheme.js";

/**
 * Logo + "Kukui / STUDIO" stacked wordmark used by the top nav and the
 * landing footer. Single source of truth — change the brand mark here.
 *
 * Two SVGs ship: the canonical dark-silhouette nut for light surfaces,
 * and kukui-logo-dark.svg (tan-body) for dark mode. Swapping client-
 * side (rather than via <picture media="prefers-color-scheme: dark">)
 * because the in-app Appearance toggle can force light/dark
 * independent of the OS preference.
 */
export function BrandWordmark() {
  const scheme = useResolvedColorScheme();
  const logoSrc =
    scheme === "dark" ? "kukui-logo-dark.svg" : "kukui-logo.svg";

  return (
    <Link to="/" className="kukui-landing__brand" aria-label="Kukui Studio">
      <img
        className="kukui-landing__brand-logo"
        src={`${import.meta.env.BASE_URL}${logoSrc}`}
        alt=""
        aria-hidden="true"
      />
      <span className="kukui-landing__brand-stack">
        <span className="kukui-landing__brand-word">Kukui</span>
        <span className="kukui-landing__brand-tag">Studio</span>
      </span>
    </Link>
  );
}
