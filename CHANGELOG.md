# Changelog

## 0.3.0 - 2026-07-22

### Features

- Add the isolated Frame Tuner Lite workflow for PNG sequences and JSON sprite sheets, with stable local imports, layered animation editing, shared attack-trail tools, and no Godot or audio binding.
- Export every primary animation in the current Lite character as transparent PNG sequences or re-importable Sprite Sheet + JSON packages, using one automatically measured character-wide canvas and a user-selected destination.
- Save edited attack-trail textures, color treatments, curvature, and motion settings as new named presets without overwriting the bundled default or copying stick paths.
- Add Full and Lite BAT launchers plus a shared single-service launcher suitable for icon-bearing Windows desktop shortcuts.

### Fixes

- Declare UTF-8 for every Full and Lite HTML, CSS, JavaScript, JSON, and text response so Chinese controls such as the trail texture selector cannot be decoded as mojibake.
- Add strict UTF-8 and mojibake regression checks for both web interfaces.

### Documentation

- Document Lite isolation, import formats, character-wide export behavior, launchers, validation, and the compressed attack-trail demonstration embedded in the README.

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
