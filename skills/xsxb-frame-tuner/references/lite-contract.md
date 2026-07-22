# Frame Tuner Lite Contract

Frame Tuner Lite is the non-Godot edition of the same editor. Use it when the user wants to process frame sequences, layered animation, attack trails, transparent PNG output, or sprite sheets without binding a game project.

## Isolation

- Start Lite with `npm run start:lite`; its default address is `http://127.0.0.1:5180`. Use `LITE_PORT` only when a different Lite port is required; the Full Tuner `PORT` variable does not redirect Lite.
- Keep Full Tuner on port `5179`. Do not reuse its project registry or project data.
- Lite registry and edits live under `data/lite/`; stable imported assets live under `workspace/lite/`. User exports never use a fixed internal workspace path.
- Lite projects have `kind: frame_lite`, an empty Godot root, no runtime sync, and no gameplay wiring. Frame-bound SFX is saved inside the isolated Lite workspace and exported as portable audio files plus JSON events; it is never synced to Godot. Other editor data, including collision-box metadata, remains editable and saveable.
- Never add Lite project records to `data/projects.json` or copy Lite data to a Godot project.

## Agent Import

For a PNG folder:

```powershell
node tools/frame_tuner_lite/import_frames.js --project <project_id> --profile <material_set> --animation <sequence_id> --source "<png_folder>" --fps <fps>
```

For a TexturePacker/Aseprite-style PNG plus JSON sheet:

```powershell
node tools/frame_tuner_lite/import_sheet.js --project <project_id> --profile <material_set> --animation <sequence_id> --sheet "<sheet.png>" --json "<sheet.json>" --fps <fallback_fps>
```

The JSON `frames` value may be an array or an object. Each entry must provide a `frame`, `crop`, or direct rectangle using `x/y/w/h` or `x/y/width/height`. Per-frame `duration` or `durationMs` values are preserved relative to the fallback FPS.

To attach another imported sequence as a visual layer:

```powershell
node tools/frame_tuner_lite/import_frames.js --project <project_id> --profile <material_set> --animation <layer_id> --source "<png_folder>" --fps <fps> --attach-to <owner_sequence_id> --layer behind
```

Use `--layer front` for an upper layer. Add `--independent` only when the layer should advance on its own timeline; otherwise it follows the owner frame index. Every imported source is copied to a stable Lite workspace path. Never leave manifests pointing to Downloads or Temp.

## Calibrate First, Then Derive the Canvas

- Do not choose, normalize, or calculate a canvas during import. Preserve each frame's original dimensions only so the editor can draw the raw material.
- First let the user calibrate the sequence transforms, layers, frame timing, frame SFX, and attack trails.
- At export time, scan the actual visible alpha bounds of every sampled frame across every primary animation in the current profile, including attached layers and attack trails. Add the chosen transparent padding and derive the smallest safe character-wide canvas.
- Every animation of that character must use the same width, height, and stable character origin. The background is always transparent, so switching animation groups does not jump or resize the canvas.
- Frame transforms, durations, disabled frames, image attachments, layers, frame SFX, and editable attack trails use the same data as the preview.
- There is no separate export FPS. Authored group/per-frame durations are the only time source. A playable source frame outside every active attack-trail interval always produces exactly one output frame. Only frames overlapped by the interval from an active segment's first stick through its completed tail chase produce `max(1, ceil(frameDurationMs / phaseDurationMs))` equal-duration trail samples, where `phaseDurationMs` is the user-facing `拖尾相位最长时长（ms）` setting (default 80 ms). Stick count and saved `framePhase` values never increase the number of exported samples: sticks only shape the ordered spatial path. An active trail may add a separate terminal disappearance sample after the duration-derived movement samples.
- Export includes the attack trail's terminal collapse/disappearance time instead of stopping at the last Sprite frame.
- The UI exposes two independent character-wide batch outputs. `导出 PNG 序列` writes a transparent frame sequence plus its sole `export.json` descriptor for every primary animation in the current profile. `导出 Sheet + JSON` writes only one `spritesheet.png` plus re-importable `spritesheet.json` pair per primary animation; it must not create a duplicate `export.json`. Attached visual layers are composited into their owner and are not exported again as standalone groups.
- Both export modes copy every referenced SFX into the batch-level `audio/` folder. Sequence mode writes `audio.files` and `audio.events` to `export.json`; Sheet mode writes them only to `spritesheet.json`. An event records its zero- and one-based output frame, millisecond time, source/display frame, asset id, and relative audio path. Bindings on disabled frames do not export. Map each event to the first duration-derived output sample at or after the authoritative source-frame arrival time instead of dropping or repeating it.
- `spritesheet.json` is the only timing authority for Sheet output. Because common sheet consumers expect integer milliseconds, distribute rounding over the ordered samples using cumulative elapsed time so the integers preserve the rounded animation total (for example, six 22.5 ms samples become `23,22,23,22,23,22`, totaling 135 ms).
- When the Agent imports a Lite-exported `spritesheet.json`, copy its referenced audio files into the target Lite project's stable `workspace/lite/.../audio/` directory and recreate the bindings on `outputFrameIndex`. Preserve unrelated animations' existing SFX.
- Clicking either export button must immediately open the browser's native writable-directory picker. Write a uniquely named batch folder under the user-selected directory; never silently export to `workspace/lite/`, Downloads, Temp, or another fixed location.
- Keep sprite sheets within browser canvas limits. Reduce columns or transparent padding, or increase the maximum trail phase duration if the UI reports an oversized sheet.

## Validation

Run:

```powershell
npm run check
npm test
npm run validate:lite -- --project <project_id>
```

Then open the Lite page, select the imported owner sequence, bind one SFX to a frame card, verify preview playback, and export at least one small transparent sequence. Inspect an individual PNG, the generated sprite sheet, the packaged audio file, and the matching JSON event. Also verify Full Tuner still answers on port `5179` and its active project has not changed.
