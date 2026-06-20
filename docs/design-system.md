# Kukui — Design System

Single source of truth for visual design across all 7 activity types. Anything you'd be tempted to invent per-controller (color hex, padding value, font size) should come from here.

## Principles

1. **Educational utility first.** Visual interest serves learner clarity, never competes with content.
2. **Layout-stable interactions.** State changes must not reflow neighbors. Reserve space; change colors only. (See `docs/lessons-learned/uss-and-ui-toolkit-runtime.md` §2.)
3. **Touch-target minimum 44 × 44 px.** WCAG 2.2 AA target size and Apple HIG. Buttons get `min-height: 44`.
4. **Contrast ratio ≥ 4.5:1** for body text on its background. Use the palette below; don't ad-hoc colors.
5. **Hawaiian cultural framing without cliché.** Neutral cool-grey surfaces with a muted **sage/eucalyptus green** (`#4A7A5F`, softened to `#8FC0A4` on dark) as the single brand color — calm and desaturated, still dark enough to carry white text, paired with the warm kukui-brown logo. It drives **primary actions** (buttons, selection, focus) and the **activity-header accent**. The **Bloom-level highlights** (section edges/dots) are pastel tints of each level's hue. Kalo-green success; a warm ochre `Warning` and a restrained deep-ocean (`kai`) `Info` teal round out the semantic palette. The kukui-brown survives as the **logo** and the "Create" Bloom dot. No garish tropical cyans — accents stay muted and content-driven.

## Color tokens

Defined as `static readonly Color` constants. Do not introduce new hex values without adding a token here first.

| Token | RGB | Hex | Use |
|---|---|---|---|
| `Bg` | `0.957, 0.961, 0.965` | `#F4F5F6` | Page background (neutral cool grey) |
| `Surface` | `1, 1, 1` | `#FFFFFF` | Card/answer background |
| `TextPrimary` | `0.094, 0.102, 0.110` | `#181A1C` | Body text, titles |
| `TextSecondary` | `0.306, 0.329, 0.357` | `#4E545B` | Subtitles, captions, secondary copy. ≈ 7.1:1 on `Surface` |
| `Border` | `0.831, 0.847, 0.867` | `#D4D8DD` | Default 1–2 px borders |
| `BorderHover` | `0.702, 0.725, 0.753` | `#B3B9C0` | Border on hover (no fill change) |
| `Primary` | `0.290, 0.478, 0.373` | `#4A7A5F` | Primary action, selection, focus — muted sage green. ≈ 5.0:1 on `Surface`. Dark scheme softens to `#8FC0A4` (with a dark `OnPrimary`). |
| `PrimaryHover` | `0.247, 0.420, 0.322` | `#3F6B52` | Primary on hover |
| `OnPrimary` | — | `#FFFFFF` | **Foreground for anything filled with `Primary`.** Always use this token, never a literal white — themes whose `Primary` is a *light* color (dark, OLED, high-contrast-dark, kalo, twilight) override it to a dark value so text/icons stay ≥4.5:1. Each `[data-color-scheme]` block sets its own `--color-on-primary`. |
| `PrimarySoft` | `Primary @ 0.07 alpha` | — | Selected answer fill (very light) |
| `Accent` | `0.290, 0.478, 0.373` | `#4A7A5F` | Activity-header accent (same muted sage as `Primary`; kept as its own token so the header can diverge later). Dark scheme softens to `#8FC0A4`. |
| `AccentSoft` | `Accent @ 0.10 alpha` | — | Header/active-state fill tint |
| `Success` | `0.180, 0.431, 0.255` | `#2E6E41` | Correct answers, kalo green |
| `SuccessSoft` | `Success @ 0.10 alpha` | — | Correct answer fill |
| `Error` | `0.764, 0.255, 0.196` | `#C34132` | Wrong answers, validation errors |
| `ErrorSoft` | `Error @ 0.08 alpha` | — | Wrong answer fill |
| `Warning` | `0.541, 0.353, 0.071` | `#8A5A12` | Caution / "watch" / urgent / danger-zone accents — warm ochre. ≈ 5.1:1 on `Surface`. Always paired with an icon + text label, never color alone. Per-scheme overrides keep it AA (lighter ambers on dark schemes) |
| `WarningSoft` | `Warning @ 0.10 alpha` | — | Caution fill (watch vitals, urgent steps) |
| `Info` | `0.122, 0.435, 0.471` | `#1F6F78` | Neutral / anatomical / informational accents — a muted deep-ocean (`kai`) teal, not a tropical cyan. ≈ 4.9:1 on `Surface`. Per-scheme overrides keep it AA |
| `InfoSoft` | `Info @ 0.10 alpha` | — | Informational fill (neutral findings, legend swatches) |
| `TipBg` | `0.925, 0.933, 0.945` | `#ECEEF1` | Tip / hint area |
| `TextMuted` | `0.369, 0.392, 0.420` | `#5E646B` | Tertiary / fine-print text (model attribution footers). ≈ 5.5:1 on `Surface`, ≈ 4.6:1 on `SurfaceAlt` — passes AA for body text; reserve for 12–13 px asides |
| `Revealed` | `0.478, 0.361, 0.678` | `#7A5CAD` | "Revealed" state (e.g. crossword reveal-letter). Used only as a ≤ 22% tint over `Surface` and always paired with a mark glyph (◔) — never as a text color. White text on the full hex is ≈ 5.3:1 if ever needed |
| `Canvas3D` | `0.043, 0.043, 0.063` | `#0B0B10` | 3D viewport backdrop (Hotspot 3D, Virtual Tour). White pin text on it is ≈ 19:1; per-scheme overrides keep it near-black so pins stay AA |

