import { z } from "zod";

/**
 * Author-pinned appearance options for an activity. Currently a single
 * field — `theme` — but lives in its own block so additions (font
 * scaling, motion preferences, etc.) don't churn every activity schema.
 *
 * Semantics:
 *   - "auto" (or omitted): follow the learner's OS preference at boot
 *     and live-update if they toggle it (via initColorScheme in
 *     engine-web/main.tsx). This is the default and right answer for
 *     accessibility.
 *   - "light" / "dark": pin the engine to this scheme regardless of OS
 *     or stored preference. ActivityHost calls applyColorScheme after
 *     the config validates, overriding what initColorScheme set.
 *
 * Pinning is one-way: the engine has no in-activity toggle, so once
 * the author picks light or dark, the learner stays there for the
 * session.
 */
/**
 * All concrete color schemes the engine, Studio, and Live know how to
 * render. Each value corresponds to a `[data-color-scheme="<value>"]`
 * CSS token block in the apps' styles.css. "auto" means no pin — the
 * engine falls back to the learner's OS preference at boot.
 */
export const THEME_VALUES = [
  "auto",
  "light",
  "dark",
  "high-contrast",
  "high-contrast-dark",
  "sepia",
  "oled",
  "print",
  "aloha",
  "kalo",
  "lab",
  "twilight",
  "kai",
] as const;

export type Theme = (typeof THEME_VALUES)[number];

export const HEADER_STYLES = ["full", "minimal"] as const;
export type HeaderStyle = (typeof HEADER_STYLES)[number];

export const AppearanceSchema = z
  .object({
    /**
     * Defaulted to "auto" so the editor dropdown always shows a value
     * (rather than an empty/placeholder option), and so config consumers
     * can read `theme` without an additional undefined check. Zod's
     * `.default()` only kicks in when the field is absent or undefined
     * on parse; existing JSON with `theme: "dark"` is preserved.
     */
    theme: z.enum(THEME_VALUES).default("auto"),
    /**
     * Header treatment for the activity's shared ActivityHeader:
     * "full" = gradient banner with the kukui watermark; "minimal" = a
     * plain titled block. Optional (NOT defaulted): a `.default()` here
     * would become `required` in z.toJSONSchema and trip AJV on every
     * activity whose `appearance` default literal omits it. Consumers
     * read `appearance?.header ?? "full"`.
     */
    header: z.enum(HEADER_STYLES).optional(),
  })
  .strict();

export type Appearance = z.infer<typeof AppearanceSchema>;
