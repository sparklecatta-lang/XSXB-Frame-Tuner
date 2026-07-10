# Godot Runtime Contract

## Save and Sync Boundary

Treat tuner Save as the synchronization point. The bound Godot project must receive and consume:

- `animation_manifest.json`
- `animation_tuning.json`
- `frame_audio_bindings.json`
- `frame_image_attachments.json`
- copied frame PNGs
- copied audio and attachment assets
- `runtime/xsxb_frame_actor.gd`
- `runtime/xsxb_frame_actor.tscn`
- `runtime/xsxb_runtime_test.tscn`

Read game data only from `res://xsxb_frame_tuner/`. Never make the game depend on the standalone tuner clone.

## Gameplay Wiring

- For actor imports, connect an actual gameplay scene or actor to `xsxb_frame_actor.tscn` or extend `xsxb_frame_actor.gd` unless the user explicitly requests tuner-only import.
- A generated runtime test scene proves data loading only; it does not prove gameplay integration.
- Map gameplay state names to stable XSXB animation IDs.
- Route movement collision through runtime collisionbox interfaces.
- Route attacks through runtime hitbox versus target hurtbox data instead of fixed attack ranges.
- Keep runtime child collision disabled only when the host gameplay actor intentionally owns and synchronizes the physical body shape.

## Playback and Timing

- Read group timing from `frame_playback_overrides["<profile>/<animation>:__group"]` before manifest FPS.
- Respect disabled frames and per-frame duration overrides.
- Repeated `play_frame_animation()` calls for the same looping animation must not reset frame zero.
- Use an explicit restart argument or `restart_frame_animation()` for one-shot actions.
- Use `animation_duration()` or `current_animation_duration()` for attack locks, startup, dash, slide, recovery, and state transitions. Fixed tables are fallback-only.

## Frame SFX

- Keep SFX runtime support present even when `frame_audio_bindings.json` is empty.
- Use stable keys such as `<profile>/<animation>:<source_frame_index>` or top-level animation plus frame fields.
- Copy audio into the Godot project and save a `res://` path.
- Trigger SFX once when entering the bound frame, not on every process tick.
- Allow the same frame's SFX to trigger again on a later loop visit.
- Preserve path-only bindings across page reloads and later Saves.

## Image Attachments

- Keep attachment runtime support present even when `frame_image_attachments.json` is empty.
- Deduplicate image files by content hash while keeping each layer instance as separate binding data.
- Use stable frame keys and game-local `res://` paths.
- Measure local attachment offset from the owner sprite origin.
- Inherit owner Character/Group/Frame scale, non-uniform axes, scene scale, rotation, and facing.
- Apply attachment local scale to image size only; local scale must not shift the anchor.
- Add local rotation to owner rotation and mirror it with facing.
- Sort by `layerOrder`, with negative values below and positive values above the owner; use legacy `layer` only as fallback.
- Keep attachments visual-only unless a future explicit feature supplies separate gameplay boxes.

## Scene Scale and Box Scaling

- Store scene scale in `scene_settings["res://path/to/scene.tscn"].scale`; default to 1.
- Do not bake scene scale into Character, Group, Frame, or saved box values.
- Compute final visual scale as Character × Group × Frame × Scene.
- Multiply box size and local box offset by the same X/Y visual axes and scene scale used by the sprite.
- Apply Character, Group, and Frame rotation and facing consistently to hit/hurt boxes.
- Keep grounded collisionbox rotation at zero and its bottom edge on the actor origin even when visual Y offset changes.
- Scale runtime-controlled speed, distance, jump velocity, gravity, and terminal velocity through `scene_scale()` so the gameplay world remains proportional.

## Facing

- Inspect an upright source frame before setting `source_faces_left` or inversion behavior.
- Logical right input must render right; logical left input must render left.
- Mirror visual X offset, source-anchor displacement, box X offset, attachment X offset, and rotation by the same facing sign.

## Godot Typing

Use explicit Godot 4 types for loaded assets:

```gdscript
var texture: Texture2D = load(path) as Texture2D
var stream: AudioStream = ResourceLoader.load(path, "AudioStream") as AudioStream
```

Avoid inferred asset loads such as `var texture := load(path)` and untyped loader return values.
