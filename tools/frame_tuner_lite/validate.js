const fs = require("node:fs");
const path = require("node:path");
const { ROOT, parseArgs, store } = require("./import_common");
const { validateLiteProject } = require("./server");

function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const registry = store.readRegistry();
  const projects = args.project
    ? registry.projects.filter((project) => project.id === store.slug(args.project, ""))
    : registry.projects;
  if (!projects.length) throw new Error(args.project ? `Lite project not found: ${args.project}` : "No Lite projects found.");
  const reports = [];
  for (const project of projects) {
    const target = store.paths(project);
    const manifest = store.readJson(target.manifest, { profiles: [] });
    let animations = 0;
    let frames = 0;
    const warnings = validateLiteProject(project);
    for (const profile of manifest.profiles || []) {
      for (const animation of profile.animations || []) {
        animations += 1;
        frames += (animation.frames || []).length;
        for (const frame of animation.frames || []) {
          const full = path.resolve(ROOT, String(frame.path || ""));
          if (!full.startsWith(`${target.workspaceDir}${path.sep}`) && full !== target.workspaceDir) warnings.push(`${profile.id}/${animation.id}: frame is outside the isolated Lite workspace: ${frame.path}`);
          if (full && !fs.existsSync(full)) warnings.push(`${profile.id}/${animation.id}: missing stable frame: ${frame.path}`);
        }
      }
    }
    reports.push({ project: project.id, profiles: (manifest.profiles || []).length, animations, frames, warnings });
  }
  const warningCount = reports.reduce((sum, report) => sum + report.warnings.length, 0);
  if (warningCount) throw new Error(reports.map((report) => `${report.project}:\n${report.warnings.map((warning) => `- ${warning}`).join("\n")}`).join("\n"));
  return reports;
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
