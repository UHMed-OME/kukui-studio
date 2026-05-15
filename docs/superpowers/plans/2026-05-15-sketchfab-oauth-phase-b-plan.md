# Sketchfab OAuth — Phase B Implementation Plan (Editor + SCORM Export Integration)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-05-13-sketchfab-oauth-registration.md`](../specs/2026-05-13-sketchfab-oauth-registration.md)
**Phase A plan (foundation):** [`docs/superpowers/plans/2026-05-14-sketchfab-oauth-phase-a-plan.md`](2026-05-14-sketchfab-oauth-phase-a-plan.md)

**Goal:** Light up the Sketchfab scaffolding from Phase A by adding an "Import from Sketchfab" affordance to the 3D Hotspot editor, then make `scormDownload.ts` embed the cached `.glb` into the exported SCORM zip with a rewritten `model.src` pointing at the embedded asset.

**Architecture:**
- New schema field `model.sketchfabMode: "embed" | "import"` distinguishes the existing iframe-embed path from the new download-and-bundle path. Default (undefined) preserves existing behaviour (embed).
- "Import" path: author signs in → enters Sketchfab URL → metadata + license check → download URL → `.glb` body → IndexedDB cache. Schema fields set: `sketchfabUid`, `sketchfabMode: "import"`, `attribution`. `model.src` stays unset (Studio reads from IndexedDB at preview time).
- "Embed" path: unchanged — `sketchfabUid` set without `sketchfabMode` (or explicitly `"embed"`) → iframe embed via existing `SketchfabViewer`.
- SCORM export: when `sketchfabMode === "import"` and the cache has the blob, write the blob to `samples/<kind>/assets/<uid>.glb` inside the zip and set `model.src = "./assets/<uid>.glb"` in the embedded JSON. `model.sketchfabMode` is dropped from the exported JSON (the embedded `.glb` is the only source of truth for the runtime).

**Tech Stack:** Same as Phase A.

