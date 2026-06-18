export type {
  ScoreState,
  ActivityProps,
  ActivityKind,
  ScoreBand,
} from "./types.js";
export { ACTIVITY_KINDS } from "./types.js";
export { scoreSelection, aggregate, percentage, bandMessage } from "./scoring.js";
export { loadContent, ContentLoadError } from "./content.js";
export {
  getScormDriver,
  __setScormDriverForTest,
  type ScormDriver,
  type DriverMode,
  type ScormDriverOptions,
  type WebResults,
} from "./scorm.js";
export { ActivityHost } from "./activity-host.js";
export { parseCollectConfig, type CollectConfig } from "./collect.js";
export {
  buildPayload,
  encodeCompletionCode,
  decodeCompletionCode,
  buildResultsDocument,
  scorePercent,
  type CompletionPayload,
  type ResultsDocument,
} from "./web-results.js";
export { SafeHtml, SafeSvg, htmlToText, type SafeHtmlProps, type SafeSvgProps } from "./safe-html.js";
export { tokens, tokensDark, activeTokens, type ColorToken } from "./tokens.js";
export {
  applyTheme,
  getInitialTheme,
  persistTheme,
  initTheme,
  type Theme,
} from "./theme.js";
export { ThemeToggle } from "./ThemeToggle.js";
export {
  applyColorScheme,
  getColorSchemePreference,
  persistColorSchemePreference,
  resolveColorScheme,
  setColorSchemePreference,
  initColorScheme,
  type ColorSchemePreference,
  type ResolvedColorScheme,
} from "./colorScheme.js";
// Activity components are no longer re-exported from the barrel — they're
// reached via the per-kind subpath (e.g. `@kukui/core/components/multiple-choice`)
// so Vite/Rollup can emit one chunk per activity instead of bundling all 24
// into a single shared chunk. Studio Preview and ActivityHost use the shared
// dispatch table in `./components/registry.ts`.
export {
  PLANNED_ACTIVITY_KINDS,
  PLANNED_LABELS,
  PLANNED_DESCRIPTIONS,
  type PlannedActivityKind,
} from "./planned.js";
