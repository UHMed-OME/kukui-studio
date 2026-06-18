import { useState } from "react";
import type { WidgetProps } from "@rjsf/utils";
import { ActivityIcon } from "@kukui/core";

/**
 * Notion-style icon picker. The stored value is a string: either a plain
 * emoji (e.g. "🩺") or a token-glyph code `glyph:<name>:<tone>` (e.g.
 * "glyph:trophy:success"). Glyph colours come from the design tokens — no
 * raw hex picker, per the design system. Rendered at runtime by
 * @kukui/core's <ActivityIcon>.
 */

const EMOJIS = [
  "🩺", "🧠", "🫀", "🦴", "🩻", "💊", "🧬", "🔬", "🧪", "🩹",
  "🌡️", "📋", "📝", "📖", "🎓", "🧑‍⚕️", "🦷", "👁️", "🫁", "🩸",
  "⚕️", "🏥", "💉", "🔍", "🗺️", "🧩", "✍️", "🎙️", "🎬", "🃏",
  "🌳", "📊", "📈", "⭐", "✅", "⚠️", "❓", "💡", "🧭", "🔑",
];
const GLYPHS = ["kukui", "check", "trophy", "clock", "dot", "x"];
const TONES = ["primary", "success", "warning", "info", "error", "neutral"];

export function IconPickerWidget({ value, onChange, id, disabled, readonly }: WidgetProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"emoji" | "glyph">("emoji");
  const [tone, setTone] = useState("primary");
  const v = typeof value === "string" ? value : "";

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="ks-iconpicker">
      <div className="ks-iconpicker__row">
        <button
          type="button"
          id={id}
          className="ks-iconpicker__trigger"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled || readonly}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          {v ? (
            <ActivityIcon value={v} className="ks-iconpicker__current" />
          ) : (
            <span className="ks-iconpicker__placeholder">Pick an icon</span>
          )}
        </button>
        {v ? (
          <button
            type="button"
            className="ks-iconpicker__clear"
            onClick={() => onChange("")}
          >
            Remove
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="ks-iconpicker__panel" role="dialog" aria-label="Icon picker">
          <div className="ks-iconpicker__tabs" role="tablist" aria-label="Icon type">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "emoji"}
              className={tab === "emoji" ? "is-active" : ""}
              onClick={() => setTab("emoji")}
            >
              Emoji
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "glyph"}
              className={tab === "glyph" ? "is-active" : ""}
              onClick={() => setTab("glyph")}
            >
              Glyph
            </button>
          </div>

          {tab === "emoji" ? (
            <>
              <input
                className="ks-iconpicker__input"
                placeholder="Type or paste an emoji…"
                maxLength={8}
                aria-label="Custom emoji"
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val) pick(val);
                }}
              />
              <div className="ks-iconpicker__grid">
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    className="ks-iconpicker__cell"
                    onClick={() => pick(em)}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="ks-iconpicker__tones" role="group" aria-label="Glyph colour">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-label={t}
                    aria-pressed={tone === t}
                    className={[
                      "ks-iconpicker__tone",
                      `ks-iconpicker__tone--${t}`,
                      tone === t ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setTone(t)}
                  />
                ))}
              </div>
              <div className="ks-iconpicker__grid">
                {GLYPHS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className="ks-iconpicker__cell"
                    aria-label={g}
                    onClick={() => pick(`glyph:${g}:${tone}`)}
                  >
                    <ActivityIcon value={`glyph:${g}:${tone}`} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
