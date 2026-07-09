---
name: xsxb-frame-tuner
description: Add or wire Godot game characters and frame animations through XSXB Frame Tuner. Use when the user asks to add a character, add an animation/action, import PNG frame sequences or SpriteFrames, connect an actor to a Godot runtime, make tuner/game playback WYSIWYG, tune frame boxes/SFX/attachments, or says 添加角色, 添加动画, 新动作, 接入角色, 接入 tuner, 接入 XSXB, 帧动画调参.
---

# XSXB Frame Tuner

Use this skill to connect frame-based Godot characters to XSXB Frame Tuner, import or replace animations, and keep the tuner preview and Godot runtime on the same data.

## Core Contract

Keep visual playback, boxes, frame timing, SFX, and image attachments data-driven from the same XSXB files.

```text
final scale = Character Base * Group Base * Frame Base
final offset = Character Base offset + Group Base offset + Frame Base offset
final rotation = Character Base rotation + Group Base rotation + Frame Base rotation
```

- Character Base is actor/profile-wide scale, offset, and rotation.
- Group Base is animation/action-level scale, offset, rotation, and timing.
- Frame Base is per-frame visual overrides, disabled state, timing, and boxes.
- Do not hide mismatches with runtime-only offsets, runtime-only scale constants, or one-off preview corrections.

## Locate the Tool

Resolve the XSXB Frame Tuner root before editing or importing:

1. If the current workspace contains `tools/animation_tuner/server.js`, use the current workspace.
2. If the user gives a tuner root, use it.
3. If the tool is missing, clone or ask the user to clone `https://github.com/sparklecatta-lang/XSXB-Frame-Tuner`, then use that clone as the tuner root.

Do not hard-code personal machine paths. Store project-specific data only under the selected tuner root and the target Godot project.

## Data Isolation

Treat every Godot project as a separate XSXB project unless the existing XSXB project entry is already bound to the exact same Godot project root.

- Never import a real Godot project into a generic/default placeholder.
- Do not copy numeric tuning, box values, scene scale, profile IDs, or project IDs from another game unless the user explicitly asks to clone that project.
- When replacing a whole animation, remove stale overrides for that animation unless the user asks to preserve existing tuning.
- Keep source frame assets in stable project folders, not Downloads or temp paths.

## Required Workflow

1. Inspect the target Godot project and source frames before editing. Find existing SpriteFrames, character scenes, runtime scripts, manifests, tuning files, and relevant tests.
2. Select or create the correct XSXB project. If a Godot root is provided, bind the XSXB project to that root.
3. Decide whether the request is a new character/profile, a new animation on an existing profile, or a replacement animation.
4. Import frames into the selected XSXB project and, when bound to Godot, sync the same assets and data into `res://xsxb_frame_tuner/`.
5. Create or preserve tuning data across all needed layers: Character Base, Group Base, and Frame Base.
6. Add rough saved boxes for actor frames. Living actors need `hurtbox` and `collisionbox`; attack-like actions also need `hitbox`.
7. Wire or refresh the Godot runtime so it reads the same manifest, tuning, playback overrides, frame audio bindings, and image attachments that the tuner saves.
8. Validate with focused checks before reporting success.
9. Start the tuner only after import/sync succeeds. If it is already open, tell the user to refresh the animation list.

## Internal Commands

Use commands from the resolved tuner root. These are agent-facing helpers, not the primary user workflow.

```powershell
node "<tuner_root>\tools\import_frames.js" --project <xsxb_project_id> --project-root <godot_project_root> --profile <profile_id> --animation <animation_id> --source <png_folder> --fps <fps> --replace
```

```powershell
node "<tuner_root>\tools\import_spriteframes.js" --project-root <godot_project_root> --project <xsxb_project_id> --all
```

```powershell
$env:PORT="5179"; node "<tuner_root>\tools\animation_tuner\server.js"
```

## Box Rules

- `hurtbox` is the actor's vulnerable body area. Fit the body mass, not weapons, large VFX, or loose cloth silhouettes.
- `hitbox` is the active attack/guard/projectile area. Add it by default only for attack-like animations such as `stand_attack`, `run_attack`, `jump_attack`, `air_attack`, parry, counter, skill, or projectile launch.
- `collisionbox` is the grounded physical footprint. Keep its bottom edge on the floor line and store its Y offset as `-height / 2`.
- Box offsets are gameplay data, not sprite alignment data. Runtime visuals must not use `collisionbox`, `hurtbox`, `hitbox`, `collision_offset`, or box offsets to position the sprite.
- Estimate boxes per animation group from that group's own source canvas and anchor. Do not reuse another group's canvas, scale, or offsets as numeric truth.

## Playback, SFX, and Attachments

- Runtime playback must respect group timing overrides from `frame_playback_overrides["<profile>/<animation>:__group"]`.
- Repeated calls to play the same looping animation must not reset to frame 0. Add an explicit restart path for one-shot actions.
- Frame SFX support is mandatory for imported actor runtimes, even if `frame_audio_bindings.json` is empty at import time.
- Frame image attachment support is mandatory for imported actor runtimes, even if `frame_image_attachments.json` is empty at import time.
- Runtime lookup for SFX and attachments must accept stable keys like `<profile>/<animation>:<source_frame_index>` or top-level `animation` plus `frame`; do not depend only on full source-heavy paths.

## Runtime Rules

- Godot runtime files should read game-local data from `res://xsxb_frame_tuner/`, not from the standalone tuner directory.
- Save from the tuner is the synchronization point. After Save, the Godot project should have the same manifest, tuning, frame audio bindings, image attachments, copied frame assets, copied audio, copied attachment images, and runtime support.
- Scene scale belongs in `scene_settings` and must multiply visuals, boxes, and runtime-controlled movement values. Do not bake scene scale into per-frame tuning.
- When horizontally flipping a character, mirror visual X offset, source-anchor displacement, box X offsets, and rotation by the facing sign.
- Godot 4 scripts should use explicit types for loaded textures, resources, and audio streams. Avoid risky inferred loads such as `var texture := load(path)`.

## Validation

Run the smallest relevant checks first:

```powershell
node --check "<tuner_root>\tools\animation_tuner\server.js"
node --check "<tuner_root>\tools\animation_tuner\public\app.js"
node --check "<tuner_root>\tools\import_frames.js"
node --check "<tuner_root>\tools\import_spriteframes.js"
node --check "<tuner_root>\tools\godot_sync.js"
node --check "<tuner_root>\tools\godot_runtime.js"
```

For a Godot import/sync, also verify:

- standalone and game-local manifests have matching profiles, animation IDs, and frame counts
- every game-local frame path exists under the Godot project
- imported actor frames have saved `hurtbox` and `collisionbox` entries
- attack-like animations have saved `hitbox` entries
- tuner `/api/config?project=<xsxb_project_id>` loads without runtime-interface warnings
- at least one gameplay scene instantiates or extends the generated XSXB runtime actor when gameplay wiring is part of the request
- runtime visual alignment does not depend on box offsets
- repeated play calls for the current looping animation advance frames instead of resetting
- SFX and image attachment readers exist even when their binding files are currently empty

If Godot is unavailable, report which static checks passed and which runtime checks could not be executed.

## Final Response

Report only what matters:

- copied/imported frame destination and count
- manifest, tuning, runtime, SFX, and attachment files changed
- validation commands that passed
- what remains adjustable in XSXB Frame Tuner

If something could not be verified, say so plainly.
