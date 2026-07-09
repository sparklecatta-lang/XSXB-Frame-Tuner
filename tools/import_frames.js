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
node tools/import_frames.js --profile <id> --animation <id> --source <png_folder> [--project <id>] [--project-root <godot_project_root>] [--label <name>] [--fps 12] [--type actor] [--anchor canvas_bottom_center|canvas_left_bottom] [--replace]
`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "replace") {
      args.replace = true;
    } else {
      args[key] = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function getPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return { width: 0, height: 0 };
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function ensureProfile(manifest, profileId, label) {
  manifest.profiles = Array.isArray(manifest.profiles) ? manifest.profiles : [];
  let profile = manifest.profiles.find((entry) => entry.id === profileId);
  if (!profile) {
    profile = {
      id: profileId,
      label: label || profileId,
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

function samePath(left, right) {
  if (!left || !right) return false;
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function projectForImport(args) {
  let registry = projectStore.readRegistry();
  let projectRoot = String(args["project-root"] || "").trim().replace(/^["']|["']$/g, "");
  if (projectRoot) {
    projectRoot = path.resolve(projectRoot);
    if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
      throw new Error(`Project root not found: ${projectRoot}`);
    }
  }
  if (projectRoot && !args.project) {
    const existingByRoot = registry.projects.find((entry) => samePath(entry.projectRoot, projectRoot));
    if (existingByRoot) return existingByRoot;
    const label = godotProjectName(projectRoot) || path.basename(projectRoot);
    registry = projectStore.addProject({ label, projectRoot });
    const project = registry.projects.find((entry) => entry.id === registry.activeProjectId);
    if (!project) throw new Error(`Project not found after adding ${label}`);
    return project;
  }

  const requestedId = args.project ? slug(args.project) : registry.activeProjectId;
  let project = registry.projects.find((entry) => entry.id === requestedId);
  if (!project && (args.project || projectRoot)) {
    registry = projectStore.addProject({
      id: args.project ? requestedId : path.basename(projectRoot),
      label: args.project || path.basename(projectRoot),
      projectRoot,
    });
    project = registry.projects.find((entry) => entry.id === registry.activeProjectId);
  }
  if (!project) throw new Error(`Project not found: ${requestedId}`);

  if (projectRoot && project.projectRoot && !samePath(project.projectRoot, projectRoot)) {
    throw new Error(`Project id "${project.id}" is already bound to ${project.projectRoot}. Use a different --project id for ${projectRoot}.`);
  }

  if (projectRoot && !project.projectRoot) {
    project.projectRoot = projectRoot;
    registry.activeProjectId = project.id;
    registry = projectStore.writeRegistry(registry);
    project = registry.projects.find((entry) => entry.id === registry.activeProjectId);
  }
  return project;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.profile || !args.animation || !args.source) {
    usage();
    process.exit(1);
  }

  const sourceDir = path.resolve(args.source);
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`Source folder not found: ${sourceDir}`);
  }

  const pngs = fs.readdirSync(sourceDir)
    .filter((name) => path.extname(name).toLowerCase() === ".png")
    .sort(naturalSort);
  if (!pngs.length) throw new Error(`No PNG files found in ${sourceDir}`);

  const project = projectForImport(args);
  const paths = projectStore.projectPaths(project);
  const workspaceAssets = path.join(paths.workspaceDir, "assets");
  const profileId = slug(args.profile);
  const animationId = slug(args.animation);
  const targetDir = path.join(workspaceAssets, profileId, animationId);
  if (args.replace && fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  const frameFiles = [];
  const frames = pngs.map((name, index) => {
    const frameName = `frame_${String(index + 1).padStart(4, "0")}.png`;
    const source = path.join(sourceDir, name);
    const target = path.join(targetDir, frameName);
    fs.copyFileSync(source, target);
    frameFiles.push(target);
    const size = getPngSize(target);
    return {
      id: `frame_${String(index + 1).padStart(4, "0")}`,
      name: frameName,
      path: path.relative(ROOT, target).replaceAll("\\", "/"),
      duration: 1,
      ...size,
    };
  });

  const manifest = projectStore.readJson(paths.manifest, EMPTY_MANIFEST);
  const profile = ensureProfile(manifest, profileId, args.label || args.profile);
  const existingIndex = profile.animations.findIndex((entry) => entry.id === animationId);
  const animation = {
    id: animationId,
    name: args.animation,
    type: args.type || "actor",
    anchorMode: args.anchor || "canvas_bottom_center",
    fps: Number(args.fps || 12),
    source: path.relative(ROOT, targetDir).replaceAll("\\", "/"),
    frames,
  };
  if (existingIndex >= 0) profile.animations[existingIndex] = animation;
  else profile.animations.push(animation);

  const tuning = projectStore.readJson(paths.tuning, EMPTY_TUNING);
  const scaleResult = ensureInitialCharacterScale(
    tuning,
    profileId,
    project.projectRoot,
    frameFiles.map((filePath) => ({ filePath, animationId, animationName: args.animation }))
  );
  upsertEstimatedFrameBoxes(tuning, profileId, animation, frameFiles, {
    replace: args.replace || existingIndex < 0,
  });
  projectStore.writeJson(paths.manifest, manifest);
  projectStore.writeJson(paths.tuning, tuning);
  const godotSync = syncGodotProject(ROOT, projectStore, project, { manifest, tuning });
  console.log(`Imported ${frames.length} frames`);
  console.log(`Project: ${project.id}`);
  console.log(`Profile: ${profileId}`);
  console.log(`Animation: ${animationId}`);
  console.log(`Target: ${path.relative(ROOT, targetDir)}`);
  if (scaleResult.changed) {
    console.log(`Initial scale: ${scaleResult.scale}`);
  }
  if (godotSync.ok) {
    console.log(`Godot assets: ${godotSync.copiedFrames}/${godotSync.frameCount} frames synced to ${godotSync.assetRoot}`);
  }
}

main();
