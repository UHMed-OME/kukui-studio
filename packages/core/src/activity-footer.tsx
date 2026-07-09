import type { CSSProperties } from "react";

/**
 * Tiny credit line shown beneath every activity in the integrated runtime
 * (engine-web's ActivityHost) — and now mirrored in Studio's live preview so
 * authors see exactly what learners will. Identifies the platform (links back
 * to the open-source repo + license) and surfaces the author's name when the
 * JSON sets one. Stays out of the way visually so it doesn't compete with the
 * activity's own UI.
 */
export function ActivityFooter({ author }: { author?: string }) {
  return (
    <footer style={footerStyle}>
      {author ? (
        <>
          Authored by <strong>{author}</strong>
          {" · "}
        </>
      ) : null}
      Made with{" "}
      <a
        href="https://github.com/UHMed-OME/kukui-studio"
        target="_blank"
        rel="noopener noreferrer"
        style={linkStyle}
      >
        Kukui Studio
      </a>
      {" · "}
      <a
        href="https://opensource.org/license/mit"
        target="_blank"
        rel="noopener noreferrer"
        style={linkStyle}
      >
        MIT
      </a>
    </footer>
  );
}

const footerStyle: CSSProperties = {
  maxWidth: 720,
  margin: "12px auto 16px",
  padding: "0 28px",
  fontSize: 12,
  color: "var(--color-text-muted, #6e6e76)",
  textAlign: "center",
  lineHeight: 1.6,
};

const linkStyle: CSSProperties = { color: "inherit", textDecoration: "underline" };
