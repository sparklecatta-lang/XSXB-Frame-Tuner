const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { EMPTY_MANIFEST, EMPTY_TUNING, createProjectStore, reslash } = require("../project_store");
const { syncFrameAudio, syncGodotProject } = require("../godot_sync");
const {
  EMPTY_ATTACK_TRAILS,
  normalizeAttackTrails,
  pngInfo,
  saveAttackTrailTexture,
  validateAttackTrails,
} = require("../attack_trails");
const { profileIdsForSceneText } = require("../scene_profiles");
const {
  ATLAS_HEIGHT_V2,
  clearExportedPetTuning,
  ensureCodexPetsProject,
  exportCodexPet,
  importCodexPet,
  parseWebpSize,
  syncCodexPetProject,
} = require("../codex_pets");
const { checkForUpdates, performUpdate } = require("../updater");
const { withUtf8Charset } = require("../http_content_type");

const ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 5179);
const projectStore = createProjectStore(ROOT);
const UPDATE_TOKEN = crypto.randomBytes(24).toString("hex");
let restartScheduled = false;

const DEFAULT_SUPPORTS = [
  "character_transform",
  "group_transform",
  "frame_transform",
  "frame_playback",
  "frame_boxes",
  "reference_frame",
];
const GDSCRIPT_SCAN_LIMIT = 250;
const GDSCRIPT_SKIP_DIRS = new Set([
  ".git",
  ".godot",
  "addons",
  "node_modules",
  "_external_vfx",
]);
const SCENE_SKIP_DIRS = new Set([
  ...GDSCRIPT_SKIP_DIRS,
  ".import",
]);

function ensureDataFiles() {
  ensureCodexPetsProject(projectStore);
}

function send(res, status, body, contentType = "application/json") {
  const data = Buffer.isBuffer(body)
    ? body
    : /^application\/json(?:\s*;|$)/i.test(contentType)
      ? Buffer.from(JSON.stringify(body, null, 2))
      : Buffer.from(String(body));
  res.writeHead(status, {
    "content-type": withUtf8Charset(contentType),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeResolve(base, requested) {
  const full = path.resolve(base, String(requested || ""));
  return full === base || full.startsWith(`${base}${path.sep}`) ? full : null;
}

function isInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function round(value) {
  return Number(value || 0).toFixed(4).replace(/\.?0+$/, "");
}

function vector(value, fallback = { x: 0, y: 0 }) {
  if (!value || typeof value !== "object") return { ...fallback };
  return {
    x: Number(value.x ?? fallback.x ?? 0),
    y: Number(value.y ?? fallback.y ?? 0),
  };
}

function scaleVector(value, fallbackScale = 1) {
  if (!value || typeof value !== "object") {
    return { x: Number(fallbackScale || 1), y: Number(fallbackScale || 1) };
  }
  return {
    x: Number(value.x ?? fallbackScale ?? 1),
    y: Number(value.y ?? fallbackScale ?? 1),
  };
}

function getPngSize(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") {
      return { width: 0, height: 0 };
    }
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  } catch {
    return { width: 0, height: 0 };
  }
}

function sanitizeSegment(value, fallback = "asset") {
  const text = String(value || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/\.\./g, "_")
    .replace(/^_+|_+$/g, "");
  return text && !/^\.+$/.test(text) ? text : fallback;
}

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(String(dataUrl || ""));
  if (!match) return null;
  return {
    mime: String(match[1] || "").toLowerCase(),
    buffer: match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3] || ""), "utf8"),
  };
}

function contentHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function attachmentImageSourcePath(project, attachment) {
  const raw = String(attachment?.path || "");
  if (!raw) return "";
  if (path.isAbsolute(raw)) return fs.existsSync(raw) ? raw : "";
  if (raw.startsWith("res://")) {
    const projectRoot = project?.projectRoot ? path.resolve(String(project.projectRoot)) : "";
    const fullPath = projectRoot ? path.join(projectRoot, raw.slice("res://".length)) : "";
    return fullPath && fs.existsSync(fullPath) ? fullPath : "";
  }
  const fullPath = safeResolve(ROOT, raw);
  return fullPath && fs.existsSync(fullPath) ? fullPath : "";
}

function withFrameAttachmentHash(project, attachment) {
  const next = { ...attachment };
  if (!next.assetHash) {
    const source = attachmentImageSourcePath(project, next);
    if (source) next.assetHash = contentHash(fs.readFileSync(source));
  }
  return next;
}

function imageExtensionFromMime(mime, name) {
  const ext = path.extname(String(name || "")).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return ext;
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  return "";
}

function normalizeManifest(raw) {
  const profiles = Array.isArray(raw?.profiles) ? raw.profiles : [];
  return {
    schemaVersion: Number(raw?.schemaVersion || 1),
    profiles: profiles.map((profile) => ({
      id: String(profile.id || profile.name || "profile"),
      label: String(profile.label || profile.id || profile.name || "Profile"),
      kind: String(profile.kind || "actor"),
      bodyScale: Math.max(0.001, Number(profile.bodyScale ?? 1)),
      runtimeScale: Math.max(0.001, Number(profile.runtimeScale ?? 1)),
      supports: Array.isArray(profile.supports) ? profile.supports : DEFAULT_SUPPORTS,
      pet: profile.pet && typeof profile.pet === "object" ? profile.pet : null,
      animations: Array.isArray(profile.animations) ? profile.animations : [],
    })),
  };
}

function projectFromRequest(projectId, options = {}) {
  let registry = projectStore.readRegistry();
  const requestedId = projectId ? projectStore.slug(projectId) : "";
  if (options.activate && requestedId && registry.projects.some((entry) => entry.id === requestedId) && registry.activeProjectId !== requestedId) {
    registry.activeProjectId = requestedId;
    registry = projectStore.writeRegistry(registry);
  }
  return {
    registry,
    project: projectStore.resolveProject(registry, projectId),
  };
}

function readManifest(project) {
  projectStore.ensureProjectFiles(project);
  const paths = projectStore.projectPaths(project);
  return normalizeManifest(projectStore.readJson(paths.manifest, EMPTY_MANIFEST));
}

function readTuningFile(project) {
  projectStore.ensureProjectFiles(project);
  const paths = projectStore.projectPaths(project);
  const raw = projectStore.readJson(paths.tuning, EMPTY_TUNING);
  return {
    schemaVersion: Number(raw.schemaVersion || 1),
    values: raw.values && typeof raw.values === "object" ? raw.values : {},
    scene_settings: raw.scene_settings && typeof raw.scene_settings === "object" ? raw.scene_settings : {},
    frame_visual_overrides: raw.frame_visual_overrides && typeof raw.frame_visual_overrides === "object" ? raw.frame_visual_overrides : {},
    frame_playback_overrides: raw.frame_playback_overrides && typeof raw.frame_playback_overrides === "object" ? raw.frame_playback_overrides : {},
    frame_box_overrides: raw.frame_box_overrides && typeof raw.frame_box_overrides === "object" ? raw.frame_box_overrides : {},
  };
}