**Branch:** `feat/sketchfab-oauth-phase-b`, stacked on top of `feat/sketchfab-oauth-phase-a` (Phase A is open as PR #4 but Phase B depends on its commits). If Phase A is rebased during review, Phase B rebases too.

**Non-goals for Phase B:**
- No model-browsing UI in Studio (paste a URL, that's it; future feature)
- No upload-to-Sketchfab
- No automatic license refresh
- No Sketchfab → other-activity-kind wiring (only 3D Hotspot; other 3D activities can follow the same pattern in Phase C if needed)

---

### Task 1: License helpers (`isImportableLicense`) + tests

**Files:**
- Create: `apps/studio-app/src/sketchfab/license.ts`
- Create: `apps/studio-app/src/sketchfab/license.test.ts`

Sketchfab's metadata response includes a `license.slug` field (e.g., `"by"`, `"by-sa"`, `"by-nd"`, `"by-nc"`, `"cc0"`, `"st"` for standard/proprietary). We allow embedding only the redistribution-compatible CC licenses; ND-licensed and proprietary models get rejected with a clear message.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { isImportableLicense, licenseRejectionMessage } from "./license.js";
import type { SketchfabLicense } from "./client.js";

const lic = (slug: string, label: string = slug): SketchfabLicense => ({
  slug,
  label,
  url: `https://creativecommons.org/licenses/${slug}/4.0/`,
});

describe("isImportableLicense", () => {
  it("allows CC0", () => {
    expect(isImportableLicense(lic("cc0"))).toBe(true);
  });
  it("allows CC-BY", () => {
    expect(isImportableLicense(lic("by"))).toBe(true);
  });
  it("allows CC-BY-SA", () => {
    expect(isImportableLicense(lic("by-sa"))).toBe(true);
  });
  it("allows CC-BY-NC", () => {
    expect(isImportableLicense(lic("by-nc"))).toBe(true);
  });
  it("rejects CC-BY-ND", () => {
    expect(isImportableLicense(lic("by-nd"))).toBe(false);
  });
  it("rejects CC-BY-NC-ND", () => {
    expect(isImportableLicense(lic("by-nc-nd"))).toBe(false);
  });
  it("rejects proprietary / standard", () => {
    expect(isImportableLicense(lic("st", "Standard"))).toBe(false);
    expect(isImportableLicense(lic("ed", "Editorial"))).toBe(false);
  });
  it("rejects null license (unknown)", () => {
    expect(isImportableLicense(null)).toBe(false);
  });
});

describe("licenseRejectionMessage", () => {
  it("explains ND rejection", () => {
    const msg = licenseRejectionMessage(lic("by-nd"));
    expect(msg.toLowerCase()).toContain("no derivatives");
  });
  it("explains null/unknown", () => {
    expect(licenseRejectionMessage(null)).toMatch(/license/i);
  });
  it("explains proprietary", () => {
    expect(licenseRejectionMessage(lic("st", "Standard"))).toMatch(/proprietary|standard/i);
  });
});
```

- [ ] **Step 2: Run — must FAIL**

`pnpm test apps/studio-app/src/sketchfab/license.test.ts`

- [ ] **Step 3: Implement**

```ts
/**
 * Creative Commons license allow/reject rules for Sketchfab imports.
 *
 * We embed only models with licenses that permit redistribution inside a
 * SCORM package. ND (no derivatives) variants are rejected because
 * embedding into an interactive activity is arguably a derivative work.
 * Proprietary / "Standard" Sketchfab licenses have variable terms and
 * aren't safe to assume blanket redistribution rights.
 */

import type { SketchfabLicense } from "./client.js";

/** CC slugs we accept. Matches Sketchfab's `license.slug` field. */
const IMPORTABLE_SLUGS = new Set(["cc0", "by", "by-sa", "by-nc"]);

export function isImportableLicense(license: SketchfabLicense | null): boolean {
  if (!license) return false;
  return IMPORTABLE_SLUGS.has(license.slug.toLowerCase());
}

export function licenseRejectionMessage(license: SketchfabLicense | null): string {
  if (!license) {
    return "Sketchfab didn't report a license for this model. We can only embed models with a Creative Commons license that permits redistribution.";
  }
  const slug = license.slug.toLowerCase();
  if (slug.includes("nd")) {
    return `This model is licensed "${license.label}" (no derivatives). Embedding it into an interactive activity is arguably a derivative work, so we can't import it. Pick a CC-BY, CC-BY-SA, CC-BY-NC, or CC0 model instead.`;
  }
  if (slug === "st" || slug === "ed" || slug.startsWith("standard") || slug.startsWith("editorial")) {
    return `This model uses a proprietary / "${license.label}" license. We can only embed models with explicit CC license terms.`;
  }
  return `This model's license ("${license.label}") doesn't match the ones we know how to embed. Pick a CC-BY, CC-BY-SA, CC-BY-NC, or CC0 model.`;
}
```

- [ ] **Step 4: Run — must PASS**, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-app/src/sketchfab/license.ts apps/studio-app/src/sketchfab/license.test.ts
git commit -m "feat(sketchfab): license helpers for import allow/reject"
```

---

### Task 2: Add `sketchfabMode` field to hotspot-3d schema + tests

**Files:**
- Modify: `packages/schemas/src/hotspot-3d.ts`
- Modify: `packages/schemas/src/hotspot-3d.test.ts` (if it exists; otherwise check the testing approach for other schemas)

The new field is OPTIONAL with no default. Absence (or explicit `"embed"`) preserves the existing iframe-embed behaviour. `"import"` indicates this activity should load the model from a bundled `.glb` (set during SCORM export). The Studio editor uses `"import"` as a marker to fetch from IndexedDB at preview time.

- [ ] **Step 1: Examine existing schema test approach**

```bash
ls /Users/Jesse/kukui-studio/packages/schemas/src/*.test.ts | head
```

- [ ] **Step 2: Modify `hotspot-3d.ts`**

In the `model` object inside `Hotspot3DConfigSchema`, after the `sketchfabUid` field, add:

```ts
        /**
         * When `sketchfabUid` is set, this discriminates between two
         * runtime paths:
         *   - "embed" (or absent): use the existing Sketchfab Viewer
         *     iframe. No GLB download; works without OAuth.
         *   - "import": the activity expects a bundled GLB file at
         *     `model.src`. SCORM export embeds the cached body from
         *     IndexedDB; the Studio preview reads the cache directly.
         */
        sketchfabMode: z.enum(["embed", "import"]).optional(),
```

The existing `.refine((m) => Boolean(m.src) || Boolean(m.sketchfabUid), ...)` stays. The Studio-time state where `sketchfabMode: "import"` is set but `model.src` is empty still satisfies the refine (because `sketchfabUid` is set).

- [ ] **Step 3: Add a schema test for the new field**

Either append to an existing `hotspot-3d.test.ts` or create one. The test should assert:
- An activity with `model.sketchfabUid` + `model.sketchfabMode: "import"` and no `src` parses successfully (Studio-time state).
- An activity with `model.src + sketchfabUid + sketchfabMode: "import"` parses (post-export state).
- An activity with `model.sketchfabMode: "invalid"` fails parse.
- An existing activity without `sketchfabMode` (legacy) parses unchanged.

- [ ] **Step 4: Run tests + typecheck + commit**

```bash
pnpm test packages/schemas/src/hotspot-3d.test.ts && \
pnpm typecheck && \
git add packages/schemas/src/hotspot-3d.ts packages/schemas/src/hotspot-3d.test.ts && \
git commit -m "feat(schemas): add hotspot-3d model.sketchfabMode field"
```

---

### Task 3: Sketchfab import service + tests

**Files:**
- Create: `apps/studio-app/src/sketchfab/import.ts`
- Create: `apps/studio-app/src/sketchfab/import.test.ts`

Pure async function that chains metadata → license check → download URL → fetch blob → cache. Returns a tagged result so the UI layer can render either success or a specific error.

- [ ] **Step 1: Write failing tests**

Use Vitest's `vi.fn` to stub `fetch` for predictable responses. The test should cover: success path, license rejection, metadata fetch failure, download URL missing, blob fetch failure, isDownloadable=false rejection.

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { importFromSketchfab } from "./import.js";
import { loadCachedModelBlob, clearAllCachedModels } from "./modelCache.js";

const TOKEN = "test-token";
const UID = "a1b2c3d4e5f67890abcdef1234567890";
const METADATA_OK = {
  uid: UID,
  name: "Test Heart",
  user: { username: "drsmith", profileUrl: "https://sketchfab.com/drsmith" },
  viewerUrl: `https://sketchfab.com/3d-models/${UID}`,
  license: { slug: "by", label: "CC Attribution", url: "https://..." },
  isDownloadable: true,
};

function stubFetch(responses: Array<{ ok: boolean; status?: number; body?: unknown; blob?: Blob }>) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++] ?? { ok: false, status: 500 };
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      statusText: r.ok ? "OK" : "Error",
      json: async () => r.body,
      blob: async () => r.blob ?? new Blob(["body"]),
    } as Response;
  });
}

