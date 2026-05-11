#!/usr/bin/env node
/**
 * pack-scorm.js
 *
 * Wraps a Vite build of one Kukui activity into a SCORM 1.2 zip ready for
 * upload to D2L Brightspace.
 *
 * Pipeline:
 *   1. Read the Vite build dir (default: apps/engine-web/dist).
 *   2. Stage into a temp directory.
 *   3. Rename {activity}.html → index.html (the entrypoint D2L launches).
 *   4. Copy assets/ as-is (Vite already emitted relative URLs via base "./").
 *   5. Copy pipwerks.SCORM.min.js (Vite served it from public/).
 *   6. Copy samples/{activity}/ → samples/{activity}/ inside the package.
 *   7. Render imsmanifest.xml from packaging/templates/imsmanifest.xml.tmpl.
 *   8. Zip to {out}/kukui-{activity}.scorm.zip.
 *
 * CLI:
 *   node packaging/pack-scorm.js \
 *       --activity multiple-choice \
 *       --build apps/engine-web/dist \
 *       --out packaging/build
 *
 * Or pack every Phase-1 activity at once:
 *   node packaging/pack-scorm.js --all
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
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const ENGINE_WEB_DIST = join(REPO_ROOT, "apps", "engine-web", "dist");
const SAMPLES_DIR = join(REPO_ROOT, "apps", "engine-web", "public", "samples");
const TEMPLATE = join(__dirname, "templates", "imsmanifest.xml.tmpl");

const PHASE_1_ACTIVITIES = [
  "multiple-choice",
  "fill-in-the-blanks",
  "drag-and-drop",
  "question-set",
  "hotspot-3d",
  "hotspot-2d",
  "virtual-tour",
  "sequence-steps",
  "matching-pairs",
  "categorization",
  "anatomy-labeling",
  "image-comparison-slider",
  "highlight-text",
  "flashcards",
  "reflection-prompt",
  "branching-scenario",
  "image-annotation",
  "concept-map",
  "interactive-video",
  "audio-recording",
  "lab-panel",
  "ddx-tree",
  "osce",
];

// Slugs become path components and zip names; reject anything outside
// [a-z0-9-] starting with an alphanumeric to prevent ../ traversal or
// shell-special filenames.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const SUPPORTED_ENGINES = new Set(["react", "unity", "godot", "articulate", "raw"]);

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

function fillTemplate(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (full, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : full,
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
      const src = join(samplesRoot, activity);
      if (!(await pathExists(src))) {
        throw new Error(`Samples directory missing for activity: ${src}`);
      }
      await cp(src, stagedSamples, { recursive: true });
    }

    // Render imsmanifest.xml.
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

    // Zip → {out}/kukui-{activity}.scorm.zip
    const zipPath = join(outDir, `kukui-${activity}.scorm.zip`);
    const bytes = await zipDirectory(stageDir, zipPath);
    console.log(
      `[pack-scorm] ${activity}: ${zipPath} (${(bytes / 1024).toFixed(1)} KB)`,
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
    );

  program.parse(process.argv);
  const opts = program.opts();

  if (!SUPPORTED_ENGINES.has(opts.engine)) {
    console.error(
      `Unsupported --engine: ${opts.engine}. Expected one of ${[...SUPPORTED_ENGINES].join(", ")}.`,
    );
    process.exit(2);
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
    });
  }
}

main().catch((err) => {
  console.error("[pack-scorm] failed:", err.stack ?? err);
  process.exit(1);
});
