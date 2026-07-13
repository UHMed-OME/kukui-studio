import { InlineEdit } from "./InlineEdit.js";

/**
 * Shared stage header for the visual editors. Renders the two fields every
 * activity carries — `title` and `prompt` — as hover-to-edit inline fields
 * above the editor's canvas, so the author edits them where they're looking
 * instead of hunting for them in the form. With these on the stage, the Editor
 * form drops title/prompt entirely (see each activity's `ui-schema`).
 *
 * Title is plain text (schema: `z.string().min(1)`), so it's a straightforward
 * inline text field. Prompt is authored through the rich-text (`html`) widget,
 * so it can hold markup. To avoid silently flattening that markup, the prompt
 * is editable inline ONLY when it's "simple" (plain text optionally wrapped in a
 * single <p>, with <br> line breaks). When it carries richer formatting (bold,
 * lists, links…), the header shows a read-only rendered preview and points the
 * author at the form — the only lossless path for rich content.
 *
 * Every edit flows through `onPatch`, which the host editor merges into its
 * config and forwards to the Studio's single `onChange` pipeline — so
 * auto-save, undo/redo, and the validation badge all keep working unchanged.
 */

/** True when the HTML carries formatting beyond plain text in a single <p>/<br>. */
function isRichHtml(html: string): boolean {
  if (!html) return false;
  const stripped = html
    .trim()
    .replace(/^<p>([\s\S]*)<\/p>$/i, "$1")
    .replace(/<br\s*\/?>/gi, "");
  return /<[^>]+>/.test(stripped);
}

/** Render simple prompt HTML as the plain text an author would type. */
function htmlToPlain(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  ).trim();
}

/** Decode the handful of entities our HTML uses, &amp; last to avoid double-decoding. */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&");
}

/** Escape text so author-typed <, >, & can't inject markup when wrapped in HTML. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Wrap freshly-typed plain text back into the <p>-wrapped HTML the runtime expects. */
function plainToHtml(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  return `<p>${escapeHtml(trimmed).replace(/\n/g, "<br>")}</p>`;
}

export function StageHeader({
  title,
  prompt,
  promptRequired = false,
  onPatch,
}: {
  title: string;
  prompt: string;
  /** Whether the activity's schema requires a non-empty prompt (drives the placeholder). */
  promptRequired?: boolean;
  onPatch: (patch: { title?: string; prompt?: string }) => void;
}) {
  const rich = isRichHtml(prompt);
  const promptPlaceholder = promptRequired
    ? "Tell the learner what to do…"
    : "Add an optional prompt…";

  return (
    <div className="ks-stage-head">
      <InlineEdit
        value={title}
        ariaLabel="Activity title"
        editLabel="Edit activity title"
        placeholder="Untitled activity"
        valueClassName="ks-stage-head__title"
        onCommit={(next) => onPatch({ title: next })}
      />
      {rich ? (
        <div className="ks-stage-head__prompt-rich">
          <div
            className="ks-stage-head__prompt-render"
            // Same HTML the live component renders; read-only here.
            dangerouslySetInnerHTML={{ __html: prompt }}
          />
          <p className="ks-stage-head__hint">
            Formatted prompt. Edit it in the <strong>Editor</strong> form on the right to keep its formatting.
          </p>
        </div>
      ) : (
        <InlineEdit
          value={htmlToPlain(prompt)}
          multiline
          ariaLabel="Activity prompt"
          editLabel="Edit activity prompt"
          placeholder={promptPlaceholder}
          valueClassName="ks-stage-head__prompt"
          onCommit={(next) => onPatch({ prompt: plainToHtml(next) })}
        />
      )}
    </div>
  );
}
