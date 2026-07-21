# Changelog

## 0.2.0 - 2026-07-21

### Features

- Add a complete editable attack-trail workflow with multiple segments, ordered per-frame sticks, draggable width and tangent handles, per-stick front/behind layering, head curvature, tail retraction, and frame-timing synchronization.
- Add solid, gradient, and original-color texture modes with live preview, stable texture copying, persistent presets, and Godot runtime synchronization.
- Bundle the default `dynamic_trail_luma.png` preset so a new animation can preview a trail before importing a custom texture.
- Add Codex Pets atlas discovery, import, read-only bundled-pet handling, and safe custom-pet writeback.
- Add desktop shortcut artwork and scene-aware profile filtering.

### Performance

- Quantize runtime trail updates to frame-animation timing and use a balanced default smoothness of 20 to reduce mesh rebuild stalls.
- Preserve effective playback duration when switching between group-time and per-frame-time editing.

### Documentation

- Document attack-trail authoring, the bundled preset, local-data isolation, runtime synchronization, and the public demonstration video.
