const fs = require("node:fs");
const path = require("node:path");
const { EMPTY_MANIFEST, EMPTY_TUNING, createProjectStore, godotProjectName, slug } = require("./project_store");
const { syncGodotProject } = require("./godot_sync");
const { upsertEstimatedFrameBoxes } = require("./box_estimator");
const { ensureInitialCharacterScale } = require("./import_scale");

const ROOT = path.resolve(__dirname, "..");
const projectStore = createProjectStore(ROOT);

function usage() {
  console.log(`Usage:
node tools/import_spriteframes.js --project-root <godot_project_root> [--project <id>] [--file <spriteframes.tres>] [--all]
`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "all") args.all = true;
    else {
      args[key] = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function walk(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".godot" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, result);
    else if (entry.isFile() && entry.name.endsWith(".spriteframes.tres")) result.push(full);
  }
  return result;
}

function shouldInclude(filePath, projectRoot, includeAll) {
  if (includeAll) return true;
  const rel = path.relative(projectRoot, filePath).replaceAll("\\", "/").toLowerCase();
  return /(character|characters|actor|actors|enemy|enemies|player|npc|boss|monster|role)/.test(rel);
}

function resolveGodotPath(rawPath, projectRoot, ownerFile) {
  if (!rawPath) return null;
  if (rawPath.startsWith("res://")) return path.join(projectRoot, rawPath.slice("res://".length));
  if (path.isAbsolute(rawPath)) return rawPath;
  return path.resolve(path.dirname(ownerFile), rawPath);
}

function getPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return { width: 0, height: 0 };
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function samePath(left, right) {
  if (!left || !right) return false;
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function initialAnchorModeForBatch(_animations) {
  // Grounded actors should enter the tuner/game at a stable foot-center origin.
  // Different source canvas sizes are handled per group, not by changing anchor.
  return "canvas_bottom_center";
}

function parseSpriteFrames(filePath, projectRoot) {
  const text = fs.readFileSync(filePath, "utf8");
  const resources = new Map();
  const extRegex = /\[ext_resource[^\]]*path="([^"]+)"[^\]]*id="([^"]+)"[^\]]*\]/g;
  let extMatch;
  while ((extMatch = extRegex.exec(text)) !== null) {
    resources.set(extMatch[2], resolveGodotPath(extMatch[1], projectRoot, filePath));
  }

  const animations = [];
  const animationRegex = /\{\s*"frames"\s*:\s*\[([\s\S]*?)\],\s*"loop"\s*:[\s\S]*?"name"\s*:\s*&"([^"]+)"[\s\S]*?"speed"\s*:\s*([-\d.]+)/g;
  let animationMatch;
  while ((animationMatch = animationRegex.exec(text)) !== null) {
    const [, frameBody, name, speed] = animationMatch;
    const frames = [];
    const frameRegex = /\{\s*"duration"\s*:\s*([-\d.]+),\s*"texture"\s*:\s*ExtResource\("([^"]+)"\)\s*\}/g;
    let frameMatch;
    while ((frameMatch = frameRegex.exec(frameBody)) !== null) {
      const source = resources.get(frameMatch[2]);
      if (!source || !fs.existsSync(source) || path.extname(source).toLowerCase() !== ".png") continue;
      frames.push({
        source,
        duration: Number(frameMatch[1] || 1),
      });
    }
    if (frames.length) {
      animations.push({ id: slug(name), name, fps: Number(speed || 12), frames });
    }
  }
  return animations;
}

function ensureProfile(manifest, profileId, label) {
  manifest.profiles = Array.isArray(manifest.profiles) ? manifest.profiles : [];
  let profile = manifest.profiles.find((entry) => entry.id === profileId);
  if (!profile) {
    profile = {
      id: profileId,
      label,
      kind: "actor",
      bodyScale: 1,
      runtimeScale: 1,
      animations: [],
    };
    manifest.profiles.push(profile);
  }
  profile.animations = Array.isArray(profile.animations) ? profile.animations : [];
  return profile;
}