## Spacing scale

Use these values only. Skip granularity that isn't here.

| Token | px | Use |
|---|---|---|
| `xs` | 4 | Tight inline gaps (between adjacent inline elements) |
| `sm` | 8 | Stack gap between siblings (e.g. answer rows) |
| `md` | 12 | Internal padding for compact cells (tip bar) |
| `lg` | 16 | Card-row padding |
| `xl` | 20 | Section breathing room |
| `xxl` | 24 | Page-level padding |
| `xxxl` | 28 | Card padding |

## Form field widths (Studio editor)

Authoring inputs are fluid (`width: 100%`) but **capped** so a one-digit number field and a long URL don't both stretch the full panel width. Caps are content-type tokens; the form itself is bounded to a reading column.

| Token | Value | Use |
|---|---|---|
| `--field-w-xs` | `7rem` | Number / integer / stepper |
| `--field-w-sm` | `14rem` | Slug, short code, `<select>` |
| `--field-w-md` | `24rem` | Default single-line text (title, name) |
| `--field-w-lg` | `38rem` | URL, email, long single-line |
| `--form-measure` | `44rem` | Max width of the whole form column (`.ks-object--root`); matches the card `max-width: 720` |

Textareas and the rich-text editor are intentionally **uncapped** — they earn the width and are bounded by `--form-measure`. Per-field override: set `ui:options.width` to `"xs" | "sm" | "md" | "lg" | "full"` in the uiSchema; `FieldTemplate` maps it to a `ks-field--w-*` class that wins over the per-type default. Buttons never stretch — the array **Add** button is `align-self: flex-start`, not `stretch`.

## Border radius scale

| Token | px | Use |
|---|---|---|
| `r-pill` | 4 | Tiny dots / pills |
| `r-sm` | 6 | Inline pills, hint bar |
| `r-md` | 8 | Buttons, answer rows |
| `r-lg` | 10 | Feedback panels |
| `r-card` | 12 | Cards |

## Border widths

- **All visible borders are 2 px.** Don't change widths between states (layout shift). Change color only.
- 1 px is acceptable for whisper-quiet card outline only.
- 0 px on filled buttons (they use color contrast, not stroke).

## Elevation

One shared shadow token for cards/panels. Subtle by design — depth as a quiet
cue, not a drop-shadow flourish. Pair with a 1 px border (the shadow softens the
edge; the border keeps the boundary crisp on dark schemes where the shadow
disappears).

