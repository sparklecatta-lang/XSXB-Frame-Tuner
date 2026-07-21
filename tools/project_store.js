const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PROJECT_ID = "default";
const DEFAULT_PROJECT_LABEL = "Default Empty Project";

const EMPTY_MANIFEST = { schemaVersion: 1, profiles: [] };
const EMPTY_TUNING = {
  schemaVersion: 1,
  values: {},
  scene_settings: {},
  frame_visual_overrides: {},
  frame_playback_overrides: {},
  frame_box_overrides: {},
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function reslash(value) {
  return String(value || "").replaceAll("\\", "/");
}

function slug(value, fallback = "project") {
  const text = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/\.\./g, "_")
    .replace(/^_+|_+$/g, "");
  return text && !/^\.+$/.test(text) ? text : fallback;
}

function safeResolve(base, requested) {
  const full = path.resolve(base, String(requested || ""));
  return full === base || full.startsWith(`${base}${path.sep}`) ? full : null;
}

function samePath(left, right) {
  if (!left || !right) return false;
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return clone(fallback);
    const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(text);
  } catch {
    return clone(fallback);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

function godotProjectName(projectRoot) {
  if (!projectRoot) return "";
  const projectFile = path.join(projectRoot, "project.godot");
  if (!fs.existsSync(projectFile)) return "";
  try {
    const text = fs.readFileSync(projectFile, "utf8");
    const match = text.match(/^\s*config\/name\s*=\s*"([^"]+)"/m);
    return String(match?.[1] || "").trim();
  } catch {
    return "";
  }
}

