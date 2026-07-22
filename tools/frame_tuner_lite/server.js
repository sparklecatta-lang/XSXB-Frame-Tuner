const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const {
  EMPTY_ATTACK_TRAILS,
  normalizeAttackTrails,
  pngInfo,
  saveAttackTrailTexture,
  validateAttackTrails,
} = require("../attack_trails");
const { EMPTY_MANIFEST, EMPTY_SETTINGS, EMPTY_TUNING, createLiteStore, reslash, slug } = require("./store");
const { withUtf8Charset } = require("../http_content_type");

const ROOT = path.resolve(__dirname, "..", "..");
const FULL_PUBLIC = path.join(ROOT, "tools", "animation_tuner", "public");
const LITE_PUBLIC = path.join(__dirname, "public");
const PORT = Number(process.env.LITE_PORT || 5180);
const store = createLiteStore(ROOT);

const clone = (value) => JSON.parse(JSON.stringify(value));
const vector = (value, fallback = { x: 0, y: 0 }) => ({ x: Number(value?.x ?? fallback.x), y: Number(value?.y ?? fallback.y) });
const scaleVector = (value, fallback = 1) => ({ x: Number(value?.x ?? fallback), y: Number(value?.y ?? fallback) });
const safeResolve = (base, value) => {
  const full = path.resolve(base, String(value || ""));
  return full === base || full.startsWith(`${base}${path.sep}`) ? full : null;
};
const isInside = (child, parent) => {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const AUDIO_MIME_BY_EXTENSION = Object.freeze({
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
});
const AUDIO_EXTENSION_BY_MIME = Object.freeze({
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/ogg": ".ogg",
  "audio/opus": ".opus",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mp4": ".m4a",
  "audio/aac": ".aac",
  "audio/flac": ".flac",
  "audio/webm": ".webm",
});

function audioBindingsArray(payload) {
  return Array.isArray(payload)
    ? payload.filter((entry) => entry && typeof entry === "object")
    : Object.entries(payload || {}).map(([key, value]) => ({
      key,
      ...(value && typeof value === "object" ? value : {}),
    }));
}

function audioExtension(binding, mime = "") {
  const named = path.extname(String(binding?.name || binding?.path || binding?.file || "")).toLowerCase();
  if (AUDIO_MIME_BY_EXTENSION[named]) return named;
  return AUDIO_EXTENSION_BY_MIME[String(mime || binding?.type || "").toLowerCase()] || "";
}

function saveFrameAudioBindings(project, payload) {
  const target = store.paths(project);
  const workspace = target.workspaceDir;
  const audioDirectory = path.join(workspace, "audio");
  const bindings = [];
  for (const input of audioBindingsArray(payload)) {
    const next = { ...input };
    delete next.data;
    delete next.file;
    const dataMatch = /^data:(audio\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,([a-z0-9+/=\r\n]+)$/i.exec(String(input.data || ""));
    let full = null;
    let mime = String(input.type || dataMatch?.[1] || "").toLowerCase();
    if (dataMatch) {
      const buffer = Buffer.from(dataMatch[2], "base64");
      const extension = audioExtension(input, dataMatch[1]);
      if (!buffer.length || !extension) throw new Error(`${input.name || "音效"}: 不支持的音频格式。`);
      const hash = crypto.createHash("sha256").update(buffer).digest("hex");
      full = path.join(audioDirectory, `${hash}${extension}`);
      fs.mkdirSync(audioDirectory, { recursive: true });
      if (!fs.existsSync(full)) fs.writeFileSync(full, buffer);
      mime = AUDIO_MIME_BY_EXTENSION[extension] || mime;
    } else {
      full = safeResolve(ROOT, input.path || input.file || "");
      const extension = path.extname(full || "").toLowerCase();
      if (!full || !isInside(full, workspace) || !fs.existsSync(full) || !AUDIO_MIME_BY_EXTENSION[extension]) continue;
      mime = mime || AUDIO_MIME_BY_EXTENSION[extension];
    }
    bindings.push({
      ...next,
      key: String(input.key || ""),
      name: path.basename(String(input.name || path.basename(full) || "audio")),
      type: mime,
      size: fs.statSync(full).size,
      path: reslash(path.relative(ROOT, full)),
    });
  }
  store.writeJson(target.frameAudio, bindings);
  return bindings;
}

function send(res, status, body, contentType = "application/json") {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(/^application\/json(?:\s*;|$)/i.test(contentType) ? JSON.stringify(body, null, 2) : String(body));
  res.writeHead(status, {
    "content-type": withUtf8Charset(contentType),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(data);
}

function readBody(req, limit = 256 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error("Request body is too large.")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function pngSize(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return { width: 0, height: 0 };
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  } catch {
    return { width: 0, height: 0 };
  }
}

function normalizeManifest(raw) {
  return {
    schemaVersion: Number(raw?.schemaVersion || 1),
    profiles: (Array.isArray(raw?.profiles) ? raw.profiles : []).map((profile) => ({
      id: String(profile.id || profile.name || "sequence"),
      label: String(profile.label || profile.id || profile.name || "Sequence"),
      kind: "actor",
      bodyScale: Math.max(0.001, Number(profile.bodyScale ?? 1)),
      runtimeScale: Math.max(0.001, Number(profile.runtimeScale ?? 1)),
      supports: Array.isArray(profile.supports) ? profile.supports : ["character_transform", "group_transform", "frame_transform", "frame_playback", "reference_frame"],
      animations: Array.isArray(profile.animations) ? profile.animations : [],
    })),
  };
}

function frameForClient(frame, index) {
  const relative = reslash(frame.path || "");
  const full = safeResolve(ROOT, relative);
  const size = full && fs.existsSync(full) ? pngSize(full) : {};
  return {
    id: String(frame.id || `frame_${String(index + 1).padStart(4, "0")}`),
    name: String(frame.name || path.basename(relative) || `frame_${index + 1}.png`),
    path: relative,
    duration: Number(frame.duration || 1),
    width: Number(frame.width || frame.crop?.width || size.width || 0),
    height: Number(frame.height || frame.crop?.height || size.height || 0),
    crop: frame.crop && typeof frame.crop === "object" ? {
      x: Number(frame.crop.x || 0), y: Number(frame.crop.y || 0),
      width: Number(frame.crop.width || frame.width || 0), height: Number(frame.crop.height || frame.height || 0),
      sheetWidth: Number(frame.crop.sheetWidth || size.width || 0), sheetHeight: Number(frame.crop.sheetHeight || size.height || 0),
    } : null,
    assetVersion: String(frame.assetVersion || ""),
  };
}

function buildGroups(manifest, tuning) {
  const groups = [];
  for (const profile of manifest.profiles) {
    for (const animation of profile.animations) {
      const id = String(animation.id || animation.name || "animation");
      const name = String(animation.name || id);
      const characterKey = `profiles.${profile.id}.character`;
      const groupKey = `profiles.${profile.id}.groups.${id}`;
      const frames = (animation.frames || []).map(frameForClient).filter((frame) => frame.path);
      if (!frames.length) continue;
      const defaultScale = Number(animation.defaultScale ?? 1);
      groups.push({
        name,
        animationId: id,
        runtimeAnimation: `${profile.id}/${id}`,
        profileId: profile.id,
        profileLabel: profile.label,
        profileKind: profile.kind,
        profileScaleSemantic: "character_group_frame",
        profileAnchorMode: String(animation.anchorMode || "canvas_bottom_center"),
        profileSupports: Array.isArray(animation.supports) ? animation.supports : profile.supports,
        type: String(animation.type || "actor"),
        tuningTarget: "",
        anchorMode: String(animation.anchorMode || "canvas_bottom_center"),
        sourceAnchor: animation.sourceAnchor ? vector(animation.sourceAnchor) : null,
        source: reslash(animation.source || path.dirname(frames[0]?.path || "")),
        speed: Number(animation.fps || 12),
        frames,
        previewOwner: String(animation.previewOwner || ""),
        attachTo: String(animation.attachTo || animation.previewOwner || ""),
        previewLayer: String(animation.previewLayer || "front") === "behind" ? "behind" : "front",
        attachedLayers: Array.isArray(animation.attachedLayers) ? animation.attachedLayers.map(String) : [],
        independentPlayback: animation.independentPlayback === true,
        sequenceOverlap: animation.sequenceOverlap === true,
        sequenceOverlapAlpha: Number(animation.sequenceOverlapAlpha ?? 0.48),
        characterScale: `${characterKey}.visual_size`, characterScaleVector: `${characterKey}.visual_scale`,
        characterOffset: `${characterKey}.offset`, characterRotation: `${characterKey}.rotation`,
        characterBaseScale: Number(profile.bodyScale || 1) * Number(profile.runtimeScale || 1),
        characterBaseScaleVector: tuning.values[`${characterKey}.visual_scale`] ?? null,
        characterBaseOffset: tuning.values[`${characterKey}.offset`] ?? { x: 0, y: 0 },
        characterBaseRotation: Number(tuning.values[`${characterKey}.rotation`] ?? 0),
        runtimeScale: Number(profile.runtimeScale || 1), bodyScale: Number(profile.bodyScale || 1),
        scale: `${groupKey}.visual_size`, scaleVector: `${groupKey}.visual_scale`, offset: `${groupKey}.offset`, rotation: `${groupKey}.rotation`,
        defaultScale, defaultScaleVector: animation.defaultScaleVector ? scaleVector(animation.defaultScaleVector, defaultScale) : null,
        defaultOffset: vector(animation.defaultOffset), defaultRotation: Number(animation.defaultRotation || 0),
        baseScale: tuning.values[`${groupKey}.visual_size`] ?? defaultScale,
        baseScaleVector: tuning.values[`${groupKey}.visual_scale`] ?? animation.defaultScaleVector ?? null,
        baseOffset: tuning.values[`${groupKey}.offset`] ?? animation.defaultOffset ?? { x: 0, y: 0 },
        baseRotation: Number(tuning.values[`${groupKey}.rotation`] ?? animation.defaultRotation ?? 0),
      });
    }
  }
  return groups;
}

function projectData(project) {
  store.ensureProjectFiles(project);
  const target = store.paths(project);
  const manifest = normalizeManifest(store.readJson(target.manifest, EMPTY_MANIFEST));
  const tuning = store.readJson(target.tuning, EMPTY_TUNING);
  tuning.values = tuning.values && typeof tuning.values === "object" ? tuning.values : {};
  const attackTrails = normalizeAttackTrails(store.readJson(target.attackTrails, EMPTY_ATTACK_TRAILS));
  const audio = audioBindingsArray(store.readJson(target.frameAudio, []));
  const attachments = store.readJson(target.frameImageAttachments, []);
  const rawSettings = store.readJson(target.settings, EMPTY_SETTINGS);
  const settings = {
    schemaVersion: 1,
    canvas: rawSettings.canvas && typeof rawSettings.canvas === "object" ? rawSettings.canvas : { ...EMPTY_SETTINGS.canvas },
    export: {
      phaseDurationMs: Math.min(1000, Math.max(1, Math.round(Number(rawSettings.export?.phaseDurationMs || 80)))),
      sheetColumns: Math.min(64, Math.max(1, Math.round(Number(rawSettings.export?.sheetColumns || 8)))),
    },
  };
  if (JSON.stringify(rawSettings) !== JSON.stringify(settings)) store.writeJson(target.settings, settings);
  return { target, manifest, tuning, attackTrails, audio, attachments: Array.isArray(attachments) ? attachments : [], settings };
}

function validateLiteProject(project, data = projectData(project)) {
  const warnings = [];
  const ids = new Set();
  for (const profile of data.manifest.profiles) {
    for (const animation of profile.animations) {
      const key = `${profile.id}/${animation.id || animation.name}`;
      ids.add(key);
      if (!(animation.frames || []).length) warnings.push(`${key}: 没有帧。`);
      for (const [index, frame] of (animation.frames || []).entries()) {
        const full = safeResolve(ROOT, frame.path);
        if (!full || !fs.existsSync(full)) warnings.push(`${key}: 缺少第 ${index + 1} 帧：${frame.path || "(empty)"}`);
      }
    }
  }
  warnings.push(...validateAttackTrails(data.attackTrails, { profiles: data.manifest.profiles }));
  for (const binding of data.audio) {
    const full = safeResolve(ROOT, binding.path || binding.file || "");
    if (!full || !isInside(full, data.target.workspaceDir) || !fs.existsSync(full)) {
      warnings.push(`${binding.name || "音效"}: Lite 音频文件不存在或不在当前项目稳定目录。`);
    }
  }
  const width = Number(data.settings.canvas?.width || 0);
  const height = Number(data.settings.canvas?.height || 0);
  if (data.settings.canvas?.autoMeasured === true && (width < 1 || height < 1 || width > 8192 || height > 8192)) warnings.push("已计算的统一透明画布尺寸必须在 1-8192 px。 ");
  return warnings;
}

function configResponse(projectId) {
  const registry = store.readRegistry();
  const project = store.resolveProject(projectId);
  const projects = registry.projects.map(store.projectForClient);
  if (!project) {
    return {
      root: ROOT, workspaceRoot: path.join(ROOT, "workspace", "lite"), workspaceAllRoot: path.join(ROOT, "workspace", "lite"), projectRoot: "",
      activeProjectId: "", activeProject: null, projects, scenes: [], profiles: [], frameAudioBindings: [], frameImageAttachments: [],
      attackTrails: EMPTY_ATTACK_TRAILS, tuning: clone(EMPTY_TUNING), warnings: ["Lite 还没有素材。请让 Agent 导入 PNG 序列或 PNG+JSON sheet。"],
      references: {}, projectKind: "frame_lite", liteSettings: clone(EMPTY_SETTINGS), groups: [],
    };
  }
  const data = projectData(project);
  return {
    root: ROOT, workspaceRoot: data.target.workspaceDir, workspaceAllRoot: path.join(ROOT, "workspace", "lite"), projectRoot: "",
    activeProjectId: project.id, activeProject: store.projectForClient(project), projects, scenes: [],
    profiles: data.manifest.profiles.map((profile) => ({ id: profile.id, label: profile.label, kind: profile.kind, scale_semantic: "character_group_frame", anchor_mode: "manifest_anchor_mode", supports: profile.supports })),
    frameAudioBindings: data.audio, frameImageAttachments: data.attachments, attackTrails: data.attackTrails,
    tuning: { ...data.tuning.values, scene_settings: data.tuning.scene_settings || {}, frame_visual_overrides: data.tuning.frame_visual_overrides || {}, frame_playback_overrides: data.tuning.frame_playback_overrides || {}, frame_box_overrides: data.tuning.frame_box_overrides || {} },
    tuningDefaults: {}, bossTuning: {}, act2StatueBossTuning: {}, act2StatueBossDefaults: {}, huangXianTuning: {}, huangXianDefaults: {}, huangXianManifest: {}, soulTuning: {}, soulDefaults: {}, soulManifest: {}, yechengPropTuning: {}, yechengPropDefaults: {},
    warnings: validateLiteProject(project, data), references: {}, projectKind: "frame_lite", liteSettings: data.settings,
    groups: buildGroups(data.manifest, data.tuning),
  };
}

function saveAttachmentImage(project, payload) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(String(payload.data || ""));
  if (!match) throw new Error("Expected an image data URL.");
  const buffer = Buffer.from(match[2], "base64");
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const extension = match[1].toLowerCase() === "image/png" ? ".png" : match[1].toLowerCase() === "image/webp" ? ".webp" : match[1].toLowerCase() === "image/gif" ? ".gif" : ".jpg";
  const full = path.join(store.paths(project).workspaceDir, "attachments", `${hash}${extension}`);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (!fs.existsSync(full)) fs.writeFileSync(full, buffer);
  const size = extension === ".png" ? pngSize(full) : {};
  return { path: reslash(path.relative(ROOT, full)), assetHash: hash, name: String(payload.name || path.basename(full)), type: match[1].toLowerCase(), width: Number(payload.width || size.width || 0), height: Number(payload.height || size.height || 0) };
}

function replaceFrame(project, payload) {
  const full = safeResolve(ROOT, payload.path);
  const workspace = store.paths(project).workspaceDir;
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(String(payload.data || ""));
  if (!full || !isInside(full, workspace) || path.extname(full).toLowerCase() !== ".png" || !match) throw new Error("Frame replacement must be a PNG inside the active Lite workspace.");
  fs.writeFileSync(full, Buffer.from(match[1], "base64"));
  return { path: reslash(path.relative(ROOT, full)), ...pngSize(full) };
}

function savePayload(project, payload) {
  const target = store.paths(project);
  const tuning = {
    schemaVersion: 1,
    values: payload.values && typeof payload.values === "object" ? payload.values : {},
    scene_settings: payload.scene_settings && typeof payload.scene_settings === "object" ? payload.scene_settings : {},
    frame_visual_overrides: payload.frame_visual_overrides && typeof payload.frame_visual_overrides === "object" ? payload.frame_visual_overrides : {},
    frame_playback_overrides: payload.frame_playback_overrides && typeof payload.frame_playback_overrides === "object" ? payload.frame_playback_overrides : {},
    frame_box_overrides: payload.frame_box_overrides && typeof payload.frame_box_overrides === "object" ? payload.frame_box_overrides : {},
  };
  store.writeJson(target.tuning, tuning);
  const audio = saveFrameAudioBindings(project, payload.frame_audio_bindings || payload.frameAudioBindings || []);
  const attachments = Array.isArray(payload.frame_image_attachments) ? payload.frame_image_attachments : [];
  store.writeJson(target.frameImageAttachments, attachments);
  const trails = normalizeAttackTrails(payload.attack_trails || EMPTY_ATTACK_TRAILS);
  for (const segments of Object.values(trails.bindings)) {
    for (const segment of segments) {
      const texture = safeResolve(ROOT, segment.texture?.path || "");
      if (texture && fs.existsSync(texture)) {
        const info = pngInfo(fs.readFileSync(texture));
        segment.texture.width = info.width; segment.texture.height = info.height; segment.texture.hasEffectiveAlpha = info.hasEffectiveAlpha;
      }
      if (segment.colorMode === "original" && !segment.texture?.hasEffectiveAlpha) throw new Error(`${segment.name}: 原色模式需要带有效 Alpha 的 RGBA PNG。`);
    }
  }
  store.writeJson(target.attackTrails, trails);
  return { tuning, audio, attachments, trails };
}

function serveIndex(res) {
  let html = fs.readFileSync(path.join(FULL_PUBLIC, "index.html"), "utf8");
  html = html.replace("<title>XSXB Frame Tuner</title>", "<title>XSXB Frame Tuner Lite</title>")
    .replace("<h1>XSXB Frame Tuner</h1>", "<h1>XSXB Frame Tuner Lite</h1>")
    .replace("</head>", "  <link rel=\"stylesheet\" href=\"/lite.css\" />\n  </head>")
    .replace("</body>", "    <script src=\"/lite.js\"></script>\n  </body>");
  return send(res, 200, html, "text/html; charset=utf-8");
}

function serveStatic(res, pathname) {
  if (pathname === "/") return serveIndex(res);
  const lite = pathname === "/lite.js" || pathname === "/lite.css";
  const base = lite ? LITE_PUBLIC : FULL_PUBLIC;
  const full = safeResolve(base, pathname.slice(1));
  if (!full || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return send(res, 404, "Not found", "text/plain");
  const ext = path.extname(full).toLowerCase();
  const type = ext === ".js" ? "application/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : ext === ".png" ? "image/png" : "application/octet-stream";
  return send(res, 200, fs.readFileSync(full), type);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/api/update-status") return send(res, 200, { updateAvailable: false, lite: true });
    if (req.method === "GET" && url.pathname === "/api/projects") {
      const registry = store.readRegistry();
      return send(res, 200, { activeProjectId: registry.activeProjectId, projects: registry.projects.map(store.projectForClient) });
    }
    if (req.method === "POST" && url.pathname === "/api/projects/active") {
      const payload = JSON.parse(await readBody(req));
      const registry = store.setActiveProject(payload.projectId);
      return send(res, 200, { ok: true, activeProjectId: registry.activeProjectId, projects: registry.projects.map(store.projectForClient) });
    }
    if (req.method === "GET" && url.pathname === "/api/config") return send(res, 200, configResponse(url.searchParams.get("project")));
    if (req.method === "POST" && url.pathname === "/api/save") {
      const payload = JSON.parse(await readBody(req));
      const project = store.resolveProject(payload.projectId);
      if (!project) return send(res, 404, { error: "Lite project not found." });
      const saved = savePayload(project, payload);
      return send(res, 200, { ok: true, warnings: validateLiteProject(project), godotSync: null, frameAudioCount: saved.audio.length });
    }
    if (req.method === "POST" && url.pathname === "/api/attack-trail-texture") {
      const payload = JSON.parse(await readBody(req));
      const project = store.resolveProject(payload.projectId);
      if (!project) return send(res, 404, { error: "Lite project not found." });
      return send(res, 200, { ok: true, texture: saveAttackTrailTexture(ROOT, store, project, payload) });
    }
    if (req.method === "POST" && url.pathname === "/api/frame-attachment-image") {
      const payload = JSON.parse(await readBody(req));
      const project = store.resolveProject(payload.projectId);
      return send(res, 200, { ok: true, image: saveAttachmentImage(project, payload) });
    }
    if (req.method === "POST" && url.pathname === "/api/replace-frame") {
      const payload = JSON.parse(await readBody(req));
      const project = store.resolveProject(payload.projectId);
      return send(res, 200, { ok: true, frame: replaceFrame(project, payload) });
    }
    if (req.method === "POST" && url.pathname === "/api/replace-animation") {
      const payload = JSON.parse(await readBody(req));
      const project = store.resolveProject(payload.projectId);
      const frames = Array.isArray(payload.frames) ? payload.frames : [];
      const files = Array.isArray(payload.files) ? payload.files : [];
      if (!frames.length || frames.length !== files.length) return send(res, 400, { error: "Replacement PNG count must match the animation frame count." });
      return send(res, 200, { ok: true, frames: frames.map((frame, index) => replaceFrame(project, { path: frame.path, data: files[index].data })) });
    }
    if (req.method === "POST" && url.pathname === "/api/lite/settings") {
      const payload = JSON.parse(await readBody(req));
      const project = store.resolveProject(payload.projectId);
      const settings = {
        schemaVersion: 1,
        canvas: {
          width: Math.min(8192, Math.max(1, Math.round(Number(payload.canvas?.width || 1024)))),
          height: Math.min(8192, Math.max(1, Math.round(Number(payload.canvas?.height || 1024)))),
          originPixelX: Number(payload.canvas?.originPixelX ?? 512),
          originPixelY: Number(payload.canvas?.originPixelY ?? 880),
          padding: Math.min(1024, Math.max(0, Math.round(Number(payload.canvas?.padding ?? 24)))),
          autoMeasured: payload.canvas?.autoMeasured === true,
        },
        export: {
          phaseDurationMs: Math.min(1000, Math.max(1, Math.round(Number(payload.export?.phaseDurationMs || 80)))),
          sheetColumns: Math.min(64, Math.max(1, Math.round(Number(payload.export?.sheetColumns || 8)))),
        },
      };
      store.writeJson(store.paths(project).settings, settings);
      return send(res, 200, { ok: true, settings });
    }
    if (req.method === "POST" && url.pathname === "/api/frame-audio") {
      const payload = JSON.parse(await readBody(req));
      const project = store.resolveProject(payload.projectId);
      if (!project) return send(res, 404, { error: "Lite project not found." });
      const bindings = saveFrameAudioBindings(project, payload.frameAudioBindings || []);
      return send(res, 200, { ok: true, frameAudioCount: bindings.length, frameAudioBindings: bindings, godotAudioSync: null });
    }
    if (req.method === "GET" && url.pathname === "/asset") {
      const full = safeResolve(ROOT, url.searchParams.get("path"));
      const types = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ...AUDIO_MIME_BY_EXTENSION };
      const type = types[path.extname(full || "").toLowerCase()];
      if (!full || !fs.existsSync(full) || !type) return send(res, 404, "Not found", "text/plain");
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      return fs.createReadStream(full).pipe(res);
    }
    return serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: String(error.message || error) });
  }
});

if (require.main === module) {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`XSXB Frame Tuner Lite running at http://127.0.0.1:${PORT}`);
    console.log(`Lite registry: ${store.path}`);
  });
}

module.exports = { AUDIO_MIME_BY_EXTENSION, buildGroups, configResponse, saveFrameAudioBindings, server, validateLiteProject };