function readFrameAudioBindings(project) {
  projectStore.ensureProjectFiles(project);
  const raw = projectStore.readJson(projectStore.projectPaths(project).frameAudio, []);
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([key, value]) => ({
      key,
      ...(value && typeof value === "object" ? value : {}),
    }));
  }
  return [];
}

function readAttackTrails(project) {
  if (project?.kind === "codex_pets") return EMPTY_ATTACK_TRAILS;
  projectStore.ensureProjectFiles(project);
  return normalizeAttackTrails(projectStore.readJson(projectStore.projectPaths(project).attackTrails, EMPTY_ATTACK_TRAILS));
}

function readFrameImageAttachments(project) {
  projectStore.ensureProjectFiles(project);
  const raw = projectStore.readJson(projectStore.projectPaths(project).frameImageAttachments, []);
  return Array.isArray(raw)
    ? raw.filter((entry) => entry && typeof entry === "object").map((entry) => withFrameAttachmentHash(project, entry))
    : [];
}

function tuningForClient(tuningFile) {
  return {
    ...tuningFile.values,
    scene_settings: tuningFile.scene_settings,
    frame_visual_overrides: tuningFile.frame_visual_overrides,
    frame_playback_overrides: tuningFile.frame_playback_overrides,
    frame_box_overrides: tuningFile.frame_box_overrides,
  };
}

function profileForClient(profile) {
  return {
    id: profile.id,
    label: profile.label,
    kind: profile.kind,
    scale_semantic: "character_group_frame",
    anchor_mode: "manifest_anchor_mode",
    supports: profile.supports,
    pet: profile.pet,
  };
}

function frameForClient(frame, index) {
  const relPath = reslash(frame.path || "");
  const fullPath = safeResolve(ROOT, relPath);
  const size = fullPath && fs.existsSync(fullPath) ? getPngSize(fullPath) : {};
  return {
    id: String(frame.id || `frame_${String(index + 1).padStart(4, "0")}`),
    name: String(frame.name || path.basename(relPath) || `frame_${index + 1}.png`),
    path: relPath,
    duration: Number(frame.duration || 1),
    width: Number(frame.width || size.width || 0),
    height: Number(frame.height || size.height || 0),
    crop: frame.crop && typeof frame.crop === "object" ? {
      x: Number(frame.crop.x || 0),
      y: Number(frame.crop.y || 0),
      width: Number(frame.crop.width || frame.width || 0),
      height: Number(frame.crop.height || frame.height || 0),
      sheetWidth: Number(frame.crop.sheetWidth || 0),
      sheetHeight: Number(frame.crop.sheetHeight || 0),
    } : null,
    assetVersion: String(frame.assetVersion || ""),
  };
}

function buildGroups(manifest, tuningFile) {
  const groups = [];
  for (const profile of manifest.profiles) {
    for (const animation of profile.animations) {
      const animationId = String(animation.id || animation.name || "animation");
      const groupName = String(animation.name || animationId);
      const characterKeyBase = `profiles.${profile.id}.character`;
      const keyBase = `profiles.${profile.id}.groups.${animationId}`;
      const defaultScale = Number(animation.defaultScale ?? 1);
      const frames = (Array.isArray(animation.frames) ? animation.frames : [])
        .map(frameForClient)
        .filter((frame) => frame.path);
      if (!frames.length) continue;
      const characterBaseScale = profile.bodyScale * profile.runtimeScale;
      const characterBaseScaleVector = tuningFile.values[`${characterKeyBase}.visual_scale`]
        ?? profile.defaultScaleVector
        ?? null;
      groups.push({
        name: groupName,
        runtimeAnimation: `${profile.id}/${animationId}`,
        profileId: profile.id,
        profileLabel: profile.label,
        profileKind: profile.kind,
        profilePet: profile.pet,
        profileScaleSemantic: "character_group_frame",
        profileAnchorMode: String(animation.anchorMode || "canvas_bottom_center"),
        profileSupports: Array.isArray(animation.supports) ? animation.supports : profile.supports,
        type: String(animation.type || "actor"),
        tuningTarget: "",
        anchorMode: String(animation.anchorMode || "canvas_bottom_center"),
        sourceAnchor: animation.sourceAnchor ? vector(animation.sourceAnchor) : null,
        scaleSemantic: String(animation.scaleSemantic || ""),
        source: reslash(animation.source || path.dirname(frames[0]?.path || "")),
        speed: Number(animation.fps || animation.defaultFps || 12),
        frames,
        characterScale: `${characterKeyBase}.visual_size`,
        characterScaleVector: `${characterKeyBase}.visual_scale`,
        characterOffset: `${characterKeyBase}.offset`,
        characterRotation: `${characterKeyBase}.rotation`,
        characterBaseScale,
        characterBaseScaleVector,
        characterBaseOffset: tuningFile.values[`${characterKeyBase}.offset`] ?? profile.defaultOffset ?? { x: 0, y: 0 },
        characterBaseRotation: Number(tuningFile.values[`${characterKeyBase}.rotation`] ?? profile.defaultRotation ?? 0),
        characterBaseSource: profile.runtimeScale !== 1 ? "bodyScale * runtimeScale" : "bodyScale",
        runtimeScale: profile.runtimeScale,
        bodyScale: profile.bodyScale,
        scale: `${keyBase}.visual_size`,
        scaleVector: `${keyBase}.visual_scale`,
        offset: `${keyBase}.offset`,
        rotation: `${keyBase}.rotation`,
        defaultScale,
        defaultScaleVector: animation.defaultScaleVector ? scaleVector(animation.defaultScaleVector, defaultScale) : null,
        defaultOffset: vector(animation.defaultOffset),
        defaultRotation: Number(animation.defaultRotation || 0),
        baseScale: tuningFile.values[`${keyBase}.visual_size`] ?? defaultScale,
        baseScaleVector: tuningFile.values[`${keyBase}.visual_scale`] ?? animation.defaultScaleVector ?? null,
        baseOffset: tuningFile.values[`${keyBase}.offset`] ?? animation.defaultOffset ?? { x: 0, y: 0 },
        baseRotation: Number(tuningFile.values[`${keyBase}.rotation`] ?? animation.defaultRotation ?? 0),
      });
    }
  }
  return groups;
}

function validateManifest(manifest) {
  const warnings = [];
  for (const profile of Array.isArray(manifest?.profiles) ? manifest.profiles : []) {
    for (const animation of Array.isArray(profile?.animations) ? profile.animations : []) {
      const anchorMode = String(animation.anchorMode || "canvas_bottom_center");
      if (String(profile.kind || "actor").toLowerCase() === "actor" && anchorMode === "canvas_left_bottom") {
        warnings.push(`${profile.id}/${animation.id || animation.name}: actor animation uses canvas_left_bottom; use canvas_bottom_center so the character enters tuner/game at the foot-center origin.`);
      }
      for (const [index, frame] of (animation.frames || []).entries()) {
        const relPath = reslash(frame.path || "");
        const fullPath = safeResolve(ROOT, relPath);
        if (!relPath || !fullPath || !fs.existsSync(fullPath)) {
          warnings.push(`${profile.id}/${animation.id || animation.name}: missing frame ${index + 1}: ${relPath || "(empty)"}`);
        }
      }
    }
  }
  return warnings;
}

