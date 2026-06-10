#!/usr/bin/env node
/**
 * pack-scorm.js
 *
 * Wraps a Vite build of one Kukui activity into a distributable package.
 * Two targets:
 *   --target scorm  (default) → SCORM 1.2 zip for an LMS (Brightspace, etc.)
 *   --target web              → portable zip for any static host, no LMS
 *
 * SCORM pipeline:
 *   1. Read the Vite build dir (default: apps/engine-web/dist).
 *   2. Stage into a temp directory.
 *   3. Rename {activity}.html → index.html (the entrypoint D2L launches).
 *   4. Copy assets/ as-is (Vite already emitted relative URLs via base "./").
 *   5. Copy pipwerks.SCORM.min.js (Vite served it from public/).
 *   6. Copy samples/{activity}/ → samples/{activity}/ inside the package.
 *   7. Render imsmanifest.xml from packaging/templates/imsmanifest.xml.tmpl.
 *   8. Zip to {out}/kukui-{activity}.scorm.zip.
 *
 * Web target differs at steps 5/7/8:
 *   - drops pipwerks.SCORM.min.js (there is no LMS API to talk to),
 *   - drops imsmanifest.xml,
 *   - tags #root with data-mode="web" so the engine uses LocalDriver
 *     (localStorage persistence + the learner-facing completion panel),
 *   - optionally bakes a data-collect="<json>" results-collection config,
 *   - if that config opts into a webhook, relaxes the CSP connect-src to
 *     the webhook's origin so the POST can leave,
 *   - zips to {out}/kukui-{activity}.web.zip.
 *
 * CLI:
 *   node packaging/pack-scorm.js --activity multiple-choice
 *   node packaging/pack-scorm.js --activity multiple-choice --target web
 *   node packaging/pack-scorm.js --all --target web
 *
 * --engine flag (Phase 1.5): [react|unity|godot|articulate|raw]
 * Currently only "react" is implemented; the flag is parsed for forward
 * compatibility with kukui-bridge consumers in M7.
 */

import { Command } from "commander";
import archiver from "archiver";
import { createWriteStream } from "node:fs";
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
  stat,
} from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const ENGINE_WEB_DIST = join(REPO_ROOT, "apps", "engine-web", "dist");
const SAMPLES_DIR = join(REPO_ROOT, "apps", "engine-web", "public", "samples");
const ACTIVITIES_ROOT = join(REPO_ROOT, "packages", "activities");
const TEMPLATE = join(__dirname, "templates", "imsmanifest.xml.tmpl");

