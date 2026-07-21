# Tuner UI Contract

Read this reference only when changing the tuner UI, save payload, or direct-manipulation behavior.

## Transform Controls

- Keep one adjustment panel with mutually exclusive Character, Group, and Frame modes.
- Reuse Scale, Scale X/Y, Offset X/Y, and Rotation controls for the selected mode.
- Keep numeric fields as readouts plus step controls; preserve keyboard arrow stepping.
- Treat rapid repeated steps on the same numeric field and editing context as one undo transaction. Changing fields or context, or pausing between adjustments, starts a new transaction.
- Keep Undo in the canvas toolbar.
- Keep destructive reset actions out of the main adjustment panel unless explicitly requested.
- Keep single-frame duration on frame cards, not in the transform panel.
- Show group time only in Group mode.

## Timing Conflicts

- Group time and per-frame duration are alternative timing sources.
- When changing frame duration while group time exists, confirm, initialize every frame from the current average playable-frame duration, and clear group time before applying the requested frame delta.
- When changing group time while frame-duration overrides exist, confirm, use the current effective total duration as the group-time starting point, and clear frame durations without jumping back to the imported total duration.
- Disabled state is not itself a duration override.

## Frame SFX

- Put SFX on frame cards, not the transform panel.
- Accept audio drag/drop on a frame card.
- Show a compact speaker marker for bound SFX.
- Confirm deletion; replace the old binding when a new audio file is dropped.
- Persist both new data bindings and existing path-only bindings across Save and reload.
- Treat browser IndexedDB as a blob cache only; it must not recreate deleted or cross-project bindings.

## Image Attachments

- Put attachments in the owner frame's card stack.
- Default new attachments above the owner.
- Use card order as `layerOrder`; cards below the owner render below it and cards above render above it.
- Reorder by dragging into card gaps, not onto another card.
- Select an attachment for Frame-mode editing without merging it into the owner sprite.
- Support copy/paste between frames in the same project while preserving local transform and layer order.
- Allow direct manipulation only when the attachment image itself is hit.
- Drag to move; hold R plus wheel to rotate; hold Z plus wheel to scale.
- Keep owner sprite manipulation in adjustment controls, not canvas gestures.
- Apply the same owner/attachment transform formula in preview and Godot runtime.

## Attack Trail Mode

- Attack trails are independent profile/animation bindings stored in `attack_trails.json`; never store their sticks as collision boxes or ordinary frame-image attachments.
- Hide this mode for Codex Pets projects. Normal Godot projects expose segment, texture, color, chase, layer, and ordered-stick controls.
- Store stick endpoints in the same stable character/frame-local coordinates used by the runtime `VisualOwner`. Each stick records a zero-based frame and `framePhase`.
- Use the existing frame playback resolver for preview time. The first stick defines local time zero, the last stick ends hard-edge motion, and frames outside that interval must not affect the path clock.
- Luma tint preserves source luminance and alpha. Original-color mode requires a PNG with effective transparency; sampling a color must read the current sprite source pixel, not the composited editor canvas.

## Boxes

- Show hurtbox, hitbox, and collisionbox as distinct selectable overlays.
- Drag a box body without Alt to move it.
- Hold Alt and drag handles to reshape; while Alt is held, box-body movement is disabled.
- Keep collisionbox Y and rotation fixed by the grounded rule.
- Do not expose numeric box fields as the primary editing UI.
- Do not let clear-frame or clear-group transform actions delete box overrides.
- Keep box editing independent from sprite movement.

## Reference and Labels

- Show `Hold H to hide reference` while a reference overlay is active.
- Keep frame-card labels short; move filenames and paths to tooltips or debug metadata.
- Preserve direct visual comparison between tuner and runtime rather than adding one-off preview corrections.

## Self-Update

- Check the official GitHub `main` branch once after the tuner page opens; do not block project loading on the network request.
- Hide update controls when the local commit already matches GitHub.
- When an update exists, show the current and latest short commit IDs and one explicit Update and restart action.
- Disable update while tuner edits are unsaved.
- Never overwrite tracked local code changes, update a non-`main` branch, or trust a remote outside the official XSXB repository.
- Update the tuner clone and installed `xsxb-frame-tuner` skill as one operation, then restart the local server and reconnect the page.

## Codex Pets Project

- Show the auto-managed Codex Pets project in the normal project selector; show profiles as pets and groups as states.
- Hide Godot-only scene scale and gameplay box panels in this project.
- Render each atlas cell as an isolated `192x208` frame even though several frames share one WebP path.
- Keep v1 animation timing visible but read-only; expose the 16 v2 look-direction cells as one `looking` group.
- Show Import new pet only for this project and accept only `1536x1872` v1 or `1536x2288` v2 WebP atlases.
- Built-in pets are read-only. Save may retain their Tuner transforms, but only custom pets may be baked back into Codex storage.