function validateCharacterScaleValues(project, manifest) {
  const warnings = [];
  if (!manifestHasRuntimeAnimations(manifest)) return warnings;
  const paths = projectStore.projectPaths(project);
  const tuning = projectStore.readJson(paths.tuning, EMPTY_TUNING);
  const values = tuning?.values && typeof tuning.values === "object" ? tuning.values : {};
  for (const profile of Array.isArray(manifest?.profiles) ? manifest.profiles : []) {
    const scaleKey = `profiles.${profile.id}.character.visual_size`;
    const vectorKey = `profiles.${profile.id}.character.visual_scale`;
    const scale = Number(values[scaleKey] ?? profile.bodyScale ?? 1);
    const vector = values[vectorKey];
    if (vector && typeof vector === "object") {
      const x = Number(vector.x);
      const y = Number(vector.y);
      if (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 0.0001 && Number.isFinite(scale) && Math.abs(x - scale) > 0.0001) {
        warnings.push(`${profile.id}: uniform character visual_scale (${x}) overrides visual_size (${scale}); remove visual_scale or make it match visual_size.`);
      }
    }
    const firstFrame = (profile.animations || []).flatMap((animation) => animation.frames || [])[0];
    const frameHeight = Number(firstFrame?.height || 0);
    if (frameHeight >= 512 && Number.isFinite(scale) && scale >= 0.75) {
      warnings.push(`${profile.id}: imported actor uses a large source canvas (${frameHeight}px high) with character visual_size ${scale}; initialize it from the scene actor/viewport height instead of 1:1 pixels.`);
    }
  }
  return warnings;
}

function relativeProjectPath(filePath, projectRoot) {
  return reslash(path.relative(projectRoot, filePath));
}

function isGeneratedTunerScene(scenePath) {
  const normalized = reslash(String(scenePath || ""));
  return normalized.startsWith("xsxb_frame_tuner/runtime/");
}

function listSceneFiles(projectRoot, profiles = []) {
  const root = projectRoot ? path.resolve(String(projectRoot)) : "";
  const scenes = [];
  if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) return scenes;

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
        if (!SCENE_SKIP_DIRS.has(entry.name)) walk(fullPath);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".tscn") continue;
      const scenePath = relativeProjectPath(fullPath, root);
      if (isGeneratedTunerScene(scenePath)) continue;
      let sceneText = "";
      try {
        sceneText = fs.readFileSync(fullPath, "utf8");
      } catch {
        sceneText = "";
      }
      scenes.push({
        id: `res://${scenePath}`,
        label: path.basename(entry.name, ".tscn"),
        path: scenePath,
        profileIds: profileIdsForSceneText(sceneText, profiles),
      });
    }
  };

  walk(root);
  return scenes.sort((left, right) => left.id.localeCompare(right.id));
}

function gdscriptTypeWarning(filePath, projectRoot, lineNumber, message, line) {
  return `${relativeProjectPath(filePath, projectRoot)}:${lineNumber}: ${message}: ${line.trim()}`;
}

function gdscriptTextureInferenceWarning(filePath, projectRoot, lineNumber, line) {
  const match = line.match(/^\s*var\s+([A-Za-z_]\w*)\s*:=\s*(.+)$/);
  if (!match) return "";
  const variableName = match[1];
  const rhs = match[2];
  if (/\sas\s+[A-Za-z_]\w*/.test(rhs)) return "";
  const riskyRhs = /\b(load|preload)\s*\(/.test(rhs)
    || /\bResourceLoader\.load\s*\(/.test(rhs)
    || /\.get_frame_texture\s*\(/.test(rhs)
    || /_load[A-Za-z0-9_]*texture\s*\(/i.test(rhs);
  if (!riskyRhs) return "";
  const typeHint = /texture/i.test(variableName) ? "Texture2D" : "explicit type";
  return gdscriptTypeWarning(
    filePath,
    projectRoot,
    lineNumber,
    `Godot may not infer this variable type; use "var ${variableName}: ${typeHint} = ..."`,
    line
  );
}

function gdscriptTextureFunctionWarning(filePath, projectRoot, lineNumber, line) {
  const match = line.match(/^\s*func\s+(_load[A-Za-z0-9_]*texture)\s*\([^)]*\)\s*:\s*(?:#.*)?$/i);
  if (!match) return "";
  return gdscriptTypeWarning(
    filePath,
    projectRoot,
    lineNumber,
    `texture loader has no return type; use "func ${match[1]}(...) -> Texture2D:"`,
    line
  );
}

function gdscriptBoxDrivenVisualWarning(filePath, projectRoot, lines, lineNumber, line) {
  const trimmed = line.trim();
  const visualPositionAssignment = /(?:sprite|visual|image|frame)[A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*\.(?:position|global_position|offset)\s*=/.test(trimmed);
  if (!visualPositionAssignment) return "";

  const context = lines
    .slice(Math.max(0, lineNumber - 4), Math.min(lines.length, lineNumber + 3))
    .join("\n");
  const hasBoxOffset = /\b(?:collision|hit|hurt)?box(?:es)?\b/i.test(context)
    || /\bcollision_offset\b/i.test(context)
    || /\b(?:collision|hit|hurt)_offset\b/i.test(context);
  if (!hasBoxOffset) return "";

  return gdscriptTypeWarning(
    filePath,
    projectRoot,
    lineNumber,
    "Runtime visual alignment must not use collision/hit/hurt box offsets; use XSXB character/group/frame visual transforms only",
    line
  );
}

function validateGdscriptTypeInference(projectRoot) {
  const warnings = [];
  if (!projectRoot) return warnings;
  const root = path.resolve(String(projectRoot));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return warnings;

  const walk = (dir) => {
    if (warnings.length >= GDSCRIPT_SCAN_LIMIT) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (warnings.length >= GDSCRIPT_SCAN_LIMIT) return;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!GDSCRIPT_SKIP_DIRS.has(entry.name)) walk(fullPath);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".gd") continue;
      let lines = [];
      try {
        lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
      } catch {
        continue;
      }
      lines.forEach((line, index) => {
        if (warnings.length >= GDSCRIPT_SCAN_LIMIT) return;
        const textureWarning = gdscriptTextureInferenceWarning(fullPath, root, index + 1, line);
        if (textureWarning) warnings.push(textureWarning);
        const functionWarning = gdscriptTextureFunctionWarning(fullPath, root, index + 1, line);
        if (functionWarning) warnings.push(functionWarning);
        const boxDrivenVisualWarning = gdscriptBoxDrivenVisualWarning(fullPath, root, lines, index + 1, line);
        if (boxDrivenVisualWarning) warnings.push(boxDrivenVisualWarning);
      });
    }
  };

  walk(root);
  if (warnings.length >= GDSCRIPT_SCAN_LIMIT) {
    warnings.push(`GDScript type scan stopped after ${GDSCRIPT_SCAN_LIMIT} warnings.`);
  }
  return warnings;
}

function manifestHasRuntimeAnimations(manifest) {
  return (Array.isArray(manifest?.profiles) ? manifest.profiles : [])
    .some((profile) => Array.isArray(profile?.animations) && profile.animations.length > 0);
}

function collectRuntimeActorScripts(projectRoot) {
  const scriptTexts = new Map();
  const runtimeScripts = new Set(["xsxb_frame_tuner/runtime/xsxb_frame_actor.gd"]);

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
        if (!GDSCRIPT_SKIP_DIRS.has(entry.name)) walk(fullPath);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".gd") continue;
      try {
        scriptTexts.set(relativeProjectPath(fullPath, projectRoot), fs.readFileSync(fullPath, "utf8"));
      } catch {
        // Ignore unreadable scripts during validation; other checks report missing runtime support.
      }
    }
  };

  walk(projectRoot);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [relPath, text] of scriptTexts.entries()) {
      if (runtimeScripts.has(relPath)) continue;
      const extendsMatch = text.match(/extends\s+"res:\/\/([^"]+\.gd)"/);
      if (!extendsMatch) continue;
      if (!runtimeScripts.has(reslash(extendsMatch[1]))) continue;
      runtimeScripts.add(relPath);
      changed = true;
    }
  }
  return runtimeScripts;
}

