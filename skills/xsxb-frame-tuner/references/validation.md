# Validation Gates

Do not report success from syntax checks or generated files alone. Validate the user-visible integration.

## Deterministic Checks

Run from the tuner root:

```powershell
npm run check
npm test
node "tools\validate_import.js" --project <xsxb_project_id> --project-root "<godot_project_root>" --require-gameplay --strict
```

Treat validator warnings as incomplete work. Inspect and fix the cause; do not merely suppress the warning.

## Import and Data Gate

- Requested animation count equals imported animation count.
- Every source folder's PNG count equals both standalone and game-local manifest counts.
- Every game-local frame path exists under the Godot project.
- No runtime frame path points to Downloads, temp, or the standalone tuner workspace.
- Existing tuned animations remain unchanged when adding a new group.
- Replaced animations contain no stale frame-index overrides.

## Visual Box Gate

Automated presence checks are insufficient.

- Inspect representative frames from every group after import.
- Confirm saved hurtbox and collisionbox on every actor frame.
- Confirm collisionbox bottom remains on the floor line.
- Confirm attack groups have saved hitbox entries and plausible enabled active frames.
- Confirm weapons, trails, tails, cloth, shadows, and alpha noise do not inflate body boxes.
- Confirm visual movement never depends on box offsets.

## Transform Regression Gate

Verify preview and runtime at representative scale values:

- Character scale: 0.5 and 2.0
- Group scale: one non-default value
- Frame scale: one non-default value
- Scene scale: 0.5 and 2.0
- Horizontal facing: both directions

For each case, confirm:

- sprite, hurtbox, hitbox, and collisionbox scale by the same expected axes
- saved box-local values do not change merely because an outer scale changes
- collisionbox bottom stays grounded
- visual offset and box offset remain independent local concepts
- attachment origin, scale, rotation, and layer match the tuner

## Runtime Gate

- An actual gameplay scene instantiates or extends the generated runtime actor.
- Repeated calls to the same looping animation advance frames.
- One-shot actions restart only through an explicit restart path.
- Gameplay action locks consume runtime animation duration.
- Gameplay movement consumes runtime scene scale.
- Gameplay movement collision consumes runtime collisionbox.
- Gameplay attack resolution consumes runtime hitbox and hurtbox.
- Source facing matches the inspected art.

## SFX and Attachment Gate

When bindings exist:

- game-local keys are stable and paths are `res://`
- every copied asset exists
- SFX plays once on frame entry, including skipped-fast-frame cases
- a looped visit can play the same SFX again
- attachment layer order, owner inheritance, and local transform match preview

When bindings are empty, confirm the files and runtime readers still exist so the user can add bindings later without another code patch.

## Godot Execution

When a Godot executable is available, run a headless parse/smoke test plus a playback probe covering one looping and one one-shot animation. If unavailable, report static-only verification and name the unrun probes.

## False-Pass Rules

Do not accept these as proof of completion:

- runtime files merely exist
- `xsxb_runtime_test.tscn` opens
- a function named `scene_scale()` or `animation_duration()` exists but gameplay never calls it
- box entries exist but were not visually inspected
- `/api/config` has no warnings while the gameplay scene is not wired
- JavaScript syntax checks pass
