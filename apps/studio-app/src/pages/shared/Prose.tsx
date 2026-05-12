import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownLink } from "./MarkdownLink.js";

/**
 * Shared markdown-to-prose renderer. Encapsulates the react-markdown +
 * remark-gfm + internal-link routing setup so docs and blog pages share
 * a single rendering surface.
 */
export function Prose({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MarkdownLink }}>
      {children}
    </ReactMarkdown>
  );
}
