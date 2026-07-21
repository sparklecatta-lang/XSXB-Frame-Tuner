const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { reslash } = require("./project_store");

const DEFAULT_ATTACK_TRAIL_PRESET_TEXTURE = Object.freeze({
  path: "tools/animation_tuner/public/presets/attack_trails/dynamic_trail_luma.png",
  assetHash: "e2b855cdb3c59db8b4ed33f400b03bafd4af7df2636f3fd4d3eb68603763da90",
  name: "dynamic_trail_luma.png",
  type: "image/png",
  width: 648,
  height: 435,
  hasEffectiveAlpha: false,
});
const DEFAULT_BEFORE_CHASE_MULTIPLIER = 0.5;
const DEFAULT_AFTER_CHASE_MULTIPLIER = 2;
const DEFAULT_PATH_COLUMNS = 20;
const LEGACY_BEFORE_CHASE_SPEED = 110;
const LEGACY_AFTER_CHASE_SPEED = 680;
const ATTACK_TRAIL_SCHEMA_VERSION = 7;
const EMPTY_ATTACK_TRAILS = Object.freeze({ schemaVersion: ATTACK_TRAIL_SCHEMA_VERSION, presetTexture: DEFAULT_ATTACK_TRAIL_PRESET_TEXTURE, bindings: {} });
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function slug(value, fallback) {
  const text = String(value || "").trim().replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "");
  return text || fallback;
}

function point(value, fallback = { x: 0, y: 0 }) {
  return {
    x: clamp(value?.x, -100000, 100000, fallback.x),
    y: clamp(value?.y, -100000, 100000, fallback.y),
  };
}

function normalizeTexture(value) {
  const texture = value && typeof value === "object" ? value : {};
  return {
    path: reslash(texture.path || ""),
    assetHash: String(texture.assetHash || ""),
    name: String(texture.name || ""),
    type: String(texture.type || "image/png"),
    width: Math.max(0, Math.round(Number(texture.width || 0))),
    height: Math.max(0, Math.round(Number(texture.height || 0))),
    hasEffectiveAlpha: texture.hasEffectiveAlpha === true,
  };
}

function normalizeColor(value, fallback = "#d9364a") {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
}

function normalizeColorMode(value) {
  const mode = String(value || "").toLowerCase();
  if (mode === "original" || mode === "gradient") return mode;
  return "solid";
}

function normalizeGradientStops(value, fallbackColor = "#d9364a") {
  const stops = (Array.isArray(value) ? value : []).slice(0, 16).map((stop, index) => ({
    id: slug(stop?.id, `gradient_stop_${index + 1}`),
    position: clamp(stop?.position ?? stop?.offset, 0, 1, index ? 1 : 0),
    color: normalizeColor(stop?.color, fallbackColor),
  })).sort((a, b) => a.position - b.position);
  if (stops.length >= 2) return stops;
  return [
    { id: "gradient_stop_bottom", position: 0, color: fallbackColor },
    { id: "gradient_stop_top", position: 1, color: fallbackColor },
  ];
}

function normalizeStick(value, index, defaultLayer = "behind") {
  const stick = value && typeof value === "object" ? value : {};
  const top = point(stick.top, { x: -60, y: -120 });
  let bottom = point(stick.bottom, { x: 60, y: 120 });
  if (Math.hypot(bottom.x - top.x, bottom.y - top.y) < 1) bottom = { x: top.x, y: top.y + 1 };
  return {
    id: slug(stick.id, `stick_${index + 1}`),
    order: index,
    frame: Math.max(0, Math.round(clamp(stick.frame, 0, 100000, 0))),
    framePhase: clamp(stick.framePhase ?? stick.frame_phase, 0, 1, 0.5),
    phaseMode: String(stick.phaseMode || stick.phase_mode || "auto") === "manual" ? "manual" : "auto",
    top,
    bottom,
    reverseDirection: stick.reverseDirection === true || stick.reverse_direction === true,
    directionOffset: clamp(stick.directionOffset ?? stick.direction_offset, -180, 180, 0),
    tangentStrength: clamp(stick.tangentStrength ?? stick.tangent_strength, 0, 4, 0.8),
    layer: String(stick.layer || defaultLayer) === "front" ? "front" : "behind",
  };
}

function normalizeFramePhases(sticks) {
  const frames = new Map();
  for (const stick of sticks) (frames.get(stick.frame) || frames.set(stick.frame, []).get(stick.frame)).push(stick);
  for (const frameSticks of frames.values()) {
    let index = 0;
    while (index < frameSticks.length) {
      if (frameSticks[index].phaseMode === "manual") { index += 1; continue; }
      const start = index;
      while (index < frameSticks.length && frameSticks[index].phaseMode !== "manual") index += 1;
      const lower = start > 0 ? frameSticks[start - 1].framePhase : 0;
      const upper = index < frameSticks.length ? frameSticks[index].framePhase : 1;
      const count = index - start;
      for (let offset = 0; offset < count; offset += 1) frameSticks[start + offset].framePhase = lower + (upper - lower) * (offset + 1) / (count + 1);
    }
    let previous = -0.0001;
    frameSticks.forEach((stick, stickIndex) => {
      const maximum = 1 - (frameSticks.length - 1 - stickIndex) * 0.0001;
      stick.framePhase = clamp(stick.framePhase, previous + 0.0001, maximum, (stickIndex + 1) / (frameSticks.length + 1));
      previous = stick.framePhase;
    });
  }
  return sticks;
}

