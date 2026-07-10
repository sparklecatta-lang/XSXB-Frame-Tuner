const fs = require("node:fs");
const path = require("node:path");
const { animationLooksAttack, frameBoxKey } = require("./box_estimator");
const { EMPTY_MANIFEST, EMPTY_TUNING, createProjectStore, slug } = require("./project_store");

const ROOT = path.resolve(__dirname, "..");
const projectStore = createProjectStore(ROOT);
const SKIP_DIRS = new Set([".git", ".godot", "addons", "node_modules", "xsxb_frame_tuner"]);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (["strict", "require-gameplay"].includes(key)) args[key] = true;
    else {
      args[key] = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeBindings(raw) {
  if (Array.isArray(raw)) return raw.filter((entry) => entry && typeof entry === "object");
  return Object.entries(raw || {}).map(([key, value]) => ({ key, ...(value && typeof value === "object" ? value : {}) }));
}

function animationMap(manifest) {
  const map = new Map();
  for (const profile of Array.isArray(manifest?.profiles) ? manifest.profiles : []) {
    for (const animation of Array.isArray(profile?.animations) ? profile.animations : []) {
      map.set(`${profile.id}/${animation.id || animation.name}`, { profile, animation });
    }
  }
  return map;
}

function validBox(box) {
  return Boolean(
    box && typeof box === "object"
    && Number(box?.size?.x) > 0
    && Number(box?.size?.y) > 0
    && Number.isFinite(Number(box?.offset?.x))
    && Number.isFinite(Number(box?.offset?.y))
  );
}

function walkTextFiles(root) {
  const files = [];
  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(fullPath);
        continue;
      }
      if (!entry.isFile() || ![".gd", ".tscn"].includes(path.extname(entry.name).toLowerCase())) continue;
      try {
        files.push({ path: fullPath, text: fs.readFileSync(fullPath, "utf8") });
      } catch {
        // Ignore unreadable files and let concrete file checks report missing data.
      }
    }
  };
  walk(root);
  return files;
}

function resolveProject(args) {
  const registry = projectStore.readRegistry();
  const requestedRoot = args["project-root"] ? path.resolve(String(args["project-root"])) : "";
  if (args.project) {
    const project = registry.projects.find((entry) => entry.id === slug(args.project));
    if (project) return project;
  }
  if (requestedRoot) {
    const project = registry.projects.find((entry) => entry.projectRoot && path.resolve(entry.projectRoot).toLowerCase() === requestedRoot.toLowerCase());
    if (project) return project;
  }
  return null;
}

