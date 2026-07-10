const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { slug } = require("./project_store");

const IMPORT_SCRIPT = path.join(__dirname, "import_frames.js");
const ENTRY_KEYS = new Set(["source", "fps", "type", "anchor"]);

function usage() {
  console.log(`Usage:
node tools/import_batch.js --project-root <godot_project_root> [--project <id>] --profile <id> [--label <name>] [--fps 12] [--type actor] [--anchor canvas_bottom_center] [--replace] \\
  --animation idle --source <idle_png_folder> [--fps 12] \\
  --animation run --source <run_png_folder> [--fps 12]
`);
}

function parseBatchArgs(argv) {
  const globals = {};
  const entries = [];
  let current = null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "replace") {
      globals.replace = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    index += 1;
    if (key === "animation") {
      if (current) entries.push(current);
      current = { animation: value };
      continue;
    }
    if (current && ENTRY_KEYS.has(key)) current[key] = value;
    else globals[key] = value;
  }
  if (current) entries.push(current);
  return { globals, entries };
}

function pngCount(sourceDir) {
  return fs.readdirSync(sourceDir)
    .filter((name) => path.extname(name).toLowerCase() === ".png")
    .length;
}

function preflightBatch(batch) {
  const { globals, entries } = batch;
  if (!globals["project-root"] || !globals.profile || !entries.length) {
    throw new Error("Batch import requires --project-root, --profile, and at least one --animation/--source pair.");
  }
  const projectRoot = path.resolve(String(globals["project-root"]));
  if (!fs.existsSync(path.join(projectRoot, "project.godot"))) {
    throw new Error(`Godot project.godot not found under: ${projectRoot}`);
  }

  const usedIds = new Set();
  const normalizedEntries = entries.map((entry) => {
    if (!entry.animation || !entry.source) {
      throw new Error("Every --animation block must include --source.");
    }
    const animationId = slug(entry.animation, "animation");
    if (usedIds.has(animationId)) throw new Error(`Duplicate animation id: ${animationId}`);
    usedIds.add(animationId);
    const source = path.resolve(String(entry.source));
    if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
      throw new Error(`Animation source folder not found: ${source}`);
    }
    const frames = pngCount(source);
    if (!frames) throw new Error(`No PNG frames found for ${animationId}: ${source}`);
    const fps = Number(entry.fps ?? globals.fps ?? 12);
    if (!Number.isFinite(fps) || fps <= 0) throw new Error(`Invalid FPS for ${animationId}: ${fps}`);
    return {
      animation: animationId,
      source,
      fps,
      type: String(entry.type || globals.type || "actor"),
      anchor: String(entry.anchor || globals.anchor || "canvas_bottom_center"),
      frames,
    };
  });

  return {
    globals: { ...globals, "project-root": projectRoot, profile: slug(globals.profile, "profile") },
    entries: normalizedEntries,
  };
}

function importBatch(batch) {
  const checked = preflightBatch(batch);
  const completed = [];
  for (const entry of checked.entries) {
    const args = [
      IMPORT_SCRIPT,
      "--project-root", checked.globals["project-root"],
      "--profile", checked.globals.profile,
      "--animation", entry.animation,
      "--source", entry.source,
      "--fps", String(entry.fps),
      "--type", entry.type,
      "--anchor", entry.anchor,
    ];
    if (checked.globals.project) args.push("--project", checked.globals.project);
    if (checked.globals.label) args.push("--label", checked.globals.label);
    if (checked.globals.replace) args.push("--replace");

    const result = spawnSync(process.execPath, args, { encoding: "utf8", windowsHide: true });
    if (result.status !== 0) {
      const detail = String(result.stderr || result.stdout || "Unknown import error").trim();
      throw new Error(`Batch stopped at ${entry.animation} after ${completed.length} completed animation(s): ${detail}`);
    }
    completed.push({
      animation: entry.animation,
      source: entry.source,
      frames: entry.frames,
      fps: entry.fps,
      type: entry.type,
      anchor: entry.anchor,
    });
  }
  return {
    project: checked.globals.project || "(resolved from project root)",
    projectRoot: checked.globals["project-root"],
    profile: checked.globals.profile,
    animationCount: completed.length,
    frameCount: completed.reduce((total, entry) => total + entry.frames, 0),
    animations: completed,
  };
}

function main() {
  try {
    const parsed = parseBatchArgs(process.argv.slice(2));
    if (!parsed.entries.length) {
      usage();
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(importBatch(parsed), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  importBatch,
  parseBatchArgs,
  preflightBatch,
};
