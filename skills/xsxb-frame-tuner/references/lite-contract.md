# Frame Tuner Lite Contract

Frame Tuner Lite is the non-Godot edition of the same editor. Use it when the user wants to process frame sequences, layered animation, attack trails, transparent PNG output, or sprite sheets without binding a game project.

## Isolation

- Start Lite with `npm run start:lite`; its default address is `http://127.0.0.1:5180`. Use `LITE_PORT` only when a different Lite port is required; the Full Tuner `PORT` variable does not redirect Lite.
- Keep Full Tuner on port `5179`. Do not reuse its project registry or project data.
- Lite registry and edits live under `data/lite/`; stable imported assets live under `workspace/lite/`. User exports never use a fixed internal workspace path.
- Lite projects have `kind: frame_lite`, an empty Godot root, no runtime sync, no gameplay wiring, and no audio. Other editor data, including collision-box metadata, remains editable and saveable.
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
- First let the user calibrate the sequence transforms, layers, frame timing, and attack trails.
- At export time, scan the actual visible alpha bounds of every sampled frame across every primary animation in the current profile, including attached layers and attack trails. Add the chosen transparent padding and derive the smallest safe character-wide canvas.
- Every animation of that character must use the same width, height, and stable character origin. The background is always transparent, so switching animation groups does not jump or resize the canvas.
- Frame transforms, durations, disabled frames, image attachments, layers, and editable attack trails use the same data as the preview.
- Export FPS is a sampling rate, not a replacement for authored timing. Long source-frame durations produce more continuous trail samples; short durations produce fewer.
- Export includes the attack trail's terminal collapse/disappearance time instead of stopping at the last Sprite frame.
- The UI exposes two independent character-wide batch outputs. `导出 PNG 序列` writes a transparent frame sequence for every primary animation in the current profile. `导出 Sheet + JSON` writes one `spritesheet.png` plus re-importable `spritesheet.json` pair per primary animation. Attached visual layers are composited into their owner and are not exported again as standalone groups. Both keep an `export.json` audit record in each animation folder.
- Clicking either export button must immediately open the browser's native writable-directory picker. Write a uniquely named batch folder under the user-selected directory; never silently export to `workspace/lite/`, Downloads, Temp, or another fixed location.
- Keep sprite sheets within browser canvas limits. Reduce columns, transparent padding, or export FPS if the UI reports an oversized sheet.

## Validation

Run:

```powershell
npm run check
npm test
npm run validate:lite -- --project <project_id>
```

Then open the Lite page, select the imported owner sequence, export at least one small transparent sequence, and inspect both an individual PNG and the generated sprite sheet. Also verify Full Tuner still answers on port `5179` and its active project has not changed.
