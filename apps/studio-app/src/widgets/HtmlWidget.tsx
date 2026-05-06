import { useRef, type ChangeEvent } from "react";
import type { WidgetProps } from "@rjsf/utils";

/**
 * RJSF widget for HTML-formatted text fields. Renders a textarea with a
 * formatting toolbar above it. Each toolbar button wraps the current
 * text-selection in tags rather than parsing/rendering rich text — the
 * stored value remains a simple HTML string compatible with everything
 * downstream (Zod validation, SafeHtml render, SCORM zip, etc.).
 *
 * Used for question prompts, 3D-hotspot prompts, slide HTML elements,
 * and overlay text content. Authors who want raw HTML can still type
 * tags directly — the toolbar is additive.
 */
export function HtmlWidget(props: WidgetProps) {
  const { value, onChange, id, disabled, readonly, placeholder, options } = props;
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (before: string, after: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const selected = text.slice(start, end);
    const placeholderText = selected.length === 0 ? "text" : selected;
    const next = text.slice(0, start) + before + placeholderText + after + text.slice(end);
    onChange(next);
    // After React re-renders, restore selection over the inserted span so
    // the author can keep typing or apply another tag.
    requestAnimationFrame(() => {
      el.focus();
      const newStart = start + before.length;
      const newEnd = newStart + placeholderText.length;
      el.setSelectionRange(newStart, newEnd);
    });
  };

  const insertLink = () => {
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    wrapSelection(`<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">`, "</a>");
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const rows = (options?.rows as number | undefined) ?? 3;

  return (
    <div className="ks-html">
      <div className="ks-html__toolbar" role="toolbar" aria-label="HTML formatting">
        <ToolbarButton title="Bold" onClick={() => wrapSelection("<strong>", "</strong>")}>
          <span style={{ fontWeight: 800 }}>B</span>
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => wrapSelection("<em>", "</em>")}>
          <span style={{ fontStyle: "italic" }}>I</span>
        </ToolbarButton>
        <ToolbarButton title="Subscript" onClick={() => wrapSelection("<sub>", "</sub>")}>
          x<sub>2</sub>
        </ToolbarButton>
        <ToolbarButton title="Superscript" onClick={() => wrapSelection("<sup>", "</sup>")}>
          x<sup>2</sup>
        </ToolbarButton>
        <ToolbarButton title="Inline code" onClick={() => wrapSelection("<code>", "</code>")}>
          {"</>"}
        </ToolbarButton>
        <ToolbarButton title="Link…" onClick={insertLink}>
          🔗
        </ToolbarButton>
        <span className="ks-html__divider" aria-hidden="true" />
        <ToolbarButton title="Paragraph" onClick={() => wrapSelection("<p>", "</p>")}>
          ¶
        </ToolbarButton>
        <ToolbarButton
          title="Heading 2"
          onClick={() => wrapSelection("<h2>", "</h2>")}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title="Bullet list item"
          onClick={() => wrapSelection("<li>", "</li>")}
        >
          •
        </ToolbarButton>
      </div>
      <textarea
        ref={ref}
        id={id}
        value={typeof value === "string" ? value : ""}
        onChange={handleChange}
        disabled={disabled}
        readOnly={readonly}
        placeholder={placeholder}
        rows={rows}
        spellCheck
        className="ks-html__textarea"
      />
    </div>
  );
}

function ToolbarButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className="ks-html__btn"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
