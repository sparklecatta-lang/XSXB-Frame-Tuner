# Import and Box Contract

## Batch Request Parsing

- Treat every animation path in one user message as one batch for one target character unless the user explicitly separates projects or characters.
- Build a complete animation table before importing: source folder, animation ID, label, FPS, type, anchor, loop/one-shot gameplay intent, and replace/add mode.
- Preserve explicit animation IDs. Otherwise derive stable IDs from folder names and translate semantic action names when necessary so attack detection remains reliable.
- Default FPS to 12 only when neither the user nor an existing SpriteFrames resource provides it; report that assumption.
- Keep one XSXB project and one profile across the whole batch. Do not create one project/profile per folder.
- Preflight every folder and PNG count before writing. Stop before import when a source folder is missing, empty, duplicated, or maps to a duplicate animation ID.

## Project and Data Isolation

- Bind an XSXB project to exactly one Godot project root.
- Reuse a project ID only when its stored root matches the target root.
- Reuse a profile only when it is the intended character in that project.
- Treat other projects as schema references only. Never copy their numeric tuning, boxes, scene settings, IDs, paths, or gameplay assumptions.
- Pass both `--project` and `--project-root` when the ID is known.
- After import, verify `data/projects.json`, the runtime project ID, and the target root agree.
- Copy only source PNGs; never copy Godot `.import` files as authored assets.

## Add and Replace Semantics

- Adding a new animation must preserve all existing animations and tuned overrides.
- Replacing a whole animation must replace its frame directory and clear stale visual, playback, and box overrides for that animation prefix unless the user explicitly asks to preserve compatible tuning.
- Re-importing an existing animation without explicit replace intent must not silently destroy user-adjusted boxes.
- Keep animation IDs stable after tuning exists. Map gameplay names explicitly when they differ.

## Anchors and Initial Scale

- Use `canvas_bottom_center` for grounded actors. Different blank canvas sizes do not justify switching to left-bottom anchoring.
- Compute each animation group's box baseline from that group's own source canvas and anchor.
- Use `canvas_left_bottom` only for an explicitly authored prop, scene, or VFX workflow.
- Estimate initial Character Base scale from the target Godot scene or viewport and the visible actor height. Do not import a large source canvas at 1:1 size.
- Store uniform Character Base scale in `visual_size`. Remove a redundant uniform `visual_scale` that would override it.
- Keep Group Base identity unless the source or project requires a group-level correction. Put action-specific corrections in Group or Frame Base, never hidden importer offsets.

## Mandatory Visual QA

The importer creates a deterministic first pass from PNG alpha bounds. Treat it as a starting point, not visual truth.

For every animation group:

1. Inspect at least one representative frame.
2. Inspect additional frames whenever pose, canvas, weapon reach, VFX, or body footprint changes materially.
3. Confirm the floor/foot origin and source facing.
4. Confirm the body mass excludes weapons, attack trails, loose cloth, tails, and faint alpha noise.
5. Correct saved boxes in `animation_tuning.json` when the heuristic result is not playable.

## Box Rules

- Save `hurtbox` and `collisionbox` for every actor frame.
- Fit `hurtbox` to vulnerable body mass, not the complete opaque silhouette.
- Fit `collisionbox` conservatively to the grounded body footprint. Store `offset.y = -height / 2`, keep rotation at zero, and preserve the floor line.
- Save `hitbox` entries for attack, parry/counter, projectile, and skill animations. Enable only plausible active frames.
- Recognize semantic attacks even when folders use Chinese or nonstandard names. Rename/mapping to stable IDs when needed.
- Do not add enabled hitboxes to idle, walk, run, ordinary jump, landing, hurt, death, or talk animations unless requested.
- Store box values in source-local coordinates. Do not bake Character, Group, Frame, or scene scale into saved box size or offset.
- Never use box offsets for sprite alignment.

## Batch Completion Evidence

Record and verify:

- requested group count versus imported group count
- source PNG count versus tuner manifest count versus game-local manifest count for every group
- animation IDs, FPS, anchor modes, and source facing
- saved box entry count versus actor frame count
- attack groups and active hitbox coverage
- stable tuner-local and `res://xsxb_frame_tuner/` paths
