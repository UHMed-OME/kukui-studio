# SCORM Interaction Hygiene — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-05-14-scorm-interaction-hygiene.md`](../specs/2026-05-14-scorm-interaction-hygiene.md)

**Goal:** Add foundational plumbing so any activity can report per-question interactions to the SCORM API. No activity is wired yet — that's Phase B/C.

**Architecture:** New `recordInteraction(record)` method on the `ScormDriver` interface, implemented by both `PipwerksDriver` (writes `cmi.interactions.N.*`) and `MemoryDriver` (dev console log). Pure encoding helpers in `interaction-encoding.ts`. `ActivityProps.onInteraction` optional callback wired by `ActivityHost`. Parity method `RecordInteraction(json)` on `@kukui/bridge` for non-React integrations.

**Tech Stack:** TypeScript 5.7 strict, Vitest 3, pnpm workspaces. pipwerks SCORM 1.2 API surface unchanged.

**Out of scope for Phase A:** Activity components calling `onInteraction`. That's Phase B (Multiple Choice, Fill in the Blanks, Drag and Drop) and Phase C (everything else). Each gets its own plan doc once Phase A lands.

**Branch convention:** `feat/scorm-interactions-phase-a` — single PR.

---

### Task 1: Add interaction types to `@kukui/core/types`

**Files:**
- Modify: `packages/core/src/types.ts` (append new exports)

- [ ] **Step 1: Add the type exports**

Append to `packages/core/src/types.ts`:

```ts
/**
 * SCORM 1.2 §3.4.7.3 interaction types. The eight values are spec-defined;
 * adding new ones isn't permitted.
 */
export type InteractionType =
  | "true-false"
  | "choice"
  | "fill-in"
  | "matching"
  | "performance"
  | "sequencing"
  | "likert"
  | "numeric";

/**
 * Discriminated union mirroring SCORM 1.2 §3.4.7.9 cmi.interactions.N.result
 * vocabulary. `numeric` covers the spec's decimal 0..1 case.
 */
export type InteractionResult =
  | { kind: "correct" }
  | { kind: "wrong" }
  | { kind: "unanticipated" }
  | { kind: "neutral" }
  | { kind: "numeric"; value: number };

/**
 * One learner-question pairing for SCORM 1.2 cmi.interactions.N.* writes.
 * `id` must be stable across re-attempts so the LMS report aggregates
 * correctly — see the spec for the `<kind>:<configIdent>:<itemRef>` format.
 *
 * `description` is internal — it's surfaced in dev-console logs and reserved
 * for future xAPI / cmi5 work, but never written to SCORM (1.2 has no
 * description field; objectives.N.id is for learning-objective linkage and
 * is intentionally unused).
 */
export type InteractionRecord = {
  id: string;
  type: InteractionType;
  description?: string;
  studentResponse: string;
  correctResponse?: string;
  result: InteractionResult;
  weighting?: number;
  latencySeconds?: number;
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (new types are exported but not yet used; no errors).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat(core): add InteractionRecord / InteractionType / InteractionResult types"
```

---

### Task 2: Create `interaction-encoding.ts` with `truncateResponse`

**Files:**
- Create: `packages/core/src/interaction-encoding.ts`
- Create: `packages/core/src/interaction-encoding.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/interaction-encoding.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { truncateResponse } from "./interaction-encoding.js";

describe("truncateResponse", () => {
  it("leaves short strings unchanged", () => {
    expect(truncateResponse("hello")).toBe("hello");
  });

  it("returns input exactly at the 255-char limit", () => {
    const s = "x".repeat(255);
    expect(truncateResponse(s)).toBe(s);
    expect(truncateResponse(s).length).toBe(255);
  });

  it("truncates over-length input with a trailing ellipsis", () => {
    const s = "x".repeat(300);
    const out = truncateResponse(s);
    expect(out.length).toBe(255);
    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, 254)).toBe("x".repeat(254));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: FAIL with "Cannot find module './interaction-encoding.js'" or equivalent.

- [ ] **Step 3: Implement `truncateResponse`**

Create `packages/core/src/interaction-encoding.ts`:

```ts
/**
 * Pure helpers that encode in-memory interaction data to the wire format
 * required by SCORM 1.2 §3.4.7. No DOM, no SCORM API calls, no side
 * effects — every helper is referentially transparent so it can be tested
 * exhaustively.
 */

/** SCORM 1.2 CMIFeedback cap; applies to id, student_response, correct_responses.0.pattern. */
export const MAX_RESPONSE_CHARS = 255;