function projectForImport(args, projectRoot) {
  let registry = projectStore.readRegistry();
  const label = args.project || godotProjectName(projectRoot) || path.basename(projectRoot);
  const requestedId = slug(label);
  const explicitProject = Boolean(args.project);
  let project = registry.projects.find((entry) => entry.id === requestedId);
  if (!project) {
    registry = projectStore.addProject({ id: requestedId, label, projectRoot });
    project = registry.projects.find((entry) => entry.id === registry.activeProjectId);
  } else if (project.projectRoot && !samePath(project.projectRoot, projectRoot)) {
    if (explicitProject) {
      throw new Error(`Project id "${project.id}" is already bound to ${project.projectRoot}. Use a different --project id for ${projectRoot}.`);
    } else {
      registry = projectStore.addProject({ label, projectRoot });
    }
    project = registry.projects.find((entry) => entry.id === registry.activeProjectId);
  } else if (project.projectRoot !== projectRoot) {
    project.projectRoot = projectRoot;
    registry.activeProjectId = project.id;
    registry = projectStore.writeRegistry(registry);
    project = registry.projects.find((entry) => entry.id === registry.activeProjectId);
  }
  if (!project) throw new Error(`Project not found: ${requestedId}`);
  return project;
}

function importSpriteFrames(filePath, projectRoot, project, manifest, tuning) {
  const relFile = path.relative(projectRoot, filePath).replaceAll("\\", "/");
  const profileId = slug(relFile.replace(/\.spriteframes\.tres$/i, ""));
  const profileLabel = path.basename(filePath, ".spriteframes.tres");
  const profile = ensureProfile(manifest, profileId, profileLabel);
  const animations = parseSpriteFrames(filePath, projectRoot);
  const batchAnchorMode = initialAnchorModeForBatch(animations);
  const paths = projectStore.projectPaths(project);
  const workspaceAssets = path.join(paths.workspaceDir, "assets");
  let importedFrames = 0;
  const scaleSamples = [];

  for (const animation of animations) {
    const targetDir = path.join(workspaceAssets, profileId, animation.id);
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });
    const frameFiles = [];
    const frames = animation.frames.map((frame, index) => {
      const targetName = `frame_${String(index + 1).padStart(4, "0")}.png`;
      const target = path.join(targetDir, targetName);
      fs.copyFileSync(frame.source, target);
      frameFiles.push(target);
      scaleSamples.push({ filePath: target, animationId: animation.id, animationName: animation.name });
      importedFrames += 1;
      return {
        id: `frame_${String(index + 1).padStart(4, "0")}`,
        name: targetName,
        path: path.relative(ROOT, target).replaceAll("\\", "/"),
        duration: frame.duration,
        ...getPngSize(target),
      };
    });
    const nextAnimation = {
      id: animation.id,
      name: animation.name,
      type: "actor",
      anchorMode: batchAnchorMode,
      fps: animation.fps,
      source: path.relative(ROOT, targetDir).replaceAll("\\", "/"),
      frames,
    };
    const existingIndex = profile.animations.findIndex((entry) => entry.id === animation.id);
    if (existingIndex >= 0) profile.animations[existingIndex] = nextAnimation;
    else profile.animations.push(nextAnimation);
    upsertEstimatedFrameBoxes(tuning, profileId, nextAnimation, frameFiles, { replace: true });
  }

  const scaleResult = ensureInitialCharacterScale(tuning, profileId, project.projectRoot, scaleSamples);
  return { profileId, animations: animations.length, frames: importedFrames, scaleResult };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args["project-root"]) {
    usage();
    process.exit(1);
  }
  const projectRoot = path.resolve(args["project-root"]);
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    throw new Error(`Project root not found: ${projectRoot}`);
  }
  const files = args.file
    ? [path.resolve(args.file)]
    : walk(projectRoot).filter((filePath) => shouldInclude(filePath, projectRoot, args.all)).sort(naturalSort);
  if (!files.length) throw new Error("No SpriteFrames files found.");

  const project = projectForImport(args, projectRoot);
  const paths = projectStore.projectPaths(project);
  const manifest = projectStore.readJson(paths.manifest, EMPTY_MANIFEST);
  const tuning = projectStore.readJson(paths.tuning, EMPTY_TUNING);
  const results = files.map((filePath) => importSpriteFrames(filePath, projectRoot, project, manifest, tuning));
  projectStore.writeJson(paths.manifest, manifest);
  projectStore.writeJson(paths.tuning, tuning);
  const godotSync = syncGodotProject(ROOT, projectStore, project, { manifest, tuning });

  const frameCount = results.reduce((sum, result) => sum + result.frames, 0);
  console.log(`Imported ${frameCount} frames from ${results.length} SpriteFrames files`);
  console.log(`Project: ${project.id}`);
  for (const result of results) {
    console.log(`${result.profileId}: ${result.animations} animations, ${result.frames} frames`);
    if (result.scaleResult?.changed) {
      console.log(`${result.profileId}: initial scale ${result.scaleResult.scale}`);
    }
  }
  if (godotSync.ok) {
    console.log(`Godot assets: ${godotSync.copiedFrames}/${godotSync.frameCount} frames synced to ${godotSync.assetRoot}`);
  }
}

main();