describe("importFromSketchfab", () => {
  beforeEach(async () => {
    await clearAllCachedModels();
  });
  afterEach(async () => {
    await clearAllCachedModels();
    vi.unstubAllGlobals();
  });

  it("returns ok and caches the blob on the happy path", async () => {
    vi.stubGlobal("fetch", stubFetch([
      { ok: true, body: METADATA_OK },
      { ok: true, body: { glb: { url: "https://signed.example/heart.glb" } } },
      { ok: true, blob: new Blob([new Uint8Array([0x67, 0x6c, 0x54, 0x46])], { type: "model/gltf-binary" }) },
    ]));
    const result = await importFromSketchfab("https://sketchfab.com/3d-models/heart-" + UID, TOKEN);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.uid).toBe(UID);
    expect(result.attribution.author).toBe("drsmith");
    expect(result.attribution.license).toContain("Attribution");
    const cached = await loadCachedModelBlob(UID);
    expect(cached).not.toBeNull();
  });

  it("rejects when license is CC-BY-ND", async () => {
    vi.stubGlobal("fetch", stubFetch([
      { ok: true, body: { ...METADATA_OK, license: { slug: "by-nd", label: "CC BY-ND", url: "" } } },
    ]));
    const result = await importFromSketchfab(UID, TOKEN);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.message.toLowerCase()).toContain("derivative");
  });

  it("rejects when isDownloadable is false", async () => {
    vi.stubGlobal("fetch", stubFetch([
      { ok: true, body: { ...METADATA_OK, isDownloadable: false } },
    ]));
    const result = await importFromSketchfab(UID, TOKEN);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.message.toLowerCase()).toMatch(/download|permission/);
  });

  it("rejects when extractModelUid returns null", async () => {
    const result = await importFromSketchfab("not a sketchfab url", TOKEN);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.message.toLowerCase()).toContain("url");
  });

  it("rejects when metadata fetch fails", async () => {
    vi.stubGlobal("fetch", stubFetch([{ ok: false, status: 401 }]));
    const result = await importFromSketchfab(UID, TOKEN);
    expect(result.kind).toBe("error");
  });

  it("rejects when no GLB URL in download response", async () => {
    vi.stubGlobal("fetch", stubFetch([
      { ok: true, body: METADATA_OK },
      { ok: true, body: { gltf: { url: "https://signed.example/heart.gltf" } } }, // no glb
    ]));
    const result = await importFromSketchfab(UID, TOKEN);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.message.toLowerCase()).toContain("glb");
  });
});
```

- [ ] **Step 2: Run — must FAIL**

- [ ] **Step 3: Implement `import.ts`**

```ts
/**
 * One-shot Sketchfab model import: URL/UID → metadata → license check →
 * download URL → blob fetch → IndexedDB cache. Returns a tagged result
 * so the UI layer can render success or a specific rejection message.
 *
 * Composes the lower-level helpers from client.ts, license.ts, and
 * modelCache.ts — no fetch / no DOM here directly beyond the
 * `fetch(downloadUrl)` for the .glb body. (The v3 API calls live in
 * client.ts and have their own auth handling.)
 */