function validateRuntimeSceneUsage(project, manifest) {
  const warnings = [];
  if (!manifestHasRuntimeAnimations(manifest)) return warnings;
  const projectRoot = project?.projectRoot ? path.resolve(String(project.projectRoot)) : "";
  if (!projectRoot || !fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) return warnings;

  const runtimeScripts = collectRuntimeActorScripts(projectRoot);
  let sceneUsesRuntime = false;

  const walk = (dir) => {
    if (sceneUsesRuntime) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (sceneUsesRuntime) return;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SCENE_SKIP_DIRS.has(entry.name)) walk(fullPath);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".tscn") continue;
      const relScene = relativeProjectPath(fullPath, projectRoot);
      if (isGeneratedTunerScene(relScene)) continue;
      let text = "";
      try {
        text = fs.readFileSync(fullPath, "utf8");
      } catch {
        continue;
      }
      if (/res:\/\/xsxb_frame_tuner\/runtime\/xsxb_frame_actor\.tscn/.test(text)) {
        sceneUsesRuntime = true;
        return;
      }
      for (const scriptRel of runtimeScripts) {
        if (text.includes(`res://${scriptRel}`)) {
          sceneUsesRuntime = true;
          return;
        }
      }
    }
  };

  walk(projectRoot);
  if (!sceneUsesRuntime) {
    warnings.push("Imported XSXB animations are synced, but no gameplay scene appears to instantiate xsxb_frame_actor.tscn or a script extending xsxb_frame_actor.gd. The generated runtime test scene can play the data, but the actual game scene will not change until a gameplay node uses the XSXB runtime.");
  }
  return warnings;
}

