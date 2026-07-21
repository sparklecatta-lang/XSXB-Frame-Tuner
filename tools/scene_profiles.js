function normalizeIdentifier(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function profileSceneAliases(profile) {
  const aliases = new Set();
  const add = (value) => {
    const normalized = normalizeIdentifier(value);
    if (!normalized || normalized.length < 3) return;
    aliases.add(normalized);
    const withoutDisplaySuffix = normalized.replace(/_(?:idle|actions?|animations?|frames?|sprite_frames?)$/, "");
    if (withoutDisplaySuffix.length >= 3) aliases.add(withoutDisplaySuffix);
  };

  add(profile?.label);
  add(profile?.id);
  for (const alias of Array.isArray(profile?.sceneAliases) ? profile.sceneAliases : []) add(alias);
  return Array.from(aliases);
}

function relevantSceneText(sceneText) {
  return String(sceneText || "")
    .split(/\r?\n/)
    .filter((line) => {
      if (/^\s*\[node\b/i.test(line)) return true;
      if (!/^\s*\[ext_resource\b/i.test(line)) return false;
      if (/type="(?:SpriteFrames|PackedScene)"/i.test(line)) return true;
      if (/path="res:\/\/[^\"]*\/(?:characters|actors)\//i.test(line)) return true;
      return /type="Script"/i.test(line) && /(?:controller|actor|character|player|boss)[^\"]*\.gd"/i.test(line);
    })
    .join("\n");
}

function profileIdsForSceneText(sceneText, profiles) {
  const haystack = `_${normalizeIdentifier(relevantSceneText(sceneText))}_`;
  return (Array.isArray(profiles) ? profiles : [])
    .filter((profile) => profileSceneAliases(profile).some((alias) => haystack.includes(`_${alias}_`)))
    .map((profile) => profile.id);
}

module.exports = {
  normalizeIdentifier,
  profileIdsForSceneText,
  profileSceneAliases,
  relevantSceneText,
};