function validateImport(args) {
  const errors = [];
  const warnings = [];
  const project = resolveProject(args);
  if (!project) {
    return { ok: false, errors: ["XSXB project not found. Pass --project or a bound --project-root."], warnings, summary: {} };
  }
  const projectRoot = project.projectRoot ? path.resolve(project.projectRoot) : "";
  if (!projectRoot || !fs.existsSync(path.join(projectRoot, "project.godot"))) {
    errors.push(`Bound Godot project.godot not found: ${projectRoot || "(empty)"}`);
  }

  const paths = projectStore.projectPaths(project);
  const manifest = readJson(paths.manifest, EMPTY_MANIFEST);
  const tuning = readJson(paths.tuning, EMPTY_TUNING);
  const standaloneAnimations = animationMap(manifest);
  const localAudio = normalizeBindings(readJson(paths.frameAudio, []));
  const localAttachments = normalizeBindings(readJson(paths.frameImageAttachments, []));
  let frameCount = 0;
  let boxFrameCount = 0;

  for (const [key, record] of standaloneAnimations.entries()) {
    const { profile, animation } = record;
    const frames = Array.isArray(animation.frames) ? animation.frames : [];
    if (!frames.length) errors.push(`${key}: animation has no frames.`);
    const actorLike = !/(vfx|effect|overlay|prop)/i.test(String(animation.type || profile.kind || "actor"));
    const attackLike = animationLooksAttack(animation.id, animation.name);
    frames.forEach((frame, index) => {
      frameCount += 1;
      const sourcePath = String(frame.path || "").replace(/^res:\/\//, "");
      const absolute = path.resolve(ROOT, sourcePath);
      if (!sourcePath || !absolute.startsWith(ROOT) || !fs.existsSync(absolute)) {
        errors.push(`${key}:${index}: standalone frame path is missing: ${sourcePath || "(empty)"}`);
      }
      if (!actorLike) return;
      const boxKey = frameBoxKey(profile.id, animation.id || animation.name, index);
      const boxes = tuning?.frame_box_overrides?.[boxKey];
      if (!boxes || typeof boxes !== "object") {
        errors.push(`${boxKey}: saved frame boxes are missing.`);
        return;
      }
      boxFrameCount += 1;
      for (const boxName of ["hurtbox", "collisionbox"]) {
        if (!validBox(boxes[boxName])) errors.push(`${boxKey}: invalid ${boxName}.`);
      }
      if (validBox(boxes.collisionbox)) {
        const expectedY = -Number(boxes.collisionbox.size.y) * 0.5;
        if (Math.abs(Number(boxes.collisionbox.offset.y) - expectedY) > 0.01) {
          errors.push(`${boxKey}: collisionbox bottom is not grounded (offset.y must equal -height/2).`);
        }
      }
      if (attackLike && !validBox(boxes.hitbox)) errors.push(`${boxKey}: attack animation is missing a saved hitbox.`);
      if (!attackLike && boxes.hitbox?.enabled === true) warnings.push(`${boxKey}: non-attack animation has an enabled hitbox; visually verify intent.`);
    });
  }

  const gameDataDir = projectRoot ? path.join(projectRoot, "xsxb_frame_tuner", "data", "projects", project.id) : "";
  const gameManifestPath = path.join(gameDataDir, "animation_manifest.json");
  const gameTuningPath = path.join(gameDataDir, "animation_tuning.json");
  const gameAudioPath = path.join(gameDataDir, "frame_audio_bindings.json");
  const gameAttachmentsPath = path.join(gameDataDir, "frame_image_attachments.json");
  for (const filePath of [gameManifestPath, gameTuningPath, gameAudioPath, gameAttachmentsPath]) {
    if (!filePath || !fs.existsSync(filePath)) errors.push(`Game-local XSXB data file is missing: ${filePath}`);
  }

  const gameManifest = readJson(gameManifestPath, EMPTY_MANIFEST);
  const gameTuning = readJson(gameTuningPath, EMPTY_TUNING);
  const gameAnimations = animationMap(gameManifest);
  for (const [key, record] of standaloneAnimations.entries()) {
    const gameRecord = gameAnimations.get(key);
    if (!gameRecord) {
      errors.push(`${key}: missing from game-local manifest.`);
      continue;
    }
    const expectedFrames = record.animation.frames || [];
    const gameFrames = gameRecord.animation.frames || [];
    if (expectedFrames.length !== gameFrames.length) {
      errors.push(`${key}: frame count mismatch (${expectedFrames.length} standalone, ${gameFrames.length} game-local).`);
    }
    gameFrames.forEach((frame, index) => {
      const relative = String(frame.path || "").replace(/^res:\/\//, "").replace(/^\/+/, "");
      if (!relative || !fs.existsSync(path.join(projectRoot, relative))) errors.push(`${key}:${index}: game-local frame is missing: ${relative}`);
    });
  }
  if (JSON.stringify(tuning) !== JSON.stringify(gameTuning)) errors.push("Standalone and game-local animation_tuning.json differ.");

  const gameAudio = normalizeBindings(readJson(gameAudioPath, []));
  const gameAttachments = normalizeBindings(readJson(gameAttachmentsPath, []));
  if (localAudio.length !== gameAudio.length) errors.push(`Frame audio binding count mismatch (${localAudio.length} local, ${gameAudio.length} game-local).`);
  if (localAttachments.length !== gameAttachments.length) errors.push(`Frame attachment count mismatch (${localAttachments.length} local, ${gameAttachments.length} game-local).`);
  for (const binding of [...gameAudio, ...gameAttachments]) {
    const key = String(binding.key || "");
    const assetPath = String(binding.path || binding.file || "");
    if (!/^.+\/.+:[0-9]+$/.test(key)) errors.push(`Unstable frame binding key: ${key || "(empty)"}`);
    if (!assetPath.startsWith("res://")) errors.push(`${key}: game-local binding path is not res://: ${assetPath || "(empty)"}`);
    const diskPath = assetPath.startsWith("res://") ? path.join(projectRoot, assetPath.slice("res://".length)) : "";
    if (diskPath && !fs.existsSync(diskPath)) errors.push(`${key}: bound game asset is missing: ${assetPath}`);
  }

  const runtimeDir = path.join(projectRoot, "xsxb_frame_tuner", "runtime");
  const runtimeScriptPath = path.join(runtimeDir, "xsxb_frame_actor.gd");
  for (const fileName of ["xsxb_frame_actor.gd", "xsxb_frame_actor.tscn", "xsxb_runtime_test.tscn"]) {
    if (!fs.existsSync(path.join(runtimeDir, fileName))) errors.push(`Generated runtime file is missing: ${fileName}`);
  }
  const runtimeSource = fs.existsSync(runtimeScriptPath) ? fs.readFileSync(runtimeScriptPath, "utf8") : "";
  const runtimeRequirements = [
    ["frame_audio_bindings.json", /frame_audio_bindings\.json/],
    ["frame_image_attachments.json", /frame_image_attachments\.json/],
    ["group playback overrides", /__group/],
    ["idempotent playback", /_current_animation\s*==\s*animation_name[\s\S]{0,300}\brestart\b/],
    ["animation duration", /func\s+animation_duration\s*\(/],
    ["scene scale interface", /func\s+scene_scale\s*\(/],
    ["scene scale applied to visuals", /_character_scale\s*\(\s*\)\s*\*\s*scene_scale\s*\(\s*\)/],
    ["scaled boxes", /size\.x\)\s*\*\s*sprite_scale_x[\s\S]{0,150}size\.y\)\s*\*\s*sprite_scale_y/],
    ["frame-entry SFX", /_frame_visit_serial[\s\S]{0,12000}_play_current_frame_audio/],
    ["attachment layers", /layerOrder[\s\S]{0,3000}_attachments_below[\s\S]{0,1000}_attachments_above/],
  ];
  for (const [label, pattern] of runtimeRequirements) {
    if (!pattern.test(runtimeSource)) errors.push(`Generated runtime is missing ${label} support.`);
  }

  if (projectRoot && fs.existsSync(projectRoot)) {
    const gameplayFiles = walkTextFiles(projectRoot);
    const usesRuntime = gameplayFiles.some((entry) => /xsxb_frame_tuner\/runtime\/xsxb_frame_actor\.(?:tscn|gd)/.test(entry.text));
    if (args["require-gameplay"] && !usesRuntime) errors.push("No non-runtime gameplay scene or script uses xsxb_frame_actor.");
    else if (!usesRuntime) warnings.push("No non-runtime gameplay scene or script uses xsxb_frame_actor.");
    if (usesRuntime && !gameplayFiles.some((entry) => /(?:current_)?animation_duration\s*\(|call\s*\(\s*["']animation_duration["']/.test(entry.text))) {
      warnings.push("Gameplay uses XSXB runtime but does not appear to consume animation_duration for action timing.");
    }
    if (usesRuntime && !gameplayFiles.some((entry) => /scene_scale\s*\(|call\s*\(\s*["']scene_scale["']/.test(entry.text))) {
      warnings.push("Gameplay uses XSXB runtime but does not appear to consume scene_scale for movement values.");
    }
  }

  return {
    ok: errors.length === 0 && (!args.strict || warnings.length === 0),
    errors,
    warnings,
    summary: {
      project: project.id,
      projectRoot,
      profiles: Array.isArray(manifest.profiles) ? manifest.profiles.length : 0,
      animations: standaloneAnimations.size,
      frames: frameCount,
      actorFramesWithBoxes: boxFrameCount,
      frameAudioBindings: gameAudio.length,
      frameImageAttachments: gameAttachments.length,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = validateImport(args);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  validateImport,
};
