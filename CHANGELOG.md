# Changelog

## Unreleased

### Features

- Add portable frame-bound SFX to Frame Tuner Lite exports and restore those bindings when a Lite sprite sheet is imported again.
- Replace Lite export FPS with a maximum trail-phase duration so authored group and per-frame milliseconds remain the only timing authority.

### Fixes

- Keep every playable source frame in Lite output while deriving additional trail samples only from its real duration, independent of stick count or saved stick phases.
- Avoid floating-point over-sampling at exact duration boundaries and distribute integer Sheet durations without changing the animation total.
- Make `spritesheet.json` the sole descriptor for Sheet exports; PNG sequence exports continue to use `export.json`.
- Restrict duration-based sub-sampling to frames actually overlapped by an active attack trail; animations and frames without trails remain one-for-one.

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