/** Trim to fit MAX_RESPONSE_CHARS, marking truncation with a trailing ellipsis. */
export function truncateResponse(text: string): string {
  if (text.length <= MAX_RESPONSE_CHARS) return text;
  return text.slice(0, MAX_RESPONSE_CHARS - 1) + "…";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interaction-encoding.ts packages/core/src/interaction-encoding.test.ts
git commit -m "feat(core): truncateResponse helper for SCORM 1.2 255-char cap"
```

---

### Task 3: `encodeChoice`

**Files:**
- Modify: `packages/core/src/interaction-encoding.ts`
- Modify: `packages/core/src/interaction-encoding.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/interaction-encoding.test.ts`:

```ts
import { encodeChoice } from "./interaction-encoding.js";

describe("encodeChoice", () => {
  it("returns the empty string for an empty selection", () => {
    expect(encodeChoice([])).toBe("");
  });

  it("emits a bare letter for a single selection (SCORM 1.2 single-choice form)", () => {
    expect(encodeChoice([0])).toBe("a");
    expect(encodeChoice([3])).toBe("d");
  });

  it("wraps multiple selections in braces (SCORM 1.2 multi-choice form)", () => {
    expect(encodeChoice([0, 2, 4])).toBe("{a,c,e}");
  });

  it("preserves selection order in the output", () => {
    expect(encodeChoice([2, 0])).toBe("{c,a}");
  });

  it("emits two-letter labels for index >= 26", () => {
    expect(encodeChoice([26])).toBe("aa");
    expect(encodeChoice([27])).toBe("ab");
    expect(encodeChoice([51])).toBe("az");
    expect(encodeChoice([52])).toBe("ba");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: FAIL — `encodeChoice is not exported`.

- [ ] **Step 3: Implement `encodeChoice`**

Append to `packages/core/src/interaction-encoding.ts`:

```ts
function letterFor(index: number): string {
  // SCORM 1.2 doesn't formally support more than 26 alternatives, but
  // activities like word-cloud / large hotspot sets can exceed it.
  // Fall through to two-letter labels (aa, ab, …) — Brightspace accepts
  // these in our testing and it preserves uniqueness.
  if (index < 26) return String.fromCharCode(97 + index);
  const first = Math.floor(index / 26) - 1;
  const second = index % 26;
  return String.fromCharCode(97 + first) + String.fromCharCode(97 + second);
}

/**
 * Encode a list of zero-based answer indices per SCORM 1.2 §3.4.7.5.
 *   []        → ""
 *   [0]       → "a"
 *   [0, 2, 4] → "{a,c,e}"
 */
export function encodeChoice(indices: readonly number[]): string {
  if (indices.length === 0) return "";
  if (indices.length === 1) return letterFor(indices[0]!);
  return `{${indices.map(letterFor).join(",")}}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: PASS, all `encodeChoice` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interaction-encoding.ts packages/core/src/interaction-encoding.test.ts
git commit -m "feat(core): encodeChoice (SCORM 1.2 §3.4.7.5)"
```

---

### Task 4: `encodeMatching`

**Files:**
- Modify: `packages/core/src/interaction-encoding.ts`
- Modify: `packages/core/src/interaction-encoding.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/interaction-encoding.test.ts`:

```ts
import { encodeMatching } from "./interaction-encoding.js";

describe("encodeMatching", () => {
  it("joins pairs with `.` between and `,` across (SCORM 1.2 matching form)", () => {
    expect(
      encodeMatching([
        { left: "1", right: "a" },
        { left: "2", right: "b" },
        { left: "3", right: "c" },
      ]),
    ).toBe("1.a,2.b,3.c");
  });

  it("emits an empty right-side for unplaced left items", () => {
    expect(
      encodeMatching([
        { left: "chip-glucose", right: "" },
        { left: "chip-insulin", right: "zone-pancreas" },
      ]),
    ).toBe("chip-glucose.,chip-insulin.zone-pancreas");
  });

  it("returns the empty string for an empty list", () => {
    expect(encodeMatching([])).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: FAIL — `encodeMatching is not exported`.

- [ ] **Step 3: Implement `encodeMatching`**

Append to `packages/core/src/interaction-encoding.ts`:

```ts
/**
 * SCORM 1.2 §3.4.7.5 matching form: `left.right,left.right`. Unplaced
 * left items use an empty right (`left.`). Used by drag-and-drop,
 * matching-pairs, categorization, anatomy-labeling, concept-map, lab-panel.
 */
export function encodeMatching(
  pairs: readonly { left: string; right: string }[],
): string {
  return pairs.map((p) => `${p.left}.${p.right}`).join(",");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interaction-encoding.ts packages/core/src/interaction-encoding.test.ts
git commit -m "feat(core): encodeMatching for drag/match/categorization activities"
```

---

### Task 5: `encodeSequencing`

**Files:**
- Modify: `packages/core/src/interaction-encoding.ts`
- Modify: `packages/core/src/interaction-encoding.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/interaction-encoding.test.ts`:

```ts
import { encodeSequencing } from "./interaction-encoding.js";

describe("encodeSequencing", () => {
  it("joins ordered ids with commas", () => {
    expect(encodeSequencing(["a", "b", "c"])).toBe("a,b,c");
  });

  it("preserves order exactly as given", () => {
    expect(encodeSequencing(["step-3", "step-1", "step-2"])).toBe(
      "step-3,step-1,step-2",
    );
  });

  it("returns the empty string for an empty sequence", () => {
    expect(encodeSequencing([])).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: FAIL — `encodeSequencing is not exported`.

- [ ] **Step 3: Implement `encodeSequencing`**

Append to `packages/core/src/interaction-encoding.ts`:

```ts
/**
 * SCORM 1.2 §3.4.7.5 sequencing form: `a,b,c`. Used by sequence-steps and
 * ddx-tree.
 */
export function encodeSequencing(orderedIds: readonly string[]): string {
  return orderedIds.join(",");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interaction-encoding.ts packages/core/src/interaction-encoding.test.ts
git commit -m "feat(core): encodeSequencing for sequence-steps / ddx-tree"
```

---

### Task 6: `encodeFillIn`

**Files:**
- Modify: `packages/core/src/interaction-encoding.ts`
- Modify: `packages/core/src/interaction-encoding.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/interaction-encoding.test.ts`:

```ts
import { encodeFillIn } from "./interaction-encoding.js";

describe("encodeFillIn", () => {
  it("trims surrounding whitespace", () => {
    expect(encodeFillIn("  hello  ")).toBe("hello");
  });

  it("truncates long input to 255 chars with ellipsis", () => {
    const out = encodeFillIn("x".repeat(400));
    expect(out.length).toBe(255);
    expect(out.endsWith("…")).toBe(true);
  });

  it("preserves internal whitespace", () => {
    expect(encodeFillIn("multi word answer")).toBe("multi word answer");
  });

  it("handles unicode characters within byte budget", () => {
    expect(encodeFillIn("café")).toBe("café");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: FAIL — `encodeFillIn is not exported`.

- [ ] **Step 3: Implement `encodeFillIn`**

Append to `packages/core/src/interaction-encoding.ts`:

```ts
/**
 * SCORM 1.2 §3.4.7.5 fill-in form: free text capped at 255 chars. Used by
 * fill-in-the-blanks, reflection-prompt, crossword, word-cloud, qa-board.
 */
export function encodeFillIn(text: string): string {
  return truncateResponse(text.trim());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interaction-encoding.ts packages/core/src/interaction-encoding.test.ts
git commit -m "feat(core): encodeFillIn with trim + 255-char truncation"
```

---

### Task 7: `encodePerformance`

**Files:**
- Modify: `packages/core/src/interaction-encoding.ts`
- Modify: `packages/core/src/interaction-encoding.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/interaction-encoding.test.ts`:

```ts
import { encodePerformance } from "./interaction-encoding.js";

describe("encodePerformance", () => {
  it("returns strings unchanged when under the cap", () => {
    expect(encodePerformance("hotspot-a,hotspot-c")).toBe("hotspot-a,hotspot-c");
  });

  it("JSON-stringifies non-string payloads", () => {
    expect(encodePerformance({ x: 12, y: 34 })).toBe('{"x":12,"y":34}');
  });

  it("truncates over-cap payloads with ellipsis", () => {
    const payload = { notes: "n".repeat(400) };
    const out = encodePerformance(payload);
    expect(out.length).toBe(255);
    expect(out.endsWith("…")).toBe(true);
  });

  it("encodes arrays of ids without quoting", () => {
    // Activities that have a structured payload but want the CSV to be
    // readable should pre-encode to a comma-separated string before calling.
    expect(encodePerformance(["a", "b", "c"])).toBe('["a","b","c"]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: FAIL — `encodePerformance is not exported`.

- [ ] **Step 3: Implement `encodePerformance`**

Append to `packages/core/src/interaction-encoding.ts`:

```ts
/**
 * SCORM 1.2 §3.4.7.5 performance form: free-form text. Used by hotspot-3d,
 * highlight-text, virtual-tour, image-annotation, audio-recording,
 * image-comparison-slider, isometric-chatroom — anywhere the response
 * shape doesn't fit choice / matching / sequencing.
 *
 * Strings pass through unchanged; everything else is JSON-stringified.
 * Result is truncated to 255 chars.
 */
export function encodePerformance(payload: unknown): string {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return truncateResponse(text);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interaction-encoding.ts packages/core/src/interaction-encoding.test.ts
git commit -m "feat(core): encodePerformance for free-form interactions"
```

---

### Task 8: `encodeLatency`, `encodeTimeOfDay`, `encodeResult`

**Files:**
- Modify: `packages/core/src/interaction-encoding.ts`
- Modify: `packages/core/src/interaction-encoding.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/interaction-encoding.test.ts`:

```ts
import { encodeLatency, encodeTimeOfDay, encodeResult } from "./interaction-encoding.js";

describe("encodeLatency", () => {
  it("formats sub-second values with hundredths", () => {
    expect(encodeLatency(0.5)).toBe("0000:00:00.50");
  });

  it("formats whole seconds", () => {
    expect(encodeLatency(5)).toBe("0000:00:05.00");
  });

  it("rolls over to minutes and hours", () => {
    expect(encodeLatency(65)).toBe("0000:01:05.00");
    expect(encodeLatency(3725.5)).toBe("0001:02:05.50"); // 1h 2m 5.5s
  });

  it("clamps negative input to zero", () => {
    expect(encodeLatency(-10)).toBe("0000:00:00.00");
  });

  it("handles four-digit hour values", () => {
    expect(encodeLatency(36000)).toBe("0010:00:00.00");
  });
});

describe("encodeTimeOfDay", () => {
  it("formats hours:minutes:seconds with zero padding", () => {
    const d = new Date(2026, 4, 14, 9, 5, 3); // local time
    expect(encodeTimeOfDay(d)).toBe("09:05:03");
  });
});

describe("encodeResult", () => {
  it("maps the four enum kinds to their SCORM strings", () => {
    expect(encodeResult({ kind: "correct" })).toBe("correct");
    expect(encodeResult({ kind: "wrong" })).toBe("wrong");
    expect(encodeResult({ kind: "unanticipated" })).toBe("unanticipated");
    expect(encodeResult({ kind: "neutral" })).toBe("neutral");
  });

  it("formats numeric results to two decimal places", () => {
    expect(encodeResult({ kind: "numeric", value: 0.5 })).toBe("0.50");
    expect(encodeResult({ kind: "numeric", value: 1 })).toBe("1.00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: FAIL — three new helpers not exported.

- [ ] **Step 3: Implement the three encoders**

Append to `packages/core/src/interaction-encoding.ts`:

```ts
import type { InteractionResult } from "./types.js";

/**
 * SCORM 1.2 §3.4.7.10 latency, HHHH:MM:SS.SS. Negative inputs clamp to zero
 * so we never emit a malformed time string from a clock-skew edge case.
 */
export function encodeLatency(seconds: number): string {
  const totalHundredths = Math.max(0, Math.floor(seconds * 100));
  const hundredths = totalHundredths % 100;
  const totalSec = Math.floor(totalHundredths / 100);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const pad4 = (n: number) => String(n).padStart(4, "0");
  return `${pad4(h)}:${pad2(m)}:${pad2(s)}.${pad2(hundredths)}`;
}

/** SCORM 1.2 §3.4.7.7 time, HH:MM:SS in the learner's local timezone. */
export function encodeTimeOfDay(date: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** Map an InteractionResult to the SCORM 1.2 §3.4.7.9 string form. */
export function encodeResult(r: InteractionResult): string {
  if (r.kind === "numeric") return r.value.toFixed(2);
  return r.kind;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/interaction-encoding.test.ts`
Expected: PASS, all encoders green.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/interaction-encoding.ts packages/core/src/interaction-encoding.test.ts
git commit -m "feat(core): encodeLatency / encodeTimeOfDay / encodeResult"
```

---

### Task 9: Extend `ScormDriver` interface and implement on `MemoryDriver`

**Files:**
- Modify: `packages/core/src/scorm.ts`
- Modify: `packages/core/src/scorm.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/scorm.test.ts`:

```ts
import type { InteractionRecord } from "./types.js";

describe("MemoryDriver.recordInteraction", () => {
  beforeEach(() => {
    __setScormDriverForTest(undefined);
  });
  afterEach(() => {
    __setScormDriverForTest(undefined);
    vi.unstubAllGlobals();
  });

  it("logs an interaction summary in dev preview mode", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const driver = getScormDriver();
    const record: InteractionRecord = {
      id: "multiple-choice:abc12345:q1",
      type: "choice",
      studentResponse: "{a,c}",
      correctResponse: "{a,b}",
      result: { kind: "wrong" },
      weighting: 1,
      latencySeconds: 12.5,
    };
    driver.recordInteraction(record);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("multiple-choice:abc12345:q1"),
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("wrong"));
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/scorm.test.ts`
Expected: FAIL — `recordInteraction is not a function` on the memory driver.

- [ ] **Step 3: Extend the interface + implement on MemoryDriver**

In `packages/core/src/scorm.ts`, edit the `ScormDriver` interface to add the method, and add the method body to `MemoryDriver`:

```ts
import type { InteractionRecord } from "./types.js";

export interface ScormDriver {
  initialize(): boolean;
  finish(): boolean;
  postScore(raw: number, max: number, success: boolean): void;
  saveSuspendData(json: string): void;
  loadSuspendData(): string | undefined;
  getStudentName(): string | undefined;
  getStudentId(): string | undefined;
  isLive(): boolean;
  recordInteraction(record: InteractionRecord): void;
}
```

Then add to `class MemoryDriver` (alongside the other methods):

```ts
  recordInteraction(record: InteractionRecord) {
    console.info(
      `[kukui:scorm:dev] interaction ${record.id} → "${record.studentResponse}" (${record.result.kind})`,
    );
  }
```

You will also need to stub `recordInteraction` on `PipwerksDriver` to satisfy the interface — temporarily implement it as `console.warn("[kukui:scorm] recordInteraction not yet implemented")`. Task 10 replaces this with the real implementation.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/scorm.test.ts`
Expected: PASS, including the new `recordInteraction` test.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/scorm.ts packages/core/src/scorm.test.ts
git commit -m "feat(core): ScormDriver.recordInteraction + MemoryDriver impl"
```

---

### Task 10: Implement `recordInteraction` on `PipwerksDriver`

**Files:**
- Modify: `packages/core/src/scorm.ts`
- Modify: `packages/core/src/scorm.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/scorm.test.ts`:

```ts
describe("PipwerksDriver.recordInteraction", () => {
  beforeEach(() => {
    __setScormDriverForTest(undefined);
  });
  afterEach(() => {
    __setScormDriverForTest(undefined);
    vi.unstubAllGlobals();
  });

  it("writes cmi.interactions.0.* fields and increments the index per call", () => {
    const set = vi.fn(() => true);
    const get = vi.fn(() => "");
    const save = vi.fn(() => true);
    const init = vi.fn(() => true);
    const quit = vi.fn(() => true);
    const status = vi.fn(() => "passed");
    vi.stubGlobal("window", {
      ...globalThis.window,
      pipwerks: { SCORM: { init, get, set, save, quit, status } },
    });

    const driver = getScormDriver();
    driver.recordInteraction({
      id: "multiple-choice:abc12345:q1",
      type: "choice",
      studentResponse: "{a,c}",
      correctResponse: "{a,b}",
      result: { kind: "wrong" },
      weighting: 2,
      latencySeconds: 12.5,
    });

    expect(set).toHaveBeenCalledWith("cmi.interactions.0.id", "multiple-choice:abc12345:q1");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.type", "choice");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.student_response", "{a,c}");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.correct_responses.0.pattern", "{a,b}");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.result", "wrong");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.weighting", "2");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.latency", "0000:00:12.50");
    expect(set).toHaveBeenCalledWith(
      "cmi.interactions.0.time",
      expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
    );
    expect(save).toHaveBeenCalled();

    driver.recordInteraction({
      id: "multiple-choice:abc12345:q2",
      type: "choice",
      studentResponse: "a",
      result: { kind: "correct" },
    });
    expect(set).toHaveBeenCalledWith("cmi.interactions.1.id", "multiple-choice:abc12345:q2");
  });

  it("omits correct_responses and latency when not provided", () => {
    const set = vi.fn(() => true);
    const save = vi.fn(() => true);
    const init = vi.fn(() => true);
    const quit = vi.fn(() => true);
    vi.stubGlobal("window", {
      ...globalThis.window,
      pipwerks: { SCORM: { init, get: () => "", set, save, quit, status: () => "passed" } },
    });

    const driver = getScormDriver();
    driver.recordInteraction({
      id: "reflection-prompt:abc:r1",
      type: "fill-in",
      studentResponse: "I learned about pancreatic function.",
      result: { kind: "neutral" },
    });

    const writes = set.mock.calls.map((c) => c[0]);
    expect(writes).not.toContain("cmi.interactions.0.correct_responses.0.pattern");
    expect(writes).not.toContain("cmi.interactions.0.latency");
  });

  it("truncates over-length id and student_response", () => {
    const set = vi.fn(() => true);
    const save = vi.fn(() => true);
    const init = vi.fn(() => true);
    const quit = vi.fn(() => true);
    vi.stubGlobal("window", {
      ...globalThis.window,
      pipwerks: { SCORM: { init, get: () => "", set, save, quit, status: () => "passed" } },
    });
    const driver = getScormDriver();
    driver.recordInteraction({
      id: "x".repeat(300),
      type: "fill-in",
      studentResponse: "y".repeat(300),
      result: { kind: "neutral" },
    });
    const idCall = set.mock.calls.find((c) => c[0] === "cmi.interactions.0.id");
    const responseCall = set.mock.calls.find((c) => c[0] === "cmi.interactions.0.student_response");
    expect(idCall?.[1]).toHaveLength(255);
    expect(idCall?.[1]?.endsWith("…")).toBe(true);
    expect(responseCall?.[1]).toHaveLength(255);
    expect(responseCall?.[1]?.endsWith("…")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/scorm.test.ts`
Expected: FAIL — PipwerksDriver still has the stub from Task 9; no `cmi.interactions.*` writes occur.

- [ ] **Step 3: Implement on PipwerksDriver**

In `packages/core/src/scorm.ts`, replace the stub `recordInteraction` on `PipwerksDriver` with the real implementation and add the index field:

```ts
import {
  encodeLatency,
  encodeResult,
  encodeTimeOfDay,
  truncateResponse,
} from "./interaction-encoding.js";

class PipwerksDriver implements ScormDriver {
  private interactionIndex = 0;
  constructor(private readonly api: PipwerksScorm) {}
  // ... existing methods unchanged ...

  recordInteraction(record: InteractionRecord) {
    const i = this.interactionIndex;
    this.interactionIndex += 1;
    const prefix = `cmi.interactions.${i}`;
    this.api.set(`${prefix}.id`, truncateResponse(record.id));
    this.api.set(`${prefix}.type`, record.type);
    this.api.set(`${prefix}.time`, encodeTimeOfDay(new Date()));
    this.api.set(`${prefix}.student_response`, truncateResponse(record.studentResponse));
    if (record.correctResponse !== undefined) {
      this.api.set(`${prefix}.correct_responses.0.pattern`, truncateResponse(record.correctResponse));
    }
    this.api.set(`${prefix}.result`, encodeResult(record.result));
    this.api.set(`${prefix}.weighting`, String(record.weighting ?? 1));
    if (record.latencySeconds !== undefined) {
      this.api.set(`${prefix}.latency`, encodeLatency(record.latencySeconds));
    }
    this.api.save();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/scorm.test.ts`
Expected: PASS — all 3 new tests + the prior tests still green.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/scorm.ts packages/core/src/scorm.test.ts
git commit -m "feat(core): PipwerksDriver.recordInteraction writes cmi.interactions.N.*"
```

---

### Task 11: Extend `ActivityProps` with `onInteraction`

**Files:**
- Modify: `packages/core/src/types.ts`

- [ ] **Step 1: Add the optional callback**

Edit `ActivityProps<TConfig>` in `packages/core/src/types.ts`:

```ts
export type ActivityProps<TConfig> = {
  config: TConfig;
  onSubmit: (s: ScoreState) => void;
  onResume?: () => Partial<TConfig> | undefined;
  suspendData?: string;
  onPersist?: (suspendData: string) => void;
  /**
   * Report a per-question SCORM 1.2 interaction. Activities not yet wired
   * simply don't call this; behaviour is purely additive. See the
   * `2026-05-14-scorm-interaction-hygiene` spec for the per-activity
   * vocabulary.
   */
  onInteraction?: (record: InteractionRecord) => void;
  headingLevel?: 1 | 2 | 3;
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS — every existing activity component continues to typecheck because `onInteraction` is optional.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat(core): ActivityProps.onInteraction optional callback"
```

---

### Task 12: Wire `ActivityHost` to forward `onInteraction`

**Files:**
- Modify: `packages/core/src/activity-host.tsx`

- [ ] **Step 1: Add `handleInteraction` and pass to `callbackProps`**

Edit `packages/core/src/activity-host.tsx`. Below the existing `handlePersist`:

```tsx
  const handleInteraction = (record: import("./types.js").InteractionRecord) => {
    scorm.recordInteraction(record);
  };
```

Update `callbackProps`:

```tsx
  const callbackProps = {
    onSubmit: handleSubmit,
    onPersist: handlePersist,
    onInteraction: handleInteraction,
    suspendData: scorm.loadSuspendData(),
  };
```

(The inline `import("./types.js")` keeps the existing import block untouched; if you'd prefer a top-of-file import, do it there instead — both work, top-of-file is the codebase norm.)

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: PASS — no activity test should break (everything ignores the new prop until Phase B).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/activity-host.tsx
git commit -m "feat(core): ActivityHost forwards onInteraction to scorm driver"
```

---

### Task 13: Add `RecordInteraction` to `@kukui/bridge`

**Files:**
- Modify: `packages/bridge/src/index.ts`
- Modify: `packages/bridge/src/index.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/bridge/src/index.test.ts`:

```ts
describe("KukuiBridge.RecordInteraction", () => {
  beforeEach(() => {
    __resetBridgeForTest(window);
  });
  afterEach(() => {
    __resetBridgeForTest(window);
  });

  it("returns false and logs in preview mode (no pipwerks)", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const bridge = attachBridge(window);
    const ok = bridge.RecordInteraction(
      JSON.stringify({
        id: "test:abc:q1",
        type: "choice",
        studentResponse: "a",
        result: { kind: "correct" },
      }),
    );
    expect(ok).toBe(false);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("RecordInteraction"));
    spy.mockRestore();
  });

  it("writes cmi.interactions.0.* via pipwerks when connected", () => {
    const set = vi.fn(() => true);
    const get = vi.fn(() => "");
    const save = vi.fn(() => true);
    const init = vi.fn(() => true);
    const quit = vi.fn(() => true);
    (window as unknown as { pipwerks: unknown }).pipwerks = {
      SCORM: { init, get, set, save, quit },
    };
    const bridge = attachBridge(window);
    const ok = bridge.RecordInteraction(
      JSON.stringify({
        id: "test:abc:q1",
        type: "choice",
        studentResponse: "a",
        correctResponse: "a",
        result: { kind: "correct" },
        weighting: 1,
        latencySeconds: 2.5,
      }),
    );
    expect(ok).toBe(true);
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.id", "test:abc:q1");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.type", "choice");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.student_response", "a");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.result", "correct");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.latency", "0000:00:02.50");
    expect(save).toHaveBeenCalled();
  });

  it("returns false on invalid JSON without throwing", () => {
    (window as unknown as { pipwerks: unknown }).pipwerks = {
      SCORM: {
        init: () => true,
        get: () => "",
        set: () => true,
        save: () => true,
        quit: () => true,
      },
    };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bridge = attachBridge(window);
    const ok = bridge.RecordInteraction("not-json");
    expect(ok).toBe(false);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/bridge/src/index.test.ts`
Expected: FAIL — `RecordInteraction is not a function` on the bridge.

- [ ] **Step 3: Implement on the bridge**

The bridge is deliberately self-contained — it must not import from `@kukui/core` (it ships to Unity / Godot builds that don't have React). Inline copies of the encoders are small enough to keep here.

In `packages/bridge/src/index.ts`, extend the `KukuiBridge` interface:

```ts
export interface KukuiBridge {
  OnActivityComplete(raw: number, max: number, success: boolean | number): boolean;
  SaveSuspendData(json: string): boolean;
  LoadSuspendData(): string;
  GetUrlParam(key: string): string;
  IsConnected(): boolean;
  RecordInteraction(json: string): boolean;
}
```

Inside the `attachBridge` function — before the `const bridge: KukuiBridge = {` literal — define the local helpers:

```ts
  const MAX_RESPONSE_CHARS = 255;
  const truncate = (s: string) =>
    s.length <= MAX_RESPONSE_CHARS ? s : s.slice(0, MAX_RESPONSE_CHARS - 1) + "…";
  const encodeLatency = (seconds: number): string => {
    const totalHundredths = Math.max(0, Math.floor(seconds * 100));
    const hundredths = totalHundredths % 100;
    const totalSec = Math.floor(totalHundredths / 100);
    const s = totalSec % 60;
    const m = Math.floor(totalSec / 60) % 60;
    const h = Math.floor(totalSec / 3600);
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const pad4 = (n: number) => String(n).padStart(4, "0");
    return `${pad4(h)}:${pad2(m)}:${pad2(s)}.${pad2(hundredths)}`;
  };
  const encodeTime = (d: Date) => {
    const pad2 = (n: number) => String(n).padStart(2, "0");
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  };
  let interactionIndex = 0;
```

Add the `RecordInteraction` method to the bridge literal:

```ts
    RecordInteraction(json) {
      if (!connected || !scormApi) {
        console.info(`[kukui:bridge:preview] RecordInteraction: ${json}`);
        return false;
      }
      let record: {
        id: string;
        type: string;
        studentResponse: string;
        correctResponse?: string;
        result: { kind: string; value?: number };
        weighting?: number;
        latencySeconds?: number;
      };
      try {
        record = JSON.parse(json);
      } catch (err) {
        console.error("[kukui:bridge] RecordInteraction: invalid JSON", err);
        return false;
      }
      try {
        const i = interactionIndex;
        interactionIndex += 1;
        const prefix = `cmi.interactions.${i}`;
        scormApi.set(`${prefix}.id`, truncate(record.id));
        scormApi.set(`${prefix}.type`, record.type);
        scormApi.set(`${prefix}.time`, encodeTime(new Date()));
        scormApi.set(`${prefix}.student_response`, truncate(record.studentResponse));
        if (record.correctResponse !== undefined) {
          scormApi.set(`${prefix}.correct_responses.0.pattern`, truncate(record.correctResponse));
        }
        const result =
          record.result.kind === "numeric" && typeof record.result.value === "number"
            ? record.result.value.toFixed(2)
            : record.result.kind;
        scormApi.set(`${prefix}.result`, result);
        scormApi.set(`${prefix}.weighting`, String(record.weighting ?? 1));
        if (record.latencySeconds !== undefined) {
          scormApi.set(`${prefix}.latency`, encodeLatency(record.latencySeconds));
        }
        scormApi.save();
        return true;
      } catch (err) {
        console.error("[kukui:bridge] RecordInteraction failed:", err);
        return false;
      }
    },
```

Also update the `__resetBridgeForTest` cleanup to reset `interactionIndex` — easiest way is to hoist it into module scope alongside `scormApi`, `connected`, etc. Update the reset function:

```ts
export function __resetBridgeForTest(target: Window = window): void {
  scormApi = null;
  connected = false;
  memorySuspend = "";
  teardownDone = false;
  // Reattaching attachBridge creates a fresh interactionIndex closure, so
  // no separate reset is needed — but if you hoisted the variable, zero it here.
  if (target.kukuiBridge) delete target.kukuiBridge;
}
```

If you keep `interactionIndex` inside the `attachBridge` closure (recommended — matches the existing memory-state pattern), you don't need to touch `__resetBridgeForTest` at all because each `attachBridge` call already creates a fresh closure.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/bridge/src/index.test.ts`
Expected: PASS — all 3 new tests green.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/bridge/src/index.ts packages/bridge/src/index.test.ts
git commit -m "feat(bridge): KukuiBridge.RecordInteraction for Unity/Godot consumers"
```

---

### Task 14: Final integration smoke

**Files:** none — verification only.

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: PASS across all packages — no regressions.

- [ ] **Step 2: Full typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: PASS. If any new `console.info` / `console.warn` triggers a rule, suppress with a targeted comment — these are intentional dev-mode breadcrumbs.

- [ ] **Step 4: Build the engine + a single SCORM package**

Run:
```bash
pnpm build
node packaging/pack-scorm.js --activity multiple-choice --build apps/engine-web/dist --out packaging/build
```
Expected: SUCCESS. `packaging/build/kukui-multiple-choice.scorm.zip` exists. No new errors versus baseline.

- [ ] **Step 5: Manual preview-mode sanity check (optional but recommended)**

Run: `pnpm dev`
Open the engine in a browser. Open DevTools console. Even without an activity wired up, `getScormDriver()` returns `MemoryDriver` — running `getScormDriver().recordInteraction({...})` from the console should log a line. Verifies the wiring without an LMS round-trip.

- [ ] **Step 6: Open PR**

```bash
git push -u origin feat/scorm-interactions-phase-a
gh pr create --title "feat: SCORM interaction hygiene — Phase A plumbing" \
  --body "$(cat <<'EOF'
## Summary
- New `recordInteraction(record)` method on `ScormDriver`; writes `cmi.interactions.N.*` per SCORM 1.2 §3.4.7
- Pure encoding helpers for choice / matching / sequencing / fill-in / performance / latency
- `ActivityProps.onInteraction` optional callback, wired by `ActivityHost`
- Bridge parity: `KukuiBridge.RecordInteraction(json)` for Unity / Godot builds

No activity wires up yet — that's Phase B (Multiple Choice, Fill in the Blanks, Drag and Drop) and Phase C (everything else).

## Spec
docs/superpowers/specs/2026-05-14-scorm-interaction-hygiene.md

## Test plan
- [ ] `pnpm test` green across `@kukui/core` and `@kukui/bridge`
- [ ] `pnpm typecheck` clean
- [ ] `pnpm build` succeeds
- [ ] `node packaging/pack-scorm.js --activity multiple-choice` produces a zip identical in behaviour to baseline (no interaction writes yet)
EOF
)"
```

---

## Phase A — done. What's next.

Phase A produces no behavioural change for learners or faculty — it's purely additive plumbing. To actually get per-question data into Brightspace's reports, Phase B must follow.

**Phase B plan (`docs/superpowers/plans/2026-05-15-scorm-interaction-hygiene-phase-b-plan.md`)** will wire the first three activities:
- Multiple Choice → one `choice` interaction at submit
- Fill in the Blanks → one `fill-in` interaction per blank at submit
- Drag and Drop → one `matching` interaction at submit (or per chip, depending on Phase B's granularity call — defer to that plan)

Phase B is the end-to-end validation: build a SCORM zip, upload to Lamakū, complete the activity as a test learner, export the SCORM CSV from Course Admin → SCORM Reports, and verify the per-question rows appear with the right IDs / responses / results.

Don't begin Phase C until Phase B's Lamakū export is verified — if Brightspace surfaces interactions differently than the spec assumes, Phase C's per-activity work would all be invalidated.