function validateRuntimeBindingReaders(project, manifest) {
  const warnings = [];
  const projectRoot = project?.projectRoot ? path.resolve(String(project.projectRoot)) : "";
  if (!projectRoot || !fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) return warnings;

  const paths = projectStore.projectPaths(project);
  const frameAudioBindings = projectStore.readJson(paths.frameAudio, []);
  const frameImageAttachments = projectStore.readJson(paths.frameImageAttachments, []);
  const tuning = projectStore.readJson(paths.tuning, EMPTY_TUNING);
  const frameBoxOverrides = tuning?.frame_box_overrides && typeof tuning.frame_box_overrides === "object"
    ? tuning.frame_box_overrides
    : {};
  const sceneSettings = tuning?.scene_settings && typeof tuning.scene_settings === "object"
    ? tuning.scene_settings
    : {};
  const hasRuntimeAnimations = manifestHasRuntimeAnimations(manifest);
  const needsFrameAudio = hasRuntimeAnimations || (Array.isArray(frameAudioBindings) && frameAudioBindings.length > 0);
  const needsFrameImageAttachments = hasRuntimeAnimations || (Array.isArray(frameImageAttachments) && frameImageAttachments.length > 0);
  const needsFramePlayback = hasRuntimeAnimations;
  const needsFrameBoxes = Object.keys(frameBoxOverrides).length > 0;
  const needsSceneScale = hasRuntimeAnimations || Object.keys(sceneSettings).length > 0;
  if (!needsFrameAudio && !needsFrameImageAttachments && !needsFramePlayback && !needsFrameBoxes && !needsSceneScale) return warnings;

  const found = {
    frameAudioBindings: false,
    frameAudioPlayback: false,
    frameAudioAdvancePlayback: false,
    frameAudioFrameVisitTrigger: false,
    frameImageAttachments: false,
    framePlaybackOverrides: false,
    groupPlayback: false,
    playbackIdempotent: false,
    sceneSettings: false,
    sceneScaleInterface: false,
    sceneScaleApplied: false,
    sceneScaleAppliedToBoxes: false,
    frameBoxOverrides: false,
    runtimeHitboxInterface: false,
    runtimeHurtboxInterface: false,
    runtimeAppliesHurtbox: false,
    runtimeSourceFacing: false,
    hardcodedGameplayBodyCollision: false,
    gameplayBodyCollisionUsesRuntime: false,
    gameplayBodyCollisionGroundAnchored: false,
    hardcodedGameplayAttackRange: false,
    gameplayAttackUsesRuntimeHitbox: false,
    animationDurationInterface: false,
    startRunState: false,
    startRunTransitionsToRun: false,
  };

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
        if (!GDSCRIPT_SKIP_DIRS.has(entry.name)) walk(fullPath);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".gd") continue;
      let text = "";
      try {
        text = fs.readFileSync(fullPath, "utf8");
      } catch {
        continue;
      }
      if (/frame_audio_bindings\.json|frame_audio_bindings/i.test(text)) found.frameAudioBindings = true;
      if (/AudioStream|AudioStreamPlayer|\.play\s*\(/.test(text)) found.frameAudioPlayback = true;
      if (/while\s+_frame_clock\s*>=\s*_current_frame_duration\s*\(\s*\)[\s\S]{0,900}_play_current_frame_audio\s*\(\s*\)/.test(text)
        || /while\s+_frame_clock\s*>=\s*_current_frame_duration\s*\(\s*\)[\s\S]{0,900}_play_frame_audio\s*\(/.test(text)) found.frameAudioAdvancePlayback = true;
      if (/_frame_visit_serial/.test(text) && /trigger_key/.test(text) && /_last_audio_key/.test(text)) found.frameAudioFrameVisitTrigger = true;
      if (/frame_image_attachments\.json|frame_image_attachments/i.test(text)) found.frameImageAttachments = true;
      if (/frame_playback_overrides/i.test(text)) found.framePlaybackOverrides = true;
      if (/__group|group_playback/i.test(text)) found.groupPlayback = true;
      if (/func\s+play_frame_animation\s*\([^)]*animation_name/.test(text)
        && /_current_animation\s*==\s*animation_name/.test(text)
        && /\brestart\b/.test(text)) found.playbackIdempotent = true;
      if (/scene_settings/i.test(text)) found.sceneSettings = true;
      if (/func\s+scene_scale\s*\(/.test(text)) found.sceneScaleInterface = true;
      if (/_character_scale\s*\(\s*\)\s*\*\s*scene_scale\s*\(\s*\)|scene_scale\s*\(\s*\)\s*\*\s*_character_scale\s*\(\s*\)/.test(text)) found.sceneScaleApplied = true;
      if (/_box_actor_size\s*\([^)]*runtime_scale/.test(text) && /_box_actor_position\s*\([^)]*runtime_scale/.test(text)) found.sceneScaleAppliedToBoxes = true;
      if (/frame_box_overrides/i.test(text)) found.frameBoxOverrides = true;
      if (/current_hitbox_enabled|current_hitbox_size|current_hitbox_position/.test(text)) found.runtimeHitboxInterface = true;
      if (/current_hurtbox_enabled|current_hurtbox_size|current_hurtbox_position/.test(text)) found.runtimeHurtboxInterface = true;
      if (/func\s+_apply_frame_hurtbox\s*\(/.test(text)) found.runtimeAppliesHurtbox = true;
      if (/source_faces_left|func\s+render_facing\s*\(/.test(text)) found.runtimeSourceFacing = true;
      const hasGameplayMovementCollision = /BodyCollision|movement_collision_shape|movement_rectangle_shape/i.test(text);
      if (hasGameplayMovementCollision && /RectangleShape2D\.new\s*\(\s*\)/.test(text) && /\.size\s*=/.test(text)) found.hardcodedGameplayBodyCollision = true;
      if (hasGameplayMovementCollision && /current_collision_box_size|current_collision_box_position|current_grounded_collision_box_position/.test(text)) found.gameplayBodyCollisionUsesRuntime = true;
      if (hasGameplayMovementCollision && /current_grounded_collision_box_position|-\s*size\.y\s*\*\s*0\.5|-\s*_body_shape\.size\.y\s*\*\s*0\.5|-\s*runtime_shape\.size\.y\s*\*\s*0\.5|-\s*movement_rectangle_shape\.size\.y\s*\*\s*0\.5/.test(text)) found.gameplayBodyCollisionGroundAnchored = true;
      if (/ATTACK_RANGE|ATTACK_HEIGHT|AIR_ATTACK_RANGE|AIR_ATTACK_HEIGHT/.test(text)) found.hardcodedGameplayAttackRange = true;
      if (/current_hitbox_size|current_hitbox_position|current_hitbox_enabled/.test(text) && /current_hurtbox_size|current_hurtbox_position|current_hurtbox_enabled|_runtime_hurt_rect/.test(text)) found.gameplayAttackUsesRuntimeHitbox = true;
      if (/func\s+(?:current_)?animation_duration\s*\(|animation_finished\s*\./.test(text)) found.animationDurationInterface = true;
      if (/ActionState\.START_RUN/.test(text) && /_enter_start_run/.test(text) && /_enter_run/.test(text)) found.startRunState = true;
      if (/finished_state\s*==\s*ActionState\.START_RUN/.test(text)) found.startRunTransitionsToRun = true;
    }
  };

  walk(projectRoot);

  if (needsFrameAudio && !found.frameAudioBindings) {
    warnings.push("Runtime must support XSXB frame audio, but no GDScript appears to read frame_audio_bindings.json.");
  } else if (needsFrameAudio && !found.frameAudioPlayback) {
    warnings.push("Runtime reads frame audio bindings, but no GDScript AudioStream/AudioStreamPlayer playback path was found.");
  } else if (needsFrameAudio && !found.frameAudioAdvancePlayback) {
    warnings.push("Runtime frame audio only appears to play during final frame rendering; very short frame durations can skip bound SFX frames.");
  } else if (needsFrameAudio && !found.frameAudioFrameVisitTrigger) {
    warnings.push("Runtime frame audio de-duplication appears keyed only by frame key; looped one-frame or repeated same-frame SFX can be blocked instead of triggering on frame entry.");
  }
  if (needsFrameImageAttachments && !found.frameImageAttachments) {
    warnings.push("Runtime must support XSXB frame image attachments, but no GDScript appears to read frame_image_attachments.json.");
  }
  if (needsFramePlayback && !found.framePlaybackOverrides) {
    warnings.push("Runtime must support XSXB frame playback overrides, but no GDScript appears to read frame_playback_overrides.");
  } else if (needsFramePlayback && !found.groupPlayback) {
    warnings.push("Runtime reads frame playback overrides, but no GDScript appears to handle <profile>/<animation>:__group timing.");
  } else if (needsFramePlayback && !found.animationDurationInterface) {
    warnings.push("Runtime reads group timing, but no animation_duration/current_animation_duration interface was found for gameplay action timers.");
  } else if (needsFramePlayback && !found.playbackIdempotent) {
    warnings.push("Runtime play_frame_animation appears to restart the same animation on every call; repeated gameplay calls can make an animation look like one frame.");
  }
  if (needsFrameBoxes && !found.frameBoxOverrides) {
    warnings.push("Runtime must support XSXB frame boxes, but no GDScript appears to read frame_box_overrides.");
  } else if (needsFrameBoxes && needsSceneScale && !found.sceneScaleAppliedToBoxes) {
    warnings.push("Runtime reads frame boxes, but box size/position does not appear to use the same scene_scale() runtime scale as the sprite.");
  } else if (needsFrameBoxes && (!found.runtimeHitboxInterface || !found.runtimeHurtboxInterface || !found.runtimeAppliesHurtbox)) {
    warnings.push("Runtime frame boxes are incomplete: gameplay must be able to query hitbox and hurtbox, and runtime must apply hurtbox with the same transform as collisionbox/hitbox.");
  }
  if (needsSceneScale && !found.sceneSettings) {
    warnings.push("Runtime must support XSXB scene scale, but no GDScript appears to read scene_settings.");
  } else if (needsSceneScale && !found.sceneScaleInterface) {
    warnings.push("Runtime reads scene_settings, but no scene_scale() interface was found for gameplay movement scaling.");
  } else if (needsSceneScale && !found.sceneScaleApplied) {
    warnings.push("Runtime scene scale exists, but visual scale does not appear to multiply character scale by scene_scale().");
  }
  if (hasRuntimeAnimations && !found.runtimeSourceFacing) {
    warnings.push("Runtime has no source_faces_left/render_facing interface; imported art facing left can make gameplay directions render backwards.");
  }
  if (needsFrameBoxes && found.hardcodedGameplayBodyCollision && !found.gameplayBodyCollisionUsesRuntime) {
    warnings.push("Gameplay creates its own movement collision rectangle but does not sync it from xsxb_frame_actor current_collision_box_*; tuner box and scene scale changes will not affect in-game movement collision.");
  } else if (needsFrameBoxes && found.hardcodedGameplayBodyCollision && found.gameplayBodyCollisionUsesRuntime && !found.gameplayBodyCollisionGroundAnchored) {
    warnings.push("Gameplay movement collision sync appears to use the runtime collisionbox Y position directly; grounded movement should anchor the collision bottom at the actor origin so visual Y offsets are not cancelled by floor collision.");
  }
  if (needsFrameBoxes && found.hardcodedGameplayAttackRange && !found.gameplayAttackUsesRuntimeHitbox) {
    warnings.push("Gameplay still appears to use fixed attack range/height without intersecting xsxb_frame_actor hitbox against target hurtbox; tuner hitbox changes will not affect combat.");
  }
  if (hasRuntimeAnimations && found.startRunState && !found.startRunTransitionsToRun) {
    warnings.push("Runtime START_RUN state appears not to transition into RUN after the start animation; holding a direction can leave movement locked.");
  }

  return warnings;
}

function validateGameLocalBindingKeys(project) {
  const warnings = [];
  const projectRoot = project?.projectRoot ? path.resolve(String(project.projectRoot)) : "";
  const projectId = String(project?.id || "");
  if (!projectRoot || !projectId || !fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) return warnings;

  const files = [
    ["frame_audio_bindings.json", "frame audio"],
    ["frame_image_attachments.json", "frame image attachment"],
  ];
  for (const [fileName, label] of files) {
    const filePath = path.join(projectRoot, "xsxb_frame_tuner", "data", "projects", projectId, fileName);
    if (!fs.existsSync(filePath)) continue;
    const entries = projectStore.readJson(filePath, []);
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const key = String(entry?.key || entry?.frameKey || "");
      if (!key) continue;
      if (key.split(":").length <= 2) continue;
      warnings.push(`Game-local ${label} binding key "${key}" is source-heavy; Save sync must write stable <profile>/<animation>:<frame> keys.`);
      break;
    }
  }
  return warnings;
}

function validateProject(project, manifest) {
  if (project?.kind === "codex_pets") {
    const warnings = [...validateManifest(manifest)];
    for (const profile of manifest.profiles || []) {
      const firstFrame = (profile.animations || []).flatMap((animation) => animation.frames || [])[0];
      const fullPath = safeResolve(ROOT, reslash(firstFrame?.path || ""));
      if (!fullPath || !fs.existsSync(fullPath)) continue;
      const size = parseWebpSize(fs.readFileSync(fullPath));
      if (size.width !== 1536 || ![1872, ATLAS_HEIGHT_V2].includes(size.height)) {
        warnings.push(`${profile.id}: Codex 宠物图集应为 1536x1872 (v1) 或 1536x2288 (v2)，当前是 ${size.width}x${size.height}。`);
      }
      const expectedAnimations = size.height === ATLAS_HEIGHT_V2 ? 10 : 9;
      if ((profile.animations || []).length !== expectedAnimations) warnings.push(`${profile.id}: Codex 宠物动画组数量不完整。`);
    }
    return warnings;
  }
  return [
    ...validateManifest(manifest),
    ...validateAttackTrails(readAttackTrails(project), manifest),
    ...validateCharacterScaleValues(project, manifest),
    ...validateGdscriptTypeInference(project?.projectRoot),
    ...validateRuntimeBindingReaders(project, manifest),
    ...validateRuntimeSceneUsage(project, manifest),
    ...validateGameLocalBindingKeys(project),
  ];
}

function syncGodotRuntimeProjectId(project) {
  const projectRoot = project?.projectRoot ? path.resolve(String(project.projectRoot)) : "";
  const projectId = String(project?.id || "");
  const changed = [];
  if (!projectRoot || !projectId || !fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) return changed;

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
        if (!GDSCRIPT_SKIP_DIRS.has(entry.name)) walk(fullPath);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".gd") continue;
      let text = "";
      try {
        text = fs.readFileSync(fullPath, "utf8");
      } catch {
        continue;
      }
      const next = text.replace(
        /(const\s+XSXB_PROJECT_ID\s*:\s*String\s*=\s*)"([^"]*)"/g,
        `$1"${projectId}"`
      );
      if (next === text) continue;
      fs.writeFileSync(fullPath, next);
      changed.push(relativeProjectPath(fullPath, projectRoot));
    }
  };

  walk(projectRoot);
  return changed;
}

