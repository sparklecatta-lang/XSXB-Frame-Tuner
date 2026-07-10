const assert = require("node:assert/strict");
const { animationLooksAttack, hitboxEnabledByDefault } = require("./box_estimator");
const { parseBatchArgs } = require("./import_batch");
const { runtimeScript } = require("./godot_runtime");

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

console.log("XSXB self-tests passed.");