function normalizeChaseMultiplier(segment, phase, sourceSchema = 6) {
  const before = phase === "before";
  const direct = before
    ? segment.beforeStopChaseMultiplier ?? segment.before_stop_chase_multiplier
    : segment.afterStopChaseMultiplier ?? segment.after_stop_chase_multiplier;
  const fallback = before ? DEFAULT_BEFORE_CHASE_MULTIPLIER : DEFAULT_AFTER_CHASE_MULTIPLIER;
  const min = before ? 0 : 0.1;
  const max = before ? 1 : 20;
  if (direct !== undefined && direct !== null && direct !== "") {
    const normalized = clamp(direct, min, max, fallback);
    if (before && sourceSchema < 6 && Math.abs(normalized - 0.7) < 0.000001) return DEFAULT_BEFORE_CHASE_MULTIPLIER;
    return normalized;
  }
  const legacy = Number(before
    ? segment.beforeStopChaseSpeed ?? segment.before_stop_chase_speed
    : segment.afterStopChaseSpeed ?? segment.after_stop_chase_speed);
  if (!Number.isFinite(legacy)) return fallback;
  const legacyDefault = before ? LEGACY_BEFORE_CHASE_SPEED : LEGACY_AFTER_CHASE_SPEED;
  return clamp(legacy / legacyDefault * fallback, min, max, fallback);
}

function normalizeSegment(value, index, bindingKey, sourceSchema = 6) {
  const segment = value && typeof value === "object" ? value : {};
  const [profileId = "", animationId = ""] = String(bindingKey || "").split("/");
  const segmentLayer = String(segment.layer || "behind") === "front" ? "front" : "behind";
  const sticks = normalizeFramePhases((Array.isArray(segment.sticks) ? segment.sticks : [])
    .map((stick, stickIndex) => normalizeStick(stick, stickIndex, segmentLayer))
    .sort((a, b) => a.order - b.order)
    .map((stick, order) => ({ ...stick, order })));
  const color = normalizeColor(segment.color);
  return {
    id: slug(segment.id, `trail_${index + 1}`),
    name: String(segment.name || `Trail ${index + 1}`),
    profileId: String(segment.profileId || profileId),
    animationId: String(segment.animationId || animationId),
    enabled: segment.enabled !== false,
    generated: segment.generated !== false,
    coordinateSpace: "group",
    layer: segmentLayer,
    texture: normalizeTexture(segment.texture),
    colorMode: normalizeColorMode(segment.colorMode || segment.color_mode || "solid"),
    color,
    gradientStops: normalizeGradientStops(segment.gradientStops ?? segment.gradient_stops, color),
    beforeStopChaseMultiplier: normalizeChaseMultiplier(segment, "before", sourceSchema),
    afterStopChaseMultiplier: normalizeChaseMultiplier(segment, "after", sourceSchema),
    tailSamples: Math.round(clamp(segment.tailSamples ?? segment.tail_samples, 4, 8, 5)),
    tailFadeStart: clamp(segment.tailFadeStart ?? segment.tail_fade_start, 0, 0.95, 0.6),
    headCurvature: clamp(segment.headCurvature ?? segment.head_curvature, -1, 1, 0),
    speedVariation: clamp(segment.speedVariation ?? segment.speed_variation, 0, 0.25, 0.008),
    stableSeed: Math.round(clamp(segment.stableSeed ?? segment.stable_seed, 0, 2147483647, 73129)),
    pathColumns: Math.round(clamp(segment.pathColumns ?? segment.path_columns, 8, 96, DEFAULT_PATH_COLUMNS)),
    pathCacheSamples: Math.round(clamp(segment.pathCacheSamples ?? segment.path_cache_samples, 32, 512, 192)),
    collapsedWidth: clamp(segment.collapsedWidth ?? segment.collapsed_width, 0.25, 32, 2),
    sticks,
  };
}

function normalizeAttackTrails(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const sourceSchema = Math.max(0, Math.round(Number(source.schemaVersion || 0)));
  const presetTexture = normalizeTexture(source.presetTexture?.path ? source.presetTexture : DEFAULT_ATTACK_TRAIL_PRESET_TEXTURE);
  const bindings = {};
  for (const [rawKey, rawSegments] of Object.entries(source.bindings || {})) {
    const key = String(rawKey || "").trim();
    if (!key.includes("/") || !Array.isArray(rawSegments)) continue;
    const segments = rawSegments.map((segment, index) => normalizeSegment(segment, index, key, sourceSchema));
    if (segments.length) bindings[key] = segments;
  }
  return { schemaVersion: ATTACK_TRAIL_SCHEMA_VERSION, presetTexture, bindings };
}

