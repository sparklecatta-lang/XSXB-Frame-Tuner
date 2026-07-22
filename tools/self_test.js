const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { animationLooksAttack, hitboxEnabledByDefault } = require("./box_estimator");
const { parseBatchArgs } = require("./import_batch");
const { runtimeScript } = require("./godot_runtime");
const { profileIdsForSceneText } = require("./scene_profiles");
const { ATLAS_HEIGHT, ATLAS_HEIGHT_V2, ATLAS_WIDTH, PET_STATES, parseWebpSize } = require("./codex_pets");
const { normalizeAttackTrails, pngInfo, validateAttackTrails } = require("./attack_trails");
const { averageFrameTiming, groupFpsForDuration, frameSynchronousEffectSample, liteExportSamples, distributeIntegerMilliseconds } = require("./animation_tuner/public/timing_modes");
const { candidateSkillTargets, resolveSkillTarget, syncSkillDirectory, trustedRemote } = require("./updater");
const { withUtf8Charset } = require("./http_content_type");
const { createLiteStore } = require("./frame_tuner_lite/store");
const { cropFromEntry, frameEntries, importSheetAudio } = require("./frame_tuner_lite/import_sheet");

assert.equal(withUtf8Charset("text/html"), "text/html; charset=utf-8");
assert.equal(withUtf8Charset("text/css"), "text/css; charset=utf-8");
assert.equal(withUtf8Charset("application/javascript"), "application/javascript; charset=utf-8");
assert.equal(withUtf8Charset("application/json"), "application/json; charset=utf-8");
assert.equal(withUtf8Charset("text/html; charset=gbk"), "text/html; charset=gbk");
assert.equal(withUtf8Charset("image/png"), "image/png");

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
for (const publicRoot of [
  path.join(__dirname, "animation_tuner", "public"),
  path.join(__dirname, "frame_tuner_lite", "public"),
]) {
  for (const entry of fs.readdirSync(publicRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.(?:html|js|css)$/i.test(entry.name)) continue;
    const filePath = path.join(entry.parentPath || entry.path, entry.name);
    const text = utf8Decoder.decode(fs.readFileSync(filePath));
    assert.doesNotMatch(text, /[\u0080-\u009f\ufffd]|(?:Ã.|Â.|â€|锟斤拷)/u, `${filePath} contains mojibake`);
  }
}

assert.equal(animationLooksAttack("stand_attack"), true);
assert.equal(animationLooksAttack("站立攻击"), true);
assert.equal(animationLooksAttack("格挡反击"), true);
assert.equal(animationLooksAttack("idle"), false);
assert.equal(hitboxEnabledByDefault(0, 3, "attack"), true);
assert.equal(hitboxEnabledByDefault(0, 12, "stand_attack"), false);
assert.equal(hitboxEnabledByDefault(5, 12, "stand_attack"), true);