function configResponse(projectId) {
  const { registry, project } = projectFromRequest(projectId, { activate: true });
  if (!project) {
    return {
      root: ROOT,
      workspaceRoot: path.join(ROOT, "workspace"),
      workspaceAllRoot: path.join(ROOT, "workspace"),
      projectRoot: "",
      activeProjectId: "",
      activeProject: null,
      projects: [],
      scenes: [],
      profiles: [],
      frameAudioBindings: [],
      frameImageAttachments: [],
      tuning: tuningForClient(EMPTY_TUNING),
      tuningDefaults: {},
      bossTuning: {},
      act2StatueBossTuning: {},
      act2StatueBossDefaults: {},
      huangXianTuning: {},
      huangXianDefaults: {},
      huangXianManifest: {},
      soulTuning: {},
      soulDefaults: {},
      soulManifest: {},
      yechengPropTuning: {},
      yechengPropDefaults: {},
      warnings: ["当前 tuner 没有项目。请用 skill 给新的 Godot 项目导入角色或动画。"],
      references: {
        playerCanonicalIdleHeight: 0,
        playerSpriteCenterX: 0,
        playerSpriteFootY: 0,
        playerFloorTopOffsetY: 0,
        bossFloorTopOffsetY: 0,
      },
      groups: [],
    };
  }
  const codexPets = project.kind === "codex_pets"
    ? syncCodexPetProject(ROOT, projectStore, project)
    : { warnings: [] };
  const manifest = readManifest(project);
  const tuningFile = readTuningFile(project);
  const groups = buildGroups(manifest, tuningFile);
  const warnings = [...codexPets.warnings, ...validateProject(project, manifest)];
  if (!groups.length) {
    warnings.unshift("当前项目没有已导入的动画组。请先用 skill/import_frames/import_spriteframes 导入 PNG 序列或 SpriteFrames。");
  }
  const projectClient = projectStore.projectForClient(project);
  return {
    root: ROOT,
    workspaceRoot: projectStore.projectWorkspaceDir(project),
    workspaceAllRoot: path.join(ROOT, "workspace"),
    projectRoot: project.projectRoot,
    activeProjectId: project.id,
    activeProject: projectClient,
    projects: registry.projects.map(projectStore.projectForClient),
    scenes: project.kind === "codex_pets" ? [] : listSceneFiles(project.projectRoot, manifest.profiles),
    profiles: manifest.profiles.map(profileForClient),
    frameAudioBindings: readFrameAudioBindings(project),
    frameImageAttachments: readFrameImageAttachments(project),
    attackTrails: project.kind === "codex_pets" ? EMPTY_ATTACK_TRAILS : readAttackTrails(project),
    tuning: tuningForClient(tuningFile),
    tuningDefaults: {},
    bossTuning: {},
    act2StatueBossTuning: {},
    act2StatueBossDefaults: {},
    huangXianTuning: {},
    huangXianDefaults: {},
    huangXianManifest: {},
    soulTuning: {},
    soulDefaults: {},
    soulManifest: {},
    yechengPropTuning: {},
    yechengPropDefaults: {},
    warnings,
    references: {
      playerCanonicalIdleHeight: 0,
      playerSpriteCenterX: 0,
      playerSpriteFootY: 0,
      playerFloorTopOffsetY: 0,
      bossFloorTopOffsetY: 0,
    },
    projectKind: project.kind || "godot",
    groups,
  };
}