| Token | Value | Use |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgb(0 0 0 / 0.06), 0 6px 16px rgb(0 0 0 / 0.07)` | Activity card / panel elevation |

## Type scale

**Family:** Inter Variable, self-hosted at `apps/studio-app/public/fonts/InterVariable.woff2` (~344KB, single file with weight axis 100–900 + slant). Loaded via `@font-face` with `font-display: swap`; falls back to `ui-sans-serif, system-ui, -apple-system, …` while the woff2 is fetching on first load.

Body opt-in features: `font-feature-settings: "cv11", "ss03"` (single-storey `a`, sharper `i J l` stems). `text-rendering: optimizeLegibility` + grayscale font-smoothing. Numeric elements (badges, counts) add `font-variant-numeric: tabular-nums` to prevent digit reflow.

**Display family (activity headings):** in-activity titles (the `__title` element of every activity card) render in `--font-family-display` — an editorial serif stack (`"Iowan Old Style", "Apple Garamond", Baskerville, "Times New Roman", serif`; engine bundles don't embed a serif to keep SCORM zips small, so the host platform's best serif resolves) at **weight 500**, letter-spacing `-0.005em`. This serif-at-500 treatment is the canonical heading style for learner-facing activity titles. The Inter weights below apply to app chrome (Studio UI, wordmark, panels), not activity headings.

Heading weights are **600** (formerly 700) — Inter at 700 is too dense at UI sizes. Letter-spacing tightens with size:

- Display/title (16px+): `-0.015em`
- Subtitle (15–17px): `-0.005em`
- Body and below: 0
- Uppercase headings (sidebar group labels): `+0.06em`

| Token | px | Weight | Use |
|---|---|---|---|
| `display` | 28 | 650 | Activity title (hero) — use sparingly |
| `title` | 22 | 650 | Brand wordmark, card / section title (was 24; Inter is optically wider) |
| `subtitle` | 17 | 500 | Section intro (was 18) |
| `prompt` | 16 | 400 | Question text, body |
| `answer` | 15 | 500 | Answer button label |
| `caption` | 14 | 400 | Tertiary info, score line |
| `meta` | 13 | 400–600 | Hints, panel headings, badges |
| `micro` | 12 | 600 | Sidebar group labels (uppercase), fine print |

Always set `whiteSpace = WhiteSpace.Normal` on labels that may wrap.

## Component patterns

### Answer button

- Size: `min-height 48`, padding `12/16`
- Type: `answer` (15 px)
- Border: 2 px, color reflects state (`Border` / `BorderHover` / `Primary` / `Success` / `Error`)
- Background: `Surface` default, soft tints for non-default states
- Margin: 8 below

### Primary button (Submit/Check)

- Size: `min-height 44`, padding `10/20`
- Type: 15 px Bold, white on `Primary` fill
- No border, 8 px radius
- Disabled: alpha 0.35 fill + 0.6 opacity

### Secondary button (Retry, Show solution)

- Same dimensions as primary
- Border 2 px in `Primary`, transparent fill, `Primary` text
- Aligned `flex-start` (not stretched)

### Card

- Padding: 28
- Radius: 12
- Border: 1 px `Border` (whisper outline)
- `max-width: 720`, centered with `align-self: Center`

### Feedback / review panel

- Border 2 px in state color (`Success` / `Error`)
- Soft fill (state @ 0.08–0.12 alpha)
- 16 padding, 10 radius
- Inside: header row (title + score), optional body line, then per-item review list

### Hint bar (pre-submit tip on hover)

- Pre-allocated **44 px min-height** so opacity 0→1 doesn't shift layout
- Use `style.opacity` to show/hide, not `display`
- 13 px text, secondary color, `TipBg` background

## Interaction rules

- **No layout shifts on state change.** Reserve space upfront; transition opacity/color only.
- **Hover is feedback, not decoration.** Border-darken on hover for any clickable.
- **Disabled state is visible.** Reduce opacity to 0.6 and dim fill alpha; never rely on cursor change alone.
- **Tap targets ≥ 44 × 44.** No exceptions for primary actions.

## Accessibility — WCAG 2.2 AA (target conformance)

Educational content at US universities falls under Section 508 and similar state laws. WCAG 2.2 AA is a legal floor for what we ship to D2L, not an aspiration.

### Conformance requirements

- **Contrast**:
  - 4.5:1 for body text against its background
  - 3:1 for large text (≥ 18 pt regular, or ≥ 14 pt bold)
  - 3:1 for UI components and meaningful graphical objects (icons, dots, borders that convey state)
  - Account for *rendered* color over alpha-blended backgrounds, not the token's nominal hex
- **Color is never the sole signal.** Pair every state-color with one of: a text label, an icon, a position cue, or per-item feedback text. (The colored dot + answer text + feedback line in the review panel is a good pattern.)
- **Tap targets ≥ 44 × 44 px** (Apple HIG; WCAG 2.5.5 target size)
- **Keyboard navigation**:
  - Every interactive element reachable via Tab in a logical order
  - Space / Enter activates focused buttons; arrow keys may navigate within radio-style answer groups
  - Visible focus indicator: 2 px `Primary` outline with 2 px offset (planned `:focus-visible` style)
- **Screen reader / assistive tech**:
  - Use semantic `Button` (not styled `VisualElement`) so accessibility nodes expose role correctly
  - Set `tooltip` on each button to provide an accessible name; include state ("Honolulu, not selected, 1 of 3")
  - Status changes (selection added, submitted, score posted) announced via Live region equivalent
- **Text resize**: content must survive a 200% zoom (browser-side) without horizontal scrollbars or content loss
- **Reduced motion**: when `prefers-reduced-motion` is set at the SCORM wrapper / page level, skip non-essential transitions; still show end states
- **Time limits**: if added (not in MVP), configurable and pause-able; never hidden
- **Error identification**: when validation rejects input (e.g., empty Fill-in-the-Blanks field), the error message is text, names the field, and suggests a fix

### Cognitive accessibility

- Plain language: aim for grade 9 reading level for chrome (button labels, instructions); content can be discipline-specific
- Predictable interactions: same button does the same thing across activities
- Avoid time pressure unless the assessment requires it
- Provide retry for low-stakes practice; instructor can disable for summative use

## Design principles (UX heuristics for quiz UI)

1. **Visibility of system state.** Every action gives feedback within 100 ms. Operations >1 s show a loading state. Score posting shows a confirmation toast.
2. **Match real-world conventions.** "Submit" / "Check" / "Try again" — never invented verbs.
3. **User control & freedom.** Retry exists where allowed; nothing is destructive without confirmation.
4. **Consistency.** An "answer button" looks and behaves identically across all 7 activities. Selected = orange border. Correct = green. Wrong = red. Always.
5. **Error prevention.** Submit is disabled until a selection exists. Required fields are marked.
6. **Recognition over recall.** Selected state persists visually until cleared.
7. **Aesthetic minimalism.** Every visible element earns its place. No decorative chrome, no Hawaiian-cliché palm trees, no gradients.

## Educational content design

Quiz UI is a learning environment, not just a form. These rules trump generic UX templates.

- **Constructive feedback tone.** "Not quite — review below" beats "Wrong." Explain *why* an answer is incorrect, not just that it is.
- **Score framing as mastery, not judgment.** Show fraction + percentage + a band-specific message ("Close — nice work" vs "80%").
- **Praise specificity.** Per-answer feedback that explains the underlying concept ("Correct! H₂O is split during the light reactions...") teaches more than a generic "Right!" Use the per-answer `feedback` field.
- **Failure is a learning step.** "Show Solution" is opt-in, not punitive. Give learners control over when they see the answer.
- **Cognitive load minimum.** 3–6 answers ideal for Multiple Choice; 7+ overloads working memory. Long question stems should be ≤ 2 sentences. Multi-blank Fill-in-the-Blanks should be ≤ 3 blanks per item.
- **Cultural framing without tokenism.** Hawaiian context is content-driven (kalo, voyaging canoes, place-name geography), not decorative.

## Component pattern checklist

Every new component must satisfy ALL of these before it ships:

- [ ] Has default, hover, focus (keyboard), disabled, and active states
- [ ] Border width is **constant** across states (color changes only — layout-stable)
- [ ] State change does not reflow neighbors
- [ ] Tap target ≥ 44 × 44 px
- [ ] Color signal is paired with text, icon, or position
- [ ] Reachable + activatable via keyboard (Tab, Space/Enter)
- [ ] Survives 200% text resize without horizontal scroll
- [ ] Documented in this file with a code snippet
- [ ] At least one fixture JSON exercises the component visually

## Performance budgets (mirror of design spec §"Device targets")

- ≤ 25 MB compressed initial download per WebGL build (Brotli post-decompression)
- 256 MB heap default; 384 MB for 3D activities
- Time-to-interactive ≤ 5 s on 50 Mbps wifi for 2D, ≤ 8 s for 3D
- 30 fps floor on iPhone 12 / iPad Air 4 / mid-range Android; 60 fps on laptops

## Old "Accessibility floor (MVP)" — now subsumed above
Earlier versions of this doc had a smaller "MVP floor" section. Superseded by the WCAG 2.2 AA section above; the superset applies.

## Future (deliberately not in MVP)

- Animations / transitions — UI Toolkit runtime support is uneven; revisit
- Dark mode — postponed
- High-contrast mode — postponed
- Localization — UI strings already live in JSON `ui` blocks; framework wiring is future work

## Implementation note

These tokens currently live as `static readonly` constants inside each Controller (copy-paste). Consolidate into `Kukui.Core.UI.KukuiPalette` when adding the next activity controller, so all 7 share one definition.