function uniqueId(baseId, usedIds) {
  const base = slug(baseId, "project");
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function defaultProject() {
  return {
    id: DEFAULT_PROJECT_ID,
    label: DEFAULT_PROJECT_LABEL,
    projectRoot: "",
    dataDir: "data/projects/default",
    workspaceDir: "workspace/projects/default",
  };
}

function projectDataDir(root, project) {
  return safeResolve(root, project?.dataDir) || path.join(root, "data", "projects", project.id);
}

function projectWorkspaceDir(root, project) {
  return safeResolve(root, project?.workspaceDir) || path.join(root, "workspace", "projects", project.id);
}

function projectPaths(root, project) {
  const dataDir = projectDataDir(root, project);
  return {
    dataDir,
    workspaceDir: projectWorkspaceDir(root, project),
    manifest: path.join(dataDir, "animation_manifest.json"),
    tuning: path.join(dataDir, "animation_tuning.json"),
    frameAudio: path.join(dataDir, "frame_audio_bindings.json"),
    frameImageAttachments: path.join(dataDir, "frame_image_attachments.json"),
    attackTrails: path.join(dataDir, "attack_trails.json"),
  };
}

function ensureProjectFiles(root, project) {
  const paths = projectPaths(root, project);
  fs.mkdirSync(paths.dataDir, { recursive: true });
  fs.mkdirSync(path.join(paths.workspaceDir, "assets"), { recursive: true });

  const legacyManifest = path.join(root, "data", "animation_manifest.json");
  const legacyTuning = path.join(root, "data", "animation_tuning.json");
  const legacyFrameAudio = path.join(root, "data", "frame_audio_bindings.json");
  const canMigrateLegacy = project.id === DEFAULT_PROJECT_ID;

  if (!fs.existsSync(paths.manifest)) {
    if (canMigrateLegacy && fs.existsSync(legacyManifest)) fs.copyFileSync(legacyManifest, paths.manifest);
    else writeJson(paths.manifest, EMPTY_MANIFEST);
  }
  if (!fs.existsSync(paths.tuning)) {
    if (canMigrateLegacy && fs.existsSync(legacyTuning)) fs.copyFileSync(legacyTuning, paths.tuning);
    else writeJson(paths.tuning, EMPTY_TUNING);
  }
  if (!fs.existsSync(paths.frameAudio)) {
    if (canMigrateLegacy && fs.existsSync(legacyFrameAudio)) fs.copyFileSync(legacyFrameAudio, paths.frameAudio);
    else writeJson(paths.frameAudio, {});
  }
  if (!fs.existsSync(paths.frameImageAttachments)) {
    writeJson(paths.frameImageAttachments, []);
  }
  if (!fs.existsSync(paths.attackTrails)) {
    writeJson(paths.attackTrails, { schemaVersion: 2, bindings: {} });
  }
}

function normalizeProject(raw, usedIds, fallback) {
  const source = raw && typeof raw === "object" ? raw : {};
  const id = uniqueId(source.id || source.label || fallback, usedIds);
  return {
    id,
    label: String(source.label || source.name || id),
    kind: String(source.kind || "godot"),
    projectRoot: String(source.projectRoot || source.root || ""),
    petRoot: String(source.petRoot || ""),
    dataDir: reslash(source.dataDir || `data/projects/${id}`),
    workspaceDir: reslash(source.workspaceDir || `workspace/projects/${id}`),
  };
}

function normalizeRegistry(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const usedIds = new Set();
  let projects = Array.isArray(source.projects) ? source.projects : [];
  if (projects.some((project) => slug(project?.id || project?.label || "") !== DEFAULT_PROJECT_ID)) {
    projects = projects.filter((project) => slug(project?.id || project?.label || "") !== DEFAULT_PROJECT_ID);
  }
  if (!projects.length) projects = [];
  const normalizedProjects = projects.map((project, index) => normalizeProject(project, usedIds, index === 0 ? DEFAULT_PROJECT_ID : `project_${index + 1}`));
  const requestedActiveId = source.activeProjectId || normalizedProjects[0]?.id
    ? slug(source.activeProjectId || normalizedProjects[0]?.id, DEFAULT_PROJECT_ID)
    : "";
  const activeProjectId = normalizedProjects.some((project) => project.id === requestedActiveId)
    ? requestedActiveId
    : normalizedProjects[0]?.id || "";
  return {
    schemaVersion: 1,
    activeProjectId,
    projects: normalizedProjects,
  };
}

function createProjectStore(root) {
  const dataDir = path.join(root, "data");
  const projectsPath = path.join(dataDir, "projects.json");

  function readRegistry() {
    fs.mkdirSync(dataDir, { recursive: true });
    const registryExists = fs.existsSync(projectsPath);
    const raw = readJson(projectsPath, {
      schemaVersion: 1,
      activeProjectId: "",
      projects: [],
    });
    const registry = normalizeRegistry(raw);
    for (const project of registry.projects) ensureProjectFiles(root, project);
    if (!registryExists || JSON.stringify(raw) !== JSON.stringify(registry)) writeJson(projectsPath, registry);
    return registry;
  }

  function writeRegistry(registry) {
    const normalized = normalizeRegistry(registry);
    for (const project of normalized.projects) ensureProjectFiles(root, project);
    writeJson(projectsPath, normalized);
    return normalized;
  }

  function resolveProject(registry, projectId) {
    const requested = projectId ? slug(projectId, DEFAULT_PROJECT_ID) : registry.activeProjectId;
    return registry.projects.find((project) => project.id === requested)
      || registry.projects.find((project) => project.id === registry.activeProjectId)
      || registry.projects[0];
  }

  function setActiveProject(projectId) {
    const registry = readRegistry();
    const project = registry.projects.find((entry) => entry.id === slug(projectId, DEFAULT_PROJECT_ID));
    if (!project) throw new Error(`Project not found: ${projectId}`);
    registry.activeProjectId = project.id;
    return writeRegistry(registry);
  }

  function addProject(payload = {}) {
    const registry = readRegistry();
    let projectRoot = String(payload.projectRoot || payload.root || "").trim().replace(/^["']|["']$/g, "");
    if (projectRoot) {
      projectRoot = path.resolve(projectRoot);
      if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
        throw new Error(`Project folder not found: ${projectRoot}`);
      }
    }

    if (projectRoot) {
      const existingByRoot = registry.projects.find((project) => samePath(project.projectRoot, projectRoot));
      if (existingByRoot) {
        registry.activeProjectId = existingByRoot.id;
        return writeRegistry(registry);
      }
    }

    const label = String(payload.label || payload.name || payload.id || godotProjectName(projectRoot) || (projectRoot ? path.basename(projectRoot) : "") || "New Project").trim() || "New Project";
    const usedIds = new Set(registry.projects.map((project) => project.id));
    const id = uniqueId(payload.id || label, usedIds);
    const project = {
      id,
      label,
      kind: String(payload.kind || "godot"),
      projectRoot,
      petRoot: String(payload.petRoot || ""),
      dataDir: `data/projects/${id}`,
      workspaceDir: `workspace/projects/${id}`,
    };
    registry.projects.push(project);
    registry.activeProjectId = id;
    return writeRegistry(registry);
  }

  function projectForClient(project) {
    const paths = projectPaths(root, project);
    return {
      id: project.id,
      label: project.label,
      kind: project.kind || "godot",
      projectRoot: project.projectRoot,
      petRoot: project.petRoot || "",
      dataDir: reslash(project.dataDir),
      workspaceDir: reslash(project.workspaceDir),
      dataPath: paths.dataDir,
      workspacePath: paths.workspaceDir,
    };
  }

  function activeProject(projectId) {
    const registry = readRegistry();
    return resolveProject(registry, projectId);
  }

  return {
    addProject,
    activeProject,
    ensureProjectFiles: (project) => ensureProjectFiles(root, project),
    path: projectsPath,
    projectDataDir: (project) => projectDataDir(root, project),
    projectForClient,
    projectPaths: (project) => projectPaths(root, project),
    projectWorkspaceDir: (project) => projectWorkspaceDir(root, project),
    readJson,
    readRegistry,
    resolveProject,
    setActiveProject,
    slug,
    writeJson,
    writeRegistry,
  };
}

module.exports = {
  DEFAULT_PROJECT_ID,
  EMPTY_MANIFEST,
  EMPTY_TUNING,
  createProjectStore,
  godotProjectName,
  reslash,
  slug,
};
