const fs = require("node:fs");
const path = require("node:path");
const { opaqueBoundsForPng } = require("./box_estimator");

const SKIP_DIRS = new Set([
  ".git",
  ".godot",
  "addons",
  "node_modules",
  "xsxb_frame_tuner",
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nearlyEqual(left, right, epsilon = 0.0001) {
  return Math.abs(Number(left || 0) - Number(right || 0)) <= epsilon;
}

function percentile(values, ratio = 0.5) {
  const sorted = values
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = clamp(Math.round((sorted.length - 1) * ratio), 0, sorted.length - 1);
  return sorted[index];
}

function isUprightAnimation(sample) {
  const text = `${sample.animationId || ""} ${sample.animationName || ""}`.toLowerCase();
  if (/(attack|atk|slash|strike|slide|dash|jump|air|fall|hurt|death|crouch|roll)/.test(text)) return false;
  return /(idle|stand|walk|run)/.test(text);
}

function estimateSourceActorHeight(samples) {
  const allHeights = [];
  const uprightHeights = [];
  const perAnimationCounts = new Map();
  for (const sample of samples || []) {
    const filePath = sample?.filePath;
    if (!filePath || !fs.existsSync(filePath)) continue;
    const animationKey = `${sample.animationId || ""}:${sample.animationName || ""}`;
    const count = perAnimationCounts.get(animationKey) || 0;
    if (count >= 4) continue;
    perAnimationCounts.set(animationKey, count + 1);
    const bounds = opaqueBoundsForPng(filePath);
    const height = Number(bounds?.body?.height || bounds?.height || bounds?.canvasHeight || 0);
    if (!Number.isFinite(height) || height < 16) continue;
    allHeights.push(height);
    if (isUprightAnimation(sample)) uprightHeights.push(height);
  }
  return percentile(uprightHeights.length ? uprightHeights : allHeights, 0.5);
}

function projectViewportHeight(projectRoot) {
  const projectFile = projectRoot ? path.join(projectRoot, "project.godot") : "";
  if (!projectFile || !fs.existsSync(projectFile)) return 0;
  try {
    const text = fs.readFileSync(projectFile, "utf8");
    const match = text.match(/^\s*window\/size\/viewport_height\s*=\s*([0-9.]+)/m);
    return Number(match?.[1] || 0);
  } catch {
    return 0;
  }
}

function packedVectorSpans(text) {
  const heights = [];
  const blockRegex = /PackedVector2Array\s*\(\s*\[([\s\S]*?)\]\s*\)/g;
  let blockMatch;
  while ((blockMatch = blockRegex.exec(text)) !== null) {
    const yValues = [];
    const vectorRegex = /Vector2\s*\(\s*[-0-9.]+\s*,\s*([-0-9.]+)\s*\)/g;
    let vectorMatch;
    while ((vectorMatch = vectorRegex.exec(blockMatch[1])) !== null) {
      yValues.push(Number(vectorMatch[1]));
    }
    if (yValues.length < 2) continue;
    const height = Math.max(...yValues) - Math.min(...yValues);
    if (height >= 24 && height <= 420) heights.push(height);
  }
  return heights;
}

function scriptShapeHeights(text) {
  if (!/(CapsuleShape2D|RectangleShape2D|CollisionShape2D|Polygon2D)/.test(text)) return [];
  const heights = [];
  const heightRegex = /\.height\s*=\s*([0-9.]+)/g;
  let heightMatch;
  while ((heightMatch = heightRegex.exec(text)) !== null) {
    const height = Number(heightMatch[1]);
    if (height >= 24 && height <= 420) heights.push(height);
  }
  const sizeRegex = /\.size\s*=\s*Vector2\s*\(\s*[0-9.]+\s*,\s*([0-9.]+)\s*\)/g;
  let sizeMatch;
  while ((sizeMatch = sizeRegex.exec(text)) !== null) {
    const height = Number(sizeMatch[1]);
    if (height >= 24 && height <= 420) heights.push(height);
  }
  return heights;
}

function sceneReferenceActorHeight(projectRoot) {
  const heights = [];
  const root = projectRoot ? path.resolve(String(projectRoot)) : "";
  if (root && fs.existsSync(root) && fs.statSync(root).isDirectory()) {
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
          if (!SKIP_DIRS.has(entry.name)) walk(fullPath);
          continue;
        }
        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".gd") continue;
        let text = "";
        try {
          text = fs.readFileSync(fullPath, "utf8");
        } catch {
          continue;
        }
        heights.push(...packedVectorSpans(text), ...scriptShapeHeights(text));
      }
    };
    walk(root);
  }

  const scriptHeight = percentile(heights, 0.75);
  if (scriptHeight > 0) return scriptHeight;
  const viewportHeight = projectViewportHeight(projectRoot);
  if (viewportHeight > 0) return clamp(viewportHeight * 0.18, 96, 180);
  return 128;
}

function estimateInitialCharacterScale(projectRoot, samples) {
  const sourceHeight = estimateSourceActorHeight(samples);
  const targetHeight = sceneReferenceActorHeight(projectRoot);
  if (!sourceHeight || !targetHeight) {
    return { scale: 1, sourceHeight, targetHeight };
  }
  const scale = Number(clamp(targetHeight / sourceHeight, 0.025, 2).toFixed(4));
  return { scale, sourceHeight, targetHeight };
}

function normalizeUniformCharacterScale(tuning, profileId) {
  tuning.values = tuning.values && typeof tuning.values === "object" ? tuning.values : {};
  const scaleKey = `profiles.${profileId}.character.visual_size`;
  const vectorKey = `profiles.${profileId}.character.visual_scale`;
  const scale = Number(tuning.values[scaleKey]);
  const vector = tuning.values[vectorKey];
  if (!vector || typeof vector !== "object") return false;
  const x = Number(vector.x);
  const y = Number(vector.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !nearlyEqual(x, y)) return false;
  if (Number.isFinite(scale) && scale > 0) {
    delete tuning.values[vectorKey];
    return true;
  }
  tuning.values[scaleKey] = Number(x.toFixed(4));
  delete tuning.values[vectorKey];
  return true;
}

function ensureInitialCharacterScale(tuning, profileId, projectRoot, samples, options = {}) {
  tuning.values = tuning.values && typeof tuning.values === "object" ? tuning.values : {};
  const scaleKey = `profiles.${profileId}.character.visual_size`;
  const vectorKey = `profiles.${profileId}.character.visual_scale`;
  const normalized = normalizeUniformCharacterScale(tuning, profileId);
  const existingScale = Number(tuning.values[scaleKey]);
  if (!options.force && Number.isFinite(existingScale) && existingScale > 0) {
    return { changed: normalized, scale: existingScale, normalized };
  }
  const estimate = estimateInitialCharacterScale(projectRoot, samples);
  tuning.values[scaleKey] = estimate.scale;
  delete tuning.values[vectorKey];
  return { changed: true, normalized, ...estimate };
}

module.exports = {
  ensureInitialCharacterScale,
  estimateInitialCharacterScale,
  normalizeUniformCharacterScale,
};
