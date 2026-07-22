const fs = require("node:fs");
const path = require("node:path");
const {
  ROOT,
  animationDestination,
  assetVersion,
  copyStable,
  naturalCompare,
  parseArgs,
  pngSize,
  required,
  reslash,
  saveAnimation,
  slug,
  store,
} = require("./import_common");

function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const projectId = slug(required(args, "project"), "lite_project");
  const profileId = slug(required(args, "profile"), "sequence");
  const animationId = slug(required(args, "animation"), "animation");
  const source = path.resolve(required(args, "source"));
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) throw new Error(`PNG folder not found: ${source}`);
  const files = fs.readdirSync(source)
    .filter((name) => path.extname(name).toLowerCase() === ".png")
    .sort(naturalCompare);
  if (!files.length) throw new Error(`No PNG files found: ${source}`);

  const project = store.ensureProject(projectId, String(args.label || projectId));
  const destination = animationDestination(project, profileId, animationId);
  const frames = files.map((name, index) => {
    const input = path.join(source, name);
    const outputName = `frame_${String(index + 1).padStart(4, "0")}.png`;
    const output = copyStable(input, path.join(destination, outputName));
    const size = pngSize(output);
    return {
      id: `frame_${String(index + 1).padStart(4, "0")}`,
      name,
      path: reslash(path.relative(ROOT, output)),
      duration: 1,
      width: size.width,
      height: size.height,
      assetVersion: assetVersion(output),
    };
  });
  const fps = Math.min(240, Math.max(0.1, Number(args.fps || 12)));
  const previewOwner = String(args["attach-to"] || "").trim();
  const previewLayer = String(args.layer || "front").toLowerCase() === "behind" ? "behind" : "front";
  const animation = {
    id: animationId,
    name: animationId,
    type: previewOwner ? "vfx" : "actor",
    anchorMode: "canvas_bottom_center",
    fps,
    source: reslash(path.relative(ROOT, destination)),
    previewOwner: previewOwner || undefined,
    attachTo: previewOwner || undefined,
    previewLayer: previewOwner ? previewLayer : undefined,
    independentPlayback: args.independent === true,
    frames,
  };
  saveAnimation({
    project,
    profileId,
    profileLabel: String(args["profile-label"] || profileId),
    animation,
  });
  return { project: project.id, profile: profileId, animation: animationId, frames: frames.length, fps, destination };
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(run(), null, 2));
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = { run };