import {
  extractModelUid,
  fetchModelDownloadUrls,
  fetchModelMetadata,
  type SketchfabModelMetadata,
} from "./client.js";
import { isImportableLicense, licenseRejectionMessage } from "./license.js";
import { cacheModelBlob } from "./modelCache.js";

export type ImportAttribution = {
  author: string;
  authorUrl?: string;
  sourceUrl?: string;
  license?: string;
  licenseUrl?: string;
};

export type ImportOk = {
  kind: "ok";
  uid: string;
  metadata: SketchfabModelMetadata;
  attribution: ImportAttribution;
};

export type ImportError = {
  kind: "error";
  message: string;
};

export type ImportResult = ImportOk | ImportError;

export async function importFromSketchfab(
  urlOrUid: string,
  accessToken: string,
): Promise<ImportResult> {
  const uid = extractModelUid(urlOrUid);
  if (!uid) {
    return { kind: "error", message: "That doesn't look like a Sketchfab URL or UID." };
  }

  let metadata: SketchfabModelMetadata;
  try {
    metadata = await fetchModelMetadata(uid, accessToken);
  } catch (err) {
    return { kind: "error", message: (err as Error).message };
  }

  if (!metadata.isDownloadable) {
    return {
      kind: "error",
      message: "This Sketchfab model isn't downloadable. Ask the author to enable downloads, or pick a different model.",
    };
  }

  if (!isImportableLicense(metadata.license)) {
    return { kind: "error", message: licenseRejectionMessage(metadata.license) };
  }

  let urls: { glb?: string; gltf?: string };
  try {
    urls = await fetchModelDownloadUrls(uid, accessToken);
  } catch (err) {
    return { kind: "error", message: (err as Error).message };
  }

  if (!urls.glb) {
    return {
      kind: "error",
      message: "Sketchfab didn't return a GLB download URL for this model. Pick a model that has GLB available.",
    };
  }

  let blob: Blob;
  try {
    const res = await fetch(urls.glb);
    if (!res.ok) {
      return {
        kind: "error",
        message: `Downloading the model body failed: ${res.status} ${res.statusText}`,
      };
    }
    blob = await res.blob();
  } catch (err) {
    return { kind: "error", message: (err as Error).message };
  }

  await cacheModelBlob(uid, blob);

  const attribution: ImportAttribution = {
    author: metadata.author.username,
    authorUrl: metadata.author.profileUrl || undefined,
    sourceUrl: metadata.viewerUrl || undefined,
    license: metadata.license?.label,
    licenseUrl: metadata.license?.url,
  };

  return { kind: "ok", uid, metadata, attribution };
}
```

- [ ] **Step 4: Run — PASS**, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-app/src/sketchfab/import.ts apps/studio-app/src/sketchfab/import.test.ts
git commit -m "feat(sketchfab): one-shot importFromSketchfab service"
```