// Auto-discover the union of:
//   * activities co-located in packages/activities/<slug>/ (migrated)
//   * activities still in apps/engine-web/public/samples/<slug>/ (legacy)
// During Plan 2's bulk migration, the activities/ list grows and the
// samples/ list shrinks; this script handles both during the transition.
//
// For packages/activities/, we additionally require a samples/ subdirectory
// so that scaffolding files (node_modules, dist, src, package.json, etc.)
// don't get treated as activity slugs. This matches the convention used by
// apps/engine-web/vite-plugin-activity-samples.ts.
function discoverActivitySlugs() {
  const fromActivities = existsSync(ACTIVITIES_ROOT)
    ? readdirSync(ACTIVITIES_ROOT, { withFileTypes: true })
        .filter(
          (e) =>
            e.isDirectory() &&
            !e.name.startsWith("_") &&
            !e.name.startsWith(".") &&
            existsSync(join(ACTIVITIES_ROOT, e.name, "samples")),
        )
        .map((e) => e.name)
    : [];
  const fromSamples = existsSync(SAMPLES_DIR)
    ? readdirSync(SAMPLES_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
        .map((e) => e.name)
    : [];
  return Array.from(new Set([...fromActivities, ...fromSamples])).sort();
}

const PHASE_1_ACTIVITIES = discoverActivitySlugs();

// Slugs become path components and zip names; reject anything outside
// [a-z0-9-] starting with an alphanumeric to prevent ../ traversal or
// shell-special filenames.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const SUPPORTED_ENGINES = new Set(["react", "unity", "godot", "articulate", "raw"]);
const SUPPORTED_TARGETS = new Set(["scorm", "web"]);

// HTML attribute-value escaping. `&` must go first so entity-like sequences
// in user input (e.g. `&copy=` in a webhook URL) survive the round trip
// instead of being decoded into corrupt JSON. Mirrors escapeAttr in
// apps/studio-app/src/webDownload.ts.
function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// XML text/attribute escaping for imsmanifest.xml values, so e.g.
// --title "Q&A Review" produces valid XML.
function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Rewrite a built engine HTML entry for the non-LMS "web" target:
 *   - drop the pipwerks SCORM wrapper <script> (no LMS API to bind),
 *   - tag #root with data-mode="web" (→ LocalDriver) and, if provided,
 *     data-collect with the results-collection JSON,
 *   - if the collect config opts into a webhook, relax the CSP connect-src
 *     to that webhook's origin (and nothing wider) so the POST can leave.
 * Pure string transform so it stays trivially testable. Each step verifies
 * its pattern matched — if the built HTML drifts, we throw instead of
 * silently shipping a broken "web" zip.
 */
function transformHtmlForWeb(html, collectJson) {
  let out = html;

  // 1. Remove the pipwerks loader script (matches the line in every entry).
  const pipwerksPattern =
    /\s*<script[^>]*src=["']\.\/pipwerks\.SCORM\.min\.js["'][^>]*><\/script>/i;
  if (!pipwerksPattern.test(out)) {
    throw new Error(
      "transformHtmlForWeb: pipwerks <script> tag not found in built HTML — the engine entry template has drifted; update pack-scorm.js to match.",
    );
  }
  out = out.replace(pipwerksPattern, "");

  // 2. Add data-mode (and optional data-collect) to the #root div. The built
  //    div is `<div id="root" data-activity="..." data-config="...">`.
  //    Function replacement: rootAttrs carries user JSON, which must not be
  //    interpreted as `$`-replacement patterns.
  const rootPattern = /<div\s+id=["']root["']/i;
  if (!rootPattern.test(out)) {
    throw new Error(
      'transformHtmlForWeb: <div id="root"> not found in built HTML — the engine entry template has drifted; update pack-scorm.js to match.',
    );
  }
  const rootAttrs =
    ` data-mode="web"` +
    (collectJson ? ` data-collect="${escapeAttr(collectJson)}"` : "");
  out = out.replace(rootPattern, (m) => m + rootAttrs);

  // 3. Relax the CSP only when the collect config has a webhook, and pin
  //    connect-src to that webhook's origin. The engine's CSP pins
  //    connect-src to 'self'; without a webhook there is nothing to relax.
  const webhook = collectJson ? JSON.parse(collectJson).webhook : undefined;
  if (typeof webhook === "string" && webhook) {
    const webhookOrigin = new URL(webhook).origin;
    const cspPattern = /connect-src 'self';/i;
    if (!cspPattern.test(out)) {
      throw new Error(
        "transformHtmlForWeb: connect-src 'self' CSP directive not found in built HTML — the engine entry template has drifted; update pack-scorm.js to match.",
      );
    }
    out = out.replace(cspPattern, () => `connect-src 'self' ${webhookOrigin};`);
  }

  return out;
}

function titleize(slug) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function slugToIdentifier(slug) {
  return "KUKUI-" + slug.replace(/[^a-zA-Z0-9]+/g, "-").toUpperCase();
}

// Var values are XML-escaped: the only template is imsmanifest.xml.tmpl, and
// e.g. --title "Q&A Review" must not produce invalid XML.
function fillTemplate(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (full, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? escapeXml(vars[key]) : full,
  );
}

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function zipDirectory(srcDir, outFile) {
  await mkdir(dirname(outFile), { recursive: true });
  return new Promise((accept, reject) => {
    const output = createWriteStream(outFile);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => accept(archive.pointer()));
    archive.on("warning", (err) => {
      if (err.code === "ENOENT") console.warn(err);
      else reject(err);
    });
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(srcDir, false);
    archive.finalize();
  });
}

async function packActivity(opts) {
  const {
    activity,
    buildDir,
    samplesRoot,
    outDir,
    title,
    masteryScore,
    defaultConfig,
    identifier,
    engine,
    target,
    collectJson,
  } = opts;

  if (!SLUG_PATTERN.test(activity)) {
    throw new Error(
      `Invalid --activity slug "${activity}". Expected /^[a-z0-9][a-z0-9-]*$/`,
    );
  }

  if (engine !== "react") {
    console.warn(
      `[pack-scorm] --engine ${engine} is documented but not yet implemented; treating as 'react'`,
    );
  }

  const sourceHtml = join(buildDir, `${activity}.html`);
  if (!existsSync(sourceHtml)) {
    throw new Error(
      `Built HTML not found at ${sourceHtml}. Run 'pnpm build' first.`,
    );
  }

  const stage = await mkdir(join(tmpdir(), `kukui-${activity}-${Date.now()}`), {
    recursive: true,
  });
  const stageDir = stage;

  try {
    // Copy entire dist → stage. Then promote {activity}.html to index.html.
    await cp(buildDir, stageDir, { recursive: true });

    // Remove sibling activity HTMLs so the zip ships exactly one entrypoint.
    const stagedFiles = await readdir(stageDir);
    for (const name of stagedFiles) {
      if (name.endsWith(".html") && name !== `${activity}.html`) {
        await rm(join(stageDir, name));
      }
    }

    // Promote the activity HTML to index.html.
    await rename(join(stageDir, `${activity}.html`), join(stageDir, "index.html"));

    // Vite copies all of public/samples into dist/samples; prune to just the
    // active activity so each SCORM zip stays small.
    const stagedSamplesRoot = join(stageDir, "samples");
    if (await pathExists(stagedSamplesRoot)) {
      for (const name of await readdir(stagedSamplesRoot)) {
        if (name !== activity) {
          await rm(join(stagedSamplesRoot, name), { recursive: true, force: true });
        }
      }
    }
    const stagedSamples = join(stageDir, "samples", activity);
    if (!(await pathExists(stagedSamples))) {
      // Prefer the new co-located location (packages/activities/<slug>/samples)
      // and fall back to the legacy apps/engine-web/public/samples/<slug>.
      const newSamplesDir = join(ACTIVITIES_ROOT, activity, "samples");
      const legacySamplesDir = join(samplesRoot, activity);
      const src = existsSync(newSamplesDir) ? newSamplesDir : legacySamplesDir;
      if (!(await pathExists(src))) {
        throw new Error(
          `No samples directory for activity ${activity} at ${newSamplesDir} or ${legacySamplesDir}`,
        );
      }
      await cp(src, stagedSamples, { recursive: true });
    }

    // Caption-stack trimming. Only video-reflection uses on-device
    // transcription, so for every OTHER package strip the parts that would
    // otherwise bloat it: the bundled model (whisper/, ~40 MB), the
    // onnxruntime-web wasm Vite emits into assets/ (~22 MB), and the
    // transformers.js chunk. video-reflection keeps all three.
    if (activity !== "video-reflection") {
      const whisperDir = join(stageDir, "whisper");
      if (await pathExists(whisperDir)) {
        await rm(whisperDir, { recursive: true, force: true });
      }
      const assetsDir = join(stageDir, "assets");
      if (await pathExists(assetsDir)) {
        for (const name of await readdir(assetsDir)) {
          if (/^ort-wasm.*\.wasm$/.test(name) || /^transformers\.web-.*\.js$/.test(name)) {
            await rm(join(assetsDir, name), { force: true });
          }
        }
      }
    }

    const indexPath = join(stageDir, "index.html");

    if (target === "web") {
      // Web target: no LMS API, no manifest. Rewrite the entry for LocalDriver
      // (data-mode="web" + optional data-collect) and drop pipwerks.
      const html = await readFile(indexPath, "utf8");
      await writeFile(indexPath, transformHtmlForWeb(html, collectJson), "utf8");
      const pipwerks = join(stageDir, "pipwerks.SCORM.min.js");
      if (await pathExists(pipwerks)) await rm(pipwerks, { force: true });
    } else {
      // SCORM target: render imsmanifest.xml.
      const tmpl = await readFile(TEMPLATE, "utf8");
      const manifestVars = {
        IDENTIFIER: identifier,
        TITLE: title,
        DEFAULT_CONFIG: defaultConfig,
        MASTERY_SCORE: String(masteryScore),
      };
      await writeFile(
        join(stageDir, "imsmanifest.xml"),
        fillTemplate(tmpl, manifestVars),
        "utf8",
      );
    }

    // Zip → {out}/kukui-{activity}.{scorm|web}.zip
    const zipPath = join(outDir, `kukui-${activity}.${target}.zip`);
    const bytes = await zipDirectory(stageDir, zipPath);
    console.log(
      `[pack-scorm] ${activity} (${target}): ${zipPath} (${(bytes / 1024).toFixed(1)} KB)`,
    );
  } finally {
    await rm(stageDir, { recursive: true, force: true });
  }
}

async function main() {
  const program = new Command();
  program
    .name("pack-scorm")
    .description("Pack a Kukui activity into a SCORM 1.2 zip")
    .option("--activity <name>", "activity slug (e.g. multiple-choice)")
    .option("--all", "pack every Phase-1 activity")
    .option("--build <dir>", "Vite build directory", ENGINE_WEB_DIST)
    .option("--samples <dir>", "samples root directory", SAMPLES_DIR)
    .option("--out <dir>", "output directory", join(REPO_ROOT, "packaging", "build"))
    .option("--title <s>", "human-readable activity title (defaults from slug)")
    .option(
      "--default-config <path>",
      "default ?config= path baked into the manifest (default: samples/<activity>/basic.json)",
    )
    .option("--identifier <s>", "manifest identifier override")
    .option(
      "--mastery <n>",
      "mastery score (0–100) for SCORM passing",
      (v) => Number.parseInt(v, 10),
      70,
    )
    .option(
      "--engine <kind>",
      `content engine (one of ${[...SUPPORTED_ENGINES].join(", ")})`,
      "react",
    )
    .option(
      "--target <kind>",
      `distribution target (one of ${[...SUPPORTED_TARGETS].join(", ")})`,
      "scorm",
    )
    .option(
      "--collect <json>",
      'web target only: results-collection JSON, e.g. \'{"email":"prof@uh.edu"}\'',
    );

  program.parse(process.argv);
  const opts = program.opts();

  if (!SUPPORTED_ENGINES.has(opts.engine)) {
    console.error(
      `Unsupported --engine: ${opts.engine}. Expected one of ${[...SUPPORTED_ENGINES].join(", ")}.`,
    );
    process.exit(2);
  }

  if (!SUPPORTED_TARGETS.has(opts.target)) {
    console.error(
      `Unsupported --target: ${opts.target}. Expected one of ${[...SUPPORTED_TARGETS].join(", ")}.`,
    );
    process.exit(2);
  }

  // Validate --mastery now so a typo fails fast rather than baking NaN (or
  // an out-of-range score) into the manifest.
  if (
    !Number.isInteger(opts.mastery) ||
    opts.mastery < 0 ||
    opts.mastery > 100
  ) {
    console.error(`Invalid --mastery: ${opts.mastery}. Expected an integer 0–100.`);
    process.exit(2);
  }

  // Validate --collect now so a typo fails fast rather than baking broken
  // JSON into the package. Only meaningful for the web target.
  let collectJson;
  if (opts.collect) {
    if (opts.target !== "web") {
      console.warn("[pack-scorm] --collect is ignored unless --target web");
    } else {
      try {
        const parsed = JSON.parse(opts.collect);
        // The webhook (if any) feeds the CSP connect-src relax, so it must
        // parse as a URL — fail fast here rather than mid-pack.
        if (typeof parsed.webhook === "string" && parsed.webhook) {
          new URL(parsed.webhook);
        }
        collectJson = opts.collect;
      } catch {
        console.error(`Invalid --collect JSON: ${opts.collect}`);
        process.exit(2);
      }
    }
  }

  const targets = opts.all
    ? PHASE_1_ACTIVITIES
    : opts.activity
      ? [opts.activity]
      : null;

  if (!targets) {
    console.error("Pass --activity <slug> or --all.");
    process.exit(2);
  }

  await mkdir(opts.out, { recursive: true });

  for (const activity of targets) {
    const title = opts.title ?? titleize(activity);
    const identifier = opts.identifier ?? slugToIdentifier(activity);
    const defaultConfig = opts.defaultConfig ?? `samples/${activity}/basic.json`;

    await packActivity({
      activity,
      buildDir: opts.build,
      samplesRoot: opts.samples,
      outDir: opts.out,
      title,
      masteryScore: opts.mastery,
      defaultConfig,
      identifier,
      engine: opts.engine,
      target: opts.target,
      collectJson,
    });
  }
}

main().catch((err) => {
  console.error("[pack-scorm] failed:", err.stack ?? err);
  process.exit(1);
});
