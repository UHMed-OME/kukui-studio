import type { CSSProperties } from "react";

/**
 * Tiny credit line shown beneath every activity in the integrated runtime
 * (engine-web's ActivityHost) — and now mirrored in Studio's live preview so
 * authors see exactly what learners will. Identifies the platform (links back
 * to the open-source repo + license) and surfaces the author's name when the
 * JSON sets one. Stays out of the way visually so it doesn't compete with the
 * activity's own UI.
 */
type Credit = { author: string; authorUrl?: string; sourceUrl?: string; license?: string; licenseUrl?: string };

const link = (href: string | undefined, text: string) =>
  href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
      {text}
    </a>
  ) : (
    text
  );

/** Distinct per-question image credits (quiz-style activities with questions[].image.attribution). */
function questionCredits(config: unknown): Credit[] {
  const qs = (config as { questions?: { image?: { attribution?: Credit } }[] } | undefined)?.questions;
  if (!Array.isArray(qs)) return [];
  const seen = new Map<string, Credit>();
  for (const q of qs) if (q?.image?.attribution) seen.set(JSON.stringify(q.image.attribution), q.image.attribution);
  return [...seen.values()];
}

export function ActivityFooter({ author, config }: { author?: string; config?: unknown }) {
  return (
    <footer style={footerStyle}>
      {author ? (
        <>
          Authored by <strong>{author}</strong>
          {" · "}
        </>
      ) : null}
      {questionCredits(config).map((c) => (
        <span key={JSON.stringify(c)}>
          Image by {link(c.authorUrl, c.author)}
          {c.sourceUrl ? <> · {link(c.sourceUrl, "View original")}</> : null}
          {c.license ? <> · {link(c.licenseUrl, c.license)}</> : null}
          {" · "}
        </span>
      ))}
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