---

### Task 4: `SketchfabImportButton` React component

**Files:**
- Create: `apps/studio-app/src/sketchfab/SketchfabImportButton.tsx`

A small composite component: input for URL, "Import" button, loading state, error display, success calls back to parent with `{ uid, attribution }`. Disabled when not signed in (shows a "Sign in first" affordance that delegates to `signIn()`).

- [ ] **Step 1: Implement**

```tsx
import { useState } from "react";
import { useSketchfabAuth } from "./useSketchfabAuth.js";
import { importFromSketchfab, type ImportAttribution } from "./import.js";

export type SketchfabImportButtonProps = {
  onImported: (result: { uid: string; attribution: ImportAttribution }) => void;
};

type State =
  | { kind: "idle"; url: string }
  | { kind: "loading"; url: string }
  | { kind: "error"; url: string; message: string };

export function SketchfabImportButton({ onImported }: SketchfabImportButtonProps) {
  const { status, token, signIn } = useSketchfabAuth();
  const [state, setState] = useState<State>({ kind: "idle", url: "" });

  if (status === "disabled") {
    return (
      <p className="ks-sketchfab-import__msg">
        Sketchfab import isn't configured for this deployment.
      </p>
    );
  }

  if (status === "signed-out") {
    return (
      <div className="ks-sketchfab-import">
        <p className="ks-sketchfab-import__msg">
          Sign in to Sketchfab to import a Creative Commons–licensed model.
        </p>
        <button
          type="button"
          className="kukui-studio-btn kukui-studio-btn--primary"
          onClick={() => signIn()}
        >
          Sign in to Sketchfab
        </button>
      </div>
    );
  }

  const url = state.kind === "loading" ? state.url : state.kind === "error" ? state.url : state.url;
  const loading = state.kind === "loading";

  const handleImport = async () => {
    if (!token) return;
    setState({ kind: "loading", url });
    const result = await importFromSketchfab(url, token.accessToken);
    if (result.kind === "error") {
      setState({ kind: "error", url, message: result.message });
      return;
    }
    onImported({ uid: result.uid, attribution: result.attribution });
    setState({ kind: "idle", url: "" });
  };

  return (
    <div className="ks-sketchfab-import">
      <label className="ks-sketchfab-import__label">
        Sketchfab model URL or UID
        <input
          type="text"
          value={url}
          onChange={(e) =>
            setState((s) =>
              s.kind === "loading"
                ? s
                : { kind: "idle", url: e.target.value },
            )
          }
          placeholder="https://sketchfab.com/3d-models/…"
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <button
        type="button"
        className="kukui-studio-btn kukui-studio-btn--primary"
        onClick={handleImport}
        disabled={loading || !url.trim()}
      >
        {loading ? "Importing…" : "Import from Sketchfab"}
      </button>
      {state.kind === "error" ? (
        <p role="alert" className="ks-sketchfab-import__error">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

- [ ] **Step 3: Commit**

```bash
git add apps/studio-app/src/sketchfab/SketchfabImportButton.tsx
git commit -m "feat(sketchfab): SketchfabImportButton component"
```

---

### Task 5: Wire the import button into the hotspot-3d editor form

**Files:**
- Modify: `apps/studio-app/src/EditorForm.tsx` (or wherever the hotspot-3d-specific form lives — verify by reading the file)

The schema-driven form auto-generates fields from the Zod schema. We need an escape hatch: when rendering the `model` section of a hotspot-3d activity, show the `SketchfabImportButton` above the auto-generated fields. When the button calls back with `{ uid, attribution }`, set:
- `model.sketchfabUid = uid`
- `model.sketchfabMode = "import"`
- `model.attribution = {...attribution}`
- Leave `model.src` unset.

- [ ] **Step 1: Read `EditorForm.tsx` to understand the rendering pattern**

```bash
wc -l /Users/Jesse/kukui-studio/apps/studio-app/src/EditorForm.tsx
head -80 /Users/Jesse/kukui-studio/apps/studio-app/src/EditorForm.tsx
```

Determine how kind-specific form customization is currently done (slot pattern? per-kind override map? conditional rendering on kind?).

- [ ] **Step 2: Inject the import button**

Approach depends on what Step 1 reveals. Likely patterns:
- If there's a per-kind override map: add a `hotspot-3d` override that prepends the import button to the `model` field group.
- If forms are auto-generated with no override hook: add a small conditional in the form renderer that, when `kind === "hotspot-3d"` and the form path is the `model` group, prepends the button.
- If kind-specific customization doesn't exist yet: implement it as part of this task — keep it small and scoped to this one need.

The button's `onImported` handler should call the form's set-config callback with the three field updates.

- [ ] **Step 3: Typecheck + test + manual smoke**

```bash
pnpm typecheck && pnpm test && pnpm dev:studio
```

Open Studio, switch to a hotspot-3d activity, confirm the import button appears in the form. (Real Sketchfab sign-in won't work on localhost without Task 10's dev-mode mock from Phase A — use that mock to populate a token, then verify the import flow at least gets to the metadata fetch.)

- [ ] **Step 4: Commit**

```bash
git add apps/studio-app/src/EditorForm.tsx
git commit -m "feat(sketchfab): wire import button into hotspot-3d editor form"
```

---

### Task 6: Studio preview reads blob from IndexedDB for `sketchfabMode === "import"`

**Files:**
- Modify: `apps/studio-app/src/EditCanvas/Hotspot3DEditor.tsx`
- Possibly: `packages/core/src/components/hotspot-3d/Hotspot3D.tsx` (the runtime — verify path)

The Studio preview and the runtime currently branch on `model.src` vs `model.sketchfabUid` to choose between GLB loader and iframe embed. For `sketchfabMode === "import"`, the Studio editor needs a third branch: load the blob from IndexedDB by UID, create a blob URL on the fly, and pass that to the GLB loader.

The runtime (post-SCORM-export) doesn't need this branch — by export time, `model.src` is set to the bundled asset path, so the GLB loader path handles it.

- [ ] **Step 1: Identify where the model loading happens in `Hotspot3DEditorInner`**

Read `Hotspot3DEditor.tsx` to find the branch that picks `SketchfabViewer` vs `useCompressedGLTF`.

- [ ] **Step 2: Add the IndexedDB-loaded blob path**

When `model.sketchfabMode === "import"` and `model.sketchfabUid` is set:
1. `useEffect` to call `loadCachedModelBlob(uid)` → if non-null, `URL.createObjectURL(blob)`, store in state
2. Pass that blob URL to the GLB loader instead of `model.src`
3. Cleanup: `URL.revokeObjectURL` when the component unmounts or the UID changes

If the cache returns null (e.g., the user reloaded after clearing the cache), surface a friendly error: "This Sketchfab model needs to be re-imported (cache was cleared)" with a re-import affordance.

- [ ] **Step 3: Typecheck + commit**

```bash
git add apps/studio-app/src/EditCanvas/Hotspot3DEditor.tsx
git commit -m "feat(sketchfab): editor preview loads imported models from IndexedDB"
```

---

### Task 7: SCORM export embeds the cached blob + rewrites `model.src`

**Files:**
- Modify: `apps/studio-app/src/scormDownload.ts`

When exporting a hotspot-3d activity with `model.sketchfabMode === "import"`:
1. Look up the blob via `loadCachedModelBlob(model.sketchfabUid)`. If not found, fail the export with a clear message ("Re-import the model first — cache was cleared").
2. Add the blob to the zip at `samples/<kind>/assets/<uid>.glb`.
3. Modify the config before writing it to the zip:
   - Set `model.src = "./assets/<uid>.glb"`
   - Delete `model.sketchfabMode` (runtime doesn't need it; the presence of `model.src` alone routes to the GLB loader)
   - Keep `model.sketchfabUid` and `model.attribution` (for footer credit at runtime).

- [ ] **Step 1: Modify `downloadScormZip`**

The current function:

```ts
export async function downloadScormZip(kind: ActivityKind, config: unknown): Promise<void> {
  const { default: JSZip } = await import("jszip");
  // ... fetch template, load zip ...
  const samplePath = `samples/${kind}/basic.json`;
  zip.file(samplePath, JSON.stringify(config, null, 2));
  // ...
}
```

Change to:

```ts
import { loadCachedModelBlob } from "./sketchfab/modelCache.js";