const groupTiming = averageFrameTiming(800, 4, 10);
assert.equal(groupTiming.durationMs, 200);
assert.equal(groupTiming.multiplier, 2);
const currentFrameTotalMs = ((2.1 + 2 + 2 + 2) / 10) * 1000;
const switchedGroupFps = groupFpsForDuration(4, currentFrameTotalMs);
assert.ok(Math.abs(switchedGroupFps - (4 / 0.81)) < 1e-12);
assert.ok(Math.abs((4 / switchedGroupFps) - 0.81) < 1e-12);
assert.equal(averageFrameTiming(800, 0, 10), null);
const normalTrailSample = frameSynchronousEffectSample(0.02, 0, 0.05, 0.05);
assert.deepEqual(
  { sampleIndex: normalTrailSample.sampleIndex, subdivisions: normalTrailSample.subdivisions },
  { sampleIndex: 0, subdivisions: 1 },
);
assert.ok(Math.abs(normalTrailSample.time - 0.025) < 1e-12);
const longTrailSampleA = frameSynchronousEffectSample(0.02, 0, 0.15, 0.05);
const longTrailSampleB = frameSynchronousEffectSample(0.08, 0, 0.15, 0.05);
const longTrailSampleC = frameSynchronousEffectSample(0.14, 0, 0.15, 0.05);
assert.deepEqual(
  [longTrailSampleA, longTrailSampleB, longTrailSampleC].map((sample) => [sample.sampleIndex, sample.subdivisions]),
  [[0, 3], [1, 3], [2, 3]],
);
assert.deepEqual(
  [longTrailSampleA, longTrailSampleB, longTrailSampleC].map((sample) => Math.round(sample.time * 1000)),
  [25, 75, 125],
);
const sixPlayableFrames = [25, 25, 25, 25, 25, 135].map((durationMs, frameIndex) => ({
  frameIndex,
  durationMs,
  // Export sampling must ignore stick-authored phases. Sticks shape the path only.
  stickPhases: frameIndex === 4 ? [1 / 3, 2 / 3] : frameIndex === 5 ? [0.5] : [],
}));
const liteTrailSamples = liteExportSamples(sixPlayableFrames, 80, 260, true);
assert.equal(liteTrailSamples.length, 8);
assert.equal(new Set(liteTrailSamples.filter((sample) => sample.reason !== "trail_end").map((sample) => sample.frameIndex)).size, 6);
assert.equal(liteTrailSamples.filter((sample) => sample.frameIndex === 4 && sample.reason !== "trail_end").length, 1);
assert.equal(liteTrailSamples.filter((sample) => sample.frameIndex === 5 && sample.reason !== "trail_end").length, 2);
assert.equal(liteTrailSamples.at(-1).reason, "trail_end");
assert.ok(liteTrailSamples.every((sample) => sample.durationMs > 0));
assert.ok(Math.abs(liteTrailSamples.filter((sample) => sample.reason !== "trail_end").reduce((total, sample) => total + sample.durationMs, 0) - 260) < 0.001);
const liteNoTrailSamples = liteExportSamples(sixPlayableFrames, 1000, 260, false);
assert.equal(liteNoTrailSamples.length, 6);
const slowerFrames = sixPlayableFrames.map((frame) => ({ ...frame, durationMs: 160 }));
assert.equal(liteExportSamples(slowerFrames, 80, 960, false).length, 12);
assert.equal(liteExportSamples([{ frameIndex: 0, durationMs: 25.000000000000004 }], 25, 25, false).length, 1);
assert.equal(liteExportSamples([{ frameIndex: 0, durationMs: 25.001 }], 25, 25.001, false).length, 2);
assert.deepEqual(distributeIntegerMilliseconds(Array(6).fill(22.5)), [23, 22, 23, 22, 23, 22]);
assert.equal(distributeIntegerMilliseconds(Array(6).fill(22.5)).reduce((sum, value) => sum + value, 0), 135);

assert.deepEqual(PET_STATES.map((state) => state.id), [
  "idle", "running-right", "running-left", "waving", "jumping", "failed", "waiting", "running", "review",
]);
assert.deepEqual(PET_STATES.map((state) => state.durations.length), [6, 8, 8, 4, 5, 8, 6, 6, 6]);
assert.equal(PET_STATES.reduce((total, state) => total + state.durations.length, 0), 57);
const webpHeader = Buffer.alloc(30);
webpHeader.write("RIFF", 0, "ascii");
webpHeader.writeUInt32LE(22, 4);
webpHeader.write("WEBP", 8, "ascii");
webpHeader.write("VP8X", 12, "ascii");
webpHeader.writeUInt32LE(10, 16);
webpHeader.writeUIntLE(ATLAS_WIDTH - 1, 24, 3);
webpHeader.writeUIntLE(ATLAS_HEIGHT - 1, 27, 3);
assert.deepEqual(parseWebpSize(webpHeader), { width: ATLAS_WIDTH, height: ATLAS_HEIGHT });
webpHeader.writeUIntLE(ATLAS_HEIGHT_V2 - 1, 27, 3);
assert.deepEqual(parseWebpSize(webpHeader), { width: ATLAS_WIDTH, height: ATLAS_HEIGHT_V2 });

