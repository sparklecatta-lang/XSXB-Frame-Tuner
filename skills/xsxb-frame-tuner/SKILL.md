---
name: xsxb-frame-tuner
description: Batch-import PNG folders or Godot SpriteFrames into XSXB Frame Tuner, use the isolated Lite edition for non-game frame-sequence and sprite-sheet work, wire complete playable Godot runtimes, and manage Codex Pets. Use for character/animation import, layered sequence export, attack trails, transparent sprite sheets, gameplay wiring, boxes/SFX/attachments, Codex pet tuning, or requests mentioning 添加角色, 接入 tuner, lite版, 序列帧, 多图层, or 宠物图集.
---

# XSXB Frame Tuner

Deliver the complete user-visible result from a natural-language request. Do not require the user to run importer commands or enumerate internal data files.

## Required References

For every actor import, animation import, replacement, or gameplay wiring task, read all three references before editing:

- [references/import-contract.md](references/import-contract.md) for batch grouping, project isolation, anchors, initial scale, and box generation.
- [references/runtime-contract.md](references/runtime-contract.md) for gameplay wiring, playback, SFX, image attachments, scene scale, facing, and box transforms.
- [references/validation.md](references/validation.md) for completion gates and commands.

When modifying the tuner web UI or save payload, also read [references/ui-contract.md](references/ui-contract.md).

For non-Godot sequence work or Frame Tuner Lite tasks, read [references/lite-contract.md](references/lite-contract.md). The Godot completion contract below does not apply to Lite; the isolation and validation rules in the Lite contract replace it.

## Frame Tuner Lite

Choose Lite when the requested deliverable is transparent PNG frames or a sprite sheet rather than a wired game runtime. It reuses the editor's timing, transforms, collision-box metadata, image layers, and attack trails, but deliberately excludes audio, Godot sync, and gameplay validation.

The Agent must import all source material without changing its source canvas, copy it into stable Lite paths, validate the isolated project, start the Lite service, and exercise a real browser export. Calculate one uniform canvas for the current character only when exporting, after all of that character's groups and visible layers have been measured. Do not ask the user to run the importer manually. Do not alter the Full Tuner project registry or active Godot project.

## Codex Pets Project

The Tuner automatically maintains one `codex_pets` project. Treat it as a non-Godot project with these rules:

- Discover current built-in pets from the installed Codex app and custom pets from `${CODEX_HOME:-$HOME/.codex}/pets`.
- Support both v1 `1536x1872` atlases (8 columns × 9 animation rows) and v2 `1536x2288` atlases (the same 9 rows plus 16 look-direction cells across rows 9-10).
- Keep built-in pets read-only. Tuner-only transforms may be saved, but never write into the installed Codex app package.
- Save custom pet transforms back into its fixed-cell `spritesheet.webp`; preserve the first pre-Tuner source as `spritesheet.xsxb-backup.webp`.
- A pet created externally by Hatch Pet must appear after Refresh without a manual XSXB import. The web UI may also import a conforming WebP and create `pet.json` plus `spritesheet.webp` together.
- Do not run Godot runtime generation, gameplay validation, box generation, scene scanning, SFX sync, or attachment sync for the Codex Pets project.

## Completion Contract

Treat a request such as “add these animation folders to this character” as authorization to complete the entire in-scope local integration. Unless the user explicitly asks for tuner-only import, success requires all of the following:

1. Import every requested animation into one correctly bound XSXB project and profile.
2. Copy every frame into stable tuner-local and Godot-local asset paths.
3. Save `hurtbox` and `collisionbox` for every actor frame; save `hitbox` for every attack-like frame entry with plausible active-frame enablement.
4. Visually inspect representative frames from every animation group and correct heuristic boxes that include weapons, VFX, tails, cloth, empty canvas, or alpha noise as body mass.
5. Generate or refresh the complete Godot runtime, including playback, boxes, SFX, image attachments, duration, facing, and scene-scale interfaces.
6. Connect at least one actual gameplay scene or gameplay actor to the generated runtime. The generated runtime test scene alone does not count.
7. Keep tuner preview, saved data, and Godot playback on the same Character/Group/Frame transform and timing data.
8. Run deterministic validation and relevant Godot checks. Treat warnings as incomplete work, not success.
9. Start the tuner only after import, sync, gameplay wiring, and validation succeed.

Do not silently downgrade to “frames copied” or “runtime generated.” Report a partial result only when a concrete blocker remains.

## Locate the Tool

Resolve the XSXB Frame Tuner root in this order:

1. Use the current workspace when it contains `tools/animation_tuner/server.js`.
2. Use a tuner root explicitly supplied by the user.
3. Locate an existing clone of `https://github.com/sparklecatta-lang/XSXB-Frame-Tuner`.
4. If no clone exists and local cloning is within the request's authority, clone it to a stable user-selected tools directory. Ask only when the destination materially matters.

Never hard-code personal machine paths. Store project bindings in `data/projects.json`, not in this skill.

## Resolve the Request

Infer safe inputs from the request and project before asking questions:

- target Godot project root
- new or existing XSXB profile
- one or many animation folders or `.spriteframes.tres` resources
- animation IDs, labels, FPS, actor/VFX type, and replacement intent
- gameplay actor/scene that must consume the runtime

