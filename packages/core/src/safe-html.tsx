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
