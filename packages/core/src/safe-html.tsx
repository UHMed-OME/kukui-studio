import { createElement, type ElementType, type ReactNode } from "react";
import parse, { type DOMNode, type HTMLReactParserOptions } from "html-react-parser";
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "mark",
  "code",
  "pre",
  "kbd",
  "small",
  "sub",
  "sup",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "img",
  "figure",
  "figcaption",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "span",
  "div",
];
const ALLOWED_ATTRS = ["href", "target", "rel", "src", "alt", "title", "class", "id"];

const parserOptions: HTMLReactParserOptions = {
  replace: (node: DOMNode) => {
    if (node.type === "tag" && (node as { name: string }).name === "a") {
      // Force noopener on links for safety.
      const tagNode = node as unknown as { attribs: Record<string, string> };
      tagNode.attribs = {
        ...tagNode.attribs,
        rel: tagNode.attribs.rel ?? "noopener noreferrer",
        target: tagNode.attribs.target ?? "_blank",
      };
    }
    return undefined;
  },
};

/**
 * Renders an HTML-formatted string from author-controlled JSON safely.
 *
 * Why we sanitize even author content: while authors are nominally trusted,
 * Studio (Phase 2) and Live (Phase 3) introduce flows where one user authors
 * content others render in their own browser. Sanitizing in @kukui/core means
 * every consumer is safe by default rather than trusting each surface to do
 * the right thing.
 */
export function SafeHtml({ html, as, className }: SafeHtmlProps) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
    // Pin the URI scheme allow-list to what Kukui actually uses, instead of
    // relying on DOMPurify's defaults. Blocks ftp, callto, xmpp, matrix,
    // sms, cid, and any future schemes upstream decides to permit.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):)/i,
  });
  return createElement(
    as ?? "div",
    { className },
    parse(clean, parserOptions) as ReactNode,
  );
}

export type SafeHtmlProps = {
  html: string;
  as?: ElementType;
  className?: string;
};

/**
 * Renders an author-supplied inline SVG safely. SVG can't go through
 * {@link SafeHtml} — its allow-list strips `<svg>` entirely — so this uses
 * DOMPurify's dedicated SVG profile, which keeps shapes, paths, text, and
 * presentation attributes while removing the dangerous surface:
 *   - `<script>` and event handlers (`onload`, `onclick`, …) are dropped.
 *   - `<foreignObject>` is forbidden (it can smuggle arbitrary HTML/JS).
 *   - `javascript:` / external-resource URIs in href/xlink:href are stripped.
 *
 * The sanitized markup is injected via `dangerouslySetInnerHTML` rather than
 * parsed to React elements, because html-react-parser lowercases attribute
 * names and would break case-sensitive SVG attributes like `viewBox`. This is
 * safe: the string is already sanitized, and `innerHTML` never executes
 * `<script>` even if one slipped through.
 *
 * Used for activity diagrams (e.g. clinical-case anatomy pathways). Pass
 * `title` for an accessible name; without it the figure is decorative.
 */
export function SafeSvg({ svg, className, title }: SafeSvgProps) {
  const clean = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Belt-and-braces on top of the SVG profile: never allow these even if
    // a future DOMPurify default loosens.
    FORBID_TAGS: ["script", "foreignObject"],
    ADD_ATTR: ["viewBox", "preserveAspectRatio"],
  });
  return createElement("figure", {
    className,
    ...(title ? { role: "img", "aria-label": title } : { "aria-hidden": "true" }),
    dangerouslySetInnerHTML: { __html: clean },
  });
}

export type SafeSvgProps = {
  svg: string;
  className?: string;
  /** Accessible name for the diagram. Omit for purely decorative SVG. */
  title?: string;
};

/**
 * Strips HTML tags, returning plain text for aria-labels and similar contexts.
 * Uses DOMParser when available so we never assign untrusted strings to live
 * DOM properties; falls back to a regex strip in non-browser environments.
 */
export function htmlToText(html: string): string {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
