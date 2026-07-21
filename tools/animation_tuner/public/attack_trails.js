(function attackTrailModule() {
  const SPEED_PROFILE = [0.94, 1.015, 0.985, 1.025, 1.035, 1.02, 0.97, 1.04];
  const TAIL_WIDTH_SPEED_INFLUENCE = 0.18;
  const HANDLE_RADIUS = 9;
  const CENTER_HANDLE_RADIUS = 8;
  const DIRECTION_HANDLE_UNIT_PX = 57.5;
  const DIRECTION_HANDLE_MIN_STRENGTH = 0.1;
  const DIRECTION_HANDLE_MAX_STRENGTH = 4;
  const DEFAULT_BEFORE_CHASE_MULTIPLIER = 0.5;
  const DEFAULT_AFTER_CHASE_MULTIPLIER = 2;
  const DEFAULT_PATH_COLUMNS = 20;
  const LEGACY_BEFORE_CHASE_SPEED = 110;
  const LEGACY_AFTER_CHASE_SPEED = 680;
  const TRAIL_MESH_WIDTH_ROWS = 17;
  const FINAL_HEAD_CAP_MARGIN_RATIO = 0.25;
  const TAIL_ALPHA_EXPONENT = 2.2;
  const ATTACK_TRAIL_SCHEMA_VERSION = 7;
  const PRESET_SEGMENT_ID = "__xsxb_default_attack_trail_preset__";
  const DEFAULT_PRESET_TEXTURE = {
    path: "tools/animation_tuner/public/presets/attack_trails/dynamic_trail_luma.png",
    assetHash: "e2b855cdb3c59db8b4ed33f400b03bafd4af7df2636f3fd4d3eb68603763da90",
    name: "dynamic_trail_luma.png",
    type: "image/png",
    width: 648,
    height: 435,
    hasEffectiveAlpha: false,
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max, fallback = min) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  const point = (value, fallback = { x: 0, y: 0 }) => ({
    x: clamp(value?.x, -100000, 100000, fallback.x),
    y: clamp(value?.y, -100000, 100000, fallback.y),
  });
  const randomId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const normalizeColor = (value, fallback = "#d9364a") => (/^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback);
  const normalizeColorMode = (value) => {
    const mode = String(value || "").toLowerCase();
    if (mode === "original" || mode === "gradient") return mode;
    return "solid";
  };
  const normalizeGradientStops = (value, fallbackColor = "#d9364a") => {
    const stops = (Array.isArray(value) ? value : []).slice(0, 16).map((stop, index) => ({
      id: String(stop?.id || `gradient_stop_${index + 1}`),
      position: clamp(stop?.position ?? stop?.offset, 0, 1, index ? 1 : 0),
      color: normalizeColor(stop?.color, fallbackColor),
    })).sort((a, b) => a.position - b.position);
    if (stops.length >= 2) return stops;
    return [
      { id: "gradient_stop_bottom", position: 0, color: fallbackColor },
      { id: "gradient_stop_top", position: 1, color: fallbackColor },
    ];
  };
  const colorChannels = (value) => [1, 3, 5].map((offset) => parseInt(normalizeColor(value).slice(offset, offset + 2), 16));
  const channelsToColor = (channels) => `#${channels.map((channel) => Math.round(clamp(channel, 0, 255, 0)).toString(16).padStart(2, "0")).join("")}`;

  class AttackTrailEditor {
    constructor(hooks) {
      this.hooks = hooks;
      this.data = { schemaVersion: ATTACK_TRAIL_SCHEMA_VERSION, bindings: {} };
      this.segmentId = "";
      this.stickId = "";
      this.gradientStopId = "";
      this.gradientDrag = null;
      this.enabled = false;
      this.guidesVisible = false;
      this.picking = false;
      this.drag = null;
      this.images = new Map();
      this.processed = new Map();
      this.pathCache = new Map();
      this.meshCanvas = document.createElement("canvas");
      this.meshContext = this.meshCanvas.getContext("2d");
      this.meshMaskCanvas = document.createElement("canvas");
      this.meshMaskContext = this.meshMaskCanvas.getContext("2d");
      this.meshSeamCanvas = document.createElement("canvas");
      this.meshSeamContext = this.meshSeamCanvas.getContext("2d");
      this.meshRepairCanvas = document.createElement("canvas");
      this.meshRepairContext = this.meshRepairCanvas.getContext("2d");
      this.gpuCanvas = document.createElement("canvas");
      this.gpuTextures = new WeakMap();
      this.gpuRenderer = this._createGpuRenderer();
      this.els = Object.fromEntries([
        "attackTrailPanel", "attackTrailMode", "attackTrailBody", "attackTrailSegment", "attackTrailNew",
        "attackTrailDelete", "attackTrailLayerToggle", "attackTrailTextureFile",
        "attackTrailTextureBrowse", "attackTrailTextureName", "attackTrailTexturePreview", "attackTrailColorMode",
        "attackTrailColor", "attackTrailPickColor", "attackTrailGradientEditor", "attackTrailGradientBar",
        "attackTrailGradientColor", "attackTrailGradientPosition", "attackTrailBeforeTimeMs", "attackTrailAfterTimeMs",
        "attackTrailTailSamples", "attackTrailPathColumns", "attackTrailTailFadeStart", "attackTrailHeadCurvature", "attackTrailHeadCurvatureValue", "attackTrailAddStick",
        "attackTrailDeleteStick", "attackTrailReverse", "attackTrailTimingSummary",
        "attackTrailGuideToggle",
      ].map((id) => [id, document.querySelector(`#${id}`)]));
      this._bind();
    }

    load(raw) {
      this.data = this._normalizeData(raw);
      this.pathCache.clear();
      this.processed.clear();
      this.contextChanged();
    }

    snapshot() {
      return clone(this.data);
    }

    restore(raw) {
      this.data = this._normalizeData(raw);
      this.pathCache.clear();
      this.render();
      this.hooks.draw();
    }

    serialize() {
      return this._normalizeData(this.data);
    }

    contextChanged() {
      const supported = this.hooks.projectKind() !== "codex_pets" && Boolean(this.hooks.group());
      this._syncGuideToggle(supported);
      if (this.els.attackTrailPanel) this.els.attackTrailPanel.hidden = !supported;
      if (!supported) {
        this.enabled = false;
        if (this.els.attackTrailMode) this.els.attackTrailMode.checked = false;
      }
      const segments = this._displaySegments();
      if (!segments.some((entry) => entry.id === this.segmentId)) this.segmentId = segments[0]?.id || "";
      const segment = this._segment();
      const frameSticks = this._frameSticks(segment);
      if (!frameSticks.some((entry) => entry.id === this.stickId)) this.stickId = frameSticks[0]?.id || "";
      this.render();
    }

    frameChanged() {
      const frameSticks = this._frameSticks(this._segment());
      if (!frameSticks.some((entry) => entry.id === this.stickId)) this.stickId = frameSticks[0]?.id || "";
      this.render();
    }

    isContinuous() {
      return this.enabled && this._segments().some((segment) => segment.enabled !== false && segment.generated !== false && segment.sticks.length >= 2);
    }

    selectedStickArrival() {
      if (!this.enabled) return null;
      const stick = this._stick();
      if (!stick || stick.frame !== this.hooks.selectedFrame()) return null;
      return this.hooks.frameArrival(stick.frame, stick.framePhase);
    }

    render() {
      const e = this.els;
      const supported = this.hooks.projectKind() !== "codex_pets" && Boolean(this.hooks.group());
      this._syncGuideToggle(supported);
      if (!e.attackTrailPanel || e.attackTrailPanel.hidden) return;
      e.attackTrailMode.checked = this.enabled;
      e.attackTrailBody.hidden = !this.enabled;
      const segments = this._displaySegments();
      e.attackTrailSegment.innerHTML = segments.length
        ? segments.map((segment, index) => `<option value="${this._escape(segment.id)}">${index + 1}. ${this._escape(segment.name || `Trail ${index + 1}`)}</option>`).join("")
        : '<option value="">暂无拖尾段</option>';
      e.attackTrailSegment.value = this.segmentId;
      const segment = this._segment();
      const presetPreview = this._isPresetSegment(segment);
      for (const element of [e.attackTrailDelete, e.attackTrailLayerToggle, e.attackTrailTextureBrowse,
        e.attackTrailColorMode, e.attackTrailColor, e.attackTrailPickColor, e.attackTrailGradientColor, e.attackTrailBeforeTimeMs,
        e.attackTrailAfterTimeMs, e.attackTrailTailSamples, e.attackTrailPathColumns, e.attackTrailTailFadeStart, e.attackTrailHeadCurvature,
        e.attackTrailAddStick, e.attackTrailDeleteStick, e.attackTrailReverse]) {
        if (element) element.disabled = !segment;
      }
      if (e.attackTrailDelete) e.attackTrailDelete.disabled = !segment || presetPreview;
      if (!segment) {
        e.attackTrailTextureName.textContent = "先新增一段拖尾";
        e.attackTrailTexturePreview.hidden = true;
        e.attackTrailGradientEditor.hidden = true;
        e.attackTrailTimingSummary.textContent = "";
        return;
      }
      e.attackTrailTextureName.textContent = segment.texture?.name
        ? `${presetPreview ? "默认预设 · " : ""}${segment.texture.name}`
        : "尚未导入 PNG";
      this._renderTexturePreview(segment);
      e.attackTrailColorMode.value = segment.colorMode;
      e.attackTrailColor.value = segment.color.slice(0, 7);
      const solidColorMode = segment.colorMode === "solid";
      e.attackTrailColor.disabled = !solidColorMode;
      e.attackTrailPickColor.disabled = !solidColorMode;
      e.attackTrailGradientEditor.hidden = segment.colorMode !== "gradient";
      if (segment.colorMode === "gradient") this._renderGradientEditor(segment);
      e.attackTrailPickColor.classList.toggle("active", this.picking);
      const chaseTimes = this._chaseTimes(segment);
      e.attackTrailBeforeTimeMs.value = chaseTimes.beforeMs;
      e.attackTrailAfterTimeMs.value = chaseTimes.afterMs;
      e.attackTrailAfterTimeMs.disabled = chaseTimes.beforeMs <= 0;
      e.attackTrailTailSamples.value = segment.tailSamples;
      e.attackTrailPathColumns.value = segment.pathColumns;
      e.attackTrailTailFadeStart.value = Math.round(segment.tailFadeStart * 100);
      e.attackTrailHeadCurvature.value = Math.round(segment.headCurvature * 100);
      e.attackTrailHeadCurvatureValue.value = `${Math.round(segment.headCurvature * 100)}`;
      const frameSticks = this._frameSticks(segment);
      if (!frameSticks.some((entry) => entry.id === this.stickId)) this.stickId = frameSticks[0]?.id || "";
      const stick = this._stick();
      e.attackTrailDeleteStick.disabled = !stick;
      e.attackTrailLayerToggle.disabled = !stick;
      e.attackTrailReverse.disabled = !stick;
      e.attackTrailLayerToggle.classList.toggle("behind", stick?.layer === "behind");
      e.attackTrailLayerToggle.classList.toggle("front", stick?.layer === "front");
      e.attackTrailLayerToggle.textContent = stick
        ? (stick.layer === "front" ? "角色前" : "角色后")
        : "角色层";
      e.attackTrailReverse.classList.toggle("active", stick?.reverseDirection === true);
      e.attackTrailReverse.setAttribute("aria-pressed", stick?.reverseDirection === true ? "true" : "false");
      const timing = this._timing(segment);
      e.attackTrailTimingSummary.textContent = timing.times.length >= 2
        ? `路径：第 ${segment.sticks[0].frame + 1} 帧 → 第 ${segment.sticks.at(-1).frame + 1} 帧 · ${Math.round(timing.times.at(-1) * 1000)} ms`
        : "至少需要两根棍子才能生成拖尾。";
    }

    drawLayer(layer, frameIndex, alpha = 1) {
      if (!this.enabled || frameIndex !== this.hooks.selectedFrame()) return;
      for (const segment of this._segments()) {
        if (segment.enabled === false || segment.generated === false || segment.sticks.length < 2 || !segment.texture?.path) continue;
        this._drawSegment(segment, alpha, layer);
      }
    }

    drawGuides() {
      if (!this.enabled || !this.guidesVisible) return;
      const segment = this._segment();
      if (!segment) return;
      const ctx = this.hooks.ctx;
      const dpr = this.hooks.dpr();
      this._drawSelectedPathGuide(segment);
      for (const stick of this._frameSticks(segment)) {
        const top = this.hooks.localToScreen(stick.top);
        const bottom = this.hooks.localToScreen(stick.bottom);
        const center = { x: (top.x + bottom.x) / 2, y: (top.y + bottom.y) / 2 };
        const directionHandle = this._directionHandleScreen(stick);
        const direction = directionHandle.direction;
        const arrow = directionHandle.arrow;
        const selected = stick.id === this.stickId;
        const layerColor = stick.layer === "front" ? "#ff982e" : "#39baff";
        ctx.save();
        ctx.globalAlpha = selected ? 1 : 0.82;
        ctx.strokeStyle = layerColor;
        ctx.fillStyle = layerColor;
        ctx.lineWidth = (selected ? 3 : 2) * dpr;
        if (selected) { ctx.shadowColor = layerColor; ctx.shadowBlur = 8 * dpr; }
        ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bottom.x, bottom.y); ctx.stroke();
        for (const handle of [top, bottom]) {
          ctx.beginPath(); ctx.arc(handle.x, handle.y, HANDLE_RADIUS * dpr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff8e8";
        ctx.strokeStyle = layerColor;
        ctx.lineWidth = 3 * dpr;
        ctx.beginPath(); ctx.arc(center.x, center.y, CENTER_HANDLE_RADIUS * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = layerColor;
        ctx.beginPath(); ctx.arc(center.x, center.y, 2.5 * dpr, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = layerColor;
        ctx.fillStyle = layerColor;
        ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(arrow.x, arrow.y); ctx.stroke();
        const side = { x: -direction.y * 7 * dpr, y: direction.x * 7 * dpr };
        ctx.beginPath();
        ctx.moveTo(arrow.x, arrow.y);
        ctx.lineTo(arrow.x - direction.x * 13 * dpr + side.x, arrow.y - direction.y * 13 * dpr + side.y);
        ctx.lineTo(arrow.x - direction.x * 13 * dpr - side.x, arrow.y - direction.y * 13 * dpr - side.y);
        ctx.closePath(); ctx.fill();
        if (selected) {
          ctx.save();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#fff8e8";
          ctx.strokeStyle = layerColor;
          ctx.lineWidth = 3 * dpr;
          ctx.beginPath(); ctx.arc(arrow.x, arrow.y, 7 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
        ctx.font = `bold ${14 * dpr}px system-ui, sans-serif`;
        ctx.fillText(`#${stick.order + 1}`, arrow.x + 8 * dpr, arrow.y - 7 * dpr);
        ctx.restore();
      }
    }

    _drawSelectedPathGuide(segment) {
      const selectedIndex = segment.sticks.findIndex((stick) => stick.id === this.stickId);
      if (selectedIndex < 0 || segment.sticks.length < 2) return;
      const timing = this._timing(segment);
      const firstIndex = Math.max(0, selectedIndex - 1);
      const lastIndex = Math.min(segment.sticks.length - 1, selectedIndex + 1);
      if (firstIndex === lastIndex) return;
      const startTime = timing.times[firstIndex];
      const endTime = timing.times[lastIndex];
      const ctx = this.hooks.ctx;
      const dpr = this.hooks.dpr();
      ctx.save();
      ctx.strokeStyle = "#ffe36a";
      ctx.lineWidth = 2 * dpr;
      ctx.setLineDash([7 * dpr, 5 * dpr]);
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      for (let sample = 0; sample <= 48; sample += 1) {
        const time = startTime + (endTime - startTime) * sample / 48;
        const screen = this.hooks.localToScreen(this._pose(segment.sticks, timing.times, time).center);
        if (sample === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
      }
      ctx.stroke();

      const stick = segment.sticks[selectedIndex];
      const pose = this._stickPose(stick);
      const previousPose = selectedIndex > 0 ? this._stickPose(segment.sticks[selectedIndex - 1]) : null;
      const nextPose = selectedIndex + 1 < segment.sticks.length ? this._stickPose(segment.sticks[selectedIndex + 1]) : null;
      const distances = [previousPose, nextPose].filter(Boolean).map((entry) => Math.hypot(entry.center.x - pose.center.x, entry.center.y - pose.center.y));
      const handleDistance = (distances.reduce((sum, value) => sum + value, 0) / Math.max(1, distances.length)) * stick.tangentStrength / 3;
      const direction = this._direction(stick);
      const center = this.hooks.localToScreen(pose.center);
      const outgoing = this.hooks.localToScreen({ x: pose.center.x + direction.x * handleDistance, y: pose.center.y + direction.y * handleDistance });
      const incoming = this.hooks.localToScreen({ x: pose.center.x - direction.x * handleDistance, y: pose.center.y - direction.y * handleDistance });
      ctx.setLineDash([]);
      ctx.strokeStyle = "#ffef9c";
      ctx.fillStyle = "#ffe36a";
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.moveTo(incoming.x, incoming.y); ctx.lineTo(outgoing.x, outgoing.y); ctx.stroke();
      for (const handle of [incoming, outgoing]) {
        ctx.beginPath(); ctx.arc(handle.x, handle.y, 4 * dpr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(center.x, center.y, 3 * dpr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    pointerDown(event) {
      if (!this.enabled) return false;
      if (this.picking) {
        this._pickColor(event);
        return true;
      }
      if (!this.guidesVisible) return false;
      const segment = this._segment();
      if (!segment) return false;
      const cursor = this.hooks.stagePoint(event);
      const radius = HANDLE_RADIUS * this.hooks.dpr() * 1.8;
      for (const stick of [...this._frameSticks(segment)].reverse()) {
        const handle = this._directionHandleScreen(stick).arrow;
        if (Math.hypot(cursor.x - handle.x, cursor.y - handle.y) <= radius) {
          this.hooks.pushUndo("adjust attack trail curve handle");
          this.stickId = stick.id;
          this.drag = { stickId: stick.id, mode: "direction" };
          this.render(); this.hooks.draw();
          return true;
        }
      }
      for (const stick of [...this._frameSticks(segment)].reverse()) {
        for (const endpoint of ["top", "bottom"]) {
          const handle = this.hooks.localToScreen(stick[endpoint]);
          if (Math.hypot(cursor.x - handle.x, cursor.y - handle.y) <= radius) {
            this.hooks.pushUndo("drag attack trail stick");
            this.stickId = stick.id;
            this.drag = { stickId: stick.id, endpoint };
            this.render();
            this.hooks.draw();
            return true;
          }
        }
      }
      for (const stick of [...this._frameSticks(segment)].reverse()) {
        const top = this.hooks.localToScreen(stick.top);
        const bottom = this.hooks.localToScreen(stick.bottom);
        const center = { x: (top.x + bottom.x) / 2, y: (top.y + bottom.y) / 2 };
        if (Math.hypot(cursor.x - center.x, cursor.y - center.y) <= CENTER_HANDLE_RADIUS * this.hooks.dpr() * 1.8) {
          this.hooks.pushUndo("move attack trail stick");
          this.stickId = stick.id;
          this.drag = {
            stickId: stick.id,
            mode: "center",
            startLocal: this.hooks.screenToLocal(cursor),
            startTop: { ...stick.top },
            startBottom: { ...stick.bottom },
          };
          this.render();
          this.hooks.draw();
          return true;
        }
      }
      for (const stick of [...this._frameSticks(segment)].reverse()) {
        const top = this.hooks.localToScreen(stick.top);
        const bottom = this.hooks.localToScreen(stick.bottom);
        if (this._distanceToSegment(cursor, top, bottom) <= 11 * this.hooks.dpr()) {
          this.stickId = stick.id;
          this.drag = null;
          this.render(); this.hooks.draw();
          return true;
        }
      }
      return false;
    }

    _distanceToSegment(pointValue, start, end) {
      const dx = end.x - start.x, dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared <= 0.0001) return Math.hypot(pointValue.x - start.x, pointValue.y - start.y);
      const phase = clamp(((pointValue.x - start.x) * dx + (pointValue.y - start.y) * dy) / lengthSquared, 0, 1, 0);
      return Math.hypot(pointValue.x - (start.x + dx * phase), pointValue.y - (start.y + dy * phase));
    }

    pointerMove(event) {
      if (!this.drag) return false;
      const stick = this._segment()?.sticks.find((entry) => entry.id === this.drag.stickId);
      if (!stick) return false;
      const cursor = this.hooks.stagePoint(event);
      const local = this.hooks.screenToLocal(cursor);
      if (this.drag.mode === "direction") {
        const pose = this._stickPose(stick);
        const desired = { x: local.x - pose.center.x, y: local.y - pose.center.y };
        const desiredLength = Math.hypot(desired.x, desired.y);
        if (desiredLength > 0.001) {
          const base = this._baseDirection(stick);
          const normalized = { x: desired.x / desiredLength, y: desired.y / desiredLength };
          const degrees = Math.atan2(base.x * normalized.y - base.y * normalized.x, base.x * normalized.x + base.y * normalized.y) * 180 / Math.PI;
          stick.directionOffset = Math.round(degrees * 10) / 10;
        }
        const center = this.hooks.localToScreen(pose.center);
        const handleLength = Math.hypot(cursor.x - center.x, cursor.y - center.y) / this.hooks.dpr();
        stick.tangentStrength = Math.round(clamp(
          handleLength / DIRECTION_HANDLE_UNIT_PX,
          DIRECTION_HANDLE_MIN_STRENGTH,
          DIRECTION_HANDLE_MAX_STRENGTH,
          stick.tangentStrength,
        ) * 100) / 100;
      } else if (this.drag.mode === "center") {
        const dx = local.x - this.drag.startLocal.x;
        const dy = local.y - this.drag.startLocal.y;
        stick.top = { x: Math.round((this.drag.startTop.x + dx) * 10) / 10, y: Math.round((this.drag.startTop.y + dy) * 10) / 10 };
        stick.bottom = { x: Math.round((this.drag.startBottom.x + dx) * 10) / 10, y: Math.round((this.drag.startBottom.y + dy) * 10) / 10 };
      } else {
        stick[this.drag.endpoint] = { x: Math.round(local.x * 10) / 10, y: Math.round(local.y * 10) / 10 };
      }
      this.pathCache.clear();
      this.hooks.markDirty();
      this.hooks.draw();
      return true;
    }

    pointerUp() {
      const hadDrag = Boolean(this.drag);
      this.drag = null;
      if (hadDrag) this.render();
      return hadDrag;
    }

    _bind() {
      const e = this.els;
      if (!e.attackTrailMode) return;
      e.attackTrailMode.addEventListener("change", () => {
        this.enabled = e.attackTrailMode.checked;
        this.picking = false;
        this.render(); this.hooks.draw();
      });
      e.attackTrailSegment.addEventListener("change", () => {
        this.segmentId = e.attackTrailSegment.value;
        this.stickId = this._segment()?.sticks[0]?.id || "";
        this.picking = false;
        this.render(); this.hooks.draw();
      });
      e.attackTrailNew.addEventListener("click", () => this._newSegment());
      e.attackTrailDelete.addEventListener("click", () => this._deleteSegment());
      e.attackTrailLayerToggle.addEventListener("click", () => this._toggleStickLayer());
      e.attackTrailTextureBrowse.addEventListener("click", () => e.attackTrailTextureFile.click());
      e.attackTrailTextureFile.addEventListener("change", () => this._uploadTexture(e.attackTrailTextureFile.files?.[0]));
      e.attackTrailColorMode.addEventListener("change", () => this._setColorMode(e.attackTrailColorMode.value));
      e.attackTrailColor.addEventListener("input", () => this._editSegment("color", e.attackTrailColor.value));
      e.attackTrailGradientColor.addEventListener("pointerdown", () => {
        if (this._segment()?.colorMode === "gradient" && this._gradientStop()) this.hooks.pushUndo("change attack trail gradient color");
      });
      e.attackTrailGradientColor.addEventListener("input", () => this._setGradientStopColor(e.attackTrailGradientColor.value));
      e.attackTrailGradientBar.addEventListener("pointerdown", (event) => this._gradientPointerDown(event));
      e.attackTrailGradientBar.addEventListener("pointermove", (event) => this._gradientPointerMove(event));
      e.attackTrailGradientBar.addEventListener("pointerup", (event) => this._gradientPointerUp(event));
      e.attackTrailGradientBar.addEventListener("pointercancel", (event) => this._gradientPointerUp(event));
      e.attackTrailGradientBar.addEventListener("dblclick", (event) => {
        if (event.target.closest?.(".trailGradientStop")) e.attackTrailGradientColor.click();
      });
      window.addEventListener("keydown", (event) => {
        if (event.key !== "Delete" || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
        if (this.enabled && this._segment()?.colorMode === "gradient" && this.gradientStopId) {
          event.preventDefault();
          this._deleteGradientStop();
        }
      });
      e.attackTrailPickColor.addEventListener("click", () => { this.picking = !this.picking; this.render(); this.hooks.draw(); });
      e.attackTrailGuideToggle.addEventListener("click", () => {
        if (!this.enabled) return;
        this.guidesVisible = !this.guidesVisible;
        this._syncGuideToggle(true);
        this.hooks.draw();
      });
      for (const [id, key, min, max] of [
        ["attackTrailTailSamples", "tailSamples", 4, 8], ["attackTrailPathColumns", "pathColumns", 8, 96],
      ]) e[id].addEventListener("input", () => this._editSegment(key, clamp(e[id].value, min, max, min)));
      e.attackTrailBeforeTimeMs.addEventListener("input", () => this._editChaseTime("before", e.attackTrailBeforeTimeMs.value));
      e.attackTrailAfterTimeMs.addEventListener("input", () => this._editChaseTime("after", e.attackTrailAfterTimeMs.value));
      e.attackTrailTailFadeStart.addEventListener("input", () => this._editSegment("tailFadeStart", clamp(e.attackTrailTailFadeStart.value, 0, 95, 60) / 100));
      e.attackTrailHeadCurvature.addEventListener("input", () => this._editSegment("headCurvature", clamp(e.attackTrailHeadCurvature.value, -100, 100, 0) / 100));
      e.attackTrailAddStick.addEventListener("click", () => this._addStick());
      e.attackTrailDeleteStick.addEventListener("click", () => this._deleteStick());
      e.attackTrailReverse.addEventListener("click", () => {
        const stick = this._stick();
        if (!stick) return;
        this.hooks.pushUndo("flip attack trail stick face");
        stick.reverseDirection = !stick.reverseDirection;
        stick.directionOffset = ((stick.directionOffset + 360) % 360) - 180;
        this._updateGenerated(this._segment());
        this.pathCache.clear(); this.hooks.markDirty(); this.render(); this.hooks.draw();
      });
    }

    _bindingKey() {
      const group = this.hooks.group();
      return group ? `${group.profileId}/${group.name}` : "";
    }

    _segments() {
      return this.data.bindings[this._bindingKey()] || [];
    }

    _displaySegments() {
      const segments = this._segments();
      return segments.length ? segments : [this._presetSegment()].filter(Boolean);
    }

    _presetSegment() {
      const key = this._bindingKey();
      if (!key) return null;
      const [profileId, animationId] = key.split("/");
      return this._normalizeSegment({
        id: PRESET_SEGMENT_ID,
        name: "默认拖尾预设",
        profileId,
        animationId,
        generated: false,
        texture: clone(this.data.presetTexture || DEFAULT_PRESET_TEXTURE),
      }, 0, key);
    }

    _isPresetSegment(segment) {
      return segment?.id === PRESET_SEGMENT_ID;
    }

    _materializePreset() {
      const preview = this._segment();
      if (!this._isPresetSegment(preview)) return preview;
      const key = this._bindingKey();
      const segment = this._normalizeSegment({
        ...clone(preview),
        id: randomId("trail"),
        name: "默认拖尾",
        generated: false,
      }, 0, key);
      (this.data.bindings[key] ||= []).push(segment);
      this.segmentId = segment.id;
      return segment;
    }

    _segment() {
      const segment = this._segments().find((entry) => entry.id === this.segmentId);
      if (segment) return segment;
      return this.segmentId === PRESET_SEGMENT_ID && !this._segments().length ? this._presetSegment() : null;
    }

    _stick() {
      return this._segment()?.sticks.find((entry) => entry.id === this.stickId) || null;
    }

    _frameSticks(segment = this._segment()) {
      if (!segment) return [];
      const frame = this.hooks.selectedFrame();
      return segment.sticks.filter((stick) => stick.frame === frame);
    }

    _newSegment() {
      const key = this._bindingKey();
      if (!key) return;
      this.hooks.pushUndo("new attack trail segment");
      const [profileId, animationId] = key.split("/");
      const segment = this._normalizeSegment({ id: randomId("trail"), name: `Trail ${this._segments().length + 1}`, profileId, animationId }, this._segments().length, key);
      (this.data.bindings[key] ||= []).push(segment);
      this.segmentId = segment.id;
      this.stickId = "";
      this.hooks.markDirty(); this.render(); this.hooks.draw();
    }

    _deleteSegment() {
      const segment = this._segment();
      if (!segment || this._isPresetSegment(segment) || !window.confirm(`删除拖尾段“${segment.name}”？`)) return;
      this.hooks.pushUndo("delete attack trail segment");
      this.data.bindings[this._bindingKey()] = this._segments().filter((entry) => entry.id !== segment.id);
      this.segmentId = this._segments()[0]?.id || "";
      this.stickId = this._segment()?.sticks[0]?.id || "";
      this.hooks.markDirty(); this.render(); this.hooks.draw();
    }

    _editSegment(key, value) {
      const segment = this._materializePreset();
      if (!segment) return;
      segment[key] = value;
      this._updateGenerated(segment);
      this.pathCache.clear(); this.processed.clear();
      this.hooks.markDirty(); this.render(); this.hooks.draw();
    }

    _setColorMode(value) {
      const mode = normalizeColorMode(value);
      const wasPreset = this._isPresetSegment(this._segment());
      this.hooks.pushUndo("change attack trail color mode");
      const segment = this._materializePreset();
      if (!segment) return;
      segment.colorMode = mode;
      if (mode === "gradient") {
        segment.gradientStops = normalizeGradientStops(segment.gradientStops, segment.color);
        this.gradientStopId = segment.gradientStops[0].id;
        if (wasPreset) segment.name = `渐变拖尾 ${this._segments().length}`;
      }
      this.picking = false;
      this._updateGenerated(segment);
      this.processed.clear();
      this.hooks.markDirty(); this.render(); this.hooks.draw();
    }

    _gradientStop(segment = this._segment()) {
      return segment?.gradientStops?.find((stop) => stop.id === this.gradientStopId) || null;
    }

    _gradientColorAt(stops, position) {
      const normalized = normalizeGradientStops(stops);
      const sample = clamp(position, 0, 1, 0);
      if (sample <= normalized[0].position) return colorChannels(normalized[0].color);
      for (let index = 1; index < normalized.length; index += 1) {
        const left = normalized[index - 1], right = normalized[index];
        if (sample > right.position) continue;
        const phase = clamp((sample - left.position) / Math.max(0.000001, right.position - left.position), 0, 1, 0);
        const a = colorChannels(left.color), b = colorChannels(right.color);
        return a.map((channel, channelIndex) => channel + (b[channelIndex] - channel) * phase);
      }
      return colorChannels(normalized.at(-1).color);
    }

    _gradientCss(stops) {
      return normalizeGradientStops(stops).map((stop) => `${stop.color} ${Math.round(stop.position * 1000) / 10}%`).join(", ");
    }

    _renderGradientEditor(segment) {
      const e = this.els;
      if (!segment || segment.colorMode !== "gradient") return;
      segment.gradientStops = normalizeGradientStops(segment.gradientStops, segment.color);
      if (!this._gradientStop(segment)) this.gradientStopId = segment.gradientStops[0].id;
      e.attackTrailGradientBar.style.background = `linear-gradient(to right, ${this._gradientCss(segment.gradientStops)})`;
      e.attackTrailGradientBar.innerHTML = segment.gradientStops.map((stop) => (
        `<button type="button" class="trailGradientStop${stop.id === this.gradientStopId ? " selected" : ""}" data-gradient-stop="${this._escape(stop.id)}" style="left:${stop.position * 100}%;background:${stop.color}" title="${Math.round(stop.position * 100)}% · ${stop.color}" aria-label="渐变节点 ${Math.round(stop.position * 100)}% ${stop.color}"></button>`
      )).join("");
      const selected = this._gradientStop(segment);
      e.attackTrailGradientColor.disabled = !selected;
      if (selected) {
        e.attackTrailGradientColor.value = selected.color;
        e.attackTrailGradientPosition.value = `${Math.round(selected.position * 100)}%`;
        e.attackTrailGradientPosition.textContent = `${Math.round(selected.position * 100)}%`;
      }
    }

    _gradientPosition(event) {
      const rect = this.els.attackTrailGradientBar.getBoundingClientRect();
      return clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1, 0);
    }

    _gradientPointerDown(event) {
      const segment = this._segment();
      if (!segment || segment.colorMode !== "gradient" || event.button !== 0) return;
      const stopButton = event.target.closest?.(".trailGradientStop");
      if (stopButton) {
        this.gradientStopId = stopButton.dataset.gradientStop;
        this.gradientDrag = { pointerId: event.pointerId, undoPushed: false };
      } else {
        if (segment.gradientStops.length >= 16) return this.hooks.status("渐变最多支持 16 个颜色节点。", true);
        this.hooks.pushUndo("add attack trail gradient stop");
        const position = this._gradientPosition(event);
        const stop = { id: randomId("gradient"), position, color: channelsToColor(this._gradientColorAt(segment.gradientStops, position)) };
        segment.gradientStops.push(stop);
        segment.gradientStops.sort((a, b) => a.position - b.position);
        this.gradientStopId = stop.id;
        this.gradientDrag = { pointerId: event.pointerId, undoPushed: true };
        this.processed.clear(); this.hooks.markDirty(); this.hooks.draw();
      }
      this.els.attackTrailGradientBar.focus({ preventScroll: true });
      this.els.attackTrailGradientBar.setPointerCapture(event.pointerId);
      this._renderGradientEditor(segment);
      event.preventDefault();
    }

    _gradientPointerMove(event) {
      if (!this.gradientDrag || this.gradientDrag.pointerId !== event.pointerId) return;
      const segment = this._segment(), stop = this._gradientStop(segment);
      if (!segment || !stop) return;
      const position = this._gradientPosition(event);
      if (Math.abs(position - stop.position) < 0.0001) return;
      if (!this.gradientDrag.undoPushed) {
        this.hooks.pushUndo("move attack trail gradient stop");
        this.gradientDrag.undoPushed = true;
      }
      stop.position = position;
      segment.gradientStops.sort((a, b) => a.position - b.position);
      this.processed.clear(); this.hooks.markDirty(); this._renderGradientEditor(segment); this.hooks.draw();
    }

    _gradientPointerUp(event) {
      if (!this.gradientDrag || this.gradientDrag.pointerId !== event.pointerId) return;
      this.gradientDrag = null;
      if (this.els.attackTrailGradientBar.hasPointerCapture(event.pointerId)) this.els.attackTrailGradientBar.releasePointerCapture(event.pointerId);
    }

    _setGradientStopColor(value) {
      const stop = this._gradientStop();
      if (!stop) return;
      stop.color = normalizeColor(value, stop.color);
      this.processed.clear(); this.hooks.markDirty(); this._renderGradientEditor(this._segment()); this.hooks.draw();
    }

    _deleteGradientStop() {
      const segment = this._segment();
      const stop = this._gradientStop(segment);
      if (!segment || !stop) return;
      if (segment.gradientStops.length <= 2) return this.hooks.status("渐变至少保留两个颜色节点。", true);
      this.hooks.pushUndo("delete attack trail gradient stop");
      const oldIndex = segment.gradientStops.indexOf(stop);
      segment.gradientStops = segment.gradientStops.filter((entry) => entry.id !== stop.id);
      this.gradientStopId = segment.gradientStops[Math.min(oldIndex, segment.gradientStops.length - 1)].id;
      this.processed.clear(); this.hooks.markDirty(); this.render(); this.hooks.draw();
    }

    _chaseTimes(segment) {
      const durationMs = Math.max(1, Math.round((this._timing(segment).times.at(-1) || 0.0001) * 1000));
      const beforeMs = Math.round(durationMs * (1 - segment.beforeStopChaseMultiplier));
      const afterMs = beforeMs > 0
        ? Math.max(1, Math.round(beforeMs / Math.max(0.1, segment.afterStopChaseMultiplier)))
        : 0;
      return { durationMs, beforeMs, afterMs };
    }

    _editChaseTime(phase, rawValue) {
      const segment = this._segment();
      if (!segment) return;
      const times = this._chaseTimes(segment);
      if (phase === "before") {
        const beforeMs = Math.round(clamp(rawValue, 0, times.durationMs, times.beforeMs));
        this._editSegment("beforeStopChaseMultiplier", clamp(1 - beforeMs / times.durationMs, 0, 1, DEFAULT_BEFORE_CHASE_MULTIPLIER));
        return;
      }
      if (times.beforeMs <= 0) return;
      const afterMs = Math.round(clamp(rawValue, 1, 60000, times.afterMs || 1));
      this._editSegment("afterStopChaseMultiplier", clamp(times.beforeMs / afterMs, 0.1, 20, DEFAULT_AFTER_CHASE_MULTIPLIER));
    }

    _toggleStickLayer() {
      const stick = this._stick();
      if (!stick) return;
      this.hooks.pushUndo("toggle attack trail stick layer");
      this._editStick("layer", stick.layer === "front" ? "behind" : "front");
    }

    _addStick() {
      if (!this._segment()) return;
      this.hooks.pushUndo("add attack trail stick");
      const segment = this._materializePreset();
      if (!segment) return;
      const frame = this.hooks.selectedFrame();
      const firstLaterIndex = segment.sticks.findIndex((stick) => stick.frame > frame);
      const insertIndex = firstLaterIndex < 0 ? segment.sticks.length : firstLaterIndex;
      const previous = insertIndex > 0 ? segment.sticks[insertIndex - 1] : null;
      const next = insertIndex < segment.sticks.length ? segment.sticks[insertIndex] : null;
      let top = { x: -90, y: -120 };
      let bottom = { x: 90, y: 120 };
      if (previous && next && previous.frame < frame && next.frame > frame) {
        const phase = clamp((frame - previous.frame) / Math.max(1, next.frame - previous.frame), 0, 1, 0.5);
        top = { x: previous.top.x + (next.top.x - previous.top.x) * phase, y: previous.top.y + (next.top.y - previous.top.y) * phase };
        bottom = { x: previous.bottom.x + (next.bottom.x - previous.bottom.x) * phase, y: previous.bottom.y + (next.bottom.y - previous.bottom.y) * phase };
      } else if (previous) {
        top = { x: previous.top.x + 24, y: previous.top.y };
        bottom = { x: previous.bottom.x + 24, y: previous.bottom.y };
      } else if (next) {
        top = { x: next.top.x - 24, y: next.top.y };
        bottom = { x: next.bottom.x - 24, y: next.bottom.y };
      }
      const stick = this._normalizeStick({
        id: randomId("stick"), frame, phaseMode: "auto",
        top, bottom,
        layer: previous?.layer || next?.layer || segment.layer,
        reverseDirection: previous?.reverseDirection ?? next?.reverseDirection ?? false,
        directionOffset: previous?.directionOffset ?? next?.directionOffset ?? 0,
        tangentStrength: previous?.tangentStrength ?? next?.tangentStrength ?? 0.8,
      }, insertIndex);
      segment.sticks.splice(insertIndex, 0, stick);
      this._renumberAndAutoPhase(segment);
      this._updateGenerated(segment);
      this.stickId = stick.id;
      this.guidesVisible = true;
      this._syncGuideToggle(true);
      this.pathCache.clear(); this.hooks.markDirty(); this.render(); this.hooks.draw();
    }

    _deleteStick() {
      const segment = this._segment();
      const stick = this._stick();
      if (!segment || !stick) return;
      this.hooks.pushUndo("delete attack trail stick");
      segment.sticks = segment.sticks.filter((entry) => entry.id !== stick.id);
      this._renumberAndAutoPhase(segment);
      this._updateGenerated(segment);
      this.stickId = this._frameSticks(segment)[0]?.id || "";
      this.pathCache.clear(); this.hooks.markDirty(); this.render(); this.hooks.draw();
    }

    _editStick(key, value, manualPhase = false) {
      const stick = this._stick();
      if (!stick) return;
      stick[key] = value;
      if (manualPhase) stick.phaseMode = "manual";
      this._updateGenerated(this._segment());
      this.pathCache.clear(); this.hooks.markDirty(); this.render(); this.hooks.draw();
    }

    _renumberAndAutoPhase(segment) {
      segment.sticks.forEach((stick, index) => { stick.order = index; });
      const frames = new Map();
      for (const stick of segment.sticks) {
        (frames.get(stick.frame) || frames.set(stick.frame, []).get(stick.frame)).push(stick);
      }
      for (const sticks of frames.values()) {
        let index = 0;
        while (index < sticks.length) {
          if (sticks[index].phaseMode === "manual") { index += 1; continue; }
          const start = index;
          while (index < sticks.length && sticks[index].phaseMode !== "manual") index += 1;
          const lower = start > 0 ? sticks[start - 1].framePhase : 0;
          const upper = index < sticks.length ? sticks[index].framePhase : 1;
          const count = index - start;
          for (let offset = 0; offset < count; offset += 1) {
            sticks[start + offset].framePhase = lower + (upper - lower) * (offset + 1) / (count + 1);
          }
        }
        let previous = -0.0001;
        sticks.forEach((stick, stickIndex) => {
          const maximum = 1 - (sticks.length - 1 - stickIndex) * 0.0001;
          stick.framePhase = clamp(stick.framePhase, previous + 0.0001, maximum, (stickIndex + 1) / (sticks.length + 1));
          previous = stick.framePhase;
        });
      }
    }

    async _uploadTexture(file) {
      if (!file || !this._segment()) return;
      if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
        this.hooks.status("攻击拖尾纹理目前仅支持 PNG。", true); return;
      }
      try {
        const data = await this._readDataUrl(file);
        const response = await fetch("/api/attack-trail-texture", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ projectId: this.hooks.projectId(), profileId: this.hooks.group().profileId, animationId: this.hooks.group().name, name: file.name, data }),
        });
        if (!response.ok) throw new Error(await response.text());
        const result = await response.json();
        this.hooks.pushUndo("import attack trail texture");
        const segment = this._materializePreset();
        segment.texture = result.texture;
        this._updateGenerated(segment);
        this.images.delete(result.texture.path);
        this.processed.clear();
        this.hooks.markDirty(); this.render(); this.hooks.draw();
        this.hooks.status(`拖尾纹理已复制到稳定项目路径：${result.texture.path}`);
      } catch (error) {
        this.hooks.status(`拖尾纹理导入失败：${error.message}`, true);
      } finally {
        this.els.attackTrailTextureFile.value = "";
      }
    }

    _updateGenerated(segment) {
      if (!segment) return false;
      const validTexture = Boolean(segment.texture?.path)
        && (segment.colorMode !== "original" || segment.texture.hasEffectiveAlpha === true);
      segment.generated = validTexture && segment.sticks.length >= 2;
      return segment.generated;
    }

    _pickColor(event) {
      const image = this.hooks.currentImage();
      if (!image) return;
      const local = this.hooks.screenToLocal(this.hooks.stagePoint(event));
      const x = Math.floor(local.x + image.width / 2);
      const y = Math.floor(local.y + image.height / 2);
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) return this.hooks.status("请在角色 Sprite 的有效像素上取色。", true);
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(image, 0, 0);
      const rgba = context.getImageData(x, y, 1, 1).data;
      if (rgba[3] < 8) return this.hooks.status("透明像素不接受取色；请点击角色的有效 Sprite 像素。", true);
      const color = `#${[rgba[0], rgba[1], rgba[2]].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
      const segment = this._materializePreset();
      segment.color = color;
      segment.colorMode = "solid";
      this.picking = false;
      this.processed.clear(); this.hooks.markDirty(); this.render(); this.hooks.draw();
      this.hooks.status(`已从角色源图像素取色：${color}`);
    }

    _timing(segment) {
      const absolute = segment.sticks.map((stick) => this.hooks.frameArrival(stick.frame, stick.framePhase));
      for (let index = 1; index < absolute.length; index += 1) absolute[index] = Math.max(absolute[index], absolute[index - 1] + 0.0001);
      const origin = absolute[0] || 0;
      return { absolute, times: absolute.map((time) => time - origin) };
    }

    _pathState(segment) {
      const timing = this._timing(segment);
      const signature = JSON.stringify([segment.sticks, timing.absolute, segment.tailSamples, segment.stableSeed, segment.speedVariation]);
      const cached = this.pathCache.get(segment.id);
      if (cached?.signature === signature) return cached;
      const count = Math.max(32, Math.min(256, segment.pathCacheSamples || 192));
      const duration = timing.times.at(-1) || 0.0001;
      const samples = [];
      let distance = 0;
      let previous = this._pose(segment.sticks, timing.times, 0);
      for (let index = 0; index < count; index += 1) {
        const time = duration * index / (count - 1);
        const pose = this._pose(segment.sticks, timing.times, time);
        if (index) distance += Math.hypot(pose.center.x - previous.center.x, pose.center.y - previous.center.y);
        samples.push({ time, distance, pose }); previous = pose;
      }
      let seed = (segment.stableSeed || 73129) >>> 0;
      const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
      const speeds = [];
      const variation = segment.speedVariation ?? 0.008;
      for (let index = 0; index < segment.tailSamples; index += 1) speeds.push(SPEED_PROFILE[index] + (random() * 2 - 1) * variation);
      const mean = speeds.reduce((sum, value) => sum + value, 0) / speeds.length;
      const state = { signature, timing, samples, total: Math.max(0.001, distance), speeds: speeds.map((value) => value / mean) };
      this.pathCache.set(segment.id, state);
      return state;
    }

    _pose(sticks, times, time) {
      if (!sticks.length) return { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, center: { x: 0, y: 0 } };
      if (sticks.length === 1 || time <= times[0]) return this._stickPose(sticks[0]);
      if (time >= times.at(-1)) return this._stickPose(sticks.at(-1));
      let index = 0;
      while (index + 1 < times.length && time > times[index + 1]) index += 1;
      const a = sticks[index], b = sticks[index + 1], pa = this._stickPose(a), pb = this._stickPose(b);
      const t = clamp((time - times[index]) / Math.max(0.0001, times[index + 1] - times[index]), 0, 1, 0);
      const da = this._direction(a), db = this._direction(b);
      const topDistance = Math.hypot(pb.top.x - pa.top.x, pb.top.y - pa.top.y);
      const bottomDistance = Math.hypot(pb.bottom.x - pa.bottom.x, pb.bottom.y - pa.bottom.y);
      const top = this._hermite(
        pa.top,
        { x: da.x * topDistance * a.tangentStrength, y: da.y * topDistance * a.tangentStrength },
        pb.top,
        { x: db.x * topDistance * b.tangentStrength, y: db.y * topDistance * b.tangentStrength },
        t,
      );
      const bottom = this._hermite(
        pa.bottom,
        { x: da.x * bottomDistance * a.tangentStrength, y: da.y * bottomDistance * a.tangentStrength },
        pb.bottom,
        { x: db.x * bottomDistance * b.tangentStrength, y: db.y * bottomDistance * b.tangentStrength },
        t,
      );
      return { top, bottom, center: { x: (top.x + bottom.x) / 2, y: (top.y + bottom.y) / 2 } };
    }

    _stickPose(stick) {
      const top = stick.reverseDirection ? stick.bottom : stick.top;
      const bottom = stick.reverseDirection ? stick.top : stick.bottom;
      return { top, bottom, center: { x: (top.x + bottom.x) / 2, y: (top.y + bottom.y) / 2 } };
    }
    _direction(stick) {
      const base = this._baseDirection(stick);
      const radians = clamp(stick.directionOffset, -180, 180, 0) * Math.PI / 180;
      return { x: base.x * Math.cos(radians) - base.y * Math.sin(radians), y: base.x * Math.sin(radians) + base.y * Math.cos(radians) };
    }
    _baseDirection(stick) {
      const pose = this._stickPose(stick);
      const dx = pose.bottom.x - pose.top.x, dy = pose.bottom.y - pose.top.y, length = Math.max(0.001, Math.hypot(dx, dy));
      return { x: -dy / length, y: dx / length };
    }
    _directionAtTime(sticks, times, time) {
      if (!sticks.length) return { x: 1, y: 0 };
      if (sticks.length === 1 || time <= times[0]) return this._direction(sticks[0]);
      if (time >= times.at(-1)) return this._direction(sticks.at(-1));
      let index = 0;
      while (index + 1 < times.length && time > times[index + 1]) index += 1;
      const phase = clamp((time - times[index]) / Math.max(0.0001, times[index + 1] - times[index]), 0, 1, 0);
      const a = this._direction(sticks[index]), b = this._direction(sticks[index + 1]);
      const x = a.x + (b.x - a.x) * phase, y = a.y + (b.y - a.y) * phase;
      const length = Math.max(0.001, Math.hypot(x, y));
      return { x: x / length, y: y / length };
    }
    _directionHandleScreen(stick) {
      const pose = this._stickPose(stick);
      const center = this.hooks.localToScreen(pose.center);
      const direction = this._direction(stick);
      const sample = this.hooks.localToScreen({ x: pose.center.x + direction.x, y: pose.center.y + direction.y });
      const dx = sample.x - center.x, dy = sample.y - center.y, length = Math.max(0.001, Math.hypot(dx, dy));
      const screenDirection = { x: dx / length, y: dy / length };
      const strength = clamp(
        stick.tangentStrength,
        DIRECTION_HANDLE_MIN_STRENGTH,
        DIRECTION_HANDLE_MAX_STRENGTH,
        0.8,
      );
      const arrowLength = strength * DIRECTION_HANDLE_UNIT_PX * this.hooks.dpr();
      return { center, direction: screenDirection, arrow: { x: center.x + screenDirection.x * arrowLength, y: center.y + screenDirection.y * arrowLength } };
    }
    _layerAtTime(sticks, times, time, fallback = "behind") {
      if (!sticks.length) return fallback;
      if (sticks.length === 1 || time <= times[0]) return sticks[0].layer || fallback;
      if (time >= times.at(-1)) return sticks.at(-1).layer || fallback;
      let index = 0;
      while (index + 1 < times.length && time > times[index + 1]) index += 1;
      const span = Math.max(0.0001, times[index + 1] - times[index]);
      const phase = clamp((time - times[index]) / span, 0, 1, 0);
      return phase < 0.5 ? (sticks[index].layer || fallback) : (sticks[index + 1].layer || fallback);
    }
    _hermite(a, ta, b, tb, t) {
      const t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      return { x: h00 * a.x + h10 * ta.x + h01 * b.x + h11 * tb.x, y: h00 * a.y + h10 * ta.y + h01 * b.y + h11 * tb.y };
    }

    _distanceAtTime(state, time) { return this._interpolateSamples(state.samples, "time", "distance", time); }
    _timeAtDistance(state, distance) { return this._interpolateSamples(state.samples, "distance", "time", distance); }
    _interpolateSamples(samples, key, valueKey, target) {
      target = clamp(target, samples[0][key], samples.at(-1)[key], samples[0][key]);
      let low = 0, high = samples.length - 1;
      while (low + 1 < high) { const middle = (low + high) >> 1; if (samples[middle][key] <= target) low = middle; else high = middle; }
      const span = samples[high][key] - samples[low][key]; const f = span <= 1e-8 ? 0 : (target - samples[low][key]) / span;
      return samples[low][valueKey] + (samples[high][valueKey] - samples[low][valueKey]) * f;
    }

    _drawSegment(segment, alpha, layer) {
      const image = this.images.get(segment.texture.path);
      if (!image) {
        this.hooks.loadTexture(segment.texture).then((loaded) => { this.images.set(segment.texture.path, loaded); this.hooks.draw(); }).catch(() => {});
        return;
      }
      const state = this._pathState(segment);
      const local = this.hooks.animationElapsed() - state.timing.absolute[0];
      if (local < 0) return;
      const duration = state.timing.times.at(-1);
      const motionTime = Math.min(local, duration);
      const currentDistance = this._distanceAtTime(state, motionTime);
      const catchElapsed = Math.max(0, local - duration);
      const animationTiming = this.hooks.animationTiming?.() || { duration: state.timing.absolute.at(-1), lastPlayableFrameStart: state.timing.absolute.at(-1) };
      const lastArrival = state.timing.absolute.at(-1);
      const finishAt = animationTiming.lastPlayableFrameStart > lastArrival + 0.0001
        ? animationTiming.lastPlayableFrameStart
        : Math.max(lastArrival + 0.0001, animationTiming.duration);
      const forcedFinishLocal = Math.max(duration + 0.0001, finishAt - state.timing.absolute[0]);
      if (local >= forcedFinishLocal) return;
      const forcedPhase = clamp((local - duration) / Math.max(0.0001, forcedFinishLocal - duration), 0, 1, 0);
      const forcedDistance = currentDistance * forcedPhase * forcedPhase * (3 - 2 * forcedPhase);
      const averageFrontSpeed = state.total / Math.max(0.0001, duration);
      const tails = this._tailDistances(state, segment, currentDistance, catchElapsed, duration, forcedDistance);
      // A fully collapsed trail is only the mesh's zero-area cross-section.
      // Do not expose that implementation detail as a visible line at either
      // the beginning or the end of the effect.
      if (currentDistance <= 0.01) return;
      const capCatchDuration = duration * Math.max(0, 1 - segment.beforeStopChaseMultiplier)
        / Math.max(0.0001, segment.afterStopChaseMultiplier);
      if (local > duration + capCatchDuration + 0.05) return;
      const columns = Math.min(192, Math.max(16, Math.round(segment.pathColumns) * 2));
      // Tail speed samples describe lag only. They are deliberately not the
      // visible cross-section tessellation: five mesh rows turn a curved head
      // into a diamond-shaped point.
      const rows = Math.max(TRAIL_MESH_WIDTH_ROWS, tails.length);
      const currentPathTime = this._timeAtDistance(state, currentDistance);
      const currentPose = this._pose(segment.sticks, state.timing.times, currentPathTime);
      const headDirection = this._directionAtTime(segment.sticks, state.timing.times, currentPathTime);
      const headHalfWidth = Math.hypot(currentPose.bottom.x - currentPose.top.x, currentPose.bottom.y - currentPose.top.y) * 0.5;
      // Preserve the complete brush in the terminal cap. Its depth must keep
      // the curved hard head from folding through the authored rough tail.
      const terminalCapDepth = Math.max(
        2,
        headHalfWidth * (Math.abs(segment.headCurvature) + FINAL_HEAD_CAP_MARGIN_RATIO),
      );
      const terminalCapBlend = this._terminalHeadCapBlend(
        currentDistance,
        tails,
        terminalCapDepth,
        catchElapsed,
      );
      const grid = [], gridTimes = [];
      for (let row = 0; row < rows; row += 1) {
        const v = row / (rows - 1);
        const rowTailDistance = this._meshTailDistance(tails, v);
        const line = [], lineTimes = [];
        for (let column = 0; column < columns; column += 1) {
          const u = column / (columns - 1); let localPoint, sampleTime;
          const distance = currentDistance + (rowTailDistance - currentDistance) * u;
          sampleTime = this._timeAtDistance(state, distance);
          const pose = this._pose(segment.sticks, state.timing.times, sampleTime);
          localPoint = { x: pose.top.x + (pose.bottom.x - pose.top.x) * v, y: pose.top.y + (pose.bottom.y - pose.top.y) * v };
          const headProfile = this._headCurveProfile(v) * this._headCurveBlend(u);
          const bulge = segment.headCurvature * headHalfWidth * headProfile;
          localPoint.x -= headDirection.x * bulge;
          localPoint.y -= headDirection.y * bulge;
          if (terminalCapBlend > 0) {
            const capBase = {
              x: currentPose.top.x + (currentPose.bottom.x - currentPose.top.x) * v,
              y: currentPose.top.y + (currentPose.bottom.y - currentPose.top.y) * v,
            };
            const capOffset = bulge + terminalCapDepth * u;
            const capPoint = {
              x: capBase.x - headDirection.x * capOffset,
              y: capBase.y - headDirection.y * capOffset,
            };
            localPoint.x += (capPoint.x - localPoint.x) * terminalCapBlend;
            localPoint.y += (capPoint.y - localPoint.y) * terminalCapBlend;
            if (terminalCapBlend >= 0.5) sampleTime = currentPathTime;
          }
          line.push(this.hooks.localToScreen(localPoint));
          lineTimes.push(sampleTime);
        }
        grid.push(line);
        gridTimes.push(lineTimes);
      }
      const texture = this._processedTexture(image, segment);
      const ctx = this.hooks.ctx;
      if (this._drawGpuMesh(texture, grid, gridTimes, segment, state, layer, ctx.canvas.width, ctx.canvas.height)) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(this.gpuCanvas, 0, 0);
        ctx.restore();
        return;
      }
      if (this.meshCanvas.width !== ctx.canvas.width || this.meshCanvas.height !== ctx.canvas.height) {
        this.meshCanvas.width = ctx.canvas.width;
        this.meshCanvas.height = ctx.canvas.height;
        this.meshMaskCanvas.width = ctx.canvas.width;
        this.meshMaskCanvas.height = ctx.canvas.height;
        this.meshSeamCanvas.width = ctx.canvas.width;
        this.meshSeamCanvas.height = ctx.canvas.height;
        this.meshRepairCanvas.width = ctx.canvas.width;
        this.meshRepairCanvas.height = ctx.canvas.height;
      }
      const meshCtx = this.meshContext;
      const maskCtx = this.meshMaskContext;
      meshCtx.setTransform(1, 0, 0, 1, 0, 0);
      meshCtx.globalCompositeOperation = "source-over";
      meshCtx.clearRect(0, 0, this.meshCanvas.width, this.meshCanvas.height);
      maskCtx.setTransform(1, 0, 0, 1, 0, 0);
      maskCtx.globalCompositeOperation = "lighter";
      maskCtx.clearRect(0, 0, this.meshMaskCanvas.width, this.meshMaskCanvas.height);
      maskCtx.fillStyle = "#fff";
      const seamCtx = this.meshSeamContext;
      seamCtx.setTransform(1, 0, 0, 1, 0, 0);
      seamCtx.globalCompositeOperation = "source-over";
      seamCtx.clearRect(0, 0, this.meshSeamCanvas.width, this.meshSeamCanvas.height);
      seamCtx.strokeStyle = "#fff";
      seamCtx.lineWidth = 1.8 * this.hooks.dpr();
      seamCtx.lineCap = "round";
      seamCtx.lineJoin = "round";
      for (let row = 0; row < rows - 1; row += 1) for (let column = 0; column < columns - 1; column += 1) {
        const u0 = column / (columns - 1) * texture.width;
        const u1 = (column + 1) / (columns - 1) * texture.width;
        const v0 = row / (rows - 1) * texture.height, v1 = (row + 1) / (rows - 1) * texture.height;
        const triangles = [
          { source: [{ x: u0, y: v0 }, { x: u1, y: v0 }, { x: u1, y: v1 }], target: [grid[row][column], grid[row][column + 1], grid[row + 1][column + 1]], times: [gridTimes[row][column], gridTimes[row][column + 1], gridTimes[row + 1][column + 1]] },
          { source: [{ x: u0, y: v0 }, { x: u1, y: v1 }, { x: u0, y: v1 }], target: [grid[row][column], grid[row + 1][column + 1], grid[row + 1][column]], times: [gridTimes[row][column], gridTimes[row + 1][column + 1], gridTimes[row + 1][column]] },
        ];
        let cellVisible = false;
        for (const triangle of triangles) {
          const triangleTime = triangle.times.reduce((sum, value) => sum + value, 0) / triangle.times.length;
          if (this._layerAtTime(segment.sticks, state.timing.times, triangleTime, segment.layer) !== layer) continue;
          cellVisible = true;
          this._fillTriangle(maskCtx, triangle.target);
          this._drawTriangle(meshCtx, texture, triangle.source, triangle.target);
        }
        if (cellVisible) {
          this._strokeSeam(seamCtx, grid[row][column], grid[row + 1][column + 1]);
          if (column > 0) this._strokeSeam(seamCtx, grid[row][column], grid[row + 1][column]);
          if (row > 0) this._strokeSeam(seamCtx, grid[row][column], grid[row][column + 1]);
        }
      }
      meshCtx.globalCompositeOperation = "destination-in";
      meshCtx.drawImage(this.meshMaskCanvas, 0, 0);
      meshCtx.globalCompositeOperation = "source-over";
      const repairCtx = this.meshRepairContext;
      repairCtx.setTransform(1, 0, 0, 1, 0, 0);
      repairCtx.globalCompositeOperation = "source-over";
      repairCtx.filter = "none";
      repairCtx.globalAlpha = 1;
      repairCtx.clearRect(0, 0, this.meshRepairCanvas.width, this.meshRepairCanvas.height);
      repairCtx.filter = `blur(${1.15 * this.hooks.dpr()}px)`;
      repairCtx.drawImage(this.meshCanvas, 0, 0);
      repairCtx.filter = "none";
      repairCtx.globalCompositeOperation = "destination-in";
      repairCtx.drawImage(this.meshSeamCanvas, 0, 0);
      repairCtx.globalCompositeOperation = "destination-in";
      repairCtx.drawImage(this.meshMaskCanvas, 0, 0);
      repairCtx.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.meshCanvas, 0, 0);
      ctx.globalAlpha = alpha * 0.92;
      ctx.drawImage(this.meshRepairCanvas, 0, 0);
      ctx.restore();
    }

    _tailDistances(state, segment, currentDistance, catchElapsed, duration, forcedDistance = 0) {
      const averageFrontSpeed = state.total / Math.max(0.0001, duration);
      const lagRatio = 1 - segment.beforeStopChaseMultiplier;
      const distances = state.speeds.map((factor) => {
        // The chase controls longitudinal compression of the whole brush.
        // Width samples only add a restrained material wobble; allowing their
        // full raw spread turns the upper/lower boundary into a round balloon.
        const widthFactor = 1 + (factor - 1) * TAIL_WIDTH_SPEED_INFLUENCE;
        const progressMultiplier = clamp(1 - lagRatio * widthFactor, 0, 1, 0);
        const beforeProgress = progressMultiplier * currentDistance;
        const endpointProgress = progressMultiplier * state.total;
        const chased = catchElapsed > 0
          ? endpointProgress + averageFrontSpeed * segment.afterStopChaseMultiplier * widthFactor * catchElapsed
          : beforeProgress;
        return Math.min(currentDistance, Math.max(chased, forcedDistance));
      });
      return this._guardTailEdgeProgress(distances);
    }

    _guardTailEdgeProgress(distances) {
      if (distances.length <= 2) return distances;
      const interior = distances.slice(1, -1);
      const interiorMean = interior.reduce((sum, value) => sum + value, 0) / interior.length;
      // The top and bottom edge may trail slightly, but may never outrun the
      // interior compression and draw a geometric round cap over the texture.
      distances[0] = Math.min(distances[0], interiorMean);
      distances[distances.length - 1] = Math.min(distances.at(-1), interiorMean);
      return distances;
    }

    _meshTailDistance(tails, v) {
      if (tails.length <= 1) return Number(tails[0] || 0);
      const scaled = clamp(v, 0, 1, 0) * (tails.length - 1);
      const index = Math.min(tails.length - 2, Math.floor(scaled));
      const phase = scaled - index;
      const smoothPhase = phase * phase * (3 - 2 * phase);
      return tails[index] + (tails[index + 1] - tails[index]) * smoothPhase;
    }

    _terminalHeadCapBlend(currentDistance, tails, capDepth, catchElapsed) {
      if (catchElapsed <= 0) return 0;
      const maximumLag = tails.reduce(
        (maximum, distance) => Math.max(maximum, Math.abs(currentDistance - distance)),
        0,
      );
      const phase = clamp(1 - maximumLag / Math.max(0.001, capDepth), 0, 1, 0);
      return phase * phase * (3 - 2 * phase);
    }

    _headCurveProfile(v) {
      // The midpoint is the fixed nose of the head: it stays exactly on the
      // original straight leading edge. Only the upper and lower portions
      // recede into the texture, following a circular-cap profile.
      const centered = clamp(v, 0, 1, 0.5) * 2 - 1;
      return 1 - Math.sqrt(Math.max(0, 1 - centered * centered));
    }

    _headCurveBlend(u) {
      const phase = clamp(u / 0.35, 0, 1, 1);
      return 1 - phase * phase * (3 - 2 * phase);
    }

    _createGpuRenderer() {
      try {
        const gl = this.gpuCanvas.getContext("webgl", {
          alpha: true,
          antialias: false,
          depth: false,
          stencil: false,
          premultipliedAlpha: true,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        });
        if (!gl) return null;
        const compile = (type, source) => {
          const shader = gl.createShader(type);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const message = gl.getShaderInfoLog(shader) || "WebGL shader compile failed";
            gl.deleteShader(shader);
            throw new Error(message);
          }
          return shader;
        };
        const vertexShader = compile(gl.VERTEX_SHADER, `
          attribute vec2 a_position;
          attribute vec2 a_uv;
          uniform vec2 u_resolution;
          varying vec2 v_uv;
          void main() {
            vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
            gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
            v_uv = a_uv;
          }
        `);
        const fragmentShader = compile(gl.FRAGMENT_SHADER, `
          precision mediump float;
          uniform sampler2D u_texture;
          varying vec2 v_uv;
          void main() {
            gl_FragColor = texture2D(u_texture, v_uv);
          }
        `);
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          const message = gl.getProgramInfoLog(program) || "WebGL program link failed";
          gl.deleteProgram(program);
          throw new Error(message);
        }
        return {
          gl,
          program,
          vertexBuffer: gl.createBuffer(),
          indexBuffer: gl.createBuffer(),
          position: gl.getAttribLocation(program, "a_position"),
          uv: gl.getAttribLocation(program, "a_uv"),
          resolution: gl.getUniformLocation(program, "u_resolution"),
          texture: gl.getUniformLocation(program, "u_texture"),
        };
      } catch (error) {
        console.warn("Attack trail WebGL preview unavailable; using Canvas fallback.", error);
        return null;
      }
    }

    _gpuTexture(source) {
      const renderer = this.gpuRenderer;
      if (!renderer) return null;
      const cached = this.gpuTextures.get(source);
      if (cached) return cached;
      const { gl } = renderer;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      // Canvas images use a top-left origin while WebGL textures use a
      // bottom-left origin. Flip on upload so mesh v=0 remains the authored
      // stick top and v=1 remains the stick bottom (the rotation-center side).
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      this.gpuTextures.set(source, texture);
      return texture;
    }

    _drawGpuMesh(textureSource, grid, gridTimes, segment, state, layer, width, height) {
      const renderer = this.gpuRenderer;
      if (!renderer || renderer.gl.isContextLost()) return false;
      const rows = grid.length;
      const columns = grid[0]?.length || 0;
      if (rows < 2 || columns < 2 || rows * columns > 65535) return false;
      if (this.gpuCanvas.width !== width || this.gpuCanvas.height !== height) {
        this.gpuCanvas.width = width;
        this.gpuCanvas.height = height;
      }
      const vertices = new Float32Array(rows * columns * 4);
      let vertexOffset = 0;
      for (let row = 0; row < rows; row += 1) {
        const v = row / (rows - 1);
        for (let column = 0; column < columns; column += 1) {
          const point = grid[row][column];
          vertices[vertexOffset++] = point.x;
          vertices[vertexOffset++] = point.y;
          vertices[vertexOffset++] = column / (columns - 1);
          vertices[vertexOffset++] = v;
        }
      }
      const indices = new Uint16Array((rows - 1) * (columns - 1) * 6);
      let indexOffset = 0;
      const appendTriangle = (a, b, c, timeA, timeB, timeC) => {
        const sampleTime = (timeA + timeB + timeC) / 3;
        if (this._layerAtTime(segment.sticks, state.timing.times, sampleTime, segment.layer) !== layer) return;
        indices[indexOffset++] = a;
        indices[indexOffset++] = b;
        indices[indexOffset++] = c;
      };
      for (let row = 0; row < rows - 1; row += 1) {
        for (let column = 0; column < columns - 1; column += 1) {
          const topLeft = row * columns + column;
          const topRight = topLeft + 1;
          const bottomLeft = topLeft + columns;
          const bottomRight = bottomLeft + 1;
          appendTriangle(topLeft, topRight, bottomRight,
            gridTimes[row][column], gridTimes[row][column + 1], gridTimes[row + 1][column + 1]);
          appendTriangle(topLeft, bottomRight, bottomLeft,
            gridTimes[row][column], gridTimes[row + 1][column + 1], gridTimes[row + 1][column]);
        }
      }
      const gpuTexture = this._gpuTexture(textureSource);
      if (!gpuTexture) return false;
      const { gl } = renderer;
      gl.viewport(0, 0, width, height);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.SCISSOR_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(renderer.program);
      gl.uniform2f(renderer.resolution, width, height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, gpuTexture);
      gl.uniform1i(renderer.texture, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, renderer.vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(renderer.position);
      gl.vertexAttribPointer(renderer.position, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(renderer.uv);
      gl.vertexAttribPointer(renderer.uv, 2, gl.FLOAT, false, 16, 8);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, renderer.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices.subarray(0, indexOffset), gl.DYNAMIC_DRAW);
      if (indexOffset) gl.drawElements(gl.TRIANGLES, indexOffset, gl.UNSIGNED_SHORT, 0);
      gl.flush();
      return true;
    }

    _strokeSeam(context, a, b) {
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }

    _fillTriangle(context, target) {
      const [a, b, c] = target;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.lineTo(c.x, c.y);
      context.closePath();
      context.fill();
    }

    _processedTexture(image, segment) {
      const key = `${segment.texture.assetHash}:${segment.colorMode}:${segment.color}:${JSON.stringify(segment.gradientStops)}:${segment.tailFadeStart}`;
      if (this.processed.has(key)) return this.processed.get(key);
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const solidTint = colorChannels(segment.color);
      for (let index = 0; index < pixels.data.length; index += 4) {
        if (segment.colorMode !== "original") {
          const pixel = index / 4;
          const y = Math.floor(pixel / canvas.width);
          const gradientPosition = canvas.height <= 1 ? 0.5 : 1 - y / (canvas.height - 1);
          const tint = segment.colorMode === "gradient" ? this._gradientColorAt(segment.gradientStops, gradientPosition) : solidTint;
          const luma = (pixels.data[index] * 0.2126 + pixels.data[index + 1] * 0.7152 + pixels.data[index + 2] * 0.0722) / 255;
          const detail = 0.52 + 0.48 * luma;
          pixels.data[index] = tint[0] * detail; pixels.data[index + 1] = tint[1] * detail; pixels.data[index + 2] = tint[2] * detail;
          pixels.data[index + 3] = pixels.data[index + 3] * luma;
        }
        const x = (index / 4) % canvas.width;
        const u = canvas.width <= 1 ? 0 : x / (canvas.width - 1);
        const fadeU = clamp((u - segment.tailFadeStart) / Math.max(0.001, 1 - segment.tailFadeStart), 0, 1, 0);
        pixels.data[index + 3] = pixels.data[index + 3] * (1 - Math.pow(fadeU, TAIL_ALPHA_EXPONENT));
      }
      context.putImageData(pixels, 0, 0); this.processed.set(key, canvas); return canvas;
    }

    _drawTriangle(context, image, source, target) {
      const [s0, s1, s2] = source, [d0, d1, d2] = target;
      const denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
      if (Math.abs(denominator) < 1e-6) return;
      const center = { x: (d0.x + d1.x + d2.x) / 3, y: (d0.y + d1.y + d2.y) / 3 };
      const overlap = 1.15 * this.hooks.dpr();
      const expand = (vertex) => {
        const dx = vertex.x - center.x, dy = vertex.y - center.y;
        const length = Math.max(0.001, Math.hypot(dx, dy));
        return { x: vertex.x + dx / length * overlap, y: vertex.y + dy / length * overlap };
      };
      const [c0, c1, c2] = [d0, d1, d2].map(expand);
      const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denominator;
      const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denominator;
      const e = (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / denominator;
      const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denominator;
      const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denominator;
      const f = (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / denominator;
      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.beginPath(); context.moveTo(c0.x, c0.y); context.lineTo(c1.x, c1.y); context.lineTo(c2.x, c2.y); context.closePath(); context.clip();
      context.setTransform(a, b, c, d, e, f); context.drawImage(image, 0, 0); context.restore();
    }

    _normalizeData(raw) {
      const bindings = {};
      const sourceSchema = Math.max(0, Math.round(Number(raw?.schemaVersion || 0)));
      for (const [key, values] of Object.entries(raw?.bindings || {})) if (Array.isArray(values) && key.includes("/")) bindings[key] = values.map((value, index) => this._normalizeSegment(value, index, key, sourceSchema));
      const presetTexture = raw?.presetTexture?.path
        ? { ...DEFAULT_PRESET_TEXTURE, ...clone(raw.presetTexture) }
        : clone(DEFAULT_PRESET_TEXTURE);
      return { schemaVersion: ATTACK_TRAIL_SCHEMA_VERSION, presetTexture, bindings };
    }
    _normalizeSegment(value = {}, index, key, sourceSchema = ATTACK_TRAIL_SCHEMA_VERSION) {
      const [profileId, animationId] = key.split("/");
      const segmentLayer = value.layer === "front" ? "front" : "behind";
      const color = normalizeColor(value.color);
      const segment = {
        id: String(value.id || `trail_${index + 1}`), name: String(value.name || `Trail ${index + 1}`), profileId: String(value.profileId || profileId), animationId: String(value.animationId || animationId),
        enabled: true, generated: value.generated !== false, coordinateSpace: "group", layer: segmentLayer,
        texture: { path: String(value.texture?.path || ""), assetHash: String(value.texture?.assetHash || ""), name: String(value.texture?.name || ""), type: String(value.texture?.type || "image/png"), width: Number(value.texture?.width || 0), height: Number(value.texture?.height || 0), hasEffectiveAlpha: value.texture?.hasEffectiveAlpha === true },
        colorMode: normalizeColorMode(value.colorMode || value.color_mode || "solid"), color,
        gradientStops: normalizeGradientStops(value.gradientStops ?? value.gradient_stops, color),
        beforeStopChaseMultiplier: this._chaseMultiplier(value, "before", 0, 1, sourceSchema), afterStopChaseMultiplier: this._chaseMultiplier(value, "after", 0.1, 20, sourceSchema), tailSamples: Math.round(clamp(value.tailSamples, 4, 8, 5)),
        tailFadeStart: clamp(value.tailFadeStart, 0, 0.95, 0.6),
        headCurvature: clamp(value.headCurvature, -1, 1, 0),
        speedVariation: clamp(value.speedVariation, 0, 0.25, 0.008), stableSeed: Math.round(clamp(value.stableSeed, 0, 2147483647, 73129)), pathColumns: Math.round(clamp(value.pathColumns, 8, 96, DEFAULT_PATH_COLUMNS)), pathCacheSamples: Math.round(clamp(value.pathCacheSamples, 32, 512, 192)), collapsedWidth: clamp(value.collapsedWidth, 0.25, 32, 2),
        sticks: (Array.isArray(value.sticks) ? value.sticks : []).map((stick, stickIndex) => this._normalizeStick(stick, stickIndex, segmentLayer)),
      };
      this._updateGenerated(segment);
      return segment;
    }
    _chaseMultiplier(value, phase, min, max, sourceSchema = 6) {
      const before = phase === "before";
      const direct = before
        ? value?.beforeStopChaseMultiplier ?? value?.before_stop_chase_multiplier
        : value?.afterStopChaseMultiplier ?? value?.after_stop_chase_multiplier;
      const fallback = before ? DEFAULT_BEFORE_CHASE_MULTIPLIER : DEFAULT_AFTER_CHASE_MULTIPLIER;
      if (direct !== undefined && direct !== null && direct !== "") {
        const normalized = clamp(direct, min, max, fallback);
        if (before && sourceSchema < 6 && Math.abs(normalized - 0.7) < 0.000001) return DEFAULT_BEFORE_CHASE_MULTIPLIER;
        return normalized;
      }
      const legacy = Number(before
        ? value?.beforeStopChaseSpeed ?? value?.before_stop_chase_speed
        : value?.afterStopChaseSpeed ?? value?.after_stop_chase_speed);
      if (!Number.isFinite(legacy)) return fallback;
      const legacyDefault = before ? LEGACY_BEFORE_CHASE_SPEED : LEGACY_AFTER_CHASE_SPEED;
      return clamp(legacy / legacyDefault * fallback, min, max, fallback);
    }
    _normalizeStick(value = {}, index, defaultLayer = "behind") {
      return { id: String(value.id || `stick_${index + 1}`), order: index, frame: Math.max(0, Math.round(Number(value.frame || 0))), framePhase: clamp(value.framePhase, 0, 1, 0.5), phaseMode: value.phaseMode === "manual" ? "manual" : "auto", top: point(value.top, { x: -60, y: -120 }), bottom: point(value.bottom, { x: 60, y: 120 }), reverseDirection: value.reverseDirection === true, directionOffset: clamp(value.directionOffset, -180, 180, 0), tangentStrength: clamp(value.tangentStrength, 0, 4, 0.8), layer: String(value.layer || defaultLayer) === "front" ? "front" : "behind" };
    }
    _renderTexturePreview(segment) {
      const canvas = this.els.attackTrailTexturePreview;
      if (!canvas) return;
      const texturePath = segment?.texture?.path;
      if (!texturePath) { canvas.hidden = true; return; }
      const image = this.images.get(texturePath);
      if (!image) {
        canvas.hidden = false;
        this.hooks.loadTexture(segment.texture).then((loaded) => {
          this.images.set(texturePath, loaded);
          if (this._segment()?.texture?.path === texturePath) this._renderTexturePreview(this._segment());
        }).catch(() => { canvas.hidden = true; });
        return;
      }
      canvas.hidden = false;
      const context = canvas.getContext("2d");
      const width = canvas.width, height = canvas.height;
      context.clearRect(0, 0, width, height);
      const drawHeight = height - 20;
      const straightWidth = Math.min(width * 0.72, drawHeight * image.width / Math.max(1, image.height));
      const curvePad = Math.max(18, straightWidth * 0.24);
      const baseX = (width - straightWidth) * 0.5 + curvePad * 0.5;
      const rightX = baseX + straightWidth - curvePad * 0.5;
      const topY = 5;
      const rows = 16;
      const columns = 8;
      context.imageSmoothingEnabled = true;
      const sourcePoint = (u, v) => ({ x: image.width * u, y: image.height * v });
      const previewPoint = (u, v) => ({
        x: baseX + (rightX - baseX) * u + segment.headCurvature * curvePad * this._headCurveProfile(v) * this._headCurveBlend(u),
        y: topY + drawHeight * v,
      });
      for (let row = 0; row < rows; row += 1) {
        const v0 = row / rows, v1 = (row + 1) / rows;
        for (let column = 0; column < columns; column += 1) {
          const u0 = column / columns, u1 = (column + 1) / columns;
          const source00 = sourcePoint(u0, v0), source10 = sourcePoint(u1, v0), source01 = sourcePoint(u0, v1), source11 = sourcePoint(u1, v1);
          const target00 = previewPoint(u0, v0), target10 = previewPoint(u1, v0), target01 = previewPoint(u0, v1), target11 = previewPoint(u1, v1);
          this._drawTriangle(context, image, [source00, source10, source11], [target00, target10, target11]);
          this._drawTriangle(context, image, [source00, source11, source01], [target00, target11, target01]);
        }
      }
      context.save();
      context.setLineDash([5, 5]);
      context.strokeStyle = "rgba(255, 214, 78, .9)";
      context.lineWidth = 2;
      context.beginPath(); context.moveTo(baseX, topY); context.lineTo(baseX, topY + drawHeight); context.stroke();
      context.setLineDash([]);
      context.strokeStyle = "rgba(65, 225, 210, .95)";
      context.beginPath();
      for (let step = 0; step <= 48; step += 1) {
        const v = step / 48;
        const x = baseX + segment.headCurvature * curvePad * this._headCurveProfile(v);
        const y = topY + drawHeight * v;
        if (!step) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke(); context.restore();
    }
    _syncGuideToggle(supported = true) {
      const button = this.els.attackTrailGuideToggle;
      if (!button) return;
      button.hidden = !supported;
      button.disabled = !supported || !this.enabled;
      button.classList.toggle("active", this.guidesVisible);
      button.setAttribute("aria-pressed", this.guidesVisible ? "true" : "false");
      button.title = this.guidesVisible ? "隐藏攻击拖尾棍子" : "显示攻击拖尾棍子";
    }
    _readDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(reader.error || new Error("读取失败")); reader.readAsDataURL(file); }); }
    _escape(value) { return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }
  }

  window.AttackTrailEditor = AttackTrailEditor;
}());
