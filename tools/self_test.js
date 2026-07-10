const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { animationLooksAttack, hitboxEnabledByDefault } = require("./box_estimator");
const { parseBatchArgs } = require("./import_batch");
const { runtimeScript } = require("./godot_runtime");
const { candidateSkillTargets, resolveSkillTarget, syncSkillDirectory, trustedRemote } = require("./updater");

assert.equal(animationLooksAttack("stand_attack"), true);
assert.equal(animationLooksAttack("站立攻击"), true);
assert.equal(animationLooksAttack("格挡反击"), true);
assert.equal(animationLooksAttack("idle"), false);
assert.equal(hitboxEnabledByDefault(0, 3, "attack"), true);
assert.equal(hitboxEnabledByDefault(0, 12, "stand_attack"), false);
assert.equal(hitboxEnabledByDefault(5, 12, "stand_attack"), true);

const parsed = parseBatchArgs([
  "--project-root", "C:\\game",
  "--project", "demo",
  "--profile", "hero",
  "--fps", "12",
  "--replace",
  "--animation", "idle",
  "--source", "C:\\frames\\idle",
  "--animation", "站立攻击",
  "--source", "C:\\frames\\attack",
  "--fps", "18",
]);
assert.equal(parsed.globals.project, "demo");
assert.equal(parsed.globals.profile, "hero");
assert.equal(parsed.globals.replace, true);
assert.equal(parsed.entries.length, 2);
assert.equal(parsed.entries[0].animation, "idle");
assert.equal(parsed.entries[1].fps, "18");

const source = runtimeScript("demo");
assert.match(source, /frame_audio_bindings\.json/);
assert.match(source, /frame_image_attachments\.json/);
assert.match(source, /func animation_duration\(/);
assert.match(source, /func scene_scale\(/);
assert.match(source, /_character_scale\(\) \* scene_scale\(\)/);
assert.match(source, /size\.x\) \* sprite_scale_x/);
assert.match(source, /size\.y\) \* sprite_scale_y/);
assert.match(source, /func restart_frame_animation\(/);

assert.equal(trustedRemote("https://github.com/sparklecatta-lang/XSXB-Frame-Tuner.git"), true);
assert.equal(trustedRemote("git@github.com:sparklecatta-lang/XSXB-Frame-Tuner.git"), true);
assert.equal(trustedRemote("https://github.com/example/XSXB-Frame-Tuner.git"), false);
assert.equal(trustedRemote("https://evilgithub.com/sparklecatta-lang/XSXB-Frame-Tuner.git"), false);
const candidates = candidateSkillTargets({ USERPROFILE: "C:\\Users\\demo" }, "C:\\Users\\fallback");
assert.equal(candidates[0], path.resolve("C:\\Users\\demo", ".codex", "skills", "xsxb-frame-tuner"));
const customCandidates = candidateSkillTargets({ CODEX_HOME: "D:\\Codex", USERPROFILE: "C:\\Users\\demo" }, "C:\\Users\\fallback");
assert.equal(customCandidates[0], path.resolve("D:\\Codex", "skills", "xsxb-frame-tuner"));
assert.equal(resolveSkillTarget({ CODEX_HOME: "D:\\Codex", USERPROFILE: "C:\\Users\\demo" }), customCandidates[0]);

const updateTestRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xsxb-updater-test-"));
try {
  const skillSource = path.join(updateTestRoot, "source");
  const skillTarget = path.join(updateTestRoot, "target", "xsxb-frame-tuner");
  fs.mkdirSync(skillSource, { recursive: true });
  fs.mkdirSync(skillTarget, { recursive: true });
  fs.writeFileSync(path.join(skillSource, "SKILL.md"), "new skill\n", "utf8");
  fs.writeFileSync(path.join(skillSource, "reference.md"), "new reference\n", "utf8");
  fs.writeFileSync(path.join(skillTarget, "SKILL.md"), "old skill\n", "utf8");
  fs.writeFileSync(path.join(skillTarget, "stale.md"), "stale\n", "utf8");
  const synced = syncSkillDirectory(skillSource, skillTarget);
  assert.equal(synced.changed, true);
  assert.equal(fs.readFileSync(path.join(skillTarget, "SKILL.md"), "utf8"), "new skill\n");
  assert.equal(fs.existsSync(path.join(skillTarget, "reference.md")), true);
  assert.equal(fs.existsSync(path.join(skillTarget, "stale.md")), false);
} finally {
  fs.rmSync(updateTestRoot, { recursive: true, force: true });
}

console.log("XSXB self-tests passed.");