function normalizeTuningScaleValues(values) {
  const next = values && typeof values === "object" ? values : {};
  for (const key of Object.keys(next)) {
    if (!/\.character\.visual_scale$/.test(key)) continue;
    const vector = next[key];
    if (!vector || typeof vector !== "object") continue;
    const x = Number(vector.x);
    const y = Number(vector.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x - y) > 0.0001) continue;
    const scaleKey = key.replace(/\.visual_scale$/, ".visual_size");
    const scale = Number(next[scaleKey]);
    if (Number.isFinite(scale) && scale > 0) delete next[key];
  }
  return next;
}

function saveTuningPayload(payload, project) {
  const next = {
    schemaVersion: 1,
    values: normalizeTuningScaleValues(payload.values),
    scene_settings: payload.scene_settings && typeof payload.scene_settings === "object" ? payload.scene_settings : {},
    frame_visual_overrides: payload.frame_visual_overrides && typeof payload.frame_visual_overrides === "object" ? payload.frame_visual_overrides : {},
    frame_playback_overrides: payload.frame_playback_overrides && typeof payload.frame_playback_overrides === "object" ? payload.frame_playback_overrides : {},
    frame_box_overrides: payload.frame_box_overrides && typeof payload.frame_box_overrides === "object" ? payload.frame_box_overrides : {},
  };
  projectStore.writeJson(projectStore.projectPaths(project).tuning, next);
}

function saveFrameImageAttachments(payload, project) {
  const attachments = Array.isArray(payload)
    ? payload.filter((entry) => entry && typeof entry === "object").map((entry) => withFrameAttachmentHash(project, entry))
    : [];
  projectStore.writeJson(projectStore.projectPaths(project).frameImageAttachments, attachments);
  return attachments;
}

function saveFrameAudioBindings(payload, project) {
  const bindings = Array.isArray(payload)
    ? payload.filter((entry) => entry && typeof entry === "object")
    : Object.entries(payload || {}).map(([key, value]) => ({
      key,
      ...(value && typeof value === "object" ? value : {}),
    })).filter((entry) => entry && typeof entry === "object");
  const usableBindings = bindings.filter((entry) => entry.data || entry.path || entry.file);
  projectStore.writeJson(projectStore.projectPaths(project).frameAudio, usableBindings);
  return usableBindings;
}

function saveAttackTrails(payload, project) {
  if (project?.kind === "codex_pets") return EMPTY_ATTACK_TRAILS;
  const trails = normalizeAttackTrails(payload);
  for (const [key, segments] of Object.entries(trails.bindings)) {
    for (const segment of segments) {
      const texturePath = safeResolve(ROOT, segment.texture?.path || "");
      if (texturePath && fs.existsSync(texturePath)) {
        const info = pngInfo(fs.readFileSync(texturePath));
        segment.texture.width = info.width;
        segment.texture.height = info.height;
        segment.texture.hasEffectiveAlpha = info.hasEffectiveAlpha;
      }
      if (segment.colorMode === "original" && !segment.texture?.hasEffectiveAlpha) {
        throw new Error(`${key}/${segment.id}: 使用贴图原色需要带有效 Alpha 的透明 RGBA PNG。`);
      }
    }
  }
  projectStore.writeJson(projectStore.projectPaths(project).attackTrails, trails);
  return trails;
}

function saveFrameAttachmentImage(payload, project) {
  const decoded = decodeDataUrl(payload.data);
  if (!decoded?.buffer?.length || !decoded.mime.startsWith("image/")) {
    throw new Error("Expected an image data URL.");
  }
  const ext = imageExtensionFromMime(decoded.mime, payload.name);
  if (!ext) throw new Error("Unsupported image type.");
  const hash = contentHash(decoded.buffer);
  const fileName = `${hash}${ext}`;
  const workspaceDir = projectStore.projectWorkspaceDir(project);
  const fullPath = path.join(workspaceDir, "attachments", fileName);
  if (!isInside(fullPath, workspaceDir)) throw new Error("Attachment image must stay under the active project workspace.");
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  if (!fs.existsSync(fullPath)) fs.writeFileSync(fullPath, decoded.buffer);
  const relPath = reslash(path.relative(ROOT, fullPath));
  const pngSize = ext === ".png" ? getPngSize(fullPath) : {};
  return {
    path: relPath,
    assetHash: hash,
    name: String(payload.name || fileName),
    type: decoded.mime,
    width: Number(payload.width || pngSize.width || 0),
    height: Number(payload.height || pngSize.height || 0),
  };
}

function replaceFrameImage(payload, project) {
  const relPath = reslash(payload.path || "");
  const fullPath = safeResolve(ROOT, relPath);
  const workspaceDir = projectStore.projectWorkspaceDir(project);
  if (!fullPath || !isInside(fullPath, workspaceDir) || path.extname(fullPath).toLowerCase() !== ".png") {
    throw new Error("Frame replacement path must be a PNG under the active project workspace.");
  }
  const match = /^data:image\/png;base64,(.+)$/i.exec(String(payload.data || ""));
  if (!match) throw new Error("Expected a PNG data URL.");
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, Buffer.from(match[1], "base64"));
  return { path: relPath, ...getPngSize(fullPath) };
}

function projectsResponse() {
  const registry = projectStore.readRegistry();
  return {
    activeProjectId: registry.activeProjectId,
    projects: registry.projects.map(projectStore.projectForClient),
  };
}

function scheduleServerRestart() {
  if (restartScheduled) return;
  restartScheduled = true;
  const timer = setTimeout(() => {
    server.close(() => {
      const child = spawn(process.execPath, [__filename], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(PORT) },
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.unref();
      process.exit(0);
    });
    if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
    const forceClose = setTimeout(() => {
      if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    }, 2500);
    forceClose.unref();
  }, 600);
  timer.unref();
}

function serveStatic(req, res, pathname) {
  const requestPath = pathname === "/" ? "index.html" : pathname.slice(1);
  const full = safeResolve(PUBLIC, requestPath);
  if (!full || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    return send(res, 404, "Not found", "text/plain");
  }
  const ext = path.extname(full).toLowerCase();
  const type = ext === ".js" ? "application/javascript" : ext === ".css" ? "text/css" : "text/html";
  return send(res, 200, fs.readFileSync(full), type);
}

