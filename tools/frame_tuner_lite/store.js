const fs = require("node:fs");
const path = require("node:path");

const EMPTY_MANIFEST = Object.freeze({ schemaVersion: 1, profiles: [] });
const EMPTY_TUNING = Object.freeze({
  schemaVersion: 1,
  values: {},
  scene_settings: {},
  frame_visual_overrides: {},
  frame_playback_overrides: {},
  frame_box_overrides: {},
});
const EMPTY_SETTINGS = Object.freeze({
  schemaVersion: 1,
  canvas: { padding: 24, autoMeasured: false },
  export: { fps: 12, sheetColumns: 8 },
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const reslash = (value) => String(value || "").replaceAll("\\", "/");
const slug = (value, fallback = "project") => {
  const text = String(value || "").trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/\.\./g, "_")
    .replace(/^_+|_+$/g, "");
  return text && !/^\.+$/.test(text) ? text : fallback;
};

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return clone(fallback);
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return clone(fallback);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, filePath);
}

function createLiteStore(root) {
  const registryPath = path.join(root, "data", "lite", "projects.json");

  const normalizeProject = (value = {}) => {
    const id = slug(value.id || value.label, "lite_project");
    return {
      id,
      label: String(value.label || id),
      kind: "frame_lite",
      dataDir: reslash(`data/lite/projects/${id}`),
      workspaceDir: reslash(`workspace/lite/projects/${id}`),
    };
  };

  function readRegistry() {
    const raw = readJson(registryPath, { schemaVersion: 1, activeProjectId: "", projects: [] });
    const used = new Set();
    const projects = (Array.isArray(raw.projects) ? raw.projects : []).map(normalizeProject).filter((project) => {
      if (used.has(project.id)) return false;
      used.add(project.id);
      return true;
    });
    const activeProjectId = projects.some((project) => project.id === raw.activeProjectId)
      ? raw.activeProjectId
      : projects[0]?.id || "";
    const registry = { schemaVersion: 1, activeProjectId, projects };
    if (JSON.stringify(raw) !== JSON.stringify(registry)) writeJson(registryPath, registry);
    projects.forEach(ensureProjectFiles);
    return registry;
  }

  function writeRegistry(value) {
    const registry = {
      schemaVersion: 1,
      activeProjectId: String(value.activeProjectId || ""),
      projects: (Array.isArray(value.projects) ? value.projects : []).map(normalizeProject),
    };
    if (!registry.projects.some((project) => project.id === registry.activeProjectId)) registry.activeProjectId = registry.projects[0]?.id || "";
    writeJson(registryPath, registry);
    registry.projects.forEach(ensureProjectFiles);
    return registry;
  }

  function paths(project) {
    const dataDir = path.join(root, ...String(project.dataDir).split("/"));
    const workspaceDir = path.join(root, ...String(project.workspaceDir).split("/"));
    return {
      dataDir,
      workspaceDir,
      manifest: path.join(dataDir, "animation_manifest.json"),
      tuning: path.join(dataDir, "animation_tuning.json"),
      frameImageAttachments: path.join(dataDir, "frame_image_attachments.json"),
      attackTrails: path.join(dataDir, "attack_trails.json"),
      settings: path.join(dataDir, "lite_settings.json"),
    };
  }

  function ensureProjectFiles(project) {
    const target = paths(project);
    fs.mkdirSync(path.join(target.workspaceDir, "assets"), { recursive: true });
    if (!fs.existsSync(target.manifest)) writeJson(target.manifest, EMPTY_MANIFEST);
    if (!fs.existsSync(target.tuning)) writeJson(target.tuning, EMPTY_TUNING);
    if (!fs.existsSync(target.frameImageAttachments)) writeJson(target.frameImageAttachments, []);
    if (!fs.existsSync(target.attackTrails)) writeJson(target.attackTrails, { schemaVersion: 8, bindings: {} });
    if (!fs.existsSync(target.settings)) writeJson(target.settings, EMPTY_SETTINGS);
  }

  function ensureProject(id, label = id) {
    const registry = readRegistry();
    const projectId = slug(id || label, "lite_project");
    let project = registry.projects.find((entry) => entry.id === projectId);
    if (!project) {
      project = normalizeProject({ id: projectId, label });
      registry.projects.push(project);
    }
    registry.activeProjectId = project.id;
    writeRegistry(registry);
    return project;
  }

  function resolveProject(projectId) {
    const registry = readRegistry();
    return registry.projects.find((project) => project.id === slug(projectId, ""))
      || registry.projects.find((project) => project.id === registry.activeProjectId)
      || registry.projects[0]
      || null;
  }

  function setActiveProject(projectId) {
    const registry = readRegistry();
    const project = registry.projects.find((entry) => entry.id === slug(projectId, ""));
    if (!project) throw new Error(`Lite project not found: ${projectId}`);
    registry.activeProjectId = project.id;
    return writeRegistry(registry);
  }

  function projectForClient(project) {
    const target = paths(project);
    return {
      id: project.id,
      label: project.label,
      kind: "frame_lite",
      projectRoot: "",
      dataDir: project.dataDir,
      workspaceDir: project.workspaceDir,
      dataPath: target.dataDir,
      workspacePath: target.workspaceDir,
    };
  }

  return {
    ensureProject,
    ensureProjectFiles,
    path: registryPath,
    paths,
    projectForClient,
    projectWorkspaceDir: (project) => paths(project).workspaceDir,
    readJson,
    readRegistry,
    resolveProject,
    setActiveProject,
    slug,
    writeJson,
    writeRegistry,
  };
}

module.exports = { EMPTY_MANIFEST, EMPTY_SETTINGS, EMPTY_TUNING, clone, createLiteStore, reslash, slug };
