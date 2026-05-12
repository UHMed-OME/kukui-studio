import { Link } from "react-router-dom";

/**
 * Logo + "Kukui / STUDIO" stacked wordmark used by the top nav and the
 * landing footer. Single source of truth — change the brand mark here.
 */
export function BrandWordmark() {
  return (
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
  );
}