Ask only when guessing could bind the wrong Godot project, overwrite a tuned animation, or change gameplay semantics. Multiple animation paths in one message are one batch, not separate future tasks.

## Required Workflow

1. Inspect the Godot project, source folders, representative frames, existing XSXB registry, manifests, tuning, gameplay scenes/scripts, and tests.
2. Select or create one XSXB project bound to the exact target Godot root. Never reuse an ID bound to another project.
3. Select or create one profile for the character. Preserve existing profile and animation IDs when tuning already exists.
4. Import all requested groups:
   - Use `tools/import_batch.js` for two or more PNG folders.
   - Use `tools/import_frames.js` for one PNG folder.
   - Use `tools/import_spriteframes.js --all` for a Godot project or SpriteFrames batch.
5. Confirm imported group count, animation IDs, per-group frame counts, FPS, anchor modes, and game-local frame paths.
6. Perform per-group visual QA. Inspect at least one representative neutral/movement frame and every materially different attack/action phase. Correct saved boxes when the heuristic result is not playable.
7. Inspect source facing from an upright frame and set gameplay-facing behavior accordingly. Do not infer facing from filenames.
8. Wire the generated XSXB actor into actual gameplay. Route animation state, action duration, collision, hit/hurt queries, movement scale, SFX, and attachments through runtime interfaces.
9. Run `tools/validate_import.js` with `--require-gameplay --strict`, then run available Godot headless/smoke checks.
10. Start or reuse the tuner server. If already open, tell the user to refresh the animation list.

## Agent-Facing Commands

Run commands from the resolved tuner root. For several PNG groups, place global options before the first `--animation` block:

```powershell
node "<tuner_root>\tools\import_batch.js" --project-root "<godot_project_root>" --project <xsxb_project_id> --profile <profile_id> --label "<character_label>" --replace `
  --animation idle --source "<idle_png_folder>" --fps 12 `
  --animation run --source "<run_png_folder>" --fps 12 `
  --animation stand_attack --source "<attack_png_folder>" --fps 12
```

For one PNG group:

```powershell
node "<tuner_root>\tools\import_frames.js" --project <xsxb_project_id> --project-root "<godot_project_root>" --profile <profile_id> --animation <animation_id> --source "<png_folder>" --fps <fps> --replace
```

For SpriteFrames:

```powershell
node "<tuner_root>\tools\import_spriteframes.js" --project-root "<godot_project_root>" --project <xsxb_project_id> --all
```

Validate the complete integration:

```powershell
node "<tuner_root>\tools\validate_import.js" --project <xsxb_project_id> --project-root "<godot_project_root>" --require-gameplay --strict
```

Start the tuner:

```powershell
$env:PORT="5179"; node "<tuner_root>\tools\animation_tuner\server.js"
```

The web tuner checks the official GitHub `main` branch once when the page opens. When an update is available, its update button fast-forwards the clean local clone, atomically replaces the installed `xsxb-frame-tuner` skill with the bundled copy, restarts the local server, and reconnects the page. Never work around an update block caused by an untrusted remote, a non-`main` branch, or tracked local changes; preserve the user's work and resolve that condition explicitly.

## Non-Negotiable Data Rules

- Keep every Godot project isolated by exact project root.
- Keep source assets in stable folders; never leave runtime paths pointing to Downloads or temp directories.
- Preserve tuned data when adding a new animation. Remove stale animation-prefixed overrides only when replacing that whole animation.
- Use `canvas_bottom_center` for grounded actors unless the existing project intentionally uses another authored anchor.
- Keep collision, hit, and hurt boxes as local gameplay data. Never use box offsets to position the sprite.
- Apply Character, Group, Frame, facing, and scene scale to visuals and boxes through the same outer transform.
- Keep frame SFX and image-attachment support present even when their binding files are empty at import time.
- Keep action timing derived from XSXB playback data; fixed timing constants are fallback-only.

## Validation Summary

Before reporting success, verify at minimum:

- requested animation count and total frame count match the sources
- standalone and game-local manifests match by profile, animation, and frame count
- every actor frame has valid saved hurtbox and collisionbox data
- every attack-like frame entry has saved hitbox data and visually plausible active frames
- tuner and runtime scale boxes proportionally at Character, Group, Frame, and scene levels
- game-local audio and attachment bindings use stable `<profile>/<animation>:<frame>` keys and `res://` assets
- runtime plays SFX once per frame entry and can replay it on later loop visits
- image attachments inherit owner transform, facing, scene scale, and layer order
- gameplay uses runtime animation duration, scene scale, collisionbox, hitbox, and hurtbox interfaces where applicable
- an actual gameplay scene uses the generated actor
- `/api/config?project=<id>` and `validate_import.js --strict` report no warnings

If Godot cannot run, state exactly which runtime checks remain unverified.

## Final Response

Report:

- imported profile, animation IDs, per-group counts, and total frame count
- tuner-local and Godot-local destinations
- manifest, tuning, runtime, SFX, attachment, and gameplay files changed
- deterministic and Godot validation that passed
- any remaining manual artistic box tuning

Do not present internal scripts as work the user still needs to perform.