const sceneProfiles = [
  { id: "hero", label: "Hero" },
  { id: "companion", label: "companion_idle" },
  { id: "bell", label: "bell" },
];
assert.deepEqual(profileIdsForSceneText('[node name="Hero" type="Node2D"]', sceneProfiles), ["hero"]);
assert.deepEqual(profileIdsForSceneText('[ext_resource type="SpriteFrames" path="res://art/characters/playable/companion/idle/companion_idle.spriteframes.tres" id="1"]', sceneProfiles), ["companion"]);
assert.deepEqual(profileIdsForSceneText('[ext_resource type="SpriteFrames" path="res://art/props/bell/bell.spriteframes.tres" id="1"]', sceneProfiles), ["bell"]);
assert.deepEqual(profileIdsForSceneText('[ext_resource type="Texture2D" path="res://art/backgrounds/dev/hero_playground_stage.png" id="1"]\n[ext_resource type="Script" path="res://scripts/dev/UnrelatedPreviewTool.gd" id="2"]', sceneProfiles), []);

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
const attackTrailRendererSource = fs.readFileSync(path.join(__dirname, "runtime", "xsxb_attack_trail_renderer.gd"), "utf8");
const attackTrailShaderSource = fs.readFileSync(path.join(__dirname, "runtime", "xsxb_attack_trail.gdshader"), "utf8");
assert.match(source, /frame_audio_bindings\.json/);
assert.match(source, /frame_image_attachments\.json/);
assert.match(source, /func animation_duration\(/);
assert.match(source, /func scene_scale\(/);
assert.match(source, /_character_scale\(\) \* scene_scale\(\)/);
assert.match(source, /size\.x\) \* sprite_scale_x/);
assert.match(source, /size\.y\) \* sprite_scale_y/);
assert.match(source, /func restart_frame_animation\(/);
assert.match(source, /attack_trails\.json/);
assert.match(source, /func trail_frame_arrival_time\(/);
assert.match(source, /func trail_quantized_animation_elapsed\(/);
assert.match(source, /var subdivisions := clampi\(roundi\(frame_duration/);
assert.match(source, /get_node_or_null\("AttackTrailsBehind"\)/);
assert.match(source, /func _apply_attack_trail_transform\(\)/);
assert.match(source, /var transform: Dictionary = _group_visual_transform\(_current_animation\)/);
assert.doesNotMatch(source, /get_node_or_null\("VisualOwner\/AttackTrailsBehind"\)/);
assert.match(attackTrailRendererSource, /const TRAIL_MESH_WIDTH_ROWS := 17/);
assert.match(attackTrailRendererSource, /const DEFAULT_PATH_COLUMNS := 20/);
assert.match(attackTrailRendererSource, /func _head_curve_profile\(/);
assert.match(attackTrailRendererSource, /point -= head_direction \* bulge/);
assert.match(attackTrailRendererSource, /return 1\.0 - sqrt\(maxf\(0\.0, 1\.0 - centered \* centered\)\)/);
assert.match(attackTrailRendererSource, /func _gradient_texture\(/);
assert.match(attackTrailRendererSource, /material\.set_shader_parameter\("use_gradient", color_mode == "gradient"\)/);
assert.match(attackTrailShaderSource, /texture\(trail_gradient, vec2\(1\.0 - UV\.y, 0\.5\)\)/);
assert.match(attackTrailRendererSource, /func _mesh_tail_distance\(/);
assert.match(attackTrailRendererSource, /const FINAL_HEAD_CAP_MARGIN_RATIO := 0\.25/);
assert.match(attackTrailRendererSource, /func _terminal_head_cap_blend\(/);
assert.match(attackTrailRendererSource, /uvs\.append\(Vector2\(u, v\)\)/);
assert.match(attackTrailRendererSource, /const TAIL_WIDTH_SPEED_INFLUENCE := 0\.18/);
assert.match(attackTrailRendererSource, /func _guard_tail_edge_progress\(/);
assert.match(attackTrailRendererSource, /var tuner_normal := Vector2\(-axis\.y, axis\.x\)/);
assert.doesNotMatch(attackTrailRendererSource, /axis\.orthogonal\(\)/);
assert.doesNotMatch(attackTrailRendererSource, /segment\.get\("collapsedWidth"/);
assert.match(attackTrailRendererSource, /"last_sample_time": -1\.0/);
assert.match(attackTrailRendererSource, /is_equal_approx\(float\(state\.get\("last_sample_time"/);
const attackTrailEditorSource = fs.readFileSync(path.join(__dirname, "animation_tuner", "public", "attack_trails.js"), "utf8");
assert.match(attackTrailEditorSource, /pixelStorei\(gl\.UNPACK_FLIP_Y_WEBGL, true\)/);
assert.match(attackTrailEditorSource, /const DEFAULT_PATH_COLUMNS = 20/);
assert.match(attackTrailEditorSource, /_savePreset\(name\)/);
assert.match(attackTrailEditorSource, /sticks: \[\]/);
assert.match(attackTrailEditorSource, /name: presetName/);
const tunerHtmlSource = fs.readFileSync(path.join(__dirname, "animation_tuner", "public", "index.html"), "utf8");
assert.match(tunerHtmlSource, /id="attackTrailNew"[^>]*>保存<\/button>/);
assert.match(tunerHtmlSource, /id="attackTrailPresetName"[^>]*maxlength="60"/);
const tunerAppSource = fs.readFileSync(path.join(__dirname, "animation_tuner", "public", "app.js"), "utf8");
const liteUiSource = fs.readFileSync(path.join(__dirname, "frame_tuner_lite", "public", "lite.js"), "utf8");
const liteServerSource = fs.readFileSync(path.join(__dirname, "frame_tuner_lite", "server.js"), "utf8");
const liteContractSource = fs.readFileSync(path.join(__dirname, "..", "skills", "xsxb-frame-tuner", "references", "lite-contract.md"), "utf8");
const liteImportFramesSource = fs.readFileSync(path.join(__dirname, "frame_tuner_lite", "import_frames.js"), "utf8");
const liteImportSheetSource = fs.readFileSync(path.join(__dirname, "frame_tuner_lite", "import_sheet.js"), "utf8");
assert.match(tunerAppSource, /window\.XsxbFrameTunerLite/);
assert.match(tunerAppSource, /function renderLiteExportFrame\(/);
assert.match(tunerAppSource, /function liteExportAudio\(/);
assert.match(tunerAppSource, /audio: \(phaseDurationMs, samples\) => liteExportAudio\(phaseDurationMs, samples\)/);
assert.match(tunerAppSource, /measureFrame:/);
assert.match(tunerAppSource, /options\.measureOnly === true/);
assert.match(tunerAppSource, /projectKind !== "frame_lite"/);
assert.match(liteUiSource, /透明序列导出/);
assert.match(liteUiSource, /id="litePhaseDurationMs"/);
assert.doesNotMatch(liteUiSource, /id="liteExportFps"/);
assert.match(liteUiSource, /导出 PNG 序列/);
assert.match(liteUiSource, /导出 Sheet \+ JSON/);
assert.match(liteUiSource, /重新计算全角色画布/);
assert.match(liteUiSource, /calculateOptimalLayout/);
assert.match(liteUiSource, /collectExportGroups/);
assert.match(liteUiSource, /packageAudioAssets/);
assert.match(liteUiSource, /audioMetadata/);
assert.match(liteUiSource, /if \(kind === "sequence"\) \{\s*await writeJson\(targetDirectory, "export\.json"/);
assert.match(liteUiSource, /sourceFrameIndex: frame\.sourceFrame/);
assert.match(liteUiSource, /getDirectoryHandle\("audio", \{ create: true \}\)/);
assert.match(liteUiSource, /showDirectoryPicker/);
assert.match(liteUiSource, /createWritable/);
assert.doesNotMatch(liteUiSource, /\/api\/lite\/export-file/);
assert.doesNotMatch(liteServerSource, /\/api\/lite\/export-file/);
assert.doesNotMatch(liteServerSource, /\/api\/lite\/export-complete/);
assert.match(liteServerSource, /saveFrameAudioBindings/);
assert.match(liteServerSource, /frameAudioBindings: data\.audio/);
assert.match(liteServerSource, /url\.pathname === "\/api\/frame-audio"/);
assert.doesNotMatch(liteServerSource, /Lite 不绑定音效/);
assert.match(liteContractSource, /portable audio files plus JSON events/);
assert.match(liteContractSource, /must not create a duplicate `export\.json`/);
assert.doesNotMatch(liteContractSource, /no audio/);
assert.doesNotMatch(liteImportFramesSource, /parseCanvas/);
assert.doesNotMatch(liteImportSheetSource, /parseCanvas/);
assert.deepEqual(frameEntries({ frames: [{ filename: "f2.png" }, { filename: "f10.png" }] }).map(([name]) => name), ["f2.png", "f10.png"]);
assert.deepEqual(frameEntries({ frames: { "f10.png": {}, "f2.png": {} } }).map(([name]) => name), ["f2.png", "f10.png"]);
assert.deepEqual(cropFromEntry({ frame: { x: 4, y: 7, w: 20, h: 30 } }), { x: 4, y: 7, width: 20, height: 30 });
assert.deepEqual(cropFromEntry({ crop: { left: 2, top: 3, width: 9, height: 11 } }), { x: 2, y: 3, width: 9, height: 11 });

const normalizedTrails = normalizeAttackTrails({
  bindings: {
    "hero/attack": [{
      layer: "front",
      colorMode: "original",
      tailFadeStart: 0.72,
      headCurvature: 0.65,
      texture: { path: "workspace/trail.png", hasEffectiveAlpha: true },
      sticks: [
        { id: "second", order: 9, frame: 2, framePhase: 0.75, directionOffset: 35, top: { x: 0, y: 0 }, bottom: { x: 0, y: 20 } },
        { id: "first", order: 2, frame: 2, framePhase: 0.25, layer: "behind", top: { x: 0, y: 0 }, bottom: { x: 0, y: 10 } },
      ],
    }],
  },
});
assert.equal(normalizedTrails.bindings["hero/attack"][0].sticks.length, 2);
assert.deepEqual(normalizedTrails.bindings["hero/attack"][0].sticks.map((stick) => stick.order), [0, 1]);
assert.deepEqual(normalizedTrails.bindings["hero/attack"][0].sticks.map((stick) => stick.framePhase), [1 / 3, 2 / 3]);
assert.deepEqual(normalizedTrails.bindings["hero/attack"][0].sticks.map((stick) => stick.layer), ["front", "behind"]);
assert.equal(normalizedTrails.bindings["hero/attack"][0].tailFadeStart, 0.72);
assert.equal(normalizedTrails.bindings["hero/attack"][0].headCurvature, 0.65);
assert.equal(normalizedTrails.bindings["hero/attack"][0].sticks[0].directionOffset, 35);
assert.equal(normalizedTrails.bindings["hero/attack"][0].sticks[1].directionOffset, 0);
assert.equal(normalizedTrails.bindings["hero/attack"][0].coordinateSpace, "group");
assert.equal(normalizedTrails.schemaVersion, 8);
assert.equal(normalizedTrails.bindings["hero/attack"][0].beforeStopChaseMultiplier, 0.5);
assert.equal(normalizedTrails.bindings["hero/attack"][0].afterStopChaseMultiplier, 2);
assert.equal(normalizedTrails.bindings["hero/attack"][0].gradientStops.length, 2);
assert.equal(normalizedTrails.presetTexture.name, "dynamic_trail_luma.png");
assert.equal(normalizedTrails.presetTexture.assetHash, "e2b855cdb3c59db8b4ed33f400b03bafd4af7df2636f3fd4d3eb68603763da90");
const reloadedTrails = normalizeAttackTrails(JSON.parse(JSON.stringify(normalizedTrails)));
assert.equal(reloadedTrails.bindings["hero/attack"][0].headCurvature, 0.65);
assert.equal(reloadedTrails.bindings["hero/attack"][0].sticks[0].directionOffset, 35);
assert.equal(normalizeAttackTrails({ bindings: { "hero/punch": [{ name: "Saved style", headCurvature: 0.8, color: "#ff8844" }] } }).bindings["hero/punch"][0].name, "Saved style");
assert.equal(normalizeAttackTrails({ presetTexture: { path: "workspace/custom.png", name: "custom.png" } }).presetTexture.path, "workspace/custom.png");
assert.equal(normalizeAttackTrails({ bindings: { "hero/attack": [{}] } }).bindings["hero/attack"][0].tailFadeStart, 0.6);
assert.equal(normalizeAttackTrails({ bindings: { "hero/attack": [{}] } }).bindings["hero/attack"][0].pathColumns, 20);
const savedStylePreset = normalizeAttackTrails({ bindings: { "hero/attack": [{ presetOnly: true, name: "Warm punch", texture: { path: "workspace/trail.png" }, color: "#ff8844", sticks: [] }] } });
assert.equal(savedStylePreset.bindings["hero/attack"][0].presetOnly, true);
assert.deepEqual(validateAttackTrails(savedStylePreset, { profiles: [{ id: "hero", animations: [{ id: "attack" }] }] }), []);
const migratedChase = normalizeAttackTrails({ bindings: { "hero/attack": [{ beforeStopChaseSpeed: 55, afterStopChaseSpeed: 1360 }] } }).bindings["hero/attack"][0];
assert.equal(migratedChase.beforeStopChaseMultiplier, 0.25);
assert.equal(migratedChase.afterStopChaseMultiplier, 4);
assert.equal("beforeStopChaseSpeed" in migratedChase, false);
assert.equal("afterStopChaseSpeed" in migratedChase, false);
const explicitChase = normalizeAttackTrails({ bindings: { "hero/attack": [{ beforeStopChaseMultiplier: 0.42, afterStopChaseMultiplier: 3.5 }] } }).bindings["hero/attack"][0];
assert.equal(explicitChase.beforeStopChaseMultiplier, 0.42);
assert.equal(explicitChase.afterStopChaseMultiplier, 3.5);
const migratedDefaultChase = normalizeAttackTrails({ schemaVersion: 5, bindings: { "hero/attack": [{ beforeStopChaseMultiplier: 0.7, afterStopChaseMultiplier: 2 }] } });
assert.equal(migratedDefaultChase.schemaVersion, 8);
assert.equal(migratedDefaultChase.bindings["hero/attack"][0].beforeStopChaseMultiplier, 0.5);
const gradientTrail = normalizeAttackTrails({ bindings: { "hero/gradient": [{
  colorMode: "gradient",
  color: "#123456",
  gradientStops: [
    { id: "top", position: 1, color: "#ffffff" },
    { id: "middle", position: 0.4, color: "#00ff88" },
    { id: "bottom", position: 0, color: "#220044" },
  ],
}] } }).bindings["hero/gradient"][0];
assert.equal(gradientTrail.colorMode, "gradient");
assert.deepEqual(gradientTrail.gradientStops.map((stop) => stop.position), [0, 0.4, 1]);
assert.deepEqual(gradientTrail.gradientStops.map((stop) => stop.color), ["#220044", "#00ff88", "#ffffff"]);
assert.equal(normalizeAttackTrails({ bindings: { "hero/legacy": [{ colorMode: "luma_tint" }] } }).bindings["hero/legacy"][0].colorMode, "solid");
const mixedPhaseSticks = normalizeAttackTrails({ bindings: { "hero/attack": [{ sticks: [
  { frame: 3, framePhase: 0.6, phaseMode: "manual" },
  { frame: 3, phaseMode: "auto" },
  { frame: 3, phaseMode: "auto" },
] }] } }).bindings["hero/attack"][0].sticks;
assert.deepEqual(mixedPhaseSticks.map((stick) => stick.framePhase), [0.6, 0.7333333333333333, 0.8666666666666667]);

function tinyPng(colorType, pixelBytes) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.from([0, ...pixelBytes]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
assert.equal(pngInfo(tinyPng(6, [255, 20, 30, 80])).hasEffectiveAlpha, true);
assert.equal(pngInfo(tinyPng(6, [255, 20, 30, 255])).hasEffectiveAlpha, false);
assert.equal(pngInfo(tinyPng(2, [255, 20, 30])).hasAlphaChannel, false);

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

const liteStoreTestRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xsxb-lite-store-test-"));
try {
  const liteStore = createLiteStore(liteStoreTestRoot);
  const project = liteStore.ensureProject("demo project", "Demo Project");
  assert.equal(project.id, "demo_project");
  assert.equal(project.kind, "frame_lite");
  assert.equal(liteStore.readRegistry().activeProjectId, "demo_project");
  const paths = liteStore.paths(project);
  assert.equal(fs.existsSync(paths.manifest), true);
  assert.equal(fs.existsSync(paths.tuning), true);
  assert.equal(fs.existsSync(paths.frameAudio), true);
  assert.deepEqual(liteStore.readJson(paths.frameAudio, null), []);
  assert.equal(fs.existsSync(paths.frameImageAttachments), true);
  assert.equal(fs.existsSync(paths.attackTrails), true);
  assert.equal(fs.existsSync(paths.settings), true);
  assert.equal(paths.workspaceDir.startsWith(path.resolve(liteStoreTestRoot)), true);
  const exportedAnimationDirectory = path.join(liteStoreTestRoot, "portable_export", "idle");
  const exportedAudioDirectory = path.join(liteStoreTestRoot, "portable_export", "audio");
  fs.mkdirSync(exportedAnimationDirectory, { recursive: true });
  fs.mkdirSync(exportedAudioDirectory, { recursive: true });
  const exportedAudio = path.join(exportedAudioDirectory, "hit.wav");
  fs.writeFileSync(exportedAudio, Buffer.from("RIFFportable-lite-audio", "ascii"));
  const importedAudioCount = importSheetAudio({
    project,
    profileId: "hero",
    animationId: "idle",
    animationType: "actor",
    outputPath: "workspace/lite/projects/demo_project/assets/hero/idle/sheet.png",
    jsonPath: path.join(exportedAnimationDirectory, "spritesheet.json"),
    liteStore,
    root: liteStoreTestRoot,
    source: {
      audio: {
        files: [{ id: "audio_1", name: "hit.wav", file: "../audio/hit.wav", type: "audio/wav" }],
        events: [{ outputFrame: 2, outputFrameIndex: 1, timeMs: 80, assetId: "audio_1", file: "../audio/hit.wav" }],
      },
    },
  });
  assert.equal(importedAudioCount, 1);
  const importedAudio = liteStore.readJson(paths.frameAudio, []);
  assert.equal(importedAudio.length, 1);
  assert.equal(importedAudio[0].frame, 1);
  assert.equal(importedAudio[0].animation, "hero/idle");
  assert.equal(importedAudio[0].type, "audio/wav");
  assert.equal(importedAudio[0].path.startsWith("workspace/lite/projects/demo_project/audio/"), true);
  assert.equal(fs.readFileSync(path.join(liteStoreTestRoot, ...importedAudio[0].path.split("/"))).subarray(0, 4).toString("ascii"), "RIFF");
} finally {
  const resolvedLiteStoreTestRoot = path.resolve(liteStoreTestRoot);
  const resolvedSystemTemp = path.resolve(os.tmpdir());
  assert.equal(resolvedLiteStoreTestRoot.startsWith(`${resolvedSystemTemp}${path.sep}`), true);
  fs.rmSync(resolvedLiteStoreTestRoot, { recursive: true, force: true });
}

console.log("XSXB self-tests passed.");
