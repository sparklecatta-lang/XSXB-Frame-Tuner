const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { EMPTY_MANIFEST, EMPTY_TUNING, reslash } = require("./project_store");
const { ensureGodotRuntime } = require("./godot_runtime");

const GODOT_SYNC_ROOT = "xsxb_frame_tuner";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeResolve(base, requested) {
  const resolvedBase = path.resolve(base);
  const full = path.resolve(resolvedBase, String(requested || ""));
  return full === resolvedBase || full.startsWith(`${resolvedBase}${path.sep}`) ? full : null;
}

function isInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function validGodotProjectRoot(project) {
  const projectRoot = project?.projectRoot ? path.resolve(String(project.projectRoot)) : "";
  if (!projectRoot || !fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) return "";
  return projectRoot;
}

function godotProjectRelPath(...parts) {
  return reslash(path.join(GODOT_SYNC_ROOT, ...parts));
}

function godotDataRelPath(project, fileName) {
  return godotProjectRelPath("data", "projects", project.id, fileName);
}

function godotDataDir(projectRoot, project) {
  return path.join(projectRoot, GODOT_SYNC_ROOT, "data", "projects", project.id);
}

function copyFileIfChanged(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const sourceStat = fs.statSync(source);
    const targetStat = fs.statSync(target);
    if (sourceStat.size === targetStat.size) {
      const sourceBuffer = fs.readFileSync(source);
      const targetBuffer = fs.readFileSync(target);
      if (sourceBuffer.equals(targetBuffer)) return false;
    }
  }
  fs.copyFileSync(source, target);
  return true;
}

function fileContentHash(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sourcePathForFrame(root, projectRoot, framePath) {
  const raw = String(framePath || "");
  if (!raw) return "";
  if (raw.startsWith("res://")) {
    const local = path.join(projectRoot, raw.slice("res://".length));
    if (fs.existsSync(local)) return local;
    return "";
  }
  if (path.isAbsolute(raw)) return fs.existsSync(raw) ? raw : "";
  const fromTuner = safeResolve(root, raw);
  if (fromTuner && fs.existsSync(fromTuner)) return fromTuner;
  const fromProject = path.resolve(projectRoot, raw);
  if (isInside(fromProject, projectRoot) && fs.existsSync(fromProject)) return fromProject;
  return "";
}

function localFrameRelPath(framePath, fallbackName = "frame.png") {
  const raw = reslash(framePath || fallbackName).replace(/^res:\/\//, "").replace(/^\/+/, "");
  if (raw.startsWith(`${GODOT_SYNC_ROOT}/`)) return raw;
  return godotProjectRelPath(raw || fallbackName);
}

function syncManifest(root, projectStore, project, manifestInput = null) {
  const projectRoot = validGodotProjectRoot(project);
  if (!projectRoot) return { manifest: manifestInput || EMPTY_MANIFEST, copiedFrames: 0, frameCount: 0 };

  const paths = projectStore.projectPaths(project);
  const manifest = clone(manifestInput || projectStore.readJson(paths.manifest, EMPTY_MANIFEST));
  let copiedFrames = 0;
  let frameCount = 0;

  for (const profile of Array.isArray(manifest.profiles) ? manifest.profiles : []) {
    for (const animation of Array.isArray(profile.animations) ? profile.animations : []) {
      const frames = Array.isArray(animation.frames) ? animation.frames : [];
      if (animation.source) animation.source = localFrameRelPath(animation.source, "assets");
      for (const frame of frames) {
        const source = sourcePathForFrame(root, projectRoot, frame.path);
        const nextRel = localFrameRelPath(frame.path, frame.name || "frame.png");
        frame.path = nextRel;
        frameCount += 1;
        if (!source || path.extname(source).toLowerCase() !== ".png") continue;
        const target = path.join(projectRoot, nextRel);
        if (copyFileIfChanged(source, target)) copiedFrames += 1;
      }
    }
  }

  const targetManifest = path.join(godotDataDir(projectRoot, project), "animation_manifest.json");
  fs.mkdirSync(path.dirname(targetManifest), { recursive: true });
  fs.writeFileSync(targetManifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { copiedFrames, frameCount };
}

function syncTuning(projectStore, project, tuningInput = null) {
  const projectRoot = validGodotProjectRoot(project);
  if (!projectRoot) return { wroteTuning: false };
  const paths = projectStore.projectPaths(project);
  const tuning = clone(tuningInput || projectStore.readJson(paths.tuning, EMPTY_TUNING));
  const targetTuning = path.join(godotDataDir(projectRoot, project), "animation_tuning.json");
  fs.mkdirSync(path.dirname(targetTuning), { recursive: true });
  fs.writeFileSync(targetTuning, `${JSON.stringify(tuning, null, 2)}\n`, "utf8");
  return { wroteTuning: true };
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

function audioExtension(binding) {
  const nameExt = path.extname(String(binding?.name || "")).toLowerCase();
  if (nameExt) return nameExt;
  const type = String(binding?.type || "").toLowerCase();
  if (type.includes("mpeg") || type.includes("mp3")) return ".mp3";
  if (type.includes("wav")) return ".wav";
  if (type.includes("ogg")) return ".ogg";
  if (type.includes("flac")) return ".flac";
  if (type.includes("aac")) return ".aac";
  return ".audio";
}

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(String(dataUrl || ""));
  if (!match) return null;
  return {
    mime: match[1] || "",
    buffer: match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3] || ""), "utf8"),
  };
}

