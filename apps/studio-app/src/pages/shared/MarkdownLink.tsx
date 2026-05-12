import type { AnchorHTMLAttributes } from "react";
import { Link } from "react-router-dom";

/**
 * Custom `<a>` renderer for react-markdown. Internal links (starting
 * with "/") use React Router's `<Link>` so they navigate without a
 * full page reload; external links open in a new tab with safe
 * rel attributes.
 */
export function MarkdownLink({
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href && href.startsWith("/")) {
    return (
      <Link to={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {children}
    </a>
  );
}