function pngInfo(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("攻击拖尾纹理目前仅支持 PNG。请导入 PNG 文件。");
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = 0;
  const idat = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) break;
    if (type === "IHDR") {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
      interlace = buffer[dataStart + 12];
    } else if (type === "IDAT") {
      idat.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }
  if (!width || !height) throw new Error("PNG 缺少有效 IHDR。");
  let hasEffectiveAlpha = false;
  if ((colorType === 4 || colorType === 6) && bitDepth === 8 && interlace === 0 && idat.length) {
    const channels = colorType === 6 ? 4 : 2;
    const rowBytes = width * channels;
    const inflated = zlib.inflateSync(Buffer.concat(idat));
    let cursor = 0;
    let previous = Buffer.alloc(rowBytes);
    for (let y = 0; y < height && !hasEffectiveAlpha; y += 1) {
      const filter = inflated[cursor++];
      const raw = inflated.subarray(cursor, cursor + rowBytes);
      cursor += rowBytes;
      const row = Buffer.alloc(rowBytes);
      for (let x = 0; x < rowBytes; x += 1) {
        const left = x >= channels ? row[x - channels] : 0;
        const up = previous[x] || 0;
        const upLeft = x >= channels ? previous[x - channels] : 0;
        let predictor = 0;
        if (filter === 1) predictor = left;
        else if (filter === 2) predictor = up;
        else if (filter === 3) predictor = Math.floor((left + up) / 2);
        else if (filter === 4) {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          predictor = pa <= pb && pa <= pc ? left : (pb <= pc ? up : upLeft);
        } else if (filter !== 0) {
          throw new Error("不支持此 PNG 过滤器。");
        }
        row[x] = (raw[x] + predictor) & 255;
      }
      for (let x = channels - 1; x < rowBytes; x += channels) {
        if (row[x] < 255) {
          hasEffectiveAlpha = true;
          break;
        }
      }
      previous = row;
    }
  }
  return { width, height, bitDepth, colorType, hasAlphaChannel: colorType === 4 || colorType === 6, hasEffectiveAlpha };
}

function decodeImageDataUrl(value) {
  const match = /^data:(image\/png);base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(String(value || ""));
  if (!match) throw new Error("攻击拖尾纹理必须是 PNG data URL。");
  return { type: match[1].toLowerCase(), buffer: Buffer.from(match[2], "base64") };
}

function saveAttackTrailTexture(root, projectStore, project, payload) {
  const decoded = decodeImageDataUrl(payload.data);
  const info = pngInfo(decoded.buffer);
  const hash = crypto.createHash("sha256").update(decoded.buffer).digest("hex");
  const profileId = slug(payload.profileId, "profile");
  const animationId = slug(payload.animationId, "animation");
  const fullPath = path.join(projectStore.projectWorkspaceDir(project), "attack_trails", profileId, animationId, `${hash}.png`);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  if (!fs.existsSync(fullPath)) fs.writeFileSync(fullPath, decoded.buffer);
  return {
    path: reslash(path.relative(root, fullPath)),
    assetHash: hash,
    name: String(payload.name || `${hash}.png`),
    type: decoded.type,
    width: info.width,
    height: info.height,
    hasEffectiveAlpha: info.hasEffectiveAlpha,
  };
}

function validateAttackTrails(data, manifest) {
  const warnings = [];
  const profileAnimations = new Set();
  for (const profile of manifest?.profiles || []) {
    for (const animation of profile.animations || []) profileAnimations.add(`${profile.id}/${animation.id || animation.name}`);
  }
  for (const [key, segments] of Object.entries(data?.bindings || {})) {
    if (!profileAnimations.has(key)) warnings.push(`${key}: 攻击拖尾绑定的动画不存在。`);
    for (const segment of segments) {
      if (!segment.texture?.path) warnings.push(`${key}/${segment.id}: 尚未导入拖尾纹理。`);
      if (segment.sticks.length < 2) warnings.push(`${key}/${segment.id}: 至少需要两根棍子。`);
      if (segment.colorMode === "original" && !segment.texture?.hasEffectiveAlpha) {
        warnings.push(`${key}/${segment.id}: 使用贴图原色需要带有效 Alpha 的透明 RGBA PNG。`);
      }
    }
  }
  return warnings;
}

module.exports = {
  DEFAULT_ATTACK_TRAIL_PRESET_TEXTURE,
  EMPTY_ATTACK_TRAILS,
  clone,
  normalizeAttackTrails,
  pngInfo,
  saveAttackTrailTexture,
  validateAttackTrails,
};