function frameAudioKey(binding, index) {
  if (binding?.key) return String(binding.key);
  const metadata = binding?.metadata || {};
  const animation = metadata.animation || binding?.animation || "animation";
  const frame = Number(metadata.frame ?? binding?.frame ?? index);
  return `${animation}:${Number.isFinite(frame) ? frame : index}`;
}

function frameBindingInfo(binding, index) {
  const metadata = binding?.metadata && typeof binding.metadata === "object" ? binding.metadata : {};
  const profileId = String(metadata.profileId || binding?.profileId || "");
  let animation = String(metadata.animation || binding?.animation || binding?.animation_id || binding?.action || "");
  if (animation && profileId && !animation.includes("/")) animation = `${profileId}/${animation}`;
  const frame = Number(metadata.frame ?? binding?.frame ?? binding?.frame_index ?? binding?.frameNumber ?? index);
  return {
    animation,
    frame: Number.isFinite(frame) ? frame : index,
  };
}

function stableFrameBindingKey(binding, index) {
  const info = frameBindingInfo(binding, index);
  return info.animation ? `${info.animation}:${info.frame}` : frameAudioKey(binding, index);
}

function assignStableFrameBindingKey(entry, sourceBinding, index) {
  const stableKey = stableFrameBindingKey(sourceBinding, index);
  const sourceKey = String(entry.key || sourceBinding?.key || "");
  if (sourceKey && sourceKey !== stableKey && !entry.sourceKey) entry.sourceKey = sourceKey;
  entry.key = stableKey;
  if (entry.frameKey !== undefined || sourceBinding?.frameKey !== undefined) entry.frameKey = stableKey;
  return entry;
}

function syncFrameAudio(projectStore, project, bindingsInput = null) {
  const projectRoot = validGodotProjectRoot(project);
  if (!projectRoot) return { audioCount: 0, copiedAudio: 0 };
  const paths = projectStore.projectPaths(project);
  const raw = bindingsInput ?? projectStore.readJson(paths.frameAudio, []);
  const bindings = Array.isArray(raw)
    ? raw
    : Object.entries(raw || {}).map(([key, value]) => ({ key, ...(value && typeof value === "object" ? value : {}) }));
  const localBindings = [];
  let copiedAudio = 0;

  bindings.forEach((binding, index) => {
    if (!binding || typeof binding !== "object") return;
    const next = { ...binding };
    delete next.data;
    const data = decodeDataUrl(binding.data);
    if (data?.buffer?.length) {
      const key = sanitizeSegment(frameAudioKey(binding, index), `audio_${index + 1}`);
      const ext = audioExtension(binding);
      const audioRel = godotProjectRelPath("audio", "projects", project.id, `${key}${ext}`);
      const target = path.join(projectRoot, audioRel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data.buffer);
      copiedAudio += 1;
      next.path = `res://${audioRel}`;
      next.type = next.type || data.mime;
    } else if (binding.path) {
      next.path = String(binding.path);
    } else if (binding.file) {
      next.path = String(binding.file);
    }
    if (next.path) localBindings.push(assignStableFrameBindingKey(next, binding, index));
  });

  const targetAudio = path.join(godotDataDir(projectRoot, project), "frame_audio_bindings.json");
  fs.mkdirSync(path.dirname(targetAudio), { recursive: true });
  fs.writeFileSync(targetAudio, `${JSON.stringify(localBindings, null, 2)}\n`, "utf8");
  return { audioCount: localBindings.length, copiedAudio };
}