ensureDataFiles();

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && parsed.pathname === "/api/update-status") {
      return send(res, 200, { ...checkForUpdates(ROOT), token: UPDATE_TOKEN, restarting: restartScheduled });
    }
    if (req.method === "POST" && parsed.pathname === "/api/update") {
      if (req.headers["x-xsxb-update-token"] !== UPDATE_TOKEN) {
        return send(res, 403, { error: "Invalid update token." });
      }
      if (restartScheduled) return send(res, 409, { error: "A tuner restart is already scheduled." });
      const update = performUpdate(ROOT);
      res.setHeader("connection", "close");
      send(res, 200, { ok: true, update });
      scheduleServerRestart();
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/projects") {
      return send(res, 200, projectsResponse());
    }
    if (req.method === "POST" && parsed.pathname === "/api/projects") {
      const payload = JSON.parse(await readBody(req));
      const registry = projectStore.addProject(payload);
      return send(res, 200, {
        ok: true,
        activeProjectId: registry.activeProjectId,
        projects: registry.projects.map(projectStore.projectForClient),
      });
    }
    if (req.method === "POST" && parsed.pathname === "/api/projects/active") {
      const payload = JSON.parse(await readBody(req));
      const registry = projectStore.setActiveProject(payload.projectId);
      return send(res, 200, {
        ok: true,
        activeProjectId: registry.activeProjectId,
        projects: registry.projects.map(projectStore.projectForClient),
      });
    }
    if (req.method === "POST" && parsed.pathname === "/api/codex-pets/import") {
      const payload = JSON.parse(await readBody(req));
      const { project } = projectFromRequest(payload.projectId || parsed.searchParams.get("project"));
      const imported = importCodexPet(project, payload);
      syncCodexPetProject(ROOT, projectStore, project);
      return send(res, 200, { ok: true, imported });
    }
    if (req.method === "GET" && parsed.pathname === "/api/config") {
      return send(res, 200, configResponse(parsed.searchParams.get("project")));
    }
    if (req.method === "POST" && parsed.pathname === "/api/save") {
      const payload = JSON.parse(await readBody(req));
      const { project } = projectFromRequest(payload.projectId || parsed.searchParams.get("project"));
      saveTuningPayload(payload, project);
      let frameAudioBindings = null;
      if (Array.isArray(payload.frame_audio_bindings) || Array.isArray(payload.frameAudioBindings) || payload.frameAudioBindings) {
        frameAudioBindings = saveFrameAudioBindings(payload.frame_audio_bindings || payload.frameAudioBindings, project);
      }
      let frameImageAttachments = null;
      if (Array.isArray(payload.frame_image_attachments) || Array.isArray(payload.frameImageAttachments)) {
        frameImageAttachments = saveFrameImageAttachments(payload.frame_image_attachments || payload.frameImageAttachments, project);
      }
      const attackTrails = project.kind === "codex_pets"
        ? EMPTY_ATTACK_TRAILS
        : saveAttackTrails(payload.attack_trails || payload.attackTrails || EMPTY_ATTACK_TRAILS, project);
      const codexPetExports = [];
      if (project.kind === "codex_pets") {
        for (const entry of Array.isArray(payload.codex_pet_exports) ? payload.codex_pet_exports : []) {
          codexPetExports.push(exportCodexPet(projectStore, project, entry));
        }
        clearExportedPetTuning(projectStore, project, codexPetExports.map((entry) => entry.profileId));
        syncCodexPetProject(ROOT, projectStore, project);
      }
      const godotSync = project.kind === "codex_pets" ? null : syncGodotProject(ROOT, projectStore, project, {
        ...(frameAudioBindings ? { frameAudioBindings } : {}),
        ...(frameImageAttachments ? { frameImageAttachments } : {}),
        attackTrails,
      });
      const runtimeProjectIdFiles = project.kind === "codex_pets" ? [] : syncGodotRuntimeProjectId(project);
      return send(res, 200, {
        ok: true,
        tuning: tuningForClient(readTuningFile(project)),
        godotSync,
        runtimeProjectIdFiles,
        codexPetExports,
        warnings: validateProject(project, readManifest(project)),
      });
    }
    if (req.method === "POST" && parsed.pathname === "/api/attack-trail-texture") {
      const payload = JSON.parse(await readBody(req));
      const { project } = projectFromRequest(payload.projectId || parsed.searchParams.get("project"));
      if (project?.kind === "codex_pets") return send(res, 400, { error: "Codex Pets 项目不支持攻击拖尾。" });
      return send(res, 200, { ok: true, texture: saveAttackTrailTexture(ROOT, projectStore, project, payload) });
    }
    if (req.method === "POST" && parsed.pathname === "/api/frame-audio") {
      const payload = JSON.parse(await readBody(req));
      const { project } = projectFromRequest(payload.projectId || parsed.searchParams.get("project"));
      const bindings = Array.isArray(payload.frameAudioBindings)
        ? payload.frameAudioBindings
        : Object.entries(payload.frameAudioBindings || {}).map(([key, value]) => ({
          key,
          ...(value && typeof value === "object" ? value : {}),
        }));
      saveFrameAudioBindings(bindings, project);
      const godotAudioSync = syncFrameAudio(projectStore, project, bindings);
      return send(res, 200, { ok: true, frameAudioCount: bindings.length, godotAudioSync });
    }
    if (req.method === "POST" && parsed.pathname === "/api/frame-attachment-image") {
      const payload = JSON.parse(await readBody(req));
      const { project } = projectFromRequest(payload.projectId || parsed.searchParams.get("project"));
      return send(res, 200, { ok: true, image: saveFrameAttachmentImage(payload, project) });
    }
    if (req.method === "POST" && parsed.pathname === "/api/replace-frame") {
      const payload = JSON.parse(await readBody(req));
      const { project } = projectFromRequest(payload.projectId || parsed.searchParams.get("project"));
      return send(res, 200, { ok: true, frame: replaceFrameImage(payload, project) });
    }
    if (req.method === "POST" && parsed.pathname === "/api/replace-animation") {
      const payload = JSON.parse(await readBody(req));
      const { project } = projectFromRequest(payload.projectId || parsed.searchParams.get("project"));
      const frames = Array.isArray(payload.frames) ? payload.frames : [];
      const files = Array.isArray(payload.files) ? payload.files : [];
      if (!frames.length || frames.length !== files.length) {
        return send(res, 400, { error: `Expected exactly ${frames.length} PNG files` });
      }
      const result = frames.map((frame, index) => replaceFrameImage({ path: frame.path, data: files[index].data }, project));
      return send(res, 200, { ok: true, frames: result });
    }
    if (req.method === "GET" && parsed.pathname === "/asset") {
      const relPath = parsed.searchParams.get("path");
      const full = safeResolve(ROOT, relPath);
      const ext = path.extname(full || "").toLowerCase();
      const imageTypes = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
      };
      if (!full || !fs.existsSync(full) || !imageTypes[ext]) {
        return send(res, 404, "Not found", "text/plain");
      }
      res.writeHead(200, { "content-type": imageTypes[ext], "cache-control": "no-store" });
      return fs.createReadStream(full).pipe(res);
    }
    return serveStatic(req, res, parsed.pathname);
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: String(error.message || error) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`XSXB Frame Tuner running at http://127.0.0.1:${PORT}`);
  console.log(`Workspace root: ${ROOT}`);
});
