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
export const AppearanceSchema = z
  .object({
    theme: z.enum(["auto", "light", "dark"]).optional(),
  })
  .strict();

export type Appearance = z.infer<typeof AppearanceSchema>;