function syncFrameImageAttachments(root, projectStore, project, attachmentsInput = null) {
  const projectRoot = validGodotProjectRoot(project);
  if (!projectRoot) return { imageAttachmentCount: 0, copiedImageAttachments: 0 };
  const paths = projectStore.projectPaths(project);
  const raw = attachmentsInput ?? projectStore.readJson(paths.frameImageAttachments, []);
  const attachments = Array.isArray(raw)
    ? raw.filter((entry) => entry && typeof entry === "object")
    : [];
  const localAttachments = [];
  let copiedImageAttachments = 0;

  attachments.forEach((attachment, index) => {
    const next = clone(attachment);
    const source = sourcePathForFrame(root, projectRoot, next.path);
    if (!source) return;
    const ext = path.extname(source) || path.extname(String(next.name || "")) || ".png";
    const hash = String(next.assetHash || fileContentHash(source));
    const nextRel = godotProjectRelPath("attachments", "projects", project.id, `${hash}${ext.toLowerCase()}`);
    const target = path.join(projectRoot, nextRel);
    if (copyFileIfChanged(source, target)) copiedImageAttachments += 1;
    next.path = `res://${nextRel}`;
    next.assetHash = hash;
    assignStableFrameBindingKey(next, attachment, index);
    localAttachments.push(next);
  });

  const targetFile = path.join(godotDataDir(projectRoot, project), "frame_image_attachments.json");
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(targetFile, `${JSON.stringify(localAttachments, null, 2)}\n`, "utf8");
  return { imageAttachmentCount: localAttachments.length, copiedImageAttachments };
}

function syncGodotProject(root, projectStore, project, options = {}) {
  const projectRoot = validGodotProjectRoot(project);
  if (!projectRoot) {
    return { ok: false, reason: "No bound Godot project root", copiedFrames: 0, frameCount: 0, audioCount: 0, copiedAudio: 0, imageAttachmentCount: 0, copiedImageAttachments: 0 };
  }
  const paths = projectStore.projectPaths(project);
  const manifestInput = options.manifest || projectStore.readJson(paths.manifest, EMPTY_MANIFEST);
  const manifestResult = syncManifest(root, projectStore, project, manifestInput);
  const tuningResult = syncTuning(projectStore, project, options.tuning);
  const audioResult = syncFrameAudio(projectStore, project, options.frameAudioBindings);
  const imageAttachmentResult = syncFrameImageAttachments(root, projectStore, project, options.frameImageAttachments);
  const runtimeResult = ensureGodotRuntime(root, project, { manifest: manifestInput });
  return {
    ok: true,
    projectRoot,
    dataDir: reslash(path.join(projectRoot, GODOT_SYNC_ROOT, "data", "projects", project.id)),
    assetRoot: reslash(path.join(projectRoot, GODOT_SYNC_ROOT)),
    ...manifestResult,
    ...tuningResult,
    ...audioResult,
    ...imageAttachmentResult,
    ...runtimeResult,
  };
}

module.exports = {
  GODOT_SYNC_ROOT,
  godotDataRelPath,
  syncFrameAudio,
  syncFrameImageAttachments,
  syncGodotProject,
  syncManifest,
  syncTuning,
  validGodotProjectRoot,
};
