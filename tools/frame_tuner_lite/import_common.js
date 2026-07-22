const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createLiteStore, reslash, slug } = require("./store");

const ROOT = path.resolve(__dirname, "..", "..");
const store = createLiteStore(ROOT);

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) result[key] = true;
    else { result[key] = next; index += 1; }
  }
  return result;
}

function pngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") throw new Error(`Not a PNG: ${filePath}`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function naturalCompare(left, right) {
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}

function required(args, name) {
  const value = String(args[name] || "").trim();
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function assetVersion(filePath) {
  return crypto.createHash("sha1").update(fs.readFileSync(filePath)).digest("hex").slice(0, 12);
}

function copyStable(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return destination;
}

function animationDestination(project, profileId, animationId) {
  return path.join(store.paths(project).workspaceDir, "assets", slug(profileId, "sequence"), slug(animationId, "animation"));
}

function loadManifest(project) {
  return store.readJson(store.paths(project).manifest, { schemaVersion: 1, profiles: [] });
}

function saveAnimation({ project, profileId, profileLabel, animation }) {
  const target = store.paths(project);
  const manifest = loadManifest(project);
  manifest.schemaVersion = 1;
  manifest.profiles = Array.isArray(manifest.profiles) ? manifest.profiles : [];
  let profile = manifest.profiles.find((entry) => entry.id === profileId);
  if (!profile) {
    profile = {
      id: profileId,
      label: profileLabel,
      kind: "actor",
      bodyScale: 1,
      runtimeScale: 1,
      supports: ["character_transform", "group_transform", "frame_transform", "frame_playback", "reference_frame"],
      animations: [],
    };
    manifest.profiles.push(profile);
  }
  profile.label = profileLabel || profile.label;
  profile.animations = Array.isArray(profile.animations) ? profile.animations : [];
  const existingIndex = profile.animations.findIndex((entry) => String(entry.id || entry.name) === animation.id);
  if (existingIndex >= 0) profile.animations[existingIndex] = animation;
  else profile.animations.push(animation);

  if (animation.previewOwner) {
    const owner = profile.animations.find((entry) => String(entry.id || entry.name) === animation.previewOwner);
    if (owner) owner.attachedLayers = Array.from(new Set([...(owner.attachedLayers || []), animation.id]));
  }
  store.writeJson(target.manifest, manifest);
  const settings = store.readJson(target.settings, { schemaVersion: 1, canvas: {}, export: {} });
  settings.schemaVersion = 1;
  settings.canvas = {
    padding: Number(settings.canvas?.padding ?? 24),
    autoMeasured: false,
  };
  settings.export = {
    phaseDurationMs: Number(settings.export?.phaseDurationMs || 80),
    sheetColumns: Number(settings.export?.sheetColumns || 8),
  };
  store.writeJson(target.settings, settings);
  return { manifest, settings };
}

module.exports = {
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
};