export async function downloadScormZip(kind: ActivityKind, config: unknown): Promise<void> {
  const { default: JSZip } = await import("jszip");
  // ... fetch template, load zip ...

  // Rewrite Sketchfab-imported models BEFORE serialising. Cast through
  // unknown because TS narrowing across the polymorphic `config` is
  // unproductive — runtime validation has already passed.
  const finalConfig = await embedSketchfabImports(kind, config, zip);

  const samplePath = `samples/${kind}/basic.json`;
  zip.file(samplePath, JSON.stringify(finalConfig, null, 2));
  // ... rest unchanged
}

async function embedSketchfabImports(
  kind: ActivityKind,
  config: unknown,
  zip: JSZip,
): Promise<unknown> {
  if (!config || typeof config !== "object") return config;
  const model = (config as { model?: { sketchfabMode?: string; sketchfabUid?: string } }).model;
  if (!model || model.sketchfabMode !== "import" || !model.sketchfabUid) {
    return config;
  }
  const blob = await loadCachedModelBlob(model.sketchfabUid);
  if (!blob) {
    throw new Error(
      `Sketchfab model ${model.sketchfabUid} is referenced but not in cache. Re-import the model and try again.`,
    );
  }
  // Asset path inside the zip — colocated under the activity's
  // samples folder so the relative ./ in model.src resolves cleanly.
  const assetPath = `samples/${kind}/assets/${model.sketchfabUid}.glb`;
  zip.file(assetPath, await blob.arrayBuffer());

  // Rewrite the embedded JSON: set model.src to the relative path,
  // drop sketchfabMode (runtime uses src now), keep sketchfabUid +
  // attribution for the footer credit.
  const next = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
  const nextModel = next.model as Record<string, unknown>;
  nextModel.src = `./assets/${model.sketchfabUid}.glb`;
  delete nextModel.sketchfabMode;
  return next;
}
```

- [ ] **Step 2: Verify the runtime picks the GLB loader path**

The runtime in `packages/core/src/components/hotspot-3d/Hotspot3D.tsx` should already branch on `model.src` first (existing behaviour for the direct-URL case). With `sketchfabMode` removed from the exported JSON, the runtime sees only `model.src + sketchfabUid + attribution` — same shape as a direct-URL model with attribution. Confirm this by reading the runtime briefly.

- [ ] **Step 3: Typecheck + commit**

```bash
git add apps/studio-app/src/scormDownload.ts
git commit -m "feat(sketchfab): embed cached GLB into SCORM zip on export"
```

---

### Task 8: Integration smoke + PR

- [ ] **Step 1: Full test suite + typecheck + build**

```bash
pnpm typecheck && pnpm test && pnpm --filter @kukui/studio-app build
```

- [ ] **Step 2: Manual end-to-end (local, using dev-mode mock from Phase A)**

1. `pnpm dev:studio` → open Studio
2. Settings → Connections → expand "Dev only — paste a token manually" → paste a real Sketchfab access token (generated against production) → save
3. Create a new hotspot-3d activity
4. Use the new "Import from Sketchfab" affordance → paste a CC-BY model URL → confirm metadata fetches, license check passes, blob downloads, cache populates, editor preview renders the model
5. Try a CC-BY-ND model → confirm rejection message
6. Click "Download SCORM" → verify the resulting `.zip` contains `samples/hotspot-3d/assets/<uid>.glb`
7. Unzip and inspect `samples/hotspot-3d/basic.json` → confirm `model.src` rewritten to `./assets/<uid>.glb`, `model.sketchfabMode` absent, `model.attribution` populated
8. (Optional) Upload the zip to a SCORM tester (e.g., scorm.com cloud) to verify it launches and the model renders

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/sketchfab-oauth-phase-b
/Users/Jesse/bin/gh pr create --base feat/sketchfab-oauth-phase-a --title "feat: Sketchfab OAuth — Phase B (editor + SCORM export integration)" \
  --body "$(cat <<'EOF'
## Summary
Activates the Phase A scaffolding by adding an "Import from Sketchfab" affordance to the 3D Hotspot editor and making SCORM export embed the cached `.glb` body.

- New schema field `model.sketchfabMode: "embed" | "import"` distinguishes existing iframe-embed path from new download-and-bundle path. Default (undefined) preserves existing behaviour.
- New `importFromSketchfab(url, token)` service: metadata → license check → download URL → blob fetch → IndexedDB cache.
- License allow/reject helpers (CC0 / BY / BY-SA / BY-NC allowed; ND variants + proprietary rejected with explanatory messages).
- New `SketchfabImportButton` React component injected into the hotspot-3d editor form.
- `scormDownload.ts` detects `sketchfabMode === "import"` models, pulls the blob from IndexedDB, embeds it at `samples/<kind>/assets/<uid>.glb`, and rewrites `model.src` in the embedded JSON.

Stacked on `feat/sketchfab-oauth-phase-a` (PR #4).

Spec: docs/superpowers/specs/2026-05-13-sketchfab-oauth-registration.md
Plan: docs/superpowers/plans/2026-05-15-sketchfab-oauth-phase-b-plan.md

## Behavioural impact
- New "Import from Sketchfab" affordance in hotspot-3d editor
- New schema field; existing activities parse unchanged
- SCORM export of imported models now produces self-contained zips with the model body bundled in
- Existing iframe-embed path unchanged (sketchfabUid without sketchfabMode = embed)

## Test plan
- [x] `pnpm typecheck` clean
- [x] `pnpm test` clean (X new unit tests)
- [x] `pnpm build` clean
- [ ] Manual end-to-end with dev-mode mock token (steps in the plan)
- [ ] Real OAuth + import + export on kukuistudio.com after merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Note the `--base feat/sketchfab-oauth-phase-a` — stacked PR. If/when Phase A merges first, GitHub auto-retargets the base to main.

---

## Out of scope (explicit)

- **Other 3D activities.** Only hotspot-3d gets the import button in this phase. Other kinds with similar needs (virtual-tour, etc.) can adopt the same pattern via separate PRs.
- **Re-import workflow on stale cache.** If the IndexedDB cache is cleared between import and export, SCORM export fails with an error. We don't auto-re-import. Future improvement.
- **Model browser UI.** Author still pastes a URL; no in-app Sketchfab browsing.
- **License refresh.** If a Sketchfab author changes a model's license post-import, the cached copy still uses the old license attribution. Author would need to re-import to refresh.
- **GLTF (non-binary) support.** Only `.glb` (binary) is imported. Sketchfab returns both `glb` and `gltf` download URLs but we use only `glb`.
