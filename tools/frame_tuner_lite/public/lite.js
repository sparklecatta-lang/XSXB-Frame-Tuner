(function frameTunerLiteUi() {
  const state = { exporting: false, initialized: false, layout: null };

  const number = (value, min, max, fallback) => {
    const result = Number(value);
    return Number.isFinite(result) ? Math.min(max, Math.max(min, result)) : fallback;
  };

  function markup() {
    return `
      <details id="liteExportPanel" class="panel liteExportPanel" open>
        <summary><h2>透明序列导出</h2></summary>
        <div class="liteExportBody">
          <div class="liteCanvasGrid">
            <label class="number"><span>透明边距 px</span><input id="liteCanvasPadding" type="number" min="0" max="1024" step="1" value="24"></label>
            <label class="number"><span>相位最长 ms</span><input id="litePhaseDurationMs" type="number" min="1" max="1000" step="1" value="80"></label>
            <label class="number"><span>Sheet 列数</span><input id="liteSheetColumns" type="number" min="1" max="64" step="1" value="8"></label>
          </div>
          <div class="liteCanvasResult"><span>全角色统一画布</span><strong id="liteCanvasResult">等待计算</strong></div>
          <p class="liteExportHelp">先校准当前角色的所有动作、图层、帧音效与拖尾。相位最长时长只决定一个源帧按真实毫秒时长拆成多少个拖尾采样；棍子数量只改变空间路径，不改变导出数量。把音频拖到帧卡即可绑定；导出时会扫描该角色全部主动作组，使用同一画布尺寸和角色原点，并把音效文件与播放帧写入 JSON。附属图层会合成到所属动作，不重复导出。</p>
          <button id="liteMeasureCanvas" type="button" class="secondary liteMeasureButton">重新计算全角色画布</button>
          <div class="liteExportActions">
            <button id="liteExportSequence" type="button" class="liteExportButton">导出 PNG 序列</button>
            <button id="liteExportSheet" type="button" class="liteExportButton">导出 Sheet + JSON</button>
          </div>
          <div id="liteExportStatus" class="liteExportStatus" aria-live="polite">等待导出</div>
        </div>
      </details>`;
  }

  function initialize() {
    if (state.initialized) return;
    const save = document.querySelector("#save");
    if (!save) return;
    save.insertAdjacentHTML("beforebegin", markup());
    document.querySelector("#liteExportSequence").addEventListener("click", () => exportOutput("sequence"));
    document.querySelector("#liteExportSheet").addEventListener("click", () => exportOutput("sheet"));
    document.querySelector("#liteMeasureCanvas").addEventListener("click", measureCanvas);
    document.querySelector("#liteCanvasPadding").addEventListener("input", invalidateLayout);
    document.querySelector("#litePhaseDurationMs").addEventListener("input", invalidateLayout);
    state.initialized = true;
    applyLiteLabels();
    syncSettings();
  }

  function applyLiteLabels() {
    document.body.classList.add("frameTunerLite");
    const subtitle = document.querySelector(".brand p");
    if (subtitle) subtitle.textContent = "透明序列帧后期与打包";
    const profileLabel = document.querySelector("#profileFieldLabel");
    const groupLabel = document.querySelector("#groupFieldLabel");
    if (profileLabel) profileLabel.textContent = "素材集";
    if (groupLabel) groupLabel.textContent = "序列";
    const save = document.querySelector("#save");
    if (save) save.textContent = "保存编辑";
  }

  function input(id) {
    return document.querySelector(`#${id}`);
  }

  function syncSettings() {
    const current = window.XsxbFrameTunerLite?.current();
    if (!current) return;
    const settings = current.settings || {};
    input("liteCanvasPadding").value = Math.round(number(settings.canvas?.padding, 0, 1024, 24));
    input("litePhaseDurationMs").value = Math.round(number(settings.export?.phaseDurationMs, 1, 1000, 80));
    input("liteSheetColumns").value = Math.round(number(settings.export?.sheetColumns, 1, 64, 8));
    state.layout = settings.canvas?.autoMeasured === true ? {
      width: Math.round(number(settings.canvas.width, 1, 8192, 1)),
      height: Math.round(number(settings.canvas.height, 1, 8192, 1)),
      originPixelX: Number(settings.canvas.originPixelX || 0),
      originPixelY: Number(settings.canvas.originPixelY || 0),
      padding: Math.round(number(settings.canvas.padding, 0, 1024, 24)),
    } : null;
    renderLayout();
    input("liteExportSequence").disabled = !current.ready;
    input("liteExportSheet").disabled = !current.ready;
    input("liteMeasureCanvas").disabled = !current.ready;
  }

  function options() {
    return {
      padding: Math.round(number(input("liteCanvasPadding").value, 0, 1024, 24)),
      phaseDurationMs: Math.round(number(input("litePhaseDurationMs").value, 1, 1000, 80)),
      columns: Math.round(number(input("liteSheetColumns").value, 1, 64, 8)),
    };
  }

  function invalidateLayout() {
    state.layout = null;
    renderLayout();
  }

  function renderLayout() {
    const result = input("liteCanvasResult");
    if (!result) return;
    result.textContent = state.layout ? `${state.layout.width} × ${state.layout.height} px` : "等待计算";
  }

  function mergeBounds(union, bounds) {
    if (!bounds) return union;
    if (!union) return { ...bounds };
    return {
      left: Math.min(union.left, bounds.left),
      top: Math.min(union.top, bounds.top),
      right: Math.max(union.right, bounds.right),
      bottom: Math.max(union.bottom, bounds.bottom),
    };
  }

  async function collectExportGroups(api, phaseDurationMs) {
    const originalGroupId = api.current().groupId;
    const groups = api.exportGroups();
    const targets = [];
    try {
      for (const group of groups) {
        const current = await api.selectGroup(group.groupId);
        const samples = api.timeline(phaseDurationMs);
        targets.push({
          ...group,
          profileId: current.profileId,
          animationId: current.animationId,
          samples,
          audio: api.audio(phaseDurationMs, samples),
        });
      }
    } finally {
      if (originalGroupId) await api.selectGroup(originalGroupId);
    }
    return { originalGroupId, targets };
  }

  async function calculateOptimalLayout(api, batch, config, status) {
    const current = api.current();
    const savedWidth = number(current.settings?.canvas?.width, 1, 8192, 1024);
    const savedHeight = number(current.settings?.canvas?.height, 1, 8192, 1024);
    let probeWidth = Math.min(8192, Math.max(1024, Math.ceil(savedWidth * 2)));
    let probeHeight = Math.min(8192, Math.max(1024, Math.ceil(savedHeight * 2)));
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        let union = null;
        for (let groupIndex = 0; groupIndex < batch.targets.length; groupIndex += 1) {
          const target = batch.targets[groupIndex];
          await api.selectGroup(target.groupId);
          for (const sample of target.samples) {
            status.textContent = `正在计算全角色画布 ${groupIndex + 1}/${batch.targets.length} · ${target.name} ${sample.index + 1}/${target.samples.length}`;
            const bounds = await api.measureFrame(sample, {
              width: probeWidth,
              height: probeHeight,
              originPixelX: probeWidth * 0.5,
              originPixelY: probeHeight * 0.5,
            });
            union = mergeBounds(union, bounds);
          }
        }
        if (!union) {
          if (probeWidth >= 8192 && probeHeight >= 8192) throw new Error("当前角色的所有动作都没有找到可见像素。");
          probeWidth = Math.min(8192, probeWidth * 2);
          probeHeight = Math.min(8192, probeHeight * 2);
          continue;
        }
        const touchesEdge = union.left <= 2 || union.top <= 2 || union.right >= probeWidth - 3 || union.bottom >= probeHeight - 3;
        if (touchesEdge) {
          if (probeWidth >= 8192 && probeHeight >= 8192) throw new Error("当前角色所有动作的总可见范围超过 8192 px。");
          probeWidth = Math.min(8192, probeWidth * 2);
          probeHeight = Math.min(8192, probeHeight * 2);
          continue;
        }
        const width = Math.ceil(union.right - union.left + 1 + config.padding * 2);
        const height = Math.ceil(union.bottom - union.top + 1 + config.padding * 2);
        if (width > 8192 || height > 8192) throw new Error(`全角色最优画布 ${width}×${height} 超过 8192 px。`);
        return {
          width,
          height,
          originPixelX: probeWidth * 0.5 - union.left + config.padding,
          originPixelY: probeHeight * 0.5 - union.top + config.padding,
          padding: config.padding,
        };
      }
      throw new Error("无法确定当前角色所有动作的完整可见范围。");
    } finally {
      if (batch.originalGroupId) await api.selectGroup(batch.originalGroupId);
    }
  }

  async function measureCanvas() {
    if (state.exporting) return;
    const api = window.XsxbFrameTunerLite;
    const current = api?.current();
    if (!current?.ready) return;
    const config = options();
    const status = input("liteExportStatus");
    state.exporting = true;
    input("liteMeasureCanvas").disabled = true;
    input("liteExportSequence").disabled = true;
    input("liteExportSheet").disabled = true;
    try {
      const batch = await collectExportGroups(api, config.phaseDurationMs);
      if (!batch.targets.length) throw new Error("当前角色没有可导出的动作组。");
      state.layout = await calculateOptimalLayout(api, batch, config, status);
      renderLayout();
      status.textContent = `全角色统一画布：${state.layout.width} × ${state.layout.height} px（${batch.targets.length} 组）`;
    } catch (error) {
      state.layout = null;
      renderLayout();
      status.textContent = `计算失败：${error.message}`;
    } finally {
      state.exporting = false;
      input("liteMeasureCanvas").disabled = false;
      input("liteExportSequence").disabled = false;
      input("liteExportSheet").disabled = false;
    }
  }

  async function postJson(url, payload) {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  function safeFolderName(value, fallback = "animation") {
    const name = String(value || "").trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 80);
    return name || fallback;
  }

  function batchFolderName(profileId, kind) {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "_");
    return `${safeFolderName(profileId, "character")}_${kind === "sheet" ? "sheet_json" : "png_sequence"}_${stamp}`;
  }

  async function writeBlob(directory, filename, blob) {
    const handle = await directory.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(blob);
    } finally {
      await writable.close();
    }
  }

  async function writeDataUrl(directory, filename, dataUrl) {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error(`无法生成 ${filename}`);
    await writeBlob(directory, filename, await response.blob());
  }

  async function writeJson(directory, filename, value) {
    await writeBlob(directory, filename, new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" }));
  }

  function sheetJson(metadataFrames, sheet, phaseDurationMs, canvas, audio) {
    const integerDurations = window.XsxbTimingModes.distributeIntegerMilliseconds(
      metadataFrames.map((frame) => frame.durationMs),
    );
    return {
      frames: Object.fromEntries(metadataFrames.map((frame, index) => [frame.filename, {
        frame: { x: frame.x, y: frame.y, w: frame.width, h: frame.height },
        duration: integerDurations[index],
        timeMs: Math.round(frame.time * 1000),
        sourceFrameIndex: frame.sourceFrame,
        rotated: false,
        trimmed: false,
      }])),
      meta: {
        app: "XSXB Frame Tuner Lite",
        version: 1,
        image: "spritesheet.png",
        format: "RGBA8888",
        size: { w: sheet.width, h: sheet.height },
        phaseDurationMs,
        canvas,
      },
      audio,
    };
  }

  function audioFileName(asset, index, used) {
    const stableName = String(asset.path || "").split(/[\\/]/).pop();
    const preferred = safeFolderName(stableName || asset.name || `audio_${index + 1}`, `audio_${index + 1}`);
    const extension = /\.[a-z0-9]{2,5}$/i.exec(preferred)?.[0] || ({
      "audio/mpeg": ".mp3", "audio/mp3": ".mp3", "audio/ogg": ".ogg", "audio/opus": ".opus",
      "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/mp4": ".m4a", "audio/aac": ".aac",
      "audio/flac": ".flac", "audio/webm": ".webm",
    }[String(asset.type || "").toLowerCase()] || ".bin");
    const stem = preferred.endsWith(extension) ? preferred.slice(0, -extension.length) : preferred;
    let result = `${stem}${extension}`;
    let suffix = 2;
    while (used.has(result.toLowerCase())) result = `${stem}_${suffix++}${extension}`;
    used.add(result.toLowerCase());
    return result;
  }

  async function packageAudioAssets(targets, batchDirectory, status) {
    const byIdentity = new Map();
    const byKey = new Map();
    const usedNames = new Set();
    const allAssets = targets.flatMap((target) => target.audio?.assets || []);
    if (!allAssets.length) return byKey;
    const audioDirectory = await batchDirectory.getDirectoryHandle("audio", { create: true });
    for (const asset of allAssets) {
      const identity = String(asset.path || asset.source || asset.key || "");
      let packaged = byIdentity.get(identity);
      if (!packaged) {
        status.textContent = `正在打包音效 ${byIdentity.size + 1}/${allAssets.length} · ${asset.name}`;
        const response = await fetch(asset.source);
        if (!response.ok) throw new Error(`无法读取音效：${asset.name}`);
        const blob = await response.blob();
        const fileName = audioFileName(asset, byIdentity.size, usedNames);
        await writeBlob(audioDirectory, fileName, blob);
        packaged = {
          id: `audio_${byIdentity.size + 1}`,
          name: asset.name || fileName,
          file: `../audio/${fileName}`,
          type: asset.type || blob.type || "",
          size: blob.size,
        };
        byIdentity.set(identity, packaged);
      }
      byKey.set(asset.key, packaged);
    }
    return byKey;
  }

  function audioMetadata(target, packagedAudio) {
    const events = (target.audio?.events || []).map((event) => {
      const asset = packagedAudio.get(event.assetKey);
      if (!asset) return null;
      const { assetKey, ...timing } = event;
      return { ...timing, assetId: asset.id, file: asset.file };
    }).filter(Boolean);
    const ids = new Set(events.map((event) => event.assetId));
    const filesById = new Map(
      [...packagedAudio.values()]
        .filter((asset) => ids.has(asset.id))
        .map((asset) => [asset.id, asset]),
    );
    return {
      schemaVersion: 1,
      files: [...filesById.values()],
      events,
    };
  }

  function imageFromDataUrl(data) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("导出帧无法写入 Sprite Sheet。"));
      image.src = data;
    });
  }

  async function exportOutput(kind) {
    if (state.exporting) return;
    const api = window.XsxbFrameTunerLite;
    const current = api?.current();
    if (!current?.ready) return;
    const config = options();
    state.exporting = true;
    const sequenceButton = input("liteExportSequence");
    const sheetButton = input("liteExportSheet");
    const status = input("liteExportStatus");
    sequenceButton.disabled = true;
    sheetButton.disabled = true;
    input("liteMeasureCanvas").disabled = true;
    const originalGroupId = current.groupId;
    try {
      if (typeof window.showDirectoryPicker !== "function") throw new Error("当前浏览器不支持文件夹选择；请使用最新版 Edge 或 Chrome 打开本地 Lite 页面。");
      status.textContent = "请选择导出目录";
      const chosenDirectory = await window.showDirectoryPicker({
        id: `xsxb-frame-tuner-lite-${kind}`,
        mode: "readwrite",
        startIn: "downloads",
      });
      const batch = await collectExportGroups(api, config.phaseDurationMs);
      if (!batch.targets.length) throw new Error("当前角色没有可导出的动作组。");
      state.layout = await calculateOptimalLayout(api, batch, config, status);
      renderLayout();
      const renderConfig = { ...config, ...state.layout };
      await postJson("/api/lite/settings", {
        projectId: current.projectId,
        canvas: { ...state.layout, autoMeasured: true },
        export: { phaseDurationMs: config.phaseDurationMs, sheetColumns: config.columns },
      });
      const batchName = batchFolderName(current.profileId, kind);
      const batchDirectory = await chosenDirectory.getDirectoryHandle(batchName, { create: true });
      const packagedAudio = await packageAudioAssets(batch.targets, batchDirectory, status);
      let totalFrames = 0;
      for (let groupIndex = 0; groupIndex < batch.targets.length; groupIndex += 1) {
        const target = batch.targets[groupIndex];
        const selected = await api.selectGroup(target.groupId);
        const targetDirectory = await batchDirectory.getDirectoryHandle(safeFolderName(selected.animationId), { create: true });
        const samples = target.samples;
        const audio = audioMetadata(target, packagedAudio);
        const rows = Math.ceil(samples.length / config.columns);
        const sheetWidth = renderConfig.width * config.columns;
        const sheetHeight = renderConfig.height * rows;
        if (kind === "sheet" && (sheetWidth > 16384 || sheetHeight > 16384 || sheetWidth * sheetHeight > 120000000)) {
          throw new Error(`${target.name} 的 Sheet 尺寸 ${sheetWidth}×${sheetHeight} 过大。`);
        }
        const sheet = kind === "sheet" ? document.createElement("canvas") : null;
        const context = sheet?.getContext("2d") || null;
        if (sheet) {
          sheet.width = sheetWidth;
          sheet.height = sheetHeight;
          context.clearRect(0, 0, sheet.width, sheet.height);
          context.imageSmoothingEnabled = true;
        }
        const metadataFrames = [];
        const digits = Math.max(4, String(samples.length).length);
        for (const sample of samples) {
          status.textContent = `正在导出 ${groupIndex + 1}/${batch.targets.length} · ${target.name} ${sample.index + 1}/${samples.length}`;
          const data = await api.renderFrame(sample, renderConfig);
          const filename = `frame_${String(sample.index + 1).padStart(digits, "0")}.png`;
          const column = sample.index % config.columns;
          const row = Math.floor(sample.index / config.columns);
          if (kind === "sequence") {
            await writeDataUrl(targetDirectory, filename, data);
          } else {
            const image = await imageFromDataUrl(data);
            context.drawImage(image, column * renderConfig.width, row * renderConfig.height, renderConfig.width, renderConfig.height);
          }
          metadataFrames.push({
            filename,
            time: sample.time,
            sourceFrame: sample.frameIndex,
            durationMs: sample.durationMs,
            x: kind === "sheet" ? column * renderConfig.width : 0,
            y: kind === "sheet" ? row * renderConfig.height : 0,
            width: renderConfig.width,
            height: renderConfig.height,
          });
        }
        if (kind === "sheet") {
          status.textContent = `正在写入 ${groupIndex + 1}/${batch.targets.length} · ${target.name} Sheet + JSON`;
          await writeDataUrl(targetDirectory, "spritesheet.png", sheet.toDataURL("image/png"));
          await writeJson(targetDirectory, "spritesheet.json", sheetJson(metadataFrames, { width: sheetWidth, height: sheetHeight }, config.phaseDurationMs, state.layout, audio));
        }
        if (kind === "sequence") {
          await writeJson(targetDirectory, "export.json", {
            schemaVersion: 1,
            profileId: selected.profileId,
            animationId: selected.animationId,
            canvas: { ...state.layout, autoMeasured: true },
            phaseDurationMs: config.phaseDurationMs,
            kind,
            audio,
            frames: metadataFrames,
            completedAt: new Date().toISOString(),
          });
        }
        totalFrames += samples.length;
      }
      status.textContent = kind === "sheet"
        ? `已导出当前角色 ${batch.targets.length} 组 Sheet + JSON（共 ${totalFrames} 帧）\n${chosenDirectory.name}\\${batchName}`
        : `已导出当前角色 ${batch.targets.length} 组 PNG 序列（共 ${totalFrames} 帧）\n${chosenDirectory.name}\\${batchName}`;
    } catch (error) {
      status.textContent = error?.name === "AbortError" ? "已取消导出" : `导出失败：${error.message}`;
    } finally {
      if (originalGroupId) await api.selectGroup(originalGroupId).catch(() => {});
      state.exporting = false;
      sequenceButton.disabled = false;
      sheetButton.disabled = false;
      input("liteMeasureCanvas").disabled = false;
    }
  }

  window.addEventListener("xsxb-frame-tuner-config", () => {
    initialize();
    applyLiteLabels();
    syncSettings();
  });
  initialize();
  setTimeout(() => { applyLiteLabels(); syncSettings(); }, 500);
})();
