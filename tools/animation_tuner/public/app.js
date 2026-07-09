const els = {
  projectSelect: document.querySelector("#projectSelect"),
  refreshProject: document.querySelector("#refreshProject"),
  languageSelect: document.querySelector("#languageSelect"),
  languageButtons: Array.from(document.querySelectorAll("[data-language]")),
  themeButtons: Array.from(document.querySelectorAll("[data-theme]")),
  canvasColor: document.querySelector("#canvasColor"),
  profileSelect: document.querySelector("#profileSelect"),
  groupSelect: document.querySelector("#groupSelect"),
  groupSearch: document.querySelector("#groupSearch"),
  sceneSelect: document.querySelector("#sceneSelect"),
  sceneScale: document.querySelector("#sceneScale"),
  characterBaseScale: document.querySelector("#characterBaseScale"),
  characterBaseSource: document.querySelector("#characterBaseSource"),
  canvasTitle: document.querySelector("#canvasTitle"),
  selectionHud: document.querySelector("#selectionHud"),
  coordHud: document.querySelector("#coordHud"),
  stage: document.querySelector("#stage"),
  filmstrip: document.querySelector("#filmstrip"),
  baseScale: document.querySelector("#baseScale"),
  baseScaleX: document.querySelector("#baseScaleX"),
  baseScaleY: document.querySelector("#baseScaleY"),
  baseX: document.querySelector("#baseX"),
  baseY: document.querySelector("#baseY"),
  baseRotation: document.querySelector("#baseRotation"),
  adjustCharacter: document.querySelector("#adjustCharacter"),
  adjustGroup: document.querySelector("#adjustGroup"),
  adjustFrame: document.querySelector("#adjustFrame"),
  frameScale: document.querySelector("#frameScale"),
  frameScaleX: document.querySelector("#frameScaleX"),
  frameScaleY: document.querySelector("#frameScaleY"),
  frameX: document.querySelector("#frameX"),
  frameY: document.querySelector("#frameY"),
  frameRotation: document.querySelector("#frameRotation"),
  frameDuration: document.querySelector("#frameDuration"),
  groupTimeField: document.querySelector("#groupTimeField"),
  groupTimeMs: document.querySelector("#groupTimeMs"),
  frameAudioFile: document.querySelector("#frameAudioFile"),
  frameAudioDrop: document.querySelector("#frameAudioDrop"),
  frameAudioName: document.querySelector("#frameAudioName"),
  clearFrameAudio: document.querySelector("#clearFrameAudio"),
  frameReference: document.querySelector("#frameReference"),
  frameDisabled: document.querySelector("#frameDisabled"),
  showBoxes: document.querySelector("#showBoxes"),
  boxOnlyMode: document.querySelector("#boxOnlyMode"),
  boxChoices: document.querySelector("#boxChoices"),
  boxChoiceInputs: Array.from(document.querySelectorAll("[data-box-choice]")),
  boxEnabled: document.querySelector("#boxEnabled"),
  boxX: document.querySelector("#boxX"),
  boxY: document.querySelector("#boxY"),
  boxW: document.querySelector("#boxW"),
  boxH: document.querySelector("#boxH"),
  boxRotation: document.querySelector("#boxRotation"),
  deleteBox: document.querySelector("#deleteBox"),
  clearBox: document.querySelector("#clearBox"),
  fps: document.querySelector("#fps"),
  fpsValue: document.querySelector("#fpsValue"),
  vfxWindowControls: document.querySelector("#vfxWindowControls"),
  vfxStartFrame: document.querySelector("#vfxStartFrame"),
  vfxEndFrame: document.querySelector("#vfxEndFrame"),
  rootMotionX: document.querySelector("#rootMotionX"),
  rootMotionY: document.querySelector("#rootMotionY"),
  chainGroupSelect: document.querySelector("#chainGroupSelect"),
  playPause: document.querySelector("#playPause"),
  ghostToggle: document.querySelector("#ghostToggle"),
  applyBaseToFrame: document.querySelector("#applyBaseToFrame"),
  undo: document.querySelector("#undo"),
  undoTop: document.querySelector("#undoTop"),
  redoTop: document.querySelector("#redoTop"),
  clearFrame: document.querySelector("#clearFrame"),
  clearGroup: document.querySelector("#clearGroup"),
  save: document.querySelector("#save"),
  saveState: document.querySelector("#saveState"),
  status: document.querySelector("#status"),
  resetView: document.querySelector("#resetView"),
};

const ctx = els.stage.getContext("2d");
const FRAME_DURATION_STEP_MS = 10;
const MIN_FRAME_DURATION_MS = 1;
const BOX_PREF_KEYS = {
  show: "xsxbFrameTuner.showBoxes",
  only: "xsxbFrameTuner.boxOnlyMode",
  selected: "xsxbFrameTuner.selectedBox",
  checked: "xsxbFrameTuner.checkedBoxes",
};
const ADJUSTMENT_MODE_KEY = "xsxbFrameTuner.adjustmentMode";
const ADJUSTMENT_MODES = ["character", "group", "frame"];
const BOX_NAMES = ["hurtbox", "hitbox", "collisionbox"];
const BOX_DRAW_ORDER = ["collisionbox", "hurtbox", "hitbox"];
const COLLISION_BOX_HANDLES = new Set(["nw", "n", "ne", "w", "e"]);
const I18N = {
  zh: {
    allCharacters: "全部角色",
    adjustmentBase: "调整 Base",
    boundFrameSfx: "已绑定帧音效：{name}\n已保存到项目",
    boxEnabled: "这一帧启用碰撞框",
    boxOnlyMode: "仅编辑碰撞框",
    boxSyncFailed: "帧音效同步到项目失败：{message}",
    boxes: "碰撞框",
    boxX: "框 X",
    boxY: "框 Y",
    brandSubtitle: "帧动画调参工作台",
    canvas: "画布",
    character: "角色",
    characterBase: "角色 Base",
    clearBoxOverride: "清除碰撞框覆盖",
    clearFrameSfx: "清除帧音效",
    clearGroupOverrides: "清除整组覆盖",
    clearSelected: "清除选中帧",
    compareThenPlay: "对比 / 接着播放",
    coordHudIdle: "鼠标 -, - | 偏移 -, -",
    copyBaseToSelected: "复制 Base 到选中帧",
    deleteBoxSelected: "删除选中帧的碰撞框",
    disableFrame: "禁用此帧",
    dropAudioFile: "请把音频文件拖到当前帧音效区域。",
    dropFrameSfx: "把这一帧的音效拖到这里",
    durationMs: "时长 ms",
    endFrame: "结束帧",
    findGroup: "查找组",
    frame: "帧",
    frameBase: "帧 Base",
    frameCountLabel: "{count} 帧",
    frameSfx: "帧音效：{name}",
    frameSfxDeleteConfirm: "删除这一帧的音效？",
    frameSfxDeleted: "已删除帧音效",
    frameSfxDeleteFailed: "帧音效删除失败：{message}",
    frameSfxRestoreFailed: "帧音效恢复失败：{message}",
    frameSfxSessionOnly: "帧音效只会保留在本次会话：{message}",
    frameSfxSaved: "帧音效已保存到项目：{count}",
    frameAttachmentAdded: "已添加附加图：{name}",
    frameAttachmentDeleteConfirm: "删除这个附加图？",
    frameAttachmentLayerAbove: "附加图在角色上方",
    frameAttachmentLayerBelow: "附加图在角色下方",
    frameAttachmentRemove: "删除附加图",
    frameAttachmentRemoved: "已删除附加图",
    frameAttachmentCanvasHint: "附加帧：拖动图片移动，R+滚轮旋转，Z+滚轮缩放；拖卡片到缝隙调层级",
    frameAttachmentUploadFailed: "附加图导入失败：{message}",
    frameAttachmentCopied: "已复制附加图：{count}",
    frameAttachmentPasted: "已粘贴附加图：{count}",
    frameAttachmentCopyEmpty: "当前帧没有可复制的附加图。",
    frameAttachmentPasteEmpty: "没有已复制的附加图。",
    frameAttachmentPasteProjectMismatch: "复制的附加图属于另一个项目，不能直接粘贴。",
    dropImageFile: "请把图片拖到帧卡片上。",
    frameTimeConflict: "当前组时间正在控制整组时长。确认后将改为单帧时间，并清除组时间设置。",
    audioPreviewBlocked: "音频预览被浏览器拦截：{message}",
    ghost: "残影",
    group: "组",
    groupBase: "组 Base",
    groupFps: "组 FPS",
    groupTimeConflict: "当前已经调过单帧时间。确认后将改为组时间，并清除单帧时间设置。",
    groupTimeMs: "组时长",
    groupSearchPlaceholder: "名称、类型、来源",
    height: "高",
    hint: "拖动画布可平移。选中附加帧：拖动移动，按住 R 滚轮旋转，按住 Z 滚轮缩放。框默认拖整体；按住 Alt 只拖节点塑形。",
    hitbox: "攻击框",
    hurtbox: "受击框",
    collisionbox: "碰撞体",
    keepReference: "设参考帧",
    referenceFrameHideHint: "按住 H 隐藏参考帧",
    boxEditHint: "按住 Alt 变形，不按 Alt 拖动",
    language: "语言",
    languageChinese: "中文",
    languageEnglish: "English",
    loadedFrames: "{count} 帧已载入",
    loadFailed: "加载失败：{message}",
    loadedStatus: "项目：{project}\n已载入 {count} 组\n{path}{warnings}",
    mainLabel: "主 ",
    mouseOffset: "鼠标 {mouseX}, {mouseY} | 偏移 {offsetX}, {offsetY}",
    noChanges: "没有改动",
    noFrameSfx: "无帧音效",
    noMatchingGroups: "没有匹配的组",
    noScenes: "没有场景",
    none: "无",
    offsetX: "偏移 X",
    offsetY: "偏移 Y",
    pause: "暂停",
    play: "播放",
    playable: "{count} 可播放",
    playback: "播放",
    preloadedFrames: "已预载 {count} 帧\n{root}",
    project: "项目",
    projectRefreshFailed: "刷新失败：{message}",
    projectSwitchConfirm: "切换项目会丢弃未保存的调参，继续吗？",
    projectSwitchFailed: "项目切换失败：{message}",
    ready: "就绪",
    refreshAnimationList: "刷新动画列表",
    resetView: "重置视图",
    rootX: "Root X",
    rootY: "Root Y",
    rotate: "旋转",
    saveFailed: "保存失败：{message}",
    saveTuning: "保存调参",
    saveTuningDirty: "保存调参 *",
    savedAt: "已保存 {time}",
    saving: "正在保存...",
    scale: "缩放",
    scaleX: "缩放 X",
    scaleY: "缩放 Y",
    scene: "场景",
    sceneScale: "场景倍率",
    sceneScalePanel: "场景",
    selectedBox: "当前碰撞框",
    selectedFrames: "{count} 帧已选",
    showBoxes: "显示框体",
    source: "来源",
    startFrame: "开始帧",
    thenLabel: "接着 ",
    undo: "撤销",
    redo: "重做",
    undoNothing: "没有可撤销内容",
    redoNothing: "没有可重做内容",
    undoReady: "可撤销：{label}",
    undone: "已撤销：{label}",
    redone: "已重做：{label}",
    unsavedChanges: "有未保存改动",
    warnings: "\n警告：\n{warnings}",
    width: "宽",
  },
  en: {
    allCharacters: "All characters",
    adjustmentBase: "Adjust Base",
    boundFrameSfx: "Bound frame SFX: {name}\nSaved to project",
    boxEnabled: "Box enabled on this frame",
    boxOnlyMode: "Box edit only",
    boxSyncFailed: "Frame SFX project sync failed: {message}",
    boxes: "Boxes",
    boxX: "Box X",
    boxY: "Box Y",
    brandSubtitle: "Frame tuning workbench",
    canvas: "Canvas",
    character: "Character",
    characterBase: "Character Base",
    clearBoxOverride: "Clear box override",
    clearFrameSfx: "Clear frame SFX",
    clearGroupOverrides: "Clear group overrides",
    clearSelected: "Clear selected",
    compareThenPlay: "Compare / then play",
    coordHudIdle: "Mouse -, - | Offset -, -",
    copyBaseToSelected: "Copy base to selected",
    deleteBoxSelected: "Delete box on selected frames",
    disableFrame: "Disable frame",
    dropAudioFile: "Drop an audio file onto the current frame SFX area.",
    dropFrameSfx: "Drop frame SFX here",
    durationMs: "Duration ms",
    endFrame: "End Frame",
    findGroup: "Find group",
    frame: "Frame",
    frameBase: "Frame Base",
    frameCountLabel: "{count} frames",
    frameSfx: "Frame SFX: {name}",
    frameSfxDeleteConfirm: "Delete this frame SFX?",
    frameSfxDeleted: "Frame SFX deleted",
    frameSfxDeleteFailed: "Frame SFX delete failed: {message}",
    frameSfxRestoreFailed: "Frame SFX restore failed: {message}",
    frameSfxSessionOnly: "Frame SFX will stay for this session only: {message}",
    frameSfxSaved: "Frame SFX saved to project: {count}",
    frameAttachmentAdded: "Added attached image: {name}",
    frameAttachmentDeleteConfirm: "Delete this attached image?",
    frameAttachmentLayerAbove: "Attached image above character",
    frameAttachmentLayerBelow: "Attached image below character",
    frameAttachmentRemove: "Delete attached image",
    frameAttachmentRemoved: "Attached image deleted",
    frameAttachmentCanvasHint: "Attached: drag image, R/Z+wheel, drag cards into gaps",
    frameAttachmentUploadFailed: "Attached image import failed: {message}",
    frameAttachmentCopied: "Copied attached images: {count}",
    frameAttachmentPasted: "Pasted attached images: {count}",
    frameAttachmentCopyEmpty: "This frame has no attached image to copy.",
    frameAttachmentPasteEmpty: "No attached image has been copied.",
    frameAttachmentPasteProjectMismatch: "Copied attached images belong to another project.",
    dropImageFile: "Drop an image onto a frame card.",
    frameTimeConflict: "Group time is controlling this animation. Confirm to switch to frame timing and clear the group time override.",
    audioPreviewBlocked: "Audio preview blocked: {message}",
    ghost: "Ghost",
    group: "Group",
    groupBase: "Group Base",
    groupFps: "Group FPS",
    groupTimeConflict: "Frame timing has already been adjusted. Confirm to switch to group time and clear frame duration overrides.",
    groupTimeMs: "Group duration",
    groupSearchPlaceholder: "Name, type, source",
    height: "Height",
    hint: "Drag pans. Selected attached frame: drag to move, hold R + wheel to rotate, hold Z + wheel to scale. Boxes drag as a whole; hold Alt to drag handles only.",
    hitbox: "Hitbox",
    hurtbox: "Hurtbox",
    collisionbox: "Collision",
    keepReference: "Set reference",
    referenceFrameHideHint: "Hold H to hide reference",
    boxEditHint: "Hold Alt to reshape; release Alt to drag",
    language: "Language",
    languageChinese: "中文",
    languageEnglish: "English",
    loadedFrames: "{count} loaded frames",
    loadFailed: "Load failed: {message}",
    loadedStatus: "Project: {project}\nLoaded {count} groups\n{path}{warnings}",
    mainLabel: "Main ",
    mouseOffset: "Mouse {mouseX}, {mouseY} | Offset {offsetX}, {offsetY}",
    noChanges: "No changes",
    noFrameSfx: "No frame SFX",
    noMatchingGroups: "No matching groups",
    noScenes: "No scenes",
    none: "None",
    offsetX: "Offset X",
    offsetY: "Offset Y",
    pause: "Pause",
    play: "Play",
    playable: "{count} playable",
    playback: "Playback",
    preloadedFrames: "Preloaded {count} frames\n{root}",
    project: "Project",
    projectRefreshFailed: "Refresh failed: {message}",
    projectSwitchConfirm: "Switch project and discard unsaved tuning changes?",
    projectSwitchFailed: "Project switch failed: {message}",
    ready: "Ready",
    refreshAnimationList: "Refresh animation list",
    resetView: "Reset view",
    rootX: "Root X",
    rootY: "Root Y",
    rotate: "Rotate",
    saveFailed: "Save failed: {message}",
    saveTuning: "Save tuning",
    saveTuningDirty: "Save tuning *",
    savedAt: "Saved {time}",
    saving: "Saving...",
    scale: "Scale",
    scaleX: "Scale X",
    scaleY: "Scale Y",
    scene: "Scene",
    sceneScale: "Scene scale",
    sceneScalePanel: "Scene",
    selectedBox: "Selected box",
    selectedFrames: "{count} selected",
    showBoxes: "Show boxes",
    source: "Source",
    startFrame: "Start Frame",
    thenLabel: "Then ",
    undo: "Undo",
    redo: "Redo",
    undoNothing: "Nothing to undo",
    redoNothing: "Nothing to redo",
    undoReady: "Undo ready: {label}",
    undone: "Undone: {label}",
    redone: "Redone: {label}",
    unsavedChanges: "Unsaved changes",
    warnings: "\nWarnings:\n{warnings}",
    width: "Width",
  },
};
let config = null;
let language = localStorage.getItem("xsxbFrameTuner.language") || "zh";
let uiTheme = localStorage.getItem("xsxbFrameTuner.theme") || "dark";
let canvasColor = localStorage.getItem("xsxbFrameTuner.canvasColor") || "#000000";
let selectedProjectId = localStorage.getItem("xsxbFrameTuner.project") || "";
let selectedSceneId = localStorage.getItem("xsxbFrameTuner.scene") || "";
let currentGroup = null;
let selectedFrame = 0;
let selectedFrames = new Set([0]);
let selectionAnchorFrame = 0;
let selectedProfileId = localStorage.getItem("animationTuner.profile") || "all";
let groupSearch = localStorage.getItem("animationTuner.groupSearch") || "";
let images = [];
let chainImages = [];
let frameOverrides = {};
let vfxFrameOverrides = {};
let framePlaybackOverrides = {};
let vfxPlaybackOverrides = {};
let bossFrameOverrides = {};
let bossPlaybackOverrides = {};
let act2StatueBossFrameOverrides = {};
let act2StatueBossPlaybackOverrides = {};
let huangXianFrameOverrides = {};
let huangXianPlaybackOverrides = {};
let soulFrameOverrides = {};
let soulPlaybackOverrides = {};
let soulFrameBoxOverrides = {};
let yechengPropFrameOverrides = {};
let values = {};
let bossValues = {};
let act2StatueBossValues = {};
let huangXianValues = {};
let soulValues = {};
let yechengPropValues = {};
let sceneSettings = {};
let previewOwnerGroup = null;
let previewOwnerImages = [];
let coordinateOwnerGroup = null;
let coordinateOwnerImages = [];
let attachedLayerImageSets = new Map();
let frameImageAttachments = [];
let selectedAttachmentId = "";
let frameImageAttachmentClipboard = [];
let frameImageAttachmentClipboardProjectId = "";
let ghost = true;
let referenceFrameHiddenByKey = false;
let playing = false;
let lastPlay = 0;
let pointerStagePoint = null;
let playbackPrimaryGroup = null;
let playbackSecondaryGroup = null;
let playbackSwitching = false;
let view = { zoom: 1, x: 0, y: 0 };
let drag = null;
let undoStack = [];
let redoStack = [];
let inputEditSnapshots = new WeakMap();
let baseEditSnapshot = null;
let boxEditSnapshot = null;
let attachmentWheelUndoTimer = null;
let attachmentWheelUndoLabel = "";
let heldAttachmentTransformKeys = new Set();
let imageCache = new Map();
let opaqueRectCache = new WeakMap();
let huangXianAnchorXCache = new WeakMap();
let preloadLoaded = 0;
let preloadTotal = 0;
let referenceFrame = null;
let frameAudioBindings = {};
const FRAME_AUDIO_DB_NAME = "xsxb-frame-tuner-frame-audio";
const FRAME_AUDIO_DB_VERSION = 1;
const FRAME_AUDIO_STORE = "frameAudio";
const LAYER_CARD_DRAG_TYPE = "application/x-xsxb-layer-card";
let frameAudioDbPromise = null;
let frameAudioSyncPromise = null;
let imageElements = new Map();
let layerCardDrag = null;
let showBoxes = localStorage.getItem(BOX_PREF_KEYS.show) === "true";
let boxOnlyMode = false;
let selectedBox = localStorage.getItem(BOX_PREF_KEYS.selected) || "";
let selectedBoxes = new Set(parseBoxSelection(localStorage.getItem(BOX_PREF_KEYS.checked)));
if (!selectedBoxes.size && BOX_NAMES.includes(selectedBox)) selectedBoxes.add(selectedBox);
let adjustmentMode = ADJUSTMENT_MODES.includes(localStorage.getItem(ADJUSTMENT_MODE_KEY))
  ? localStorage.getItem(ADJUSTMENT_MODE_KEY)
  : "group";
let frameBoxOverrides = {};
const GROUP_PLAYBACK_FRAME = "__group";
let dirty = false;
let saveInFlight = false;
let lastSavedAt = "";

function t(key, vars = {}) {
  const table = I18N[language] || I18N.zh;
  const template = table[key] ?? I18N.zh[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_match, name) => vars[name] ?? "");
}

function applyLanguage() {
  language = language === "en" ? "en" : "zh";
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  if (els.languageSelect) els.languageSelect.value = language;
  for (const button of els.languageButtons) {
    const active = button.dataset.language === language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    node.title = t(node.dataset.i18nTitle);
  });
  updateSaveState();
  updateHistoryControls();
  syncFrameAudioInputs();
  updateCanvasTitle();
  updateCoordHud();
  if (config) {
    renderSceneSelect();
    renderProfileSelect();
    renderGroupSelect(currentGroup?.uiId);
    renderChainGroupSelect();
    renderFilmstrip();
    status(loadedStatusText());
  }
}

function normalizeTheme(theme) {
  return theme === "light" ? "light" : "dark";
}

function normalizeColor(value, fallback = "#000000") {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function applyUiTheme() {
  uiTheme = normalizeTheme(uiTheme);
  document.body.classList.toggle("theme-light", uiTheme === "light");
  document.body.classList.toggle("theme-dark", uiTheme !== "light");
  for (const button of els.themeButtons) {
    const active = button.dataset.theme === uiTheme;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

function applyCanvasColor() {
  canvasColor = normalizeColor(canvasColor);
  document.documentElement.style.setProperty("--canvas-bg", canvasColor);
  if (els.canvasColor) els.canvasColor.value = canvasColor;
}

function parseBoxSelection(value) {
  const seen = new Set();
  return String(value || "")
    .split(/[,\s]+/)
    .map((name) => name.trim())
    .filter((name) => {
      if (!BOX_NAMES.includes(name) || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
}

function selectedBoxNames() {
  return BOX_NAMES.filter((boxName) => selectedBoxes.has(boxName));
}

function firstEditableSelectedBox(group = currentGroup) {
  return BOX_NAMES.find((boxName) => selectedBoxes.has(boxName) && canEditBox(boxName, group)) || "";
}

function normalizeBoxSelectionForGroup(group = currentGroup) {
  let changed = false;
  for (const boxName of [...selectedBoxes]) {
    if (!canEditBox(boxName, group)) {
      selectedBoxes.delete(boxName);
      changed = true;
    }
  }
  if (selectedBox && !canEditBox(selectedBox, group)) {
    selectedBox = firstEditableSelectedBox(group);
    changed = true;
  }
  if (!selectedBox) {
    const nextBox = firstEditableSelectedBox(group);
    if (nextBox) {
      selectedBox = nextBox;
      changed = true;
    }
  }
  if (selectedBox && !selectedBoxes.has(selectedBox)) {
    selectedBoxes.add(selectedBox);
    changed = true;
  }
  return changed;
}

function saveBoxViewPrefs() {
  localStorage.setItem(BOX_PREF_KEYS.show, showBoxes ? "true" : "false");
  localStorage.setItem(BOX_PREF_KEYS.only, "false");
  localStorage.setItem(BOX_PREF_KEYS.selected, selectedBox || "");
  localStorage.setItem(BOX_PREF_KEYS.checked, selectedBoxNames().join(","));
}

function status(text) {
  if (!els.status) return;
  els.status.textContent = text;
  els.status.hidden = !text;
}

function loadedStatusText() {
  if (!config) return t("ready");
  const projectName = projectLabel(config.activeProject);
  const projectPath = config.projectRoot || config.workspaceRoot || config.root;
  const warningText = Array.isArray(config.warnings) && config.warnings.length
    ? t("warnings", { warnings: config.warnings.join("\n") })
    : "";
  return t("loadedStatus", { project: projectName, count: config.groups?.length || 0, path: projectPath, warnings: warningText });
}

function updateSaveState() {
  if (!els.saveState || !els.save) return;
  const label = saveInFlight
    ? t("saving")
    : dirty
      ? t("unsavedChanges")
      : lastSavedAt
        ? t("savedAt", { time: lastSavedAt })
        : t("noChanges");
  els.saveState.textContent = label;
  els.saveState.classList.toggle("dirty", dirty);
  els.save.disabled = saveInFlight;
  els.save.textContent = saveInFlight ? t("saving") : dirty ? t("saveTuningDirty") : t("saveTuning");
  document.body.classList.toggle("hasUnsavedChanges", dirty);
}

function markDirty() {
  dirty = true;
  updateSaveState();
}

function markClean() {
  dirty = false;
  lastSavedAt = new Date().toLocaleTimeString();
  updateSaveState();
}

function keyFor(groupName, index) {
  return `${groupName}:${index}`;
}

function tuningAnimationName(group = currentGroup) {
  return group?.runtimeAnimation || group?.name || "";
}

function sourceFrameIndex(index = selectedFrame, group = currentGroup) {
  if (!group || !Array.isArray(group.sourceFrameIndices) || !group.sourceFrameIndices.length) return index;
  return Number(group.sourceFrameIndices[index] ?? index);
}

function tuningFrameKey(index = selectedFrame, group = currentGroup) {
  return keyFor(tuningAnimationName(group), sourceFrameIndex(index, group));
}

function activeProjectId() {
  return config?.activeProjectId || selectedProjectId || "";
}

function activeSceneId() {
  const scenes = Array.isArray(config?.scenes) ? config.scenes : [];
  if (selectedSceneId && scenes.some((scene) => scene.id === selectedSceneId)) return selectedSceneId;
  return scenes[0]?.id || "";
}

function sceneScaleFor(sceneId = activeSceneId()) {
  const setting = sceneSettings?.[sceneId] || {};
  const scale = Number(setting.scale ?? 1);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function activeSceneScale() {
  return sceneScaleFor(activeSceneId());
}

function renderSceneSelect() {
  if (!els.sceneSelect) return;
  const scenes = Array.isArray(config?.scenes) ? config.scenes : [];
  if (!scenes.length) {
    els.sceneSelect.innerHTML = `<option value="">${escapeHtml(t("noScenes"))}</option>`;
    els.sceneSelect.value = "";
    els.sceneSelect.disabled = true;
    selectedSceneId = "";
    syncSceneInputs();
    return;
  }
  els.sceneSelect.innerHTML = scenes
    .map((scene) => `<option value="${escapeHtml(scene.id)}">${escapeHtml(scene.label || scene.path || scene.id)}</option>`)
    .join("");
  selectedSceneId = activeSceneId();
  els.sceneSelect.value = selectedSceneId;
  els.sceneSelect.disabled = false;
  if (selectedSceneId) localStorage.setItem("xsxbFrameTuner.scene", selectedSceneId);
  syncSceneInputs();
}

function syncSceneInputs() {
  if (!els.sceneScale) return;
  const sceneId = activeSceneId();
  if (els.sceneSelect && sceneId) els.sceneSelect.value = sceneId;
  els.sceneScale.disabled = !sceneId;
  els.sceneScale.value = String(round(sceneScaleFor(sceneId)));
}

function updateSceneScaleFromInput() {
  const sceneId = activeSceneId();
  if (!sceneId || !els.sceneScale) return;
  const nextScale = Math.max(0.01, Number(els.sceneScale.value || 1));
  if (nearlyEqual(nextScale, 1)) {
    delete sceneSettings[sceneId];
  } else {
    sceneSettings[sceneId] = {
      ...(sceneSettings[sceneId] || {}),
      scale: nextScale,
    };
  }
  markDirty();
  updateSaveState();
  draw();
}

function collectSceneSettings() {
  const result = {};
  for (const [sceneId, setting] of Object.entries(sceneSettings || {})) {
    const scale = Number(setting?.scale ?? 1);
    if (Number.isFinite(scale) && scale > 0 && !nearlyEqual(scale, 1)) {
      result[sceneId] = { scale };
    }
  }
  return result;
}

function frameAudioKey(index = selectedFrame, group = currentGroup) {
  if (!group) return "";
  return [
    activeProjectId(),
    group.tuningTarget || "player",
    group.profileId || "all",
    group.type || "animation",
    group.name || "",
    group.source || "",
    sourceFrameIndex(index, group),
  ].join(":");
}

function frameAudioMetadata(index = selectedFrame, group = currentGroup) {
  if (!group) return null;
  const frame = sourceFrameIndex(index, group);
  return {
    projectId: activeProjectId(),
    tuningTarget: group.tuningTarget || "player",
    profileId: group.profileId || "all",
    groupType: group.type || "animation",
    animation: tuningAnimationName(group),
    source: group.source || "",
    frame,
    displayFrame: index,
  };
}

function frameAudioMetadataFromKey(key) {
  const parts = String(key || "").split(":");
  if (parts.length < 6) return null;
  const frame = Number(parts[parts.length - 1]);
  if (!Number.isFinite(frame)) return null;
  if (parts.length >= 7) {
    return {
      projectId: parts[0] || "default",
      tuningTarget: parts[1] || "player",
      profileId: parts[2] || "all",
      groupType: parts[3] || "animation",
      animation: parts[4] || "",
      source: parts.slice(5, -1).join(":"),
      frame,
      displayFrame: frame,
    };
  }
  return {
    projectId: "legacy",
    tuningTarget: parts[0] || "player",
    profileId: parts[1] || "all",
    groupType: parts[2] || "animation",
    animation: parts[3] || "",
    source: parts.slice(4, -1).join(":"),
    frame,
    displayFrame: frame,
  };
}

function newLocalId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function frameImageAttachmentKey(index = selectedFrame, group = currentGroup) {
  return frameAudioKey(index, group);
}

function frameImageAttachmentMetadata(index = selectedFrame, group = currentGroup) {
  return frameAudioMetadata(index, group);
}

function normalizeAttachmentTransform(transform = {}) {
  const scale = Math.max(0.001, Number(transform.scale ?? 1));
  return {
    scale,
    scaleX: Math.max(0.001, Number(transform.scaleX ?? transform.visual_scale?.x ?? scale)),
    scaleY: Math.max(0.001, Number(transform.scaleY ?? transform.visual_scale?.y ?? scale)),
    offset: cloneVector(transform.offset || { x: 0, y: 0 }),
    rotation: Number(transform.rotation || 0),
  };
}

function normalizeAttachmentLayerOrder(source = {}) {
  const parsed = Number(source.layerOrder);
  if (Number.isFinite(parsed) && Math.abs(parsed) > 0.0001) return parsed;
  return source.layer === "below" ? -1 : 1;
}

function normalizeFrameImageAttachment(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const metadata = source.metadata && typeof source.metadata === "object" ? source.metadata : {};
  const key = String(source.key || source.frameKey || "");
  const layerOrder = normalizeAttachmentLayerOrder(source);
  return {
    id: String(source.id || newLocalId("layer")),
    key,
    frameKey: key,
    metadata,
    name: String(source.name || "image"),
    path: String(source.path || ""),
    assetHash: String(source.assetHash || ""),
    type: String(source.type || ""),
    width: Number(source.width || 0),
    height: Number(source.height || 0),
    layer: layerOrder < 0 ? "below" : "above",
    layerOrder,
    transform: normalizeAttachmentTransform(source.transform),
  };
}

function loadFrameImageAttachmentsFromProject() {
  frameImageAttachments = (Array.isArray(config?.frameImageAttachments) ? config.frameImageAttachments : [])
    .map(normalizeFrameImageAttachment)
    .filter((attachment) => attachment.path && attachment.key);
  if (!frameImageAttachments.some((attachment) => attachment.id === selectedAttachmentId)) {
    selectedAttachmentId = "";
  }
}

function frameImageAttachmentsForFrame(index = selectedFrame, group = currentGroup) {
  const key = frameImageAttachmentKey(index, group);
  return frameImageAttachments.filter((attachment) => attachment.key === key);
}

function attachmentLayerOrder(attachment) {
  return normalizeAttachmentLayerOrder(attachment);
}

function frameLayerStackItems(index = selectedFrame, group = currentGroup) {
  const attachments = frameImageAttachmentsForFrame(index, group).map((attachment) => ({
    type: "attachment",
    attachment,
    id: attachment.id,
    order: attachmentLayerOrder(attachment),
    sourceIndex: frameImageAttachments.indexOf(attachment),
  }));
  const above = attachments
    .filter((entry) => entry.order > 0)
    .sort((a, b) => b.order - a.order || a.sourceIndex - b.sourceIndex);
  const below = attachments
    .filter((entry) => entry.order < 0)
    .sort((a, b) => b.order - a.order || a.sourceIndex - b.sourceIndex);
  return [
    ...above,
    { type: "main", id: "main", index, group },
    ...below,
  ];
}

function drawableFrameAttachments(index = selectedFrame, layer = "above", group = currentGroup) {
  return frameImageAttachmentsForFrame(index, group)
    .filter((attachment) => (layer === "below" ? attachmentLayerOrder(attachment) < 0 : attachmentLayerOrder(attachment) > 0))
    .sort((a, b) => attachmentLayerOrder(a) - attachmentLayerOrder(b) || frameImageAttachments.indexOf(b) - frameImageAttachments.indexOf(a));
}

function nextAboveAttachmentLayerOrder(index = selectedFrame, group = currentGroup) {
  const maxOrder = frameImageAttachmentsForFrame(index, group)
    .reduce((max, attachment) => Math.max(max, attachmentLayerOrder(attachment)), 0);
  return Math.max(1, maxOrder + 1);
}

function selectedFrameAttachment() {
  if (!selectedAttachmentId) return null;
  return frameImageAttachments.find((attachment) => attachment.id === selectedAttachmentId) || null;
}

function implicitSingleFrameAttachment() {
  const indexes = selectedFrameIndexes();
  if (!currentGroup || indexes.length !== 1) return null;
  const attachments = frameImageAttachmentsForFrame(indexes[0], currentGroup);
  return attachments.length === 1 ? attachments[0] : null;
}

function directManipulationAttachment() {
  const indexes = selectedFrameIndexes();
  if (indexes.length !== 1) return null;
  const selected = selectedFrameAttachment();
  if (selected && attachmentFrameIndex(selected, currentGroup) === indexes[0]) return selected;
  return implicitSingleFrameAttachment();
}

function canDirectManipulateSelectedAttachment() {
  return Boolean(directManipulationAttachment());
}

function activateFrameAttachmentForEditing(attachment) {
  if (!attachment) return false;
  const changed = selectedAttachmentId !== attachment.id || adjustmentMode !== "frame";
  selectedAttachmentId = attachment.id;
  adjustmentMode = "frame";
  localStorage.setItem(ADJUSTMENT_MODE_KEY, adjustmentMode);
  syncAdjustmentInputs();
  syncFrameInputs();
  if (changed) renderFilmstrip();
  return changed;
}

function attachmentFrameIndex(attachment, group = currentGroup) {
  if (!attachment || !group?.frames?.length) return selectedFrame;
  const frame = Number(attachment.metadata?.displayFrame ?? attachment.metadata?.frame);
  if (Number.isFinite(frame)) return clampFrameIndex(frame, group);
  const key = String(attachment.key || "");
  for (let index = 0; index < group.frames.length; index += 1) {
    if (frameImageAttachmentKey(index, group) === key) return index;
  }
  return selectedFrame;
}

function selectFrameImageAttachment(attachment, index = selectedFrame, group = currentGroup) {
  if (!attachment || !group) return;
  selectedAttachmentId = attachment.id;
  setSingleFrameSelection(index, group);
  if (adjustmentMode !== "frame") setAdjustmentMode("frame");
  else syncAdjustmentInputs();
  syncFrameInputs();
  renderFilmstrip();
  draw();
}

function clearSelectedAttachment() {
  selectedAttachmentId = "";
}

function frameImageAttachmentClipboardItem(attachment) {
  return {
    name: attachment.name,
    path: attachment.path,
    assetHash: attachment.assetHash,
    type: attachment.type,
    width: attachment.width,
    height: attachment.height,
    layer: attachment.layer === "below" ? "below" : "above",
    layerOrder: attachmentLayerOrder(attachment),
    transform: structuredClone(normalizeAttachmentTransform(attachment.transform)),
  };
}

function copyFrameImageAttachments() {
  if (!currentGroup) return false;
  const selectedAttachment = selectedFrameAttachment();
  const attachments = selectedAttachment
    ? [selectedAttachment]
    : frameImageAttachmentsForFrame(selectedFrame, currentGroup);
  if (!attachments.length) {
    status(t("frameAttachmentCopyEmpty"));
    return false;
  }
  frameImageAttachmentClipboard = attachments.map(frameImageAttachmentClipboardItem);
  frameImageAttachmentClipboardProjectId = activeProjectId();
  status(t("frameAttachmentCopied", { count: frameImageAttachmentClipboard.length }));
  return true;
}

function pasteFrameImageAttachments() {
  if (!currentGroup) return false;
  if (!frameImageAttachmentClipboard.length) {
    status(t("frameAttachmentPasteEmpty"));
    return false;
  }
  if (frameImageAttachmentClipboardProjectId && frameImageAttachmentClipboardProjectId !== activeProjectId()) {
    status(t("frameAttachmentPasteProjectMismatch"));
    return false;
  }
  const targetFrames = selectedFrameIndexes(currentGroup);
  if (!targetFrames.length) return false;
  pushUndo("paste attached image");
  const created = [];
  for (const frameIndex of targetFrames) {
    for (const copied of frameImageAttachmentClipboard) {
      const attachment = normalizeFrameImageAttachment({
        ...structuredClone(copied),
        id: newLocalId("layer"),
        key: frameImageAttachmentKey(frameIndex, currentGroup),
        metadata: frameImageAttachmentMetadata(frameIndex, currentGroup),
      });
      frameImageAttachments.push(attachment);
      created.push(attachment);
      loadImageCached(attachment).catch(() => null);
    }
  }
  if (created.length === 1 && targetFrames.length === 1) {
    selectedAttachmentId = created[0].id;
    adjustmentMode = "frame";
  } else {
    clearSelectedAttachment();
  }
  markDirty();
  syncFrameInputs();
  renderFilmstrip();
  draw();
  status(t("frameAttachmentPasted", { count: created.length }));
  return true;
}

function frameAudioBinding(index = selectedFrame, group = currentGroup) {
  return frameAudioBindings[frameAudioKey(index, group)] || null;
}

function revokeFrameAudioBinding(binding) {
  if (binding?.url) URL.revokeObjectURL(binding.url);
}

function resetFrameAudioBindings() {
  for (const binding of Object.values(frameAudioBindings)) revokeFrameAudioBinding(binding);
  frameAudioBindings = {};
}

function frameAudioKeyFromBinding(binding) {
  if (binding?.key) return String(binding.key);
  const metadata = binding?.metadata || {};
  if (!metadata.animation || !Number.isFinite(Number(metadata.frame))) return "";
  return [
    metadata.projectId || activeProjectId(),
    metadata.tuningTarget || "player",
    metadata.profileId || "all",
    metadata.groupType || "animation",
    metadata.animation,
    metadata.source || "",
    Number(metadata.frame),
  ].join(":");
}

function loadFrameAudioBindingsFromProject() {
  const bindings = Array.isArray(config?.frameAudioBindings) ? config.frameAudioBindings : [];
  for (const rawBinding of bindings) {
    const binding = rawBinding && typeof rawBinding === "object" ? rawBinding : null;
    if (!binding) continue;
    const key = frameAudioKeyFromBinding(binding);
    if (!key) continue;
    if (!binding.data && !binding.path && !binding.file) continue;
    const metadata = binding.metadata || frameAudioMetadataFromKey(key);
    if (metadata?.projectId && metadata.projectId !== activeProjectId()) continue;
    revokeFrameAudioBinding(frameAudioBindings[key]);
    frameAudioBindings[key] = {
      key,
      name: binding.name || "audio",
      type: binding.type || "",
      size: Number(binding.size || 0),
      metadata,
      data: binding.data || "",
      path: binding.path || binding.file || "",
    };
  }
}

function openFrameAudioDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (frameAudioDbPromise) return frameAudioDbPromise;
  frameAudioDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(FRAME_AUDIO_DB_NAME, FRAME_AUDIO_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FRAME_AUDIO_STORE)) {
        db.createObjectStore(FRAME_AUDIO_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
  });
  return frameAudioDbPromise;
}

async function saveFrameAudioBindingToDb(key, binding) {
  if (!key || !binding?.blob) return;
  try {
    const db = await openFrameAudioDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FRAME_AUDIO_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Audio save failed"));
      tx.objectStore(FRAME_AUDIO_STORE).put({
        key,
        name: binding.name || "audio",
        type: binding.type || "",
        size: Number(binding.size || 0),
        metadata: binding.metadata || frameAudioMetadataFromKey(key),
        blob: binding.blob,
      });
    });
  } catch (error) {
    status(t("frameSfxSessionOnly", { message: error.message }));
  }
}

async function deleteFrameAudioBindingFromDb(key) {
  if (!key) return;
  try {
    const db = await openFrameAudioDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FRAME_AUDIO_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Audio delete failed"));
      tx.objectStore(FRAME_AUDIO_STORE).delete(key);
    });
  } catch (error) {
    status(t("frameSfxDeleteFailed", { message: error.message }));
  }
}

async function loadFrameAudioBindingsFromDb() {
  try {
    const db = await openFrameAudioDb();
    if (!db) return;
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(FRAME_AUDIO_STORE, "readonly");
      const request = tx.objectStore(FRAME_AUDIO_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("Audio load failed"));
    });
    for (const record of records) {
      if (!record?.key || !record.blob) continue;
      const existing = frameAudioBindings[record.key];
      if (!existing) continue;
      const metadata = existing.metadata || record.metadata || frameAudioMetadataFromKey(record.key);
      if (!metadata || (metadata.projectId && metadata.projectId !== activeProjectId())) continue;
      revokeFrameAudioBinding(existing);
      frameAudioBindings[record.key] = {
        ...existing,
        key: record.key,
        name: existing.name || record.name || "audio",
        url: URL.createObjectURL(record.blob),
        type: existing.type || record.type || "",
        size: Number(existing.size || record.size || 0),
        metadata,
        blob: record.blob,
        path: existing.path || existing.file || "",
      };
    }
  } catch (error) {
    status(t("frameSfxRestoreFailed", { message: error.message }));
  }
}

async function setFrameAudioBinding(file, index = selectedFrame, group = currentGroup) {
  if (!file || !group) return;
  const key = frameAudioKey(index, group);
  revokeFrameAudioBinding(frameAudioBindings[key]);
  frameAudioBindings[key] = {
    key,
    name: file.name || "audio",
    url: URL.createObjectURL(file),
    type: file.type || "",
    size: Number(file.size || 0),
    metadata: frameAudioMetadata(index, group),
    blob: file,
  };
  await saveFrameAudioBindingToDb(key, frameAudioBindings[key]);
}

async function clearFrameAudioBinding(index = selectedFrame, group = currentGroup) {
  const key = frameAudioKey(index, group);
  revokeFrameAudioBinding(frameAudioBindings[key]);
  delete frameAudioBindings[key];
  await deleteFrameAudioBindingFromDb(key);
}

function playFrameAudio(index = selectedFrame, group = currentGroup) {
  const binding = frameAudioBinding(index, group);
  const source = binding?.url || binding?.data || "";
  if (!source) return;
  const audio = new Audio(source);
  audio.preload = "auto";
  audio.play().catch((error) => status(t("audioPreviewBlocked", { message: error.message })));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Audio read failed"));
    reader.readAsDataURL(blob);
  });
}

async function collectFrameAudioBindingsForSave() {
  const result = [];
  for (const [key, binding] of Object.entries(frameAudioBindings)) {
    const metadata = binding.metadata || frameAudioMetadataFromKey(key);
    if (!metadata || metadata.projectId !== activeProjectId() || !metadata.animation) continue;
    const frame = Number(metadata.frame);
    if (!Number.isFinite(frame)) continue;
    const data = binding?.blob ? await blobToDataUrl(binding.blob) : String(binding?.data || "");
    const existingPath = String(binding?.path || binding?.file || "");
    if (!data && !existingPath) continue;
    result.push({
      key,
      ...metadata,
      frame,
      name: binding.name || "audio",
      type: binding.type || "",
      size: Number(binding.size || 0),
      ...(data ? { data } : {}),
      ...(existingPath ? { path: existingPath } : {}),
    });
  }
  return result;
}

async function syncFrameAudioBindingsToGame(options = {}) {
  const silent = options.silent === true;
  if (frameAudioSyncPromise) await frameAudioSyncPromise.catch(() => {});
  frameAudioSyncPromise = (async () => {
    const bindings = await collectFrameAudioBindingsForSave();
    const res = await fetch("/api/frame-audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: activeProjectId(), frameAudioBindings: bindings }),
    });
    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();
    if (!silent) status(t("frameSfxSaved", { count: result.frameAudioCount || 0 }));
    return result;
  })();
  try {
    return await frameAudioSyncPromise;
  } finally {
    frameAudioSyncPromise = null;
  }
}

function groupPlaybackKey(group = currentGroup) {
  return keyFor(tuningAnimationName(group), GROUP_PLAYBACK_FRAME);
}

function groupOwnsFrameKey(group, key) {
  if (!group || !key.startsWith(`${tuningAnimationName(group)}:`)) return false;
  if (key === groupPlaybackKey(group)) return true;
  if (!Array.isArray(group.sourceFrameIndices) || !group.sourceFrameIndices.length) return true;
  const frameIndex = Number(String(key).slice(String(key).lastIndexOf(":") + 1));
  return group.sourceFrameIndices.includes(frameIndex);
}

function overrideStore(group = currentGroup) {
  if (!group) return frameOverrides;
  if (group.tuningTarget === "boss") return bossFrameOverrides;
  if (group.tuningTarget === "act2_statue_boss") return act2StatueBossFrameOverrides;
  if (group.tuningTarget === "huang_xian") return huangXianFrameOverrides;
  if (group.tuningTarget === "soul") return soulFrameOverrides;
  if (group.tuningTarget === "yecheng_props") return yechengPropFrameOverrides;
  return group.type === "vfx" ? vfxFrameOverrides : frameOverrides;
}

function playbackStore(group = currentGroup) {
  if (!group) return framePlaybackOverrides;
  if (group.tuningTarget === "boss") return bossPlaybackOverrides;
  if (group.tuningTarget === "act2_statue_boss") return act2StatueBossPlaybackOverrides;
  if (group.tuningTarget === "huang_xian") return huangXianPlaybackOverrides;
  if (group.tuningTarget === "soul") return soulPlaybackOverrides;
  return group.type === "vfx" ? vfxPlaybackOverrides : framePlaybackOverrides;
}

function boxOverrideStore(group = currentGroup) {
  if (group?.tuningTarget === "soul") return soulFrameBoxOverrides;
  return frameBoxOverrides;
}

function valueStore(group = currentGroup) {
  if (group?.tuningTarget === "boss") return bossValues;
  if (group?.tuningTarget === "act2_statue_boss") return act2StatueBossValues;
  if (group?.tuningTarget === "huang_xian") return huangXianValues;
  if (group?.tuningTarget === "soul") return soulValues;
  if (group?.tuningTarget === "yecheng_props") return yechengPropValues;
  return values;
}

function groupSupports(group, feature) {
  if (!group || !Array.isArray(group.profileSupports) || !group.profileSupports.length) return true;
  return group.profileSupports.includes(feature);
}

function canEditGroupTransform(group = currentGroup) {
  return groupSupports(group, "group_transform");
}

function canEditFrameTransform(group = currentGroup) {
  return groupSupports(group, "frame_transform");
}

function canEditFramePlayback(group = currentGroup) {
  return groupSupports(group, "frame_playback");
}

function canUseReferenceFrame(group = currentGroup) {
  return canEditFrameTransform(group) || groupSupports(group, "reference_frame");
}

function assetUrl(frame) {
  return `/asset?path=${encodeURIComponent(frame.path)}&v=${Date.now()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function projectLabel(project) {
  if (!project) return "Project";
  return project.label || project.id || "Project";
}

function renderProjectSelect() {
  if (!els.projectSelect) return;
  const projects = Array.isArray(config?.projects) ? config.projects : [];
  els.projectSelect.innerHTML = projects.length
    ? projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(projectLabel(project))}</option>`).join("")
    : `<option value="">No projects</option>`;
  const active = config?.activeProjectId || projects[0]?.id || "";
  selectedProjectId = active;
  if (active) localStorage.setItem("xsxbFrameTuner.project", active);
  els.projectSelect.value = active;
  els.projectSelect.disabled = !projects.length;
}

function resetProjectSession() {
  playing = false;
  playbackPrimaryGroup = null;
  playbackSecondaryGroup = null;
  playbackSwitching = false;
  currentGroup = null;
  selectedFrame = 0;
  selectedFrames = new Set([0]);
  selectionAnchorFrame = 0;
  images = [];
  chainImages = [];
  previewOwnerGroup = null;
  previewOwnerImages = [];
  coordinateOwnerGroup = null;
  coordinateOwnerImages = [];
  attachedLayerImageSets.clear();
  referenceFrame = null;
  undoStack = [];
  redoStack = [];
  imageCache.clear();
  opaqueRectCache = new WeakMap();
  huangXianAnchorXCache = new WeakMap();
  if (els.playPause) els.playPause.textContent = t("play");
  if (els.filmstrip) els.filmstrip.innerHTML = "";
  if (els.canvasTitle) els.canvasTitle.textContent = t("canvas");
  if (els.selectionHud) els.selectionHud.textContent = `${t("frame")} -`;
  if (els.coordHud) els.coordHud.textContent = t("coordHudIdle");
  updateHistoryControls();
}

async function activateProject(projectId) {
  if (!projectId || projectId === activeProjectId()) return;
  if (dirty && !window.confirm(t("projectSwitchConfirm"))) {
    renderProjectSelect();
    return;
  }
  const res = await fetch("/api/projects/active", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) throw new Error(await res.text());
  selectedProjectId = projectId;
  localStorage.setItem("xsxbFrameTuner.project", projectId);
  resetProjectSession();
  dirty = false;
  await loadConfig();
  resizeCanvas();
}

function groupBindingLabel(group) {
  if (!group) return "";
  if (group.previewOwner) return ` -> ${group.previewOwner}`;
  if (Array.isArray(group.attachedLayers) && group.attachedLayers.length) return ` + ${group.attachedLayers.join(", ")}`;
  if (group.type !== "vfx") return "";
  const boundTarget = group.attachTo || String(group.name || "").replace(/_vfx$/, "");
  return boundTarget ? ` -> ${boundTarget}` : "";
}

function groupLabel(group) {
  const fallbackTypeLabel = group.tuningTarget === "act2_statue_boss"
    ? "Act2 Statue"
    : group.tuningTarget === "huang_xian"
      ? "Act2 Huang Xian"
    : group.tuningTarget === "soul"
      ? (group.type === "prop" ? "Soul Prop" : "Soul")
    : group.tuningTarget === "yecheng_props"
      ? (group.type === "scene_prop_attachment" ? "Yecheng Prop Layer" : "Yecheng Prop")
    : group.type === "boss"
      ? "Boss"
      : group.type === "vfx"
        ? "VFX"
        : "Sprite";
  let typeLabel = group.profileLabel || fallbackTypeLabel;
  if (group.profileLabel && group.type === "vfx") typeLabel = `${group.profileLabel} VFX`;
  if (group.profileLabel && group.type === "prop") typeLabel = `${group.profileLabel} Prop`;
  if (group.profileLabel && group.type === "scene_prop_attachment") typeLabel = `${group.profileLabel} Layer`;
  const runtimeLabel = group.skillName && group.runtimeAnimation ? ` (${group.runtimeAnimation})` : "";
  return `${typeLabel} - ${group.name}${runtimeLabel}${groupBindingLabel(group)}`;
}

function filteredGroups() {
  if (!config?.groups) return [];
  let groups = (!selectedProfileId || selectedProfileId === "all")
    ? config.groups
    : config.groups.filter((group) => group.profileId === selectedProfileId);
  const query = groupSearch.trim().toLowerCase();
  if (query) {
    groups = groups.filter((group) => {
      const haystack = [
        groupLabel(group),
        group.name,
        group.type,
        group.source,
        group.profileLabel,
        group.runtimeAnimation,
        group.profileKind,
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }
  return groups;
}

function profileOptionsFromConfig() {
  const profileIdsInUse = new Set((config?.groups || []).map((group) => group.profileId).filter(Boolean));
  const profiles = Array.isArray(config?.profiles) ? config.profiles : [];
  return profiles
    .filter((profile) => profileIdsInUse.has(profile.id))
    .map((profile) => ({ id: profile.id, label: profile.label || profile.id }));
}

function renderProfileSelect() {
  const options = [
    { id: "all", label: t("allCharacters") },
    ...profileOptionsFromConfig(),
  ];
  els.profileSelect.innerHTML = options
    .map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.label)}</option>`)
    .join("");
  if (!options.some((profile) => profile.id === selectedProfileId)) selectedProfileId = "all";
  els.profileSelect.value = selectedProfileId;
}

function renderGroupSelect(selectedUiId = currentGroup?.uiId) {
  const groups = filteredGroups();
  els.groupSelect.innerHTML = groups.length
    ? groups.map((group) => `<option value="${escapeHtml(group.uiId)}">${escapeHtml(groupLabel(group))}</option>`).join("")
    : `<option value="">${escapeHtml(t("noMatchingGroups"))}</option>`;
  els.groupSelect.disabled = !groups.length;
  if (selectedUiId && groups.some((group) => group.uiId === selectedUiId)) {
    els.groupSelect.value = selectedUiId;
  }
  return groups;
}

function renderChainGroupSelect(selectedUiId = els.chainGroupSelect?.value || "") {
  if (!els.chainGroupSelect) return;
  els.chainGroupSelect.innerHTML = [
    `<option value="">${escapeHtml(t("none"))}</option>`,
    ...config.groups.map((group) => `<option value="${escapeHtml(group.uiId)}">${escapeHtml(groupLabel(group))}</option>`),
  ].join("");
  els.chainGroupSelect.value = selectedUiId || "";
}

function updateGroupMeta() {}

async function loadConfig() {
  const configUrl = selectedProjectId ? `/api/config?project=${encodeURIComponent(selectedProjectId)}` : "/api/config";
  const res = await fetch(configUrl);
  if (!res.ok) throw new Error(await res.text());
  config = await res.json();
  config.groups = Array.isArray(config.groups) ? config.groups : [];
  config.scenes = Array.isArray(config.scenes) ? config.scenes : [];
  selectedProjectId = config.activeProjectId || selectedProjectId || "";
  if (selectedProjectId) localStorage.setItem("xsxbFrameTuner.project", selectedProjectId);
  config.groups.forEach((group, index) => { group.uiId = `${group.tuningTarget || "player"}:${group.type}:${group.name}:${index}`; });
  values = { ...config.tuning };
  bossValues = { ...(config.bossTuning || {}) };
  act2StatueBossValues = { ...(config.act2StatueBossTuning || {}) };
  huangXianValues = { ...(config.huangXianTuning || {}) };
  soulValues = { ...(config.soulTuning || {}) };
  yechengPropValues = { ...(config.yechengPropTuning || {}) };
  sceneSettings = structuredClone(config.tuning.scene_settings || {});
  frameOverrides = structuredClone(config.tuning.frame_visual_overrides || {});
  vfxFrameOverrides = structuredClone(config.tuning.attack_vfx_frame_overrides || {});
  framePlaybackOverrides = structuredClone(config.tuning.frame_playback_overrides || {});
  vfxPlaybackOverrides = structuredClone(config.tuning.attack_vfx_playback_overrides || {});
  frameBoxOverrides = structuredClone(config.tuning.frame_box_overrides || {});
  bossFrameOverrides = structuredClone(config.bossTuning?.boss_frame_visual_overrides || {});
  bossPlaybackOverrides = structuredClone(config.bossTuning?.boss_frame_playback_overrides || {});
  act2StatueBossFrameOverrides = structuredClone(config.act2StatueBossTuning?.frame_visual_overrides || {});
  act2StatueBossPlaybackOverrides = structuredClone(config.act2StatueBossTuning?.frame_playback_overrides || {});
  huangXianFrameOverrides = structuredClone(config.huangXianTuning?.frame_visual_overrides || {});
  huangXianPlaybackOverrides = structuredClone(config.huangXianTuning?.frame_playback_overrides || {});
  soulFrameOverrides = structuredClone(config.soulTuning?.frame_visual_overrides || {});
  soulPlaybackOverrides = structuredClone(config.soulTuning?.frame_playback_overrides || {});
  soulFrameBoxOverrides = structuredClone(config.soulTuning?.frame_box_overrides || {});
  yechengPropFrameOverrides = structuredClone(config.yechengPropTuning?.frame_visual_overrides || {});
  loadFrameImageAttachmentsFromProject();
  resetFrameAudioBindings();
  loadFrameAudioBindingsFromProject();
  await loadFrameAudioBindingsFromDb();
  if (Object.keys(frameAudioBindings).length) {
    await syncFrameAudioBindingsToGame({ silent: true }).catch((error) => {
      status(t("boxSyncFailed", { message: error.message }));
    });
  }
  if (els.groupSearch) els.groupSearch.value = groupSearch;
  renderProjectSelect();
  renderSceneSelect();
  renderProfileSelect();
  renderGroupSelect();
  renderChainGroupSelect();
  updateSaveState();
  updateHistoryControls();
  startPreloadImages();
  const savedGroupUiId = localStorage.getItem("animationTuner.groupUiId");
  const initialGroup = config.groups.find((group) => group.uiId === savedGroupUiId)
    || config.groups.find((group) => group.name === "stand_attack")
    || config.groups[0];
  if (initialGroup) {
    await selectGroup(initialGroup);
  } else {
    resetProjectSession();
    renderProjectSelect();
    renderProfileSelect();
    renderGroupSelect();
    renderChainGroupSelect();
    updateWorkbenchHud(null);
    draw();
  }
  status(loadedStatusText());
}

async function selectGroup(group, options = {}) {
  if (!group) return;
  const hadCurrentGroup = Boolean(currentGroup);
  if (options.stopPlayback !== false) {
    playing = false;
    playbackPrimaryGroup = null;
    playbackSecondaryGroup = null;
    if (els.playPause) els.playPause.textContent = t("play");
  }
  if (selectedProfileId !== "all" && group.profileId !== selectedProfileId) {
    selectedProfileId = group.profileId || "all";
    els.profileSelect.value = selectedProfileId;
  }
  renderGroupSelect(group.uiId);
  currentGroup = group;
  localStorage.setItem("animationTuner.groupUiId", group.uiId);
  selectedFrame = Number.isInteger(options.frameIndex) ? options.frameIndex : 0;
  images = await Promise.all(group.frames.map(loadImageCached));
  if (group.huangXianAnchorFrame) {
    group.huangXianAnchorImage = await loadImageCached(group.huangXianAnchorFrame);
  } else {
    delete group.huangXianAnchorImage;
  }
  await loadCompositeContext(group);
  await loadFrameImageAttachmentsForGroup(group);
  selectedFrame = Math.min(Math.max(selectedFrame, 0), Math.max(group.frames.length - 1, 0));
  selectedAttachmentId = options.selectedAttachmentId || "";
  if (framePlayback(selectedFrame, group).disabled) {
    selectedFrame = firstPlayableFrame(group);
  }
  if (Array.isArray(options.selectedFrames)) {
    selectionAnchorFrame = Number.isInteger(options.selectionAnchorFrame) ? options.selectionAnchorFrame : selectedFrame;
    setFrameSelection(options.selectedFrames, selectedFrame, group);
  } else {
    setSingleFrameSelection(selectedFrame, group);
  }
  await loadChainImages();
  els.groupSelect.value = group.uiId;
  updateCanvasTitle(group);
  updateGroupMeta(group);
  syncBoxSelectionForGroup(group);
  syncBaseInputs();
  syncFrameInputs();
  syncGroupPlaybackInputs();
  syncGroupTimeInputs();
  renderFilmstrip();
  const preserveView = options.preserveView === true || (options.preserveView !== false && hadCurrentGroup);
  if (options.fitView === true || !preserveView) fitView();
  draw();
}

async function loadChainImages() {
  const chain = playbackChainGroup();
  if (chain && currentGroup && chain.uiId !== currentGroup.uiId) {
    chainImages = await Promise.all(chain.frames.map(loadImageCached));
    if (chain.huangXianAnchorFrame) {
      chain.huangXianAnchorImage = await loadImageCached(chain.huangXianAnchorFrame);
    } else {
      delete chain.huangXianAnchorImage;
    }
  } else {
    chainImages = [];
  }
}

function findRelatedGroup(ownerGroup, name) {
  if (!ownerGroup || !name) return null;
  return config?.groups?.find((group) => group.tuningTarget === ownerGroup.tuningTarget && group.name === name) || null;
}

function attachedLayerGroups(ownerGroup) {
  if (!Array.isArray(ownerGroup?.attachedLayers)) return [];
  return ownerGroup.attachedLayers
    .map((name) => findRelatedGroup(ownerGroup, name))
    .filter(Boolean);
}

async function loadCompositeContext(group) {
  previewOwnerGroup = group?.previewOwner ? findRelatedGroup(group, group.previewOwner) : null;
  previewOwnerImages = previewOwnerGroup ? await Promise.all(previewOwnerGroup.frames.map(loadImageCached)) : [];
  const coordinateOwnerName = group?.previewOwner || (group?.type === "vfx" ? group.attachTo : "");
  coordinateOwnerGroup = coordinateOwnerName ? findRelatedGroup(group, coordinateOwnerName) : null;
  coordinateOwnerImages = coordinateOwnerGroup
    ? (coordinateOwnerGroup.uiId === previewOwnerGroup?.uiId
      ? previewOwnerImages
      : await Promise.all(coordinateOwnerGroup.frames.map(loadImageCached)))
    : [];
  attachedLayerImageSets = new Map();
  for (const ownerGroup of [group, previewOwnerGroup].filter(Boolean)) {
    for (const layerGroup of attachedLayerGroups(ownerGroup)) {
      if (attachedLayerImageSets.has(layerGroup.uiId)) continue;
      attachedLayerImageSets.set(layerGroup.uiId, await Promise.all(layerGroup.frames.map(loadImageCached)));
    }
  }
}

async function loadFrameImageAttachmentsForGroup(group) {
  if (!group?.frames?.length) return;
  const preloadFrames = new Map();
  for (let index = 0; index < group.frames.length; index += 1) {
    for (const attachment of frameImageAttachmentsForFrame(index, group)) {
      if (attachment.path) preloadFrames.set(imageCacheKey(attachment), attachment);
    }
  }
  await Promise.all(Array.from(preloadFrames.values()).map((frame) => loadImageCached(frame).catch(() => null)));
}

function startPreloadImages() {
  const paths = new Set();
  for (const group of config.groups) {
    for (const frame of group.frames) paths.add(frame.path);
  }
  preloadLoaded = 0;
  preloadTotal = paths.size;
  for (const path of paths) {
    loadImageCached({ path }).then(() => {
      preloadLoaded += 1;
      if (preloadLoaded === preloadTotal) status(t("preloadedFrames", { count: preloadTotal, root: config.root }));
    }).catch(() => {
      preloadLoaded += 1;
    });
  }
}

function imageCacheKey(frame) {
  const hash = String(frame?.assetHash || "");
  if (hash) return `asset:${hash}`;
  return String(frame?.path || "");
}

function cachedImageForFrame(frame) {
  return imageElements.get(imageCacheKey(frame)) || imageElements.get(String(frame?.path || ""));
}

function loadImageCached(frame) {
  const key = imageCacheKey(frame);
  if (!imageCache.has(key)) {
    imageCache.set(key, loadImage(frame).then((img) => {
      imageElements.set(key, img);
      if (frame?.path) imageElements.set(String(frame.path), img);
      return img;
    }));
  }
  return imageCache.get(key);
}

function loadImage(frame) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = assetUrl(frame);
  });
}

function opaqueRectForImage(img) {
  if (!img) return { x: 0, y: 0, width: 1, height: 1 };
  if (opaqueRectCache.has(img)) return opaqueRectCache.get(img);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(img, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 3) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const rect = maxX >= minX && maxY >= minY
    ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : { x: 0, y: 0, width: img.width, height: img.height };
  opaqueRectCache.set(img, rect);
  return rect;
}

function playerPreviewVisualHeight() {
  const canonicalHeight = Number(config?.references?.playerCanonicalIdleHeight);
  if (Number.isFinite(canonicalHeight) && canonicalHeight > 0) return canonicalHeight;
  const idleGroup = config?.groups?.find((group) => !group.tuningTarget && group.name === "idle");
  if (!idleGroup || !idleGroup.frames?.length) return 720;
  const idleTransform = baseTransform(idleGroup);
  return Number(idleGroup.frames[0].height || 720) * Number(idleTransform.scaleY ?? idleTransform.scale ?? 1);
}

function huangXianRuntimeBaseScale(index = selectedFrame, group = currentGroup, groupImages = images) {
  const img = groupImages[index];
  if (!img) return 1;
  const opaqueRect = opaqueRectForImage(img);
  const targetHeight = Number(config?.references?.huangXianTargetHeight)
    || playerPreviewVisualHeight() * Number(config?.references?.huangXianHeightScale || 1.06);
  return targetHeight / Math.max(opaqueRect.height, 1);
}

function targetHeightScaleForGroup(group = currentGroup) {
  if (group?.tuningTarget === "soul") return Number(group.targetHeightScale || config?.references?.soulHeightScale || 1.08);
  if (group?.tuningTarget === "huang_xian") return Number(config?.references?.huangXianHeightScale || group.targetHeightScale || 1.06);
  return Number(group?.targetHeightScale || 1);
}

function targetHeightForGroup(group = currentGroup) {
  const explicitTargetHeight = Number(group?.targetHeight || 0);
  if (Number.isFinite(explicitTargetHeight) && explicitTargetHeight > 0) return explicitTargetHeight;
  if (group?.tuningTarget === "soul") {
    return Number(config?.references?.soulTargetHeight) || playerPreviewVisualHeight() * targetHeightScaleForGroup(group);
  }
  if (group?.tuningTarget === "huang_xian") {
    return Number(config?.references?.huangXianTargetHeight) || playerPreviewVisualHeight() * targetHeightScaleForGroup(group);
  }
  return 0;
}

function usesTargetHeightFootAnchor(group = currentGroup) {
  return group?.tuningTarget === "huang_xian"
    || group?.scaleSemantic === "target_height"
    || (group?.tuningTarget === "soul" && group?.type !== "vfx" && group?.type !== "prop");
}

function usesCanvasBottomCenterAnchor(group = currentGroup) {
  return group?.anchorMode === "canvas_bottom_center";
}

function usesCanvasLeftBottomAnchor(group = currentGroup) {
  return group?.anchorMode === "canvas_left_bottom";
}

function usesCanvasFootAnchor(group = currentGroup) {
  return usesCanvasBottomCenterAnchor(group) || usesCanvasLeftBottomAnchor(group);
}

function usesSceneTopLeftAnchor(group = currentGroup) {
  return group?.anchorMode === "scene_top_left";
}

function usesPropFootAnchor(group = currentGroup) {
  return group?.tuningTarget === "soul" && group?.type === "prop" && usesCanvasFootAnchor(group);
}

function usesGenericFootAnchor(group = currentGroup) {
  return usesCanvasFootAnchor(group)
    && !usesTargetHeightFootAnchor(group)
    && !usesPropFootAnchor(group)
    && group?.type !== "vfx"
    && group?.type !== "scene_prop";
}

function usesRuntimeFootAnchor(group = currentGroup) {
  return usesTargetHeightFootAnchor(group) || usesPropFootAnchor(group) || usesGenericFootAnchor(group);
}

function targetHeightRuntimeBaseScale(index = selectedFrame, group = currentGroup, groupImages = images) {
  const img = groupImages[index];
  if (!img) return 1;
  const targetHeight = characterBaseScaleForGroup(group) * playerPreviewVisualHeight();
  if (usesCanvasFootAnchor(group)) {
    return targetHeight / Math.max(img.height, 1);
  }
  const opaqueRect = opaqueRectForImage(img);
  return targetHeight / Math.max(opaqueRect.height, 1);
}

function soulAttachedVfxRuntimeBaseScale(group = currentGroup) {
  if (group?.tuningTarget !== "soul" || group?.type !== "vfx") return 1;
  const ownerName = group.attachTo || String(group.name || "").replace(/_vfx$/, "");
  const ownerGroup = config?.groups?.find((entry) => entry.tuningTarget === "soul" && entry.name === ownerName);
  const ownerHeight = Number(ownerGroup?.frames?.[0]?.height || group.attachedFrameHeight || 1);
  return targetHeightForGroup(ownerGroup || group) / Math.max(ownerHeight, 1);
}

function characterBaseScaleForGroup(group = currentGroup) {
  const explicitScale = Number(characterTransform(group).scale);
  if (Number.isFinite(explicitScale) && explicitScale > 0) return explicitScale;
  const targetHeight = targetHeightForGroup(group);
  const playerHeight = playerPreviewVisualHeight();
  if (targetHeight > 0 && playerHeight > 0) return targetHeight / playerHeight;
  const scale = Number(group?.runtimeScale ?? 1);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function runtimeBaseScaleForGroup(index = selectedFrame, group = currentGroup, groupImages = images) {
  const characterScale = characterBaseScaleForGroup(group);
  const sceneScale = activeSceneScale();
  if (usesTargetHeightFootAnchor(group)) return targetHeightRuntimeBaseScale(index, group, groupImages) * sceneScale;
  if (usesPropFootAnchor(group) || usesGenericFootAnchor(group)) return characterScale * sceneScale;
  if (group?.tuningTarget === "soul" && group?.type === "vfx") return soulAttachedVfxRuntimeBaseScale(group) * sceneScale;
  return soulAttachedVfxRuntimeBaseScale(group) * characterScale * sceneScale;
}

function characterTransform(group = currentGroup) {
  if (!group) {
    return {
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      visual_scale: { x: 1, y: 1 },
      offset: { x: 0, y: 0 },
      rotation: 0,
    };
  }
  const store = valueStore(group);
  const scale = Number(store[group.characterScale] ?? group.characterBaseScale ?? group.bodyScale ?? 1);
  const scaleVector = cloneScaleVector(store[group.characterScaleVector] ?? group.characterBaseScaleVector, scale);
  return {
    scale,
    scaleX: scaleVector.x,
    scaleY: scaleVector.y,
    visual_scale: scaleVector,
    offset: cloneVector(store[group.characterOffset] ?? group.characterBaseOffset ?? { x: 0, y: 0 }),
    rotation: Number(store[group.characterRotation] ?? group.characterBaseRotation ?? 0),
  };
}

function renderTransformForGroup(transform, group = currentGroup) {
  const character = characterTransform(group);
  const characterScale = Number(character.scale || 1);
  const axisX = characterScale !== 0 ? Number(character.scaleX || characterScale) / characterScale : 1;
  const axisY = characterScale !== 0 ? Number(character.scaleY || characterScale) / characterScale : 1;
  return {
    scale: Number(transform.scale ?? 1),
    scaleX: Number(transform.scaleX ?? transform.scale ?? 1) * axisX,
    scaleY: Number(transform.scaleY ?? transform.scale ?? 1) * axisY,
    offset: {
      x: Number(character.offset?.x || 0) + Number(transform.offset?.x || 0),
      y: Number(character.offset?.y || 0) + Number(transform.offset?.y || 0),
    },
    rotation: Number(character.rotation || 0) + Number(transform.rotation || 0),
  };
}

function targetHeightAnimationAnchorX(index = selectedFrame, group = currentGroup, groupImages = images) {
  if (Number.isFinite(Number(group?.sourceAnchor?.x))) {
    return Number(group.sourceAnchor.x);
  }
  if (usesCanvasBottomCenterAnchor(group)) {
    const img = groupImages?.[index] || groupImages?.[0];
    return img ? img.width * 0.5 : 0;
  }
  if (usesCanvasLeftBottomAnchor(group)) return 0;
  const anchorImage = group?.huangXianAnchorImage || groupImages?.[0];
  if (!anchorImage) return 0;
  if (!huangXianAnchorXCache.has(anchorImage)) {
    const rect = opaqueRectForImage(anchorImage);
    huangXianAnchorXCache.set(anchorImage, rect.x + rect.width * 0.5);
  }
  return huangXianAnchorXCache.get(anchorImage);
}

function targetHeightAnimationAnchorY(index = selectedFrame, group = currentGroup, groupImages = images) {
  if (Number.isFinite(Number(group?.sourceAnchor?.y))) {
    return Number(group.sourceAnchor.y);
  }
  const img = groupImages[index];
  if (!img) return 0;
  if (usesCanvasFootAnchor(group)) {
    return img.height;
  }
  const opaqueRect = opaqueRectForImage(img);
  return opaqueRect.y + opaqueRect.height;
}

function baseTransform(group = currentGroup) {
  if (!group) {
    return {
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      visual_scale: { x: 1, y: 1 },
      offset: { x: 0, y: 0 },
      rotation: 0,
    };
  }
  const store = valueStore(group);
  const scale = Number(store[group.scale] ?? group.baseScale ?? group.defaultScale ?? 0.22);
  const scaleVector = cloneScaleVector(store[group.scaleVector] ?? group.baseScaleVector ?? group.defaultScaleVector, scale);
  return {
    scale,
    scaleX: scaleVector.x,
    scaleY: scaleVector.y,
    visual_scale: scaleVector,
    offset: cloneVector(store[group.offset] ?? group.baseOffset ?? group.defaultOffset ?? { x: 0, y: 0 }),
    rotation: Number(store[group.rotation] ?? group.baseRotation ?? group.defaultRotation ?? 0),
  };
}

function cloneVector(vector) {
  return { x: Number(vector?.x || 0), y: Number(vector?.y || 0) };
}

function cloneScaleVector(vector, fallbackScale = 1) {
  const fallback = Number(fallbackScale || 1);
  if (!vector || (Number(vector.x || 0) === 0 && Number(vector.y || 0) === 0)) {
    return { x: fallback, y: fallback };
  }
  return { x: Number(vector?.x ?? fallback), y: Number(vector?.y ?? fallback) };
}

function scaleVectorFromTransform(transform) {
  return {
    x: Number(transform.scaleX ?? transform.scale ?? 1),
    y: Number(transform.scaleY ?? transform.scale ?? 1),
  };
}

function round(value) {
  return Number(value || 0).toFixed(4).replace(/\.?0+$/, "");
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(Math.max(numeric, min), max);
}

function clampInteger(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(Math.max(Math.round(numeric), min), max);
}

function cloneState() {
  return {
    values: structuredClone(values),
    bossValues: structuredClone(bossValues),
    act2StatueBossValues: structuredClone(act2StatueBossValues),
    huangXianValues: structuredClone(huangXianValues),
    soulValues: structuredClone(soulValues),
    yechengPropValues: structuredClone(yechengPropValues),
    sceneSettings: structuredClone(sceneSettings),
    selectedSceneId,
    frameImageAttachments: structuredClone(frameImageAttachments),
    selectedAttachmentId,
    frameOverrides: structuredClone(frameOverrides),
    vfxFrameOverrides: structuredClone(vfxFrameOverrides),
    framePlaybackOverrides: structuredClone(framePlaybackOverrides),
    vfxPlaybackOverrides: structuredClone(vfxPlaybackOverrides),
    frameBoxOverrides: structuredClone(frameBoxOverrides),
    bossFrameOverrides: structuredClone(bossFrameOverrides),
    bossPlaybackOverrides: structuredClone(bossPlaybackOverrides),
    act2StatueBossFrameOverrides: structuredClone(act2StatueBossFrameOverrides),
    act2StatueBossPlaybackOverrides: structuredClone(act2StatueBossPlaybackOverrides),
    huangXianFrameOverrides: structuredClone(huangXianFrameOverrides),
    huangXianPlaybackOverrides: structuredClone(huangXianPlaybackOverrides),
    soulFrameOverrides: structuredClone(soulFrameOverrides),
    soulPlaybackOverrides: structuredClone(soulPlaybackOverrides),
    soulFrameBoxOverrides: structuredClone(soulFrameBoxOverrides),
    yechengPropFrameOverrides: structuredClone(yechengPropFrameOverrides),
    selectedFrame,
    selectedFrames: Array.from(selectedFrames),
    selectionAnchorFrame,
    groupName: currentGroup?.uiId,
  };
}

function updateHistoryControls() {
  for (const button of [els.undo, els.undoTop]) {
    if (button) button.disabled = !undoStack.length;
  }
  if (els.redoTop) els.redoTop.disabled = !redoStack.length;
}

function pushUndo(label = "edit") {
  undoStack.push({ label, state: cloneState() });
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
  updateHistoryControls();
  status(t("undoReady", { label }));
}

function restoreHistoryState(state) {
  values = structuredClone(state.values);
  bossValues = structuredClone(state.bossValues);
  act2StatueBossValues = structuredClone(state.act2StatueBossValues || {});
  huangXianValues = structuredClone(state.huangXianValues || {});
  soulValues = structuredClone(state.soulValues || {});
  yechengPropValues = structuredClone(state.yechengPropValues || {});
  sceneSettings = structuredClone(state.sceneSettings || {});
  selectedSceneId = state.selectedSceneId || selectedSceneId;
  frameImageAttachments = structuredClone(state.frameImageAttachments || []);
  selectedAttachmentId = state.selectedAttachmentId || "";
  frameOverrides = structuredClone(state.frameOverrides);
  vfxFrameOverrides = structuredClone(state.vfxFrameOverrides);
  framePlaybackOverrides = structuredClone(state.framePlaybackOverrides);
  vfxPlaybackOverrides = structuredClone(state.vfxPlaybackOverrides);
  frameBoxOverrides = structuredClone(state.frameBoxOverrides || {});
  bossFrameOverrides = structuredClone(state.bossFrameOverrides);
  bossPlaybackOverrides = structuredClone(state.bossPlaybackOverrides);
  act2StatueBossFrameOverrides = structuredClone(state.act2StatueBossFrameOverrides || {});
  act2StatueBossPlaybackOverrides = structuredClone(state.act2StatueBossPlaybackOverrides || {});
  huangXianFrameOverrides = structuredClone(state.huangXianFrameOverrides || {});
  huangXianPlaybackOverrides = structuredClone(state.huangXianPlaybackOverrides || {});
  soulFrameOverrides = structuredClone(state.soulFrameOverrides || {});
  soulPlaybackOverrides = structuredClone(state.soulPlaybackOverrides || {});
  soulFrameBoxOverrides = structuredClone(state.soulFrameBoxOverrides || {});
  yechengPropFrameOverrides = structuredClone(state.yechengPropFrameOverrides || {});
  const group = config.groups.find((entry) => entry.uiId === state.groupName) || currentGroup;
  renderSceneSelect();
  syncSceneInputs();
  return selectGroup(group, {
    frameIndex: state.selectedFrame,
    selectedFrames: state.selectedFrames,
    selectionAnchorFrame: state.selectionAnchorFrame,
    selectedAttachmentId,
  });
}

function undo() {
  const item = undoStack.pop();
  if (!item) {
    status(t("undoNothing"));
    updateHistoryControls();
    return;
  }
  redoStack.push({ label: item.label, state: cloneState() });
  if (redoStack.length > 80) redoStack.shift();
  updateHistoryControls();
  restoreHistoryState(item.state).then(() => {
    markDirty();
    updateHistoryControls();
    status(t("undone", { label: item.label }));
  });
}

function redo() {
  const item = redoStack.pop();
  if (!item) {
    status(t("redoNothing"));
    updateHistoryControls();
    return;
  }
  undoStack.push({ label: item.label, state: cloneState() });
  if (undoStack.length > 80) undoStack.shift();
  updateHistoryControls();
  restoreHistoryState(item.state).then(() => {
    markDirty();
    updateHistoryControls();
    status(t("redone", { label: item.label }));
  });
}

function clampFrameIndex(index, group = currentGroup) {
  const maxFrame = Math.max((group?.frames?.length || 1) - 1, 0);
  return Math.min(Math.max(Number(index) || 0, 0), maxFrame);
}

function setSingleFrameSelection(index, group = currentGroup) {
  selectedFrame = clampFrameIndex(index, group);
  selectedFrames = new Set([selectedFrame]);
  selectionAnchorFrame = selectedFrame;
}

function setFrameSelection(indexes, primaryIndex = selectedFrame, group = currentGroup) {
  const maxFrame = Math.max((group?.frames?.length || 1) - 1, 0);
  const next = new Set();
  for (const index of indexes || []) {
    const frameIndex = clampFrameIndex(index, group);
    if (frameIndex >= 0 && frameIndex <= maxFrame) next.add(frameIndex);
  }
  selectedFrame = clampFrameIndex(primaryIndex, group);
  next.add(selectedFrame);
  selectedFrames = next;
  selectionAnchorFrame = clampFrameIndex(selectionAnchorFrame, group);
}

function selectedFrameIndexes(group = currentGroup) {
  if (!selectedFrames.size) setSingleFrameSelection(selectedFrame, group);
  return Array.from(selectedFrames)
    .map((index) => clampFrameIndex(index, group))
    .filter((index, position, array) => array.indexOf(index) === position)
    .sort((a, b) => a - b);
}

function selectedFrameCount() {
  return selectedFrameIndexes().length;
}

function updateWorkbenchHud(group = currentGroup) {
  const frameCount = group?.frames?.length || 0;
  const selectionCount = selectedFrameCount();
  if (els.selectionHud) {
    const playable = playableFrameCount(group);
    const fps = group ? round(groupPlaybackFps(group)) : "-";
    const duration = group ? `${round(groupPlaybackDurationSeconds(group))}s` : "-";
    els.selectionHud.textContent = frameCount
      ? `${t("frame")} ${selectedFrame + 1}/${frameCount} - ${t("selectedFrames", { count: selectionCount })} - ${t("playable", { count: playable })} - ${fps} fps - ${duration}`
      : `${t("frame")} -`;
  }
}

function updateCanvasTitle(group = currentGroup) {
  if (!group) {
    els.canvasTitle.textContent = t("canvas");
    updateWorkbenchHud(null);
    return;
  }
  const count = selectedFrameCount();
  els.canvasTitle.textContent = `${group.name} - ${t("frameCountLabel", { count: group.frames.length })}${count > 1 ? ` - ${t("selectedFrames", { count })}` : ""}`;
  updateWorkbenchHud(group);
}

function frameTransform(index = selectedFrame, group = currentGroup) {
  const base = baseTransform(group);
  const store = overrideStore(group);
  const override = store[tuningFrameKey(index, group)];
  if (!override) return base;
  const scale = Number(override.visual_size ?? base.scale);
  let scaleVector;
  if (override.visual_scale) {
    scaleVector = cloneScaleVector(override.visual_scale, scale);
  } else if (override.visual_size !== undefined) {
    scaleVector = cloneScaleVector(null, scale);
  } else {
    scaleVector = { x: base.scaleX, y: base.scaleY };
  }
  return {
    scale,
    scaleX: scaleVector.x,
    scaleY: scaleVector.y,
    offset: cloneVector(override.offset ?? base.offset),
    rotation: Number(override.rotation || 0),
  };
}

function hasFrameTransformOverride(index = selectedFrame, group = currentGroup) {
  return Boolean(group && overrideStore(group)[tuningFrameKey(index, group)]);
}

function setFrameTransform(index, transform) {
  const store = overrideStore();
  const previous = frameTransform(index, currentGroup);
  const scale = Number(transform.scale ?? previous.scale);
  const scaleVector = scaleVectorFromTransform(
    {
      ...previous,
      ...transform,
      scale,
    },
    scale
  );
  const data = {
    visual_size: scale,
    offset: cloneVector(transform.offset ?? previous.offset),
    rotation: Number(transform.rotation ?? previous.rotation ?? 0),
  };
  if (!nearlyEqual(scaleVector.x, scale) || !nearlyEqual(scaleVector.y, scale)) {
    data.visual_scale = scaleVector;
  }
  store[tuningFrameKey(index, currentGroup)] = data;
  markDirty();
}

function framePlayback(index = selectedFrame, group = currentGroup) {
  if (!group) return { duration: 1, disabled: false };
  const override = playbackStore(group)[tuningFrameKey(index, group)] || {};
  return {
    duration: Number(override.duration || 1),
    disabled: override.disabled === true,
  };
}

function setFramePlayback(index, playback, group = currentGroup) {
  const store = playbackStore(group);
  const data = {
    duration: Math.max(0.001, Number(playback.duration || 1)),
    disabled: playback.disabled === true,
  };
  if (data.disabled || data.duration !== 1) store[tuningFrameKey(index, group)] = data;
  else delete store[tuningFrameKey(index, group)];
  markDirty();
}

function rawGroupPlaybackFps(group = currentGroup) {
  if (!group) return 12;
  const override = groupPlaybackOverride(group);
  return Math.max(0.001, Number(override.fps ?? group.speed ?? 12));
}

function attachedPlaybackOwnerGroup(group = currentGroup) {
  if (!group || group.type !== "vfx" || !group.attachTo) return null;
  return config?.groups?.find((entry) => entry.tuningTarget === group.tuningTarget && entry.name === group.attachTo) || null;
}

function usesAttachedPlaybackTiming(group = currentGroup) {
  return Boolean(attachedPlaybackOwnerGroup(group)) && group?.independentPlayback !== true;
}

function groupPlaybackOverride(group = currentGroup) {
  if (!group) return {};
  return playbackStore(group)[groupPlaybackKey(group)] || {};
}

function attachedVfxPlaybackWindow(group = currentGroup) {
  const owner = attachedPlaybackOwnerGroup(group);
  const ownerFrameCount = owner?.frames?.length || 0;
  if (!owner || ownerFrameCount <= 0) return { owner: null, start: 0, end: -1 };
  const override = groupPlaybackOverride(group);
  const defaultEnd = ownerFrameCount - 1;
  const start = clampInteger(override.start_frame ?? 0, 0, defaultEnd);
  const end = clampInteger(override.end_frame ?? defaultEnd, start, defaultEnd);
  return { owner, start, end };
}

function playableFrameCount(group = currentGroup) {
  if (!group?.frames?.length) return 0;
  return group.frames.reduce((count, _frame, index) => count + (framePlayback(index, group).disabled ? 0 : 1), 0);
}

function groupPlaybackDurationUnits(group = currentGroup, range = null) {
  if (!group?.frames?.length) return 0;
  const start = clampInteger(range?.start ?? 0, 0, group.frames.length - 1);
  const end = clampInteger(range?.end ?? group.frames.length - 1, start, group.frames.length - 1);
  let durationUnits = 0;
  for (let index = start; index <= end; index += 1) {
    const playback = framePlayback(index, group);
    if (!playback.disabled) durationUnits += Math.max(0.001, Number(playback.duration || 1));
  }
  return durationUnits;
}

function groupPlaybackDurationSeconds(group = currentGroup, range = null) {
  if (!group?.frames?.length) return 0;
  const fps = rawGroupPlaybackFps(group);
  const durationUnits = groupPlaybackDurationUnits(group, range);
  return durationUnits / fps;
}

function groupPlaybackFps(group = currentGroup) {
  if (usesAttachedPlaybackTiming(group)) {
    const owner = attachedPlaybackOwnerGroup(group);
    const window = attachedVfxPlaybackWindow(group);
    const ownerDuration = groupPlaybackDurationSeconds(owner, window);
    const vfxFrames = playableFrameCount(group);
    if (ownerDuration > 0 && vfxFrames > 0) return vfxFrames / ownerDuration;
  }
  return rawGroupPlaybackFps(group);
}

function effectiveFrameDurationMultiplier(index = selectedFrame, group = currentGroup) {
  return usesAttachedPlaybackTiming(group) ? 1 : framePlayback(index, group).duration;
}

function frameDurationMs(index = selectedFrame, group = currentGroup) {
  if (!group) return 0;
  return (1000 / groupPlaybackFps(group)) * effectiveFrameDurationMultiplier(index, group);
}

function frameDurationMultiplierFromMs(ms, group = currentGroup) {
  if (!group) return 1;
  return Math.max(0.001, (Math.max(MIN_FRAME_DURATION_MS, Number(ms) || MIN_FRAME_DURATION_MS) / 1000) * groupPlaybackFps(group));
}

function frameDurationMsLabel(index = selectedFrame, group = currentGroup) {
  return `${Math.round(frameDurationMs(index, group))}ms`;
}

function groupTimeMs(group = currentGroup) {
  return Math.max(MIN_FRAME_DURATION_MS, Math.round(groupPlaybackDurationSeconds(group) * 1000));
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function groupHasGroupTimeOverride(group = currentGroup) {
  return hasOwn(groupPlaybackOverride(group), "fps");
}

function groupHasFrameDurationOverrides(group = currentGroup) {
  if (!group) return false;
  const store = playbackStore(group);
  const groupKey = groupPlaybackKey(group);
  for (const key of Object.keys(store)) {
    if (key === groupKey || !groupOwnsFrameKey(group, key)) continue;
    const entry = store[key] || {};
    if (hasOwn(entry, "duration") && !nearlyEqual(entry.duration, 1)) return true;
  }
  return false;
}

function clearGroupTimeOverride(group = currentGroup) {
  if (!group) return false;
  const store = playbackStore(group);
  const key = groupPlaybackKey(group);
  const previous = store[key];
  if (!previous || !hasOwn(previous, "fps")) return false;
  const next = { ...previous };
  delete next.fps;
  if (Object.keys(next).length) store[key] = next;
  else delete store[key];
  markDirty();
  return true;
}

function clearFrameDurationOverrides(group = currentGroup) {
  if (!group) return false;
  const store = playbackStore(group);
  const groupKey = groupPlaybackKey(group);
  let changed = false;
  for (const key of Object.keys(store)) {
    if (key === groupKey || !groupOwnsFrameKey(group, key)) continue;
    const previous = store[key] || {};
    if (!hasOwn(previous, "duration")) continue;
    const next = { ...previous };
    delete next.duration;
    if (Object.keys(next).length) store[key] = next;
    else delete store[key];
    changed = true;
  }
  if (changed) markDirty();
  return changed;
}

function syncGroupTimeInputs() {
  if (!els.groupTimeMs) return;
  const visible = adjustmentMode === "group";
  if (els.groupTimeField) els.groupTimeField.hidden = !visible;
  if (!visible) return;
  const editable = Boolean(currentGroup) && canEditFramePlayback() && !usesAttachedPlaybackTiming();
  els.groupTimeMs.disabled = !editable;
  els.groupTimeMs.value = editable ? groupTimeMs(currentGroup) : "";
}

function setGroupTimeMs(ms, group = currentGroup) {
  if (!group || usesAttachedPlaybackTiming(group)) return false;
  const targetSeconds = Math.max(MIN_FRAME_DURATION_MS, Number(ms) || MIN_FRAME_DURATION_MS) / 1000;
  const durationUnits = groupPlaybackDurationUnits(group);
  if (durationUnits <= 0 || targetSeconds <= 0) return false;
  setGroupPlaybackData({ fps: durationUnits / targetSeconds }, group);
  return true;
}

function applyGroupTimeFromInput() {
  if (!currentGroup || !els.groupTimeMs || !canEditFramePlayback() || usesAttachedPlaybackTiming()) {
    syncGroupTimeInputs();
    return;
  }
  const targetMs = Math.max(MIN_FRAME_DURATION_MS, Math.round(Number(els.groupTimeMs.value || MIN_FRAME_DURATION_MS)));
  const hasFrameTiming = groupHasFrameDurationOverrides();
  const currentMs = groupTimeMs(currentGroup);
  if (!hasFrameTiming && Math.round(targetMs) === Math.round(currentMs)) {
    syncGroupTimeInputs();
    return;
  }
  if (hasFrameTiming && !window.confirm(t("groupTimeConflict"))) {
    syncGroupTimeInputs();
    return;
  }
  pushUndo("group time");
  if (hasFrameTiming) clearFrameDurationOverrides(currentGroup);
  setGroupTimeMs(targetMs, currentGroup);
  syncFrameInputs();
  renderFilmstrip();
  updateGroupMeta();
  updateWorkbenchHud();
  draw();
}

function groupRootMotion(group = currentGroup) {
  if (!group) return { x: 0, y: 0 };
  const override = groupPlaybackOverride(group);
  return cloneVector(override.root_motion || { x: 0, y: 0 });
}

function setGroupPlaybackData(data, group = currentGroup) {
  if (!group) return;
  const store = playbackStore(group);
  const key = groupPlaybackKey(group);
  const previous = store[key] || {};
  const owner = attachedPlaybackOwnerGroup(group);
  if (owner) {
    const defaultEnd = Math.max((owner.frames?.length || 1) - 1, 0);
    const start = clampInteger(data.start_frame ?? previous.start_frame ?? 0, 0, defaultEnd);
    const end = clampInteger(data.end_frame ?? previous.end_frame ?? defaultEnd, start, defaultEnd);
    const next = {};
    if (start !== 0) next.start_frame = start;
    if (end !== defaultEnd) next.end_frame = end;
    if (!Object.keys(next).length) {
      delete store[key];
      markDirty();
      return;
    }
    store[key] = next;
    markDirty();
    return;
  }
  const safeFps = Math.max(0.001, Number(data.fps ?? previous.fps ?? group.speed ?? 12));
  const defaultFps = Math.max(0.001, Number(group.speed || 12));
  const rootMotion = cloneVector(data.root_motion ?? previous.root_motion ?? { x: 0, y: 0 });
  const next = {};
  if (!nearlyEqual(safeFps, defaultFps)) next.fps = safeFps;
  if (!nearlyEqual(rootMotion.x, 0) || !nearlyEqual(rootMotion.y, 0)) next.root_motion = rootMotion;
  if (!Object.keys(next).length) {
    delete store[key];
    markDirty();
    return;
  }
  store[key] = next;
  markDirty();
}

function preserveGroupPlaybackDuration(previousDurationSeconds, group = currentGroup) {
  if (!group || attachedPlaybackOwnerGroup(group) || previousDurationSeconds <= 0) return false;
  const durationUnits = groupPlaybackDurationUnits(group);
  if (durationUnits <= 0) return false;
  setGroupPlaybackData({
    fps: durationUnits / previousDurationSeconds,
  }, group);
  syncGroupPlaybackInputs();
  syncGroupTimeInputs();
  updateGroupMeta();
  return true;
}

function frameBoxKey(index = selectedFrame, group = currentGroup) {
  return tuningFrameKey(index, group);
}

function boxOverride(index = selectedFrame, group = currentGroup) {
  return boxOverrideStore(group)[frameBoxKey(index, group)] || {};
}

function isCollisionBox(boxName) {
  return boxName === "collisionbox";
}

function collisionOffsetYForHeight(height) {
  return -Math.max(1, Number(height || 1)) / 2;
}

function sourceFrameSize(index = selectedFrame, group = currentGroup, groupImages = images) {
  const frame = group?.frames?.[index] || group?.frames?.[0] || {};
  const img = groupImages?.[index] || null;
  return {
    width: Math.max(1, Number(img?.width || frame.width || 1)),
    height: Math.max(1, Number(img?.height || frame.height || 1)),
  };
}

function sourceAnchorForBox(index = selectedFrame, group = currentGroup, groupImages = images) {
  const size = sourceFrameSize(index, group, groupImages);
  if (usesCanvasLeftBottomAnchor(group)) return { x: 0, y: size.height };
  if (usesCanvasBottomCenterAnchor(group)) return { x: size.width * 0.5, y: size.height };
  return { x: size.width * 0.5, y: size.height };
}

function sourceRectForBox(index = selectedFrame, group = currentGroup, groupImages = images) {
  const size = sourceFrameSize(index, group, groupImages);
  const img = groupImages?.[index] || null;
  if (img) return opaqueRectForImage(img);
  return { x: 0, y: 0, width: size.width, height: size.height };
}

function sourceBodyCenterForBox(index = selectedFrame, group = currentGroup, groupImages = images) {
  const rect = sourceRectForBox(index, group, groupImages);
  const anchor = sourceAnchorForBox(index, group, groupImages);
  return {
    x: rect.x + rect.width * 0.5 - anchor.x,
    y: rect.y + rect.height * 0.5 - anchor.y,
    rect,
  };
}

function normalizeFrameBox(boxName, box) {
  const size = {
    x: Math.max(1, Number(box?.size?.x || 1)),
    y: Math.max(1, Number(box?.size?.y || 1)),
  };
  if (isCollisionBox(boxName)) {
    return {
      offset: {
        x: Number(box?.offset?.x || 0),
        y: collisionOffsetYForHeight(size.y),
      },
      size,
      rotation: 0,
      enabled: box?.enabled !== false,
    };
  }
  return {
    offset: cloneVector(box?.offset),
    size,
    rotation: Number(box?.rotation || 0),
    enabled: box?.enabled !== false,
  };
}

function setBoxOverride(boxName, box, index = selectedFrame, group = currentGroup) {
  const store = boxOverrideStore(group);
  const key = frameBoxKey(index, group);
  const entry = structuredClone(store[key] || {});
  entry[boxName] = normalizeFrameBox(boxName, box);
  store[key] = entry;
  markDirty();
}

function deleteBoxOnFrame(boxName, index = selectedFrame, group = currentGroup) {
  const box = frameBox(boxName, index, group);
  setBoxOverride(boxName, {
    offset: box.offset,
    size: box.size,
    rotation: box.rotation || 0,
    enabled: false,
  }, index, group);
}

function clearBoxOverride(boxName, index = selectedFrame, group = currentGroup) {
  const store = boxOverrideStore(group);
  const key = frameBoxKey(index, group);
  const entry = store[key];
  if (!entry) return;
  delete entry[boxName];
  if (!BOX_NAMES.some((name) => entry[name])) delete store[key];
  markDirty();
}

function defaultHitboxOffset(group = currentGroup) {
  if (group?.tuningTarget === "soul") {
    return cloneVector(defaultSoulHitbox(group).offset);
  }
  const map = {
    stand_attack: "stand_attack_hitbox_offset",
    air_attack: "air_attack_hitbox_offset",
    crouch_attack: "crouch_attack_hitbox_offset",
  };
  const key = map[group?.name];
  return cloneVector((key && (values[key] ?? config?.tuningDefaults?.[key])) || { x: 72, y: 0 });
}

function boxRuleText(group = currentGroup) {
  return [
    group?.name,
    group?.runtimeAnimation,
    group?.skillName,
    group?.source,
  ].filter(Boolean).join(" ").toLowerCase();
}

function hasBoxRuleToken(group, tokenPattern) {
  return new RegExp(`(^|[\\s_-])(${tokenPattern})(?=$|[\\s_-])`, "i").test(boxRuleText(group));
}

function isNonAttackAnimationGroup(group = currentGroup) {
  return hasBoxRuleToken(group, "idle|stand|walk|run|jump|fall|land|hurt|damage|death|die|dead|stun|turn|talk|interact");
}

function isAttackAnimationGroup(group = currentGroup) {
  if (group?.hasHitbox === false) return false;
  if (group?.hasHitbox === true) return true;
  if (group?.tuningTarget === "soul") {
    return ["attack1", "attack2", "run_attack", "air_attack1", "parry1", "parry2", "parry3"].includes(group?.name);
  }
  if (["stand_attack", "air_attack", "crouch_attack"].includes(group?.name)) return true;
  if (hasBoxRuleToken(group, "attack|atk|slash|strike|shoot|shot|fire|skill|cast|stab|punch|kick|bite|claw|parry|counter")) return true;
  if (isNonAttackAnimationGroup(group)) return false;
  return false;
}

function hitboxActiveByDefault(index = selectedFrame, group = currentGroup) {
  if (group?.tuningTarget === "soul") return soulHitboxActiveByDefault(index, group);
  if (!isAttackAnimationGroup(group)) return false;
  if (!["stand_attack", "air_attack", "crouch_attack"].includes(group?.name)) {
    return !framePlayback(index, group).disabled;
  }
  const frameCount = Math.max(group.frames.length, 1);
  const frameStart = index / frameCount;
  const frameEnd = (index + 1) / frameCount;
  const activeStart = 0.045 / 0.28;
  const activeEnd = 1 - 0.03 / 0.28;
  return frameEnd >= activeStart && frameStart <= activeEnd;
}

function defaultHurtbox(index = selectedFrame, group = currentGroup, groupImages = images) {
  if (group?.tuningTarget === "soul") {
    return {
      offset: cloneVector(config.references.soulHurtboxOffset || { x: 0, y: -310 }),
      size: cloneVector(config.references.soulHurtboxSize || { x: 190, y: 560 }),
      rotation: 0,
      enabled: soulHurtboxActiveByDefault(index, group),
    };
  }
  const crouching = ["crouch", "crawl", "slide", "crouch_attack"].includes(group?.name);
  if (usesCanvasFootAnchor(group)) {
    const body = sourceBodyCenterForBox(index, group, groupImages);
    return {
      offset: { x: body.x, y: body.y },
      size: {
        x: clampNumber(body.rect.width * (isAttackAnimationGroup(group) ? 0.88 : 0.78), 8, Math.max(8, body.rect.width)),
        y: clampNumber(body.rect.height * (crouching ? 0.72 : 0.82), 8, Math.max(8, body.rect.height)),
      },
      rotation: 0,
      enabled: true,
    };
  }
  return {
    offset: cloneVector(crouching ? config.references.crouchHurtboxOffset : config.references.playerHurtboxOffset),
    size: cloneVector(crouching ? config.references.crouchHurtboxSize : config.references.playerHurtboxSize),
    rotation: 0,
    enabled: true,
  };
}

function defaultHitbox(index = selectedFrame, group = currentGroup, groupImages = images) {
  if (group?.tuningTarget === "soul") {
    return {
      ...defaultSoulHitbox(group),
      enabled: soulHitboxActiveByDefault(index, group),
    };
  }
  if (usesCanvasFootAnchor(group) && isAttackAnimationGroup(group)) {
    const body = sourceBodyCenterForBox(index, group, groupImages);
    const anchor = sourceAnchorForBox(index, group, groupImages);
    const rect = body.rect;
    return {
      offset: {
        x: rect.x + rect.width * 0.72 - anchor.x,
        y: body.y - rect.height * 0.08,
      },
      size: {
        x: clampNumber(rect.width * 0.34, 8, Math.max(8, rect.width)),
        y: clampNumber(rect.height * 0.24, 6, Math.max(6, rect.height)),
      },
      rotation: 0,
      enabled: hitboxActiveByDefault(index, group),
    };
  }
  const offset = defaultHitboxOffset(group);
  const local = cloneVector(config.references.attackHitboxLocalOffset || { x: 0, y: -72 });
  return {
    offset: { x: offset.x + local.x, y: offset.y + local.y },
    size: cloneVector(config.references.attackHitboxSize || { x: 118, y: 76 }),
    rotation: 0,
    enabled: hitboxActiveByDefault(index, group),
  };
}

function defaultCollisionBox(index = selectedFrame, group = currentGroup, groupImages = images) {
  const body = sourceBodyCenterForBox(index, group, groupImages);
  const visualWidth = Math.max(1, Number(body.rect.width || 96));
  const visualHeight = Math.max(1, Number(body.rect.height || 160));
  const widthRatio = Number(group?.collisionWidthRatio || 0.42);
  const heightRatio = Number(group?.collisionHeightRatio || 0.88);
  const width = Math.round(clampNumber(visualWidth * widthRatio, 4, Math.max(4, visualWidth)));
  const height = Math.round(clampNumber(visualHeight * heightRatio, 4, Math.max(4, visualHeight)));
  return normalizeFrameBox("collisionbox", {
    offset: { x: body.x, y: collisionOffsetYForHeight(height) },
    size: { x: width, y: height },
    rotation: 0,
    enabled: true,
  });
}

function defaultSoulHitbox(group = currentGroup) {
  if (["parry1", "parry2", "parry3"].includes(group?.name)) {
    return {
      offset: cloneVector(config.references.soulParryHitboxOffset || { x: 135, y: -315 }),
      size: cloneVector(config.references.soulParryHitboxSize || { x: 260, y: 430 }),
      rotation: 0,
    };
  }
  if (group?.name === "run_attack") {
    return {
      offset: cloneVector(config.references.soulRunAttackHitboxOffset || { x: 285, y: -285 }),
      size: cloneVector(config.references.soulRunAttackHitboxSize || { x: 390, y: 220 }),
      rotation: 0,
    };
  }
  if (group?.name === "air_attack1") {
    return {
      offset: cloneVector(config.references.soulAirAttackHitboxOffset || { x: 255, y: -305 }),
      size: cloneVector(config.references.soulAirAttackHitboxSize || { x: 340, y: 230 }),
      rotation: 0,
    };
  }
  return {
    offset: cloneVector(config.references.soulStandAttackHitboxOffset || { x: 245, y: -295 }),
    size: cloneVector(config.references.soulStandAttackHitboxSize || { x: 330, y: 210 }),
    rotation: 0,
  };
}

function soulHitboxActiveByDefault(index = selectedFrame, group = currentGroup) {
  if (framePlayback(index, group).disabled) return false;
  const parryRange = soulParryGuardFrameRange(group);
  if (parryRange) return index >= parryRange.start && index <= parryRange.end;
  if (group?.name === "attack1") return index >= 1 && index <= 9;
  if (group?.name === "attack2") return index >= 4 && index <= 13;
  if (group?.name === "run_attack") return index >= 1 && index <= 6;
  if (group?.name === "air_attack1") return index >= 2 && index <= 5;
  return false;
}

function soulParryGuardFrameRange(group = currentGroup) {
  const raw = soulRawParryGuardFrameRange(group);
  if (!raw) return null;
  return {
    start: firstPlayableFrameInRange(group, raw.start, raw.end),
    end: lastPlayableFrameInRange(group, raw.start, raw.end),
  };
}

function soulRawParryGuardFrameRange(group = currentGroup) {
  if (group?.name === "parry1") return { start: 3, end: 4 };
  if (group?.name === "parry2") return { start: 4, end: 5 };
  if (group?.name === "parry3") return { start: 2, end: 6 };
  return null;
}

function firstPlayableFrameInRange(group, start, end) {
  for (let index = start; index <= end; index += 1) {
    if (!framePlayback(index, group).disabled) return index;
  }
  return start;
}

function lastPlayableFrameInRange(group, start, end) {
  for (let index = end; index >= start; index -= 1) {
    if (!framePlayback(index, group).disabled) return index;
  }
  return end;
}

function soulHurtboxActiveByDefault(index = selectedFrame, group = currentGroup) {
  return group?.tuningTarget === "soul" && group?.type === "actor" && !framePlayback(index, group).disabled;
}

function frameBox(boxName, index = selectedFrame, group = currentGroup, groupImages = images) {
  const base = boxName === "hitbox"
    ? defaultHitbox(index, group, groupImages)
    : isCollisionBox(boxName)
      ? defaultCollisionBox(index, group, groupImages)
      : defaultHurtbox(index, group, groupImages);
  const override = boxOverride(index, group)[boxName] || {};
  return normalizeFrameBox(boxName, {
    offset: cloneVector(override.offset ?? base.offset),
    size: cloneVector(override.size ?? base.size),
    rotation: Number(override.rotation ?? base.rotation ?? 0),
    enabled: override.enabled ?? base.enabled,
  });
}

function canEditBoxes(group = currentGroup) {
  if (group?.tuningTarget === "soul" && group?.type === "actor") return true;
  const type = String(group?.type || "").toLowerCase();
  if (!group || group?.tuningTarget === "boss") return false;
  return ["actor", "character", "player", "enemy", "npc"].includes(type);
}

function canEditBox(boxName, group = currentGroup) {
  if (!canEditBoxes(group)) return false;
  if (boxName === "collisionbox") return true;
  if (boxName === "hurtbox") return true;
  if (boxName === "hitbox") return isAttackAnimationGroup(group);
  return false;
}

function defaultSelectedBoxForGroup(group = currentGroup) {
  if (!canEditBoxes(group)) return "";
  if (canEditBox("hitbox", group)) return "hitbox";
  if (canEditBox("hurtbox", group)) return "hurtbox";
  if (canEditBox("collisionbox", group)) return "collisionbox";
  return "";
}

function syncBoxSelectionForGroup(group = currentGroup) {
  if (!canEditBoxes(group)) {
    if (boxOnlyMode) boxOnlyMode = false;
    selectedBoxes.clear();
    selectedBox = "";
    saveBoxViewPrefs();
    return;
  }
  normalizeBoxSelectionForGroup(group);
  saveBoxViewPrefs();
}

function boxExistsOnFrame(boxName, index = selectedFrame, group = currentGroup) {
  if (!canEditBox(boxName, group)) return false;
  const override = boxOverride(index, group)[boxName];
  const box = frameBox(boxName, index, group);
  if (boxName === "hurtbox") {
    return box.enabled !== false
      || Boolean(override)
      || selectedBoxes.has("hurtbox")
      || shouldPreviewPairedBox(boxName, group);
  }
  if (boxName === "collisionbox") {
    return box.enabled !== false || Boolean(override) || selectedBoxes.has("collisionbox");
  }
  return box.enabled === true || Boolean(override) || selectedBoxes.has("hitbox") || shouldPreviewPairedBox(boxName, group);
}

function shouldPreviewPairedBox(boxName, group = currentGroup) {
  if (group?.tuningTarget !== "soul") return false;
  if (boxName === "hurtbox") return selectedBox === "hitbox";
  if (boxName === "hitbox") return selectedBox === "hurtbox" && canEditBox("hitbox", group);
  return false;
}

function combatBoxFacingForGroup(group = currentGroup) {
  return group?.flipH === true ? -1 : 1;
}

function boxAutoTransform(index = selectedFrame, group = currentGroup, groupImages = images) {
  const facing = combatBoxFacingForGroup(group);
  const t = renderTransformForGroup(frameTransform(index, group), group);
  const runtimeBaseScale = Math.max(0.0001, runtimeBaseScaleForGroup(index, group, groupImages));
  return {
    facing,
    scaleX: runtimeBaseScale * Number(t.scaleX ?? t.scale ?? 1) * facing,
    scaleY: runtimeBaseScale * Number(t.scaleY ?? t.scale ?? 1),
    offset: {
      x: Number(t.offset?.x || 0) * runtimeBaseScale * facing,
      y: Number(t.offset?.y || 0) * runtimeBaseScale,
    },
    rotation: (Number(t.rotation || 0) * facing * Math.PI) / 180,
  };
}

function transformForAdjustmentMode(mode = adjustmentMode, group = currentGroup, index = selectedFrame) {
  if (mode === "character") return characterTransform(group);
  if (mode === "frame") return frameTransform(index, group);
  return baseTransform(group);
}

function boxSpaceTransformForAdjustment(mode, transform, group = currentGroup) {
  const character = characterTransform(group);
  const characterUniform = Math.max(0.0001, Number((mode === "character" ? transform?.scale : character.scale) || 1));
  return {
    scale: Number(transform?.scale ?? 1),
    scaleX: Number(transform?.scaleX ?? transform?.scale ?? 1),
    scaleY: Number(transform?.scaleY ?? transform?.scale ?? 1),
    offset: {
      x: Number(transform?.offset?.x || 0) * characterUniform,
      y: Number(transform?.offset?.y || 0) * characterUniform,
    },
    rotation: Number(transform?.rotation || 0),
  };
}

function boxScopeGroups(mode = adjustmentMode) {
  if (!currentGroup) return [];
  if (mode === "character") {
    return (config?.groups || []).filter((group) => {
      if (!canEditBoxes(group)) return false;
      if (currentGroup.profileId || group.profileId) return group.profileId === currentGroup.profileId;
      if (currentGroup.characterScale || group.characterScale) return group.characterScale === currentGroup.characterScale;
      return group.tuningTarget === currentGroup.tuningTarget && group.profileLabel === currentGroup.profileLabel;
    });
  }
  return canEditBoxes(currentGroup) ? [currentGroup] : [];
}

function boxScopeFrameIndexes(mode, group) {
  if (!group?.frames?.length) return [];
  if (mode === "frame") {
    if (group?.uiId !== currentGroup?.uiId) return [];
    return selectedFrameIndexes(group);
  }
  return Array.from({ length: group.frames.length }, (_value, index) => index);
}

function snapshotBoxEntriesForGroups(groups, mode = adjustmentMode) {
  const snapshot = {};
  for (const group of groups) {
    const groupSnapshot = {};
    for (const index of boxScopeFrameIndexes(mode, group)) {
      const boxes = {};
      for (const boxName of BOX_NAMES) {
        if (canEditBox(boxName, group) && boxExistsOnFrame(boxName, index, group)) {
          boxes[boxName] = structuredClone(frameBox(boxName, index, group));
        }
      }
      if (Object.keys(boxes).length) {
        groupSnapshot[frameBoxKey(index, group)] = { index, boxes };
      }
    }
    snapshot[group.uiId] = groupSnapshot;
  }
  return snapshot;
}

function createBoxEditSnapshot(mode = adjustmentMode) {
  const groups = boxScopeGroups(mode);
  const transforms = {};
  const frameTransforms = {};
  for (const group of groups) {
    transforms[group.uiId] = structuredClone(
      boxSpaceTransformForAdjustment(mode, transformForAdjustmentMode(mode, group), group)
    );
    if (mode === "frame") {
      frameTransforms[group.uiId] = {};
      for (const index of boxScopeFrameIndexes(mode, group)) {
        frameTransforms[group.uiId][String(index)] = structuredClone(
          boxSpaceTransformForAdjustment(mode, frameTransform(index, group), group)
        );
      }
    }
  }
  return {
    mode,
    groupUiIds: groups.map((group) => group.uiId),
    transforms,
    frameTransforms,
    boxes: snapshotBoxEntriesForGroups(groups, mode),
  };
}

function transformScaleX(transform) {
  const value = Number(transform?.scaleX ?? transform?.scale ?? 1);
  return Math.abs(value) > 0.0001 ? value : 1;
}

function transformScaleY(transform) {
  const value = Number(transform?.scaleY ?? transform?.scale ?? 1);
  return Math.abs(value) > 0.0001 ? value : 1;
}

function transformHasDelta(previous, next) {
  return !nearlyEqual(transformScaleX(previous), transformScaleX(next))
    || !nearlyEqual(transformScaleY(previous), transformScaleY(next))
    || !nearlyEqual(Number(previous?.offset?.x || 0), Number(next?.offset?.x || 0))
    || !nearlyEqual(Number(previous?.offset?.y || 0), Number(next?.offset?.y || 0))
    || !nearlyEqual(Number(previous?.rotation || 0), Number(next?.rotation || 0));
}

function transformBoxByDelta(boxName, box, previousTransform, nextTransform) {
  const previousScaleX = transformScaleX(previousTransform);
  const previousScaleY = transformScaleY(previousTransform);
  const scaleXRatio = transformScaleX(nextTransform) / previousScaleX;
  const scaleYRatio = transformScaleY(nextTransform) / previousScaleY;
  const offsetDelta = {
    x: Number(nextTransform?.offset?.x || 0) - Number(previousTransform?.offset?.x || 0),
    y: Number(nextTransform?.offset?.y || 0) - Number(previousTransform?.offset?.y || 0),
  };
  const rotationDelta = Number(nextTransform?.rotation || 0) - Number(previousTransform?.rotation || 0);
  const collision = isCollisionBox(boxName);
  const size = {
    x: Math.max(1, Number(box?.size?.x || 1) * Math.abs(scaleXRatio)),
    y: Math.max(1, Number(box?.size?.y || 1) * Math.abs(scaleYRatio)),
  };
  let offset = {
    x: Number(box?.offset?.x || 0) * scaleXRatio,
    y: Number(box?.offset?.y || 0) * scaleYRatio,
  };
  if (!collision && !nearlyEqual(rotationDelta, 0)) {
    offset = rotateVector(offset, (rotationDelta * Math.PI) / 180);
  }
  offset.x += offsetDelta.x;
  offset.y += offsetDelta.y;
  if (collision) offset.y = collisionOffsetYForHeight(size.y);
  return normalizeFrameBox(boxName, {
    offset,
    size,
    rotation: collision ? 0 : Number(box?.rotation || 0) + rotationDelta,
    enabled: box?.enabled !== false,
  });
}

function applyBoxTransformDelta(mode, nextTransform) {
  const snapshot = boxEditSnapshot?.mode === mode ? boxEditSnapshot : createBoxEditSnapshot(mode);
  let changed = false;
  for (const groupUiId of snapshot.groupUiIds || []) {
    const group = (config?.groups || []).find((entry) => entry.uiId === groupUiId);
    if (!group) continue;
    const store = boxOverrideStore(group);
    const groupSnapshot = snapshot.boxes[groupUiId] || {};
    const nextBoxTransform = boxSpaceTransformForAdjustment(mode, nextTransform, group);
    for (const [key, record] of Object.entries(groupSnapshot)) {
      const previousTransform = mode === "frame"
        ? snapshot.frameTransforms[groupUiId]?.[String(record.index)] || snapshot.transforms[groupUiId]
        : snapshot.transforms[groupUiId];
      if (!transformHasDelta(previousTransform, nextBoxTransform)) continue;
      const nextEntry = structuredClone(store[key] || {});
      for (const [boxName, box] of Object.entries(record.boxes || {})) {
        nextEntry[boxName] = transformBoxByDelta(boxName, box, previousTransform, nextBoxTransform);
      }
      store[key] = nextEntry;
      changed = true;
    }
  }
  if (changed) markDirty();
  return changed;
}

function boxOffsetDeltaFromScreenDelta(delta, index = selectedFrame, group = currentGroup) {
  const auto = boxAutoTransform(index, group);
  const unrotated = rotateVector(delta, -auto.rotation);
  return {
    x: unrotated.x / auto.scaleX,
    y: unrotated.y / auto.scaleY,
  };
}

function boxResizeDeltaFromScreenDelta(delta, boxRotation = 0, index = selectedFrame, group = currentGroup) {
  const offsetDelta = boxOffsetDeltaFromScreenDelta(delta, index, group);
  return rotateVector(offsetDelta, -(Number(boxRotation || 0) * Math.PI) / 180);
}

function boxScreenRect(boxName, index = selectedFrame, group = currentGroup, groupImages = images) {
  if (!boxExistsOnFrame(boxName, index, group)) return null;
  const box = frameBox(boxName, index, group, groupImages);
  const worldScale = view.zoom * devicePixelRatio;
  const auto = boxAutoTransform(index, group, groupImages);
  const width = Math.max(1, Math.abs(box.size.x * auto.scaleX * worldScale));
  const height = Math.max(1, Math.abs(box.size.y * auto.scaleY * worldScale));
  const origin = groupOriginScreen(index, group, groupImages, false);
  const localCenter = {
    x: box.offset.x * auto.scaleX * worldScale,
    y: box.offset.y * auto.scaleY * worldScale,
  };
  const rotatedCenter = rotateVector(localCenter, auto.rotation);
  const centerX = origin.x + auto.offset.x * worldScale + rotatedCenter.x;
  const centerY = origin.y + (isCollisionBox(boxName) ? 0 : auto.offset.y * worldScale) + rotatedCenter.y;
  const rotation = isCollisionBox(boxName) ? 0 : auto.rotation + (Number(box.rotation || 0) * auto.facing * Math.PI) / 180;
  const localCorners = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 },
  ];
  const points = localCorners.map((point) => rotatePoint(point, rotation, { x: centerX, y: centerY }));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return {
    box,
    centerX,
    centerY,
    rotation,
    x: left,
    y: top,
    width,
    height,
    halfWidth: width / 2,
    halfHeight: height / 2,
    left,
    right,
    top,
    bottom,
    points,
  };
}

function boxHandleRects(rect) {
  const size = Math.max(18 * devicePixelRatio, 18);
  const half = size / 2;
  const [nw, ne, se, sw] = rect.points;
  const points = [
    ["nw", nw.x, nw.y],
    ["n", (nw.x + ne.x) / 2, (nw.y + ne.y) / 2],
    ["ne", ne.x, ne.y],
    ["e", (ne.x + se.x) / 2, (ne.y + se.y) / 2],
    ["se", se.x, se.y],
    ["s", (sw.x + se.x) / 2, (sw.y + se.y) / 2],
    ["sw", sw.x, sw.y],
    ["w", (nw.x + sw.x) / 2, (nw.y + sw.y) / 2],
  ];
  return points.map(([name, x, y]) => ({ name, x: x - half, y: y - half, width: size, height: size }));
}

function editableBoxHandleRects(boxName, rect) {
  const handles = boxHandleRects(rect);
  if (!isCollisionBox(boxName)) return handles;
  return handles.filter((handle) => COLLISION_BOX_HANDLES.has(handle.name));
}

function rotateVector(point, radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return {
    x: point.x * c - point.y * s,
    y: point.x * s + point.y * c,
  };
}

function rotatePoint(point, radians, origin = { x: 0, y: 0 }) {
  const rotated = rotateVector(point, radians);
  return { x: origin.x + rotated.x, y: origin.y + rotated.y };
}

function stagePoint(event) {
  const stageRect = els.stage.getBoundingClientRect();
  return {
    x: (event.clientX - stageRect.left) * devicePixelRatio,
    y: (event.clientY - stageRect.top) * devicePixelRatio,
  };
}

function pointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function pointInBoxRect(point, rect, padding = 0) {
  const local = rotateVector({ x: point.x - rect.centerX, y: point.y - rect.centerY }, -rect.rotation);
  return local.x >= -rect.halfWidth - padding
    && local.x <= rect.halfWidth + padding
    && local.y >= -rect.halfHeight - padding
    && local.y <= rect.halfHeight + padding;
}

function hitTestBoxes(event) {
  if (!showBoxes || !canEditBoxes()) return null;
  const point = stagePoint(event);
  const boxNames = BOX_DRAW_ORDER.slice().reverse().filter((name) => selectedBoxes.has(name));
  if (event.altKey) {
    for (const boxName of boxNames) {
      const rect = boxScreenRect(boxName);
      if (!rect) continue;
      const handle = editableBoxHandleRects(boxName, rect).find((entry) => pointInRect(point, entry));
      if (handle) return { boxName, mode: "box-resize", handle: handle.name };
    }
    for (const boxName of boxNames) {
      const rect = boxScreenRect(boxName);
      if (!rect) continue;
      const padding = Math.max(10 * devicePixelRatio, 10);
      if (pointInBoxRect(point, rect, padding)) return { boxName, mode: "box-alt-block" };
    }
    return null;
  }
  for (const boxName of boxNames) {
    const rect = boxScreenRect(boxName);
    if (!rect) continue;
    const padding = Math.max(10 * devicePixelRatio, 10);
    if (pointInBoxRect(point, rect, padding)) {
      return { boxName, mode: "box-move" };
    }
  }
  return null;
}

function syncBoxInputs() {
  els.showBoxes.checked = showBoxes;
  const canUseBoxes = canEditBoxes();
  if (els.boxOnlyMode) {
    els.boxOnlyMode.checked = false;
    els.boxOnlyMode.disabled = true;
  }
  const changed = currentGroup ? normalizeBoxSelectionForGroup() : false;
  for (const input of els.boxChoiceInputs) {
    const boxName = input.dataset.boxChoice;
    const enabled = currentGroup ? canEditBox(boxName) : false;
    input.disabled = !enabled;
    input.checked = selectedBoxes.has(boxName);
    const choice = input.closest(".boxChoice");
    if (choice) {
      choice.classList.toggle("activeBoxChoice", selectedBox === boxName);
      choice.classList.toggle("disabled", !enabled);
    }
  }
  if (changed) {
    saveBoxViewPrefs();
  }
  const enabled = canEditBox(selectedBox) && Boolean(selectedBox);
  for (const input of [els.boxEnabled, els.deleteBox, els.clearBox].filter(Boolean)) {
    input.disabled = !enabled;
  }
  if (!enabled) {
    if (els.boxEnabled) els.boxEnabled.checked = false;
    return;
  }
  const box = frameBox(selectedBox);
  if (els.boxEnabled) els.boxEnabled.checked = box.enabled !== false;
}

function syncFrameAudioInputs() {
  const binding = frameAudioBinding();
  if (els.frameAudioName) {
    els.frameAudioName.textContent = binding ? t("frameSfx", { name: binding.name }) : t("noFrameSfx");
    els.frameAudioName.title = binding?.name || "";
  }
  const enabled = Boolean(currentGroup);
  if (els.frameAudioDrop) {
    els.frameAudioDrop.classList.toggle("disabled", !enabled);
    els.frameAudioDrop.setAttribute("aria-disabled", enabled ? "false" : "true");
  }
  if (els.clearFrameAudio) els.clearFrameAudio.disabled = !binding;
}

function updateSelectedBoxFromInputs() {
  if (!canEditBox(selectedBox) || !selectedBox) return;
  const current = frameBox(selectedBox);
  const collision = isCollisionBox(selectedBox);
  const box = {
    offset: {
      x: Number(current.offset?.x || 0),
      y: collision ? collisionOffsetYForHeight(current.size.y) : Number(current.offset?.y || 0),
    },
    size: cloneVector(current.size),
    rotation: collision ? 0 : Number(current.rotation || 0),
    enabled: els.boxEnabled ? els.boxEnabled.checked : current.enabled !== false,
  };
  for (const frameIndex of selectedFrameIndexes()) {
    setBoxOverride(selectedBox, box, frameIndex);
  }
  renderFilmstrip();
  draw();
}

function referenceFrameIndex(group = currentGroup) {
  if (!referenceFrame || referenceFrame.group?.uiId !== group?.uiId) return null;
  return referenceFrame.index;
}

function isReferenceFrame(index = selectedFrame, group = currentGroup) {
  return referenceFrameIndex(group) === index;
}

function setReferenceFrameEnabled(enabled) {
  if (!currentGroup) return;
  if (enabled) {
    referenceFrame = {
      group: currentGroup,
      index: selectedFrame,
      image: images[selectedFrame],
      images: images.slice(),
      transform: structuredClone(frameTransform(selectedFrame, currentGroup)),
    };
  } else {
    referenceFrame = null;
  }
  renderFilmstrip();
  draw();
}

function nearlyEqual(a, b) {
  return Math.abs(Number(a || 0) - Number(b || 0)) < 0.0001;
}

function pruneNoopFrameOverrides() {
  for (const group of config.groups) {
    const store = overrideStore(group);
    const base = baseTransform(group);
    for (const key of Object.keys(store)) {
      if (!groupOwnsFrameKey(group, key)) continue;
      const override = store[key];
      const overrideScale = cloneScaleVector(override?.visual_scale, override?.visual_size);
      if (
        nearlyEqual(override?.visual_size, base.scale)
        && nearlyEqual(overrideScale.x, base.scaleX)
        && nearlyEqual(overrideScale.y, base.scaleY)
        && nearlyEqual(override?.offset?.x, base.offset.x)
        && nearlyEqual(override?.offset?.y, base.offset.y)
        && nearlyEqual(override?.rotation, base.rotation)
      ) {
        delete store[key];
      }
    }
  }
}

function canEditCharacterTransform(group = currentGroup) {
  return Boolean(group) && (groupSupports(group, "character_transform") || groupSupports(group, "group_transform"));
}

function canEditAdjustmentMode(mode = adjustmentMode, group = currentGroup) {
  if (selectedFrameAttachment()) return mode === "frame";
  if (mode === "character") return canEditCharacterTransform(group);
  if (mode === "group") return canEditGroupTransform(group);
  if (mode === "frame") return canEditFrameTransform(group);
  return false;
}

function normalizeAdjustmentMode(mode = adjustmentMode) {
  if (selectedFrameAttachment()) return "frame";
  const requested = ADJUSTMENT_MODES.includes(mode) ? mode : "group";
  if (canEditAdjustmentMode(requested)) return requested;
  return ADJUSTMENT_MODES.find((entry) => canEditAdjustmentMode(entry)) || "group";
}

function adjustmentTransform(mode = adjustmentMode) {
  const attachment = selectedFrameAttachment();
  if (attachment && mode === "frame") return normalizeAttachmentTransform(attachment.transform);
  if (mode === "character") return characterTransform();
  if (mode === "frame") return frameTransform();
  return baseTransform();
}

function transformFromAdjustmentInputs() {
  const uniformScale = Number(els.baseScale.value);
  return {
    scale: uniformScale,
    scaleX: Number(els.baseScaleX.value || uniformScale),
    scaleY: Number(els.baseScaleY.value || uniformScale),
    offset: { x: Number(els.baseX.value || 0), y: Number(els.baseY.value || 0) },
    rotation: Number(els.baseRotation.value || 0),
  };
}

function adjustmentNumberInputs() {
  return [els.baseScale, els.baseScaleX, els.baseScaleY, els.baseX, els.baseY, els.baseRotation].filter(Boolean);
}

function adjustmentStepButtonsForInput(input) {
  if (!input?.id) return [];
  return Array.from(document.querySelectorAll(`.numberStep[data-step-target="${input.id}"]`));
}

function beginStepAdjustmentEdit() {
  if (selectedFrameAttachment()) {
    baseEditSnapshot = null;
    boxEditSnapshot = null;
    return;
  }
  boxEditSnapshot = createBoxEditSnapshot(adjustmentMode);
  if (adjustmentMode === "group") {
    baseEditSnapshot = {
      groupUiId: currentGroup?.uiId,
      base: structuredClone(baseTransform()),
      overrides: structuredClone(overrideStore()),
    };
  }
}

function endStepAdjustmentEdit() {
  baseEditSnapshot = null;
  boxEditSnapshot = null;
}

function stepAdjustmentInput(input, direction, multiplier = 1) {
  if (!input || input.disabled) return;
  const current = Number(input.value);
  if (!Number.isFinite(current)) return;
  const step = Number(input.step || 1) || 1;
  const nextValue = current + Number(direction || 0) * step * multiplier;
  pushUndo("adjustment step");
  beginStepAdjustmentEdit();
  input.value = round(nextValue);
  if (input === els.baseScale) {
    els.baseScaleX.value = input.value;
    els.baseScaleY.value = input.value;
  }
  updateAdjustmentFromInputs();
  endStepAdjustmentEdit();
}

function stepOffsetByArrowKey(key, multiplier = 1) {
  if (key === "ArrowLeft") {
    stepAdjustmentInput(els.baseX, -1, multiplier);
    return true;
  }
  if (key === "ArrowRight") {
    stepAdjustmentInput(els.baseX, 1, multiplier);
    return true;
  }
  if (key === "ArrowUp") {
    stepAdjustmentInput(els.baseY, -1, multiplier);
    return true;
  }
  if (key === "ArrowDown") {
    stepAdjustmentInput(els.baseY, 1, multiplier);
    return true;
  }
  return false;
}

function syncAdjustmentModeInputs() {
  if (els.adjustCharacter) els.adjustCharacter.checked = adjustmentMode === "character";
  if (els.adjustGroup) els.adjustGroup.checked = adjustmentMode === "group";
  if (els.adjustFrame) els.adjustFrame.checked = adjustmentMode === "frame";
  syncGroupTimeInputs();
}

function syncAdjustmentInputs() {
  adjustmentMode = normalizeAdjustmentMode(adjustmentMode);
  localStorage.setItem(ADJUSTMENT_MODE_KEY, adjustmentMode);
  syncAdjustmentModeInputs();
  const transform = adjustmentTransform(adjustmentMode);
  els.baseScale.value = round(transform.scale);
  els.baseScaleX.value = round(transform.scaleX);
  els.baseScaleY.value = round(transform.scaleY);
  els.baseX.value = round(transform.offset.x);
  els.baseY.value = round(transform.offset.y);
  els.baseRotation.value = round(transform.rotation || 0);
  const enabled = canEditAdjustmentMode(adjustmentMode);
  for (const input of adjustmentNumberInputs()) {
    input.disabled = !enabled;
    for (const button of adjustmentStepButtonsForInput(input)) button.disabled = !enabled;
  }
  if (els.applyBaseToFrame) {
    els.applyBaseToFrame.hidden = true;
    els.applyBaseToFrame.disabled = true;
  }
}

function syncBaseInputs() {
  syncAdjustmentInputs();
}

function syncCharacterBaseInputs(group = currentGroup) {
  if (!els.characterBaseScale || !els.characterBaseSource) return;
  if (!group) {
    els.characterBaseScale.value = "";
    els.characterBaseSource.value = "";
    return;
  }
  els.characterBaseScale.value = round(characterBaseScaleForGroup(group));
  els.characterBaseSource.value = group.characterBaseSource || group.profileScaleSemantic || group.profileLabel || "";
}

function syncFrameInputs() {
  updateCanvasTitle();
  syncCharacterBaseInputs();
  const t = frameTransform();
  const transformEditable = canEditFrameTransform();
  els.frameScale.value = t.scale;
  els.frameScaleX.value = t.scaleX;
  els.frameScaleY.value = t.scaleY;
  els.frameX.value = t.offset.x;
  els.frameY.value = t.offset.y;
  els.frameRotation.value = t.rotation || 0;
  const playback = framePlayback();
  els.frameDuration.value = Math.round(frameDurationMs());
  els.frameDuration.disabled = !canEditFramePlayback() || usesAttachedPlaybackTiming();
  els.frameReference.checked = isReferenceFrame(selectedFrame, currentGroup);
  els.frameDisabled.checked = playback.disabled;
  for (const input of [els.frameScale, els.frameScaleX, els.frameScaleY, els.frameX, els.frameY, els.frameRotation]) {
    input.disabled = !transformEditable;
  }
  els.frameReference.disabled = !canUseReferenceFrame();
  els.frameDisabled.disabled = !canEditFramePlayback();
  if (els.applyBaseToFrame) els.applyBaseToFrame.disabled = true;
  els.frameDisabled.parentElement.classList.toggle("dangerActive", playback.disabled);
  syncGroupTimeInputs();
  syncAdjustmentInputs();
  syncBoxInputs();
  syncFrameAudioInputs();
}

function syncGroupPlaybackInputs() {
  if (!els.fps || !els.fpsValue || !els.rootMotionX || !els.rootMotionY) {
    updateWorkbenchHud();
    return;
  }
  const fps = groupPlaybackFps();
  const rootMotion = groupRootMotion();
  const owner = attachedPlaybackOwnerGroup();
  const attachedTiming = usesAttachedPlaybackTiming();
  const playbackEditable = canEditFramePlayback();
  els.fps.value = fps;
  els.fpsValue.textContent = round(fps);
  els.fps.disabled = !playbackEditable || attachedTiming;
  if (els.vfxWindowControls) {
    els.vfxWindowControls.hidden = !attachedTiming;
  }
  if (attachedTiming && owner && els.vfxStartFrame && els.vfxEndFrame) {
    const window = attachedVfxPlaybackWindow();
    const maxFrame = owner.frames?.length || 1;
    els.vfxStartFrame.max = maxFrame;
    els.vfxEndFrame.max = maxFrame;
    els.vfxStartFrame.value = window.start + 1;
    els.vfxEndFrame.value = window.end + 1;
  }
  els.rootMotionX.value = rootMotion.x;
  els.rootMotionY.value = rootMotion.y;
  els.rootMotionX.disabled = !playbackEditable || attachedTiming;
  els.rootMotionY.disabled = !playbackEditable || attachedTiming;
  updateWorkbenchHud();
}

function selectFilmstripFrame(index, event = null) {
  clearSelectedAttachment();
  const frameIndex = clampFrameIndex(index, currentGroup);
  if (event?.shiftKey) {
    const anchor = clampFrameIndex(selectionAnchorFrame, currentGroup);
    const start = Math.min(anchor, frameIndex);
    const end = Math.max(anchor, frameIndex);
    selectedFrame = frameIndex;
    selectedFrames = new Set();
    for (let selectionIndex = start; selectionIndex <= end; selectionIndex += 1) {
      selectedFrames.add(selectionIndex);
    }
  } else if (event?.ctrlKey || event?.metaKey) {
    if (selectedFrames.has(frameIndex) && selectedFrames.size > 1) {
      selectedFrames.delete(frameIndex);
      selectedFrame = selectedFrame === frameIndex ? selectedFrameIndexes()[0] : selectedFrame;
    } else {
      selectedFrames.add(frameIndex);
      selectedFrame = frameIndex;
    }
    selectionAnchorFrame = selectedFrame;
  } else {
    setSingleFrameSelection(frameIndex, currentGroup);
  }
  playing = false;
  playbackPrimaryGroup = null;
  if (els.playPause) els.playPause.textContent = t("play");
  updateCanvasTitle();
  syncFrameInputs();
  renderFilmstrip();
  draw();
}

function renderFilmstrip() {
  els.filmstrip.innerHTML = "";
  if (!currentGroup) return;
  renderFilmstripGroup(currentGroup, t("mainLabel"));
  const chain = playbackChainGroup();
  if (chain && chain.uiId !== currentGroup.uiId) {
    renderFilmstripGroup(chain, t("thenLabel"));
  }
}

function layerCardKey(info) {
  return info?.type === "attachment" ? `attachment:${info.attachmentId}` : "main";
}

function layerCardDomKey(info) {
  return `${info?.groupUiId || ""}:${info?.frameIndex ?? ""}:${layerCardKey(info)}`;
}

function layerCardInfoForAttachment(attachment, index, group) {
  return {
    type: "attachment",
    attachmentId: attachment.id,
    frameIndex: index,
    groupUiId: group.uiId,
  };
}

function layerCardInfoForMain(index, group) {
  return {
    type: "main",
    frameIndex: index,
    groupUiId: group.uiId,
  };
}

function layerCardInfosForFrame(index, group) {
  return frameLayerStackItems(index, group).map((item) => (
    item.type === "attachment"
      ? layerCardInfoForAttachment(item.attachment, index, group)
      : layerCardInfoForMain(index, group)
  ));
}

function clearLayerDropClasses(card) {
  card.classList.remove("layerShiftPreview");
  card.style.transform = "";
}

function clearLayerDragPreview() {
  document.querySelectorAll(".layerShiftPreview").forEach(clearLayerDropClasses);
}

function isLayerCardDragEvent(event) {
  return Boolean(layerCardDrag)
    || Array.from(event.dataTransfer?.types || []).includes(LAYER_CARD_DRAG_TYPE);
}

function movedLayerCardOrder(dragInfo, insertionIndex, group = currentGroup) {
  if (!group || dragInfo.groupUiId !== group.uiId) return null;
  const before = layerCardInfosForFrame(clampFrameIndex(dragInfo.frameIndex, group), group);
  const dragIndex = before.findIndex((info) => layerCardKey(info) === layerCardKey(dragInfo));
  if (dragIndex < 0) return null;
  const after = before.slice();
  const [dragged] = after.splice(dragIndex, 1);
  const targetIndex = Math.max(0, Math.min(Number(insertionIndex) || 0, before.length));
  const adjustedIndex = dragIndex < targetIndex ? targetIndex - 1 : targetIndex;
  after.splice(Math.max(0, Math.min(adjustedIndex, after.length)), 0, dragged);
  return { before, after };
}

function layerInsertionIndexFromPoint(stack, frameIndex, group, clientY) {
  const infos = layerCardInfosForFrame(frameIndex, group);
  for (let index = 0; index < infos.length; index += 1) {
    const card = stack.querySelector(`[data-layer-card-key="${CSS.escape(layerCardDomKey(infos[index]))}"]`);
    if (!card) continue;
    const rect = card.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return index;
  }
  return infos.length;
}

function previewLayerCardMove(dragInfo, insertionIndex, stack) {
  clearLayerDragPreview();
  const order = movedLayerCardOrder(dragInfo, insertionIndex);
  if (!order) return;
  if (!stack) return;
  const style = getComputedStyle(stack);
  const gap = Number.parseFloat(style.rowGap || style.gap || "0") || 0;
  const currentRects = new Map();
  const cards = new Map();
  for (const info of order.before) {
    const key = layerCardDomKey(info);
    const card = stack.querySelector(`[data-layer-card-key="${CSS.escape(key)}"]`);
    if (!card) return;
    cards.set(key, card);
    currentRects.set(key, card.getBoundingClientRect());
  }
  let nextTop = currentRects.get(layerCardDomKey(order.before[0]))?.top || 0;
  const nextTops = new Map();
  for (const info of order.after) {
    const key = layerCardDomKey(info);
    const rect = currentRects.get(key);
    nextTops.set(key, nextTop);
    nextTop += rect.height + gap;
  }
  for (const info of order.before) {
    const key = layerCardDomKey(info);
    if (key === layerCardDomKey(dragInfo)) continue;
    const card = cards.get(key);
    const rect = currentRects.get(key);
    const dy = (nextTops.get(key) || rect.top) - rect.top;
    if (Math.abs(dy) < 1) continue;
    card.classList.add("layerShiftPreview");
    card.style.transform = `translateY(${dy}px)`;
  }
}

function captureLayerCardRects() {
  const rects = new Map();
  document.querySelectorAll("[data-layer-card-key]").forEach((card) => {
    rects.set(card.dataset.layerCardKey, card.getBoundingClientRect());
  });
  return rects;
}

function animateLayerCardRects(previousRects) {
  if (!previousRects?.size) return;
  requestAnimationFrame(() => {
    document.querySelectorAll("[data-layer-card-key]").forEach((card) => {
      const previous = previousRects.get(card.dataset.layerCardKey);
      if (!previous) return;
      const next = card.getBoundingClientRect();
      const dx = previous.left - next.left;
      const dy = previous.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      card.style.transition = "none";
      card.style.transform = `translate(${dx}px, ${dy}px)`;
      card.getBoundingClientRect();
      requestAnimationFrame(() => {
        card.style.transition = "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease";
        card.style.transform = "";
      });
    });
  });
}

function setupLayerCardDrag(card, info) {
  if (!currentGroup || info.groupUiId !== currentGroup.uiId) return;
  card.draggable = true;
  card.classList.add("layerDraggable");
  card.dataset.layerCardKey = layerCardDomKey(info);
  card.addEventListener("dragstart", (event) => {
    if (event.target.closest(".attachmentAction, .durationStep, .frameSfxBadge")) {
      event.preventDefault();
      return;
    }
    layerCardDrag = { ...info };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(LAYER_CARD_DRAG_TYPE, JSON.stringify(layerCardDrag));
    card.classList.add("layerCardDragging");
  });
  card.addEventListener("dragend", () => {
    layerCardDrag = null;
    card.classList.remove("layerCardDragging");
    clearLayerDragPreview();
  });
}

function setupLayerStackDrag(stack, index, group) {
  if (!currentGroup || group.uiId !== currentGroup.uiId) return;
  stack.addEventListener("dragover", (event) => {
    if (!layerCardDrag || layerCardDrag.groupUiId !== group.uiId || layerCardDrag.frameIndex !== index) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    clearLayerDragPreview();
    const insertionIndex = layerInsertionIndexFromPoint(stack, index, group, event.clientY);
    previewLayerCardMove(layerCardDrag, insertionIndex, stack);
  });
  stack.addEventListener("dragleave", (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    clearLayerDragPreview();
  });
  stack.addEventListener("drop", (event) => {
    if (!layerCardDrag || layerCardDrag.groupUiId !== group.uiId || layerCardDrag.frameIndex !== index) return;
    event.preventDefault();
    event.stopPropagation();
    clearLayerDragPreview();
    const insertionIndex = layerInsertionIndexFromPoint(stack, index, group, event.clientY);
    moveFrameLayerCardToIndex(layerCardDrag, insertionIndex);
    layerCardDrag = null;
  });
}

function applyFrameLayerCardOrder(index, group, orderedInfos) {
  const mainIndex = orderedInfos.findIndex((info) => info.type === "main");
  if (mainIndex < 0) return false;
  for (let orderIndex = 0; orderIndex < orderedInfos.length; orderIndex += 1) {
    const info = orderedInfos[orderIndex];
    if (info.type !== "attachment") continue;
    const attachment = frameImageAttachments.find((entry) => entry.id === info.attachmentId);
    if (!attachment) continue;
    const layerOrder = orderIndex < mainIndex ? mainIndex - orderIndex : -(orderIndex - mainIndex);
    attachment.layerOrder = layerOrder;
    attachment.layer = layerOrder < 0 ? "below" : "above";
    attachment.key = frameImageAttachmentKey(index, group);
    attachment.frameKey = attachment.key;
    attachment.metadata = frameImageAttachmentMetadata(index, group);
  }
  return true;
}

function moveFrameLayerCardToIndex(dragInfo, insertionIndex) {
  if (!currentGroup || dragInfo.groupUiId !== currentGroup.uiId) return;
  const frameIndex = clampFrameIndex(dragInfo.frameIndex, currentGroup);
  const order = movedLayerCardOrder(dragInfo, insertionIndex, currentGroup);
  if (!order) return;
  const { before, after } = order;
  const beforeKeys = before.map(layerCardKey).join("|");
  const afterKeys = after.map(layerCardKey).join("|");
  if (beforeKeys === afterKeys) return;
  const previousRects = captureLayerCardRects();
  clearLayerDragPreview();
  pushUndo("reorder frame layers");
  if (!applyFrameLayerCardOrder(frameIndex, currentGroup, after)) return;
  if (dragInfo.type === "attachment") {
    selectedAttachmentId = dragInfo.attachmentId;
  } else {
    clearSelectedAttachment();
  }
  setSingleFrameSelection(frameIndex, currentGroup);
  markDirty();
  renderFilmstrip();
  animateLayerCardRects(previousRects);
  draw();
}

function createFrameImageAttachmentCard(attachment, index, group, label) {
  const isCurrent = group.uiId === currentGroup.uiId;
  const card = document.createElement("button");
  const selected = selectedAttachmentId === attachment.id;
  const below = attachmentLayerOrder(attachment) < 0;
  card.className = `thumb attachmentThumb ${selected ? "selectedAttachment" : ""} ${below ? "layerBelow" : "layerAbove"} ${!isCurrent ? "chained" : ""}`;
  const layerTitle = below ? t("frameAttachmentLayerBelow") : t("frameAttachmentLayerAbove");
  card.title = `${label}${index + 1} - ${attachment.name || "image"}\n${layerTitle}`;
  card.innerHTML = `
    <span class="attachmentActions">
      <button class="attachmentAction" data-action="remove-attachment" title="${escapeHtml(t("frameAttachmentRemove"))}">×</button>
    </span>
    <img src="${assetUrl(attachment)}" alt="">
    <span class="thumbLabel">${label}${index + 1}</span>`;
  card.querySelector('[data-action="remove-attachment"]').addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    removeFrameImageAttachment(attachment.id);
  });
  card.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (group.uiId !== currentGroup.uiId) {
      await selectGroup(group, { frameIndex: index, preserveView: true, stopPlayback: false, selectedAttachmentId: attachment.id });
      return;
    }
    selectFrameImageAttachment(attachment, index, group);
  });
  setupLayerCardDrag(card, layerCardInfoForAttachment(attachment, index, group));
  return card;
}

function renderFilmstripGroup(group, label) {
  const store = overrideStore(group);
  const isCurrent = group.uiId === currentGroup.uiId;
  group.frames.forEach((frame, index) => {
    const stack = document.createElement("div");
    stack.className = "frameStack";
    const stackItems = frameLayerStackItems(index, group);
    setupLayerStackDrag(stack, index, group);

    const playback = framePlayback(index, group);
    const item = document.createElement("button");
    const inSelection = isCurrent && selectedFrames.has(index) && !selectedAttachmentId;
    const audioBinding = frameAudioBinding(index, group);
    item.className = `thumb ${inSelection ? "selected" : ""} ${isCurrent && index === selectedFrame ? "primary" : ""} ${isReferenceFrame(index, group) ? "reference" : ""} ${!isCurrent ? "chained" : ""} ${store[tuningFrameKey(index, group)] ? "overridden" : ""} ${playback.disabled ? "disabled" : ""} ${audioBinding ? "hasSfx" : ""}`;
    const sourceLabel = Array.isArray(group.sourceFrameIndices) && group.sourceFrameIndices.length ? ` (src ${sourceFrameIndex(index, group) + 1})` : "";
    item.title = `${label}${index + 1} - ${frame.name}${sourceLabel}`;
    const canAdjustDuration = isCurrent && canEditFramePlayback(group) && !usesAttachedPlaybackTiming(group);
    const audioBadge = audioBinding
      ? `<span class="frameSfxBadge" data-action="delete-sfx" role="button" tabindex="0" title="${escapeHtml(audioBinding.name || "audio")}"><span class="frameSfxSpeaker" aria-hidden="true">&#128266;</span><span class="frameSfxRemove" aria-hidden="true">x</span></span>`
      : "";
    item.innerHTML = `
      ${audioBadge}
      <img src="${assetUrl(frame)}" alt="">
      <span class="thumbLabel">${label}${index + 1}</span>
      <div class="thumbDuration">
        <button class="durationStep" data-delta="${-FRAME_DURATION_STEP_MS}" ${canAdjustDuration ? "" : "disabled"} title="-${FRAME_DURATION_STEP_MS}ms">-</button>
        <b>${frameDurationMsLabel(index, group)}</b>
        <button class="durationStep" data-delta="${FRAME_DURATION_STEP_MS}" ${canAdjustDuration ? "" : "disabled"} title="+${FRAME_DURATION_STEP_MS}ms">+</button>
      </div>`;
    const sfxBadge = item.querySelector(".frameSfxBadge");
    if (sfxBadge) {
      const removeSfx = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await removeFrameAudioFromCard(index, group);
      };
      sfxBadge.addEventListener("click", removeSfx);
      sfxBadge.addEventListener("keydown", async (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        await removeSfx(event);
      });
    }
    const canDropOnFrame = isCurrent && Boolean(currentGroup);
    for (const eventName of ["dragenter", "dragover"]) {
      item.addEventListener(eventName, (event) => {
        if (!canDropOnFrame) return;
        if (isLayerCardDragEvent(event)) return;
        const items = Array.from(event.dataTransfer?.items || []);
        const hasFile = items.some((entry) => entry.kind === "file")
          || Array.from(event.dataTransfer?.types || []).includes("Files")
          || Boolean(event.dataTransfer?.files?.length);
        const imageFile = imageFileFromList(event.dataTransfer?.files);
        const audioFile = audioFileFromList(event.dataTransfer?.files);
        const looksImage = Boolean(imageFile) || items.some((entry) => String(entry.type || "").startsWith("image/"));
        const looksAudio = Boolean(audioFile) || items.some((entry) => String(entry.type || "").startsWith("audio/"));
        if (!hasFile) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
        item.classList.toggle("imageDragOver", looksImage || !looksAudio);
        item.classList.toggle("audioDragOver", !looksImage && looksAudio);
      });
    }
    for (const eventName of ["dragleave", "dragend"]) {
      item.addEventListener(eventName, () => {
        item.classList.remove("audioDragOver", "imageDragOver");
      });
    }
    item.addEventListener("drop", async (event) => {
      if (!canDropOnFrame) return;
      if (isLayerCardDragEvent(event)) return;
      event.preventDefault();
      event.stopPropagation();
      item.classList.remove("audioDragOver", "imageDragOver");
      const imageFile = imageFileFromList(event.dataTransfer?.files);
      if (imageFile) {
        await bindFrameImageAttachmentFile(imageFile, index, group);
        return;
      }
      const file = audioFileFromList(event.dataTransfer?.files);
      if (!file) {
        status(t("dropImageFile"));
        return;
      }
      await bindFrameAudioFile(file, index, group);
    });
    item.querySelectorAll(".durationStep").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        adjustFrameDurationMs(index, Number(button.dataset.delta || 0));
      });
    });
    item.addEventListener("click", async (event) => {
      if (group.uiId !== currentGroup.uiId) {
        const previousGroup = currentGroup;
        playing = false;
        playbackPrimaryGroup = null;
        if (els.playPause) els.playPause.textContent = t("play");
        if (els.chainGroupSelect) els.chainGroupSelect.value = previousGroup.uiId;
        await selectGroup(group, { frameIndex: index, preserveView: true, stopPlayback: false });
        return;
      }
      selectFilmstripFrame(index, event);
    });
    setupLayerCardDrag(item, layerCardInfoForMain(index, group));
    for (const stackItem of stackItems) {
      if (stackItem.type === "main") {
        stack.appendChild(item);
      } else {
        stack.appendChild(createFrameImageAttachmentCard(stackItem.attachment, index, group, "附 "));
      }
    }
    els.filmstrip.appendChild(stack);
  });
}

function fitView() {
  view = { zoom: 1, x: els.stage.width / 2, y: els.stage.height / 2 };
}

function zoomViewAt(event) {
  const rect = els.stage.getBoundingClientRect();
  const px = (event.clientX - rect.left) * devicePixelRatio;
  const py = (event.clientY - rect.top) * devicePixelRatio;
  const before = {
    x: (px - view.x) / view.zoom,
    y: (py - view.y) / view.zoom,
  };
  const factor = event.deltaY < 0 ? 1.08 : 0.92;
  view.zoom = Math.min(8, Math.max(0.12, view.zoom * factor));
  view.x = px - before.x * view.zoom;
  view.y = py - before.y * view.zoom;
  draw();
}

function resizeCanvas() {
  const rect = els.stage.getBoundingClientRect();
  els.stage.width = Math.max(640, Math.floor(rect.width * devicePixelRatio));
  els.stage.height = Math.max(420, Math.floor(rect.height * devicePixelRatio));
  fitView();
  draw();
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.07)";
  ctx.lineWidth = 1;
  const step = 64 * devicePixelRatio;
  for (let x = view.x % step; x < els.stage.width; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, els.stage.height); ctx.stroke();
  }
  for (let y = view.y % step; y < els.stage.height; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(els.stage.width, y); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(242,162,60,.55)";
  ctx.beginPath(); ctx.moveTo(view.x - 20, view.y); ctx.lineTo(view.x + 20, view.y); ctx.moveTo(view.x, view.y - 20); ctx.lineTo(view.x, view.y + 20); ctx.stroke();
  drawCoordinateGrid();
  drawFloorTopReference();
  ctx.restore();
}

function coordinateScreenScale(index = selectedFrame, group = currentGroup, groupImages = images) {
  if (!group) return Math.max(0.0001, view.zoom * devicePixelRatio);
  const worldScale = view.zoom * devicePixelRatio;
  return Math.max(0.0001, runtimeBaseScaleForGroup(index, group, groupImages) * worldScale);
}

function coordinateOrigin(index = selectedFrame, group = currentGroup, groupImages = images, alignFloor = false) {
  return groupOriginScreen(index, group, groupImages, alignFloor);
}

function coordinateToScreen(point, index = selectedFrame, group = currentGroup, groupImages = images, alignFloor = false) {
  const origin = coordinateOrigin(index, group, groupImages, alignFloor);
  const scale = coordinateScreenScale(index, group, groupImages);
  return {
    x: origin.x + Number(point?.x || 0) * scale,
    y: origin.y + Number(point?.y || 0) * scale,
  };
}

function screenToCoordinate(point, index = selectedFrame, group = currentGroup, groupImages = images, alignFloor = false) {
  const origin = coordinateOrigin(index, group, groupImages, alignFloor);
  const scale = coordinateScreenScale(index, group, groupImages);
  return {
    x: (Number(point?.x || 0) - origin.x) / scale,
    y: (Number(point?.y || 0) - origin.y) / scale,
  };
}

function coordinateGridStep(screenScale) {
  const targetPixels = 96 * devicePixelRatio;
  const raw = Math.max(1, targetPixels / Math.max(screenScale, 0.0001));
  const base = 10 ** Math.floor(Math.log10(raw));
  for (const multiplier of [1, 2, 5, 10]) {
    const step = base * multiplier;
    if (step >= raw) return step;
  }
  return base * 10;
}

function drawCoordinateGrid() {
  if (!currentGroup || !images.length) return;
  const origin = coordinateOrigin();
  const scale = coordinateScreenScale();
  const step = coordinateGridStep(scale);
  const minX = Math.floor((0 - origin.x) / scale / step) * step;
  const maxX = Math.ceil((els.stage.width - origin.x) / scale / step) * step;
  const minY = Math.floor((0 - origin.y) / scale / step) * step;
  const maxY = Math.ceil((els.stage.height - origin.y) / scale / step) * step;
  const labelY = Math.min(Math.max(origin.y + 15 * devicePixelRatio, 16 * devicePixelRatio), els.stage.height - 10 * devicePixelRatio);
  const labelX = Math.min(Math.max(origin.x + 8 * devicePixelRatio, 8 * devicePixelRatio), els.stage.width - 74 * devicePixelRatio);
  ctx.save();
  ctx.lineWidth = Math.max(1, devicePixelRatio);
  ctx.font = `${11 * devicePixelRatio}px Consolas, "Cascadia Mono", monospace`;
  ctx.textBaseline = "top";
  for (let x = minX; x <= maxX; x += step) {
    const screenX = origin.x + x * scale;
    ctx.strokeStyle = nearlyEqual(x, 0) ? "rgba(255, 196, 74, .82)" : "rgba(145, 215, 255, .12)";
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, els.stage.height);
    ctx.stroke();
    if (!nearlyEqual(x, 0) && screenX >= 0 && screenX <= els.stage.width) {
      ctx.fillStyle = "rgba(203, 238, 255, .68)";
      ctx.fillText(String(round(x)), screenX + 4 * devicePixelRatio, labelY);
    }
  }
  for (let y = minY; y <= maxY; y += step) {
    const screenY = origin.y + y * scale;
    ctx.strokeStyle = nearlyEqual(y, 0) ? "rgba(255, 196, 74, .82)" : "rgba(145, 215, 255, .10)";
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(els.stage.width, screenY);
    ctx.stroke();
    if (!nearlyEqual(y, 0) && screenY >= 0 && screenY <= els.stage.height) {
      ctx.fillStyle = "rgba(203, 238, 255, .68)";
      ctx.fillText(String(round(y)), labelX, screenY + 3 * devicePixelRatio);
    }
  }
  ctx.fillStyle = "rgba(255, 224, 150, .95)";
  ctx.fillText("0,0", origin.x + 8 * devicePixelRatio, origin.y + 8 * devicePixelRatio);
  ctx.restore();
}

function drawFloorTopReference() {
  const offsetY = floorTopReferenceOffset(selectedFrame, currentGroup, images);
  const y = view.y + offsetY * view.zoom * devicePixelRatio;
  ctx.save();
  ctx.strokeStyle = "rgba(255,196,74,.78)";
  ctx.lineWidth = Math.max(1, devicePixelRatio);
  ctx.setLineDash([10 * devicePixelRatio, 7 * devicePixelRatio]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(els.stage.width, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,214,128,.92)";
  ctx.font = `${12 * devicePixelRatio}px system-ui, sans-serif`;
  ctx.fillText(floorReferenceLabel(currentGroup), 12 * devicePixelRatio, y - 8 * devicePixelRatio);
  ctx.restore();
}

function floorReferenceLabel(group = currentGroup) {
  if (group?.tuningTarget === "soul") return "Soul runtime floor";
  return "Floor top";
}

function drawAlignedFloorLabel(label, color = "rgba(145,215,255,.62)") {
  const offsetY = floorTopReferenceOffset(selectedFrame, currentGroup, images);
  const y = view.y + offsetY * view.zoom * devicePixelRatio;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, devicePixelRatio);
  ctx.setLineDash([4 * devicePixelRatio, 8 * devicePixelRatio]);
  ctx.beginPath();
  ctx.moveTo(0, y + 4 * devicePixelRatio);
  ctx.lineTo(els.stage.width, y + 4 * devicePixelRatio);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.font = `${11 * devicePixelRatio}px system-ui, sans-serif`;
  ctx.fillText(label, 12 * devicePixelRatio, y + 19 * devicePixelRatio);
  ctx.restore();
}

function floorTopReferenceOffset(index = selectedFrame, group = currentGroup, groupImages = images) {
  if (!group) return 0;
  if (group.tuningTarget === "soul") {
    return 0;
  }
  if (group.tuningTarget === "huang_xian") {
    return Number(config?.references?.playerFloorTopOffsetY || 0);
  }
  if (group.tuningTarget === "boss" || group.tuningTarget === "act2_statue_boss") {
    return Number(config?.references?.bossFloorTopOffsetY || 0);
  }
  if (group.type === "character") {
    return Number(config?.references?.playerFloorTopOffsetY || 0);
  }
  return Number(config?.references?.playerFloorTopOffsetY || 0);
}

function floorAlignmentDelta(index, group = currentGroup, groupImages = images) {
  return floorTopReferenceOffset(selectedFrame, currentGroup, images) - floorTopReferenceOffset(index, group, groupImages);
}

function groupOriginScreen(index, group = currentGroup, groupImages = images, alignFloor = false) {
  const floorDelta = alignFloor ? floorAlignmentDelta(index, group, groupImages) : 0;
  return {
    x: view.x,
    y: view.y + floorDelta * view.zoom * devicePixelRatio,
  };
}

function frameScreenRect(index, group = currentGroup, groupImages = images, options = {}) {
  const img = groupImages[index];
  if (!img || !group) return null;
  const t = renderTransformForGroup(options.transform || frameTransform(index, group), group);
  const flipH = effectiveFlipH(group, options);
  const facing = flipH ? -1 : 1;
  const worldScale = view.zoom * devicePixelRatio;
  const runtimeBaseScale = runtimeBaseScaleForGroup(index, group, groupImages);
  const alignFloor = options.alignFloor === true || group.uiId !== currentGroup?.uiId;
  const origin = groupOriginScreen(index, group, groupImages, alignFloor);
  if (usesRuntimeFootAnchor(group)) {
    const opaqueRect = opaqueRectForImage(img);
    const spriteScaleX = runtimeBaseScale * t.scaleX * worldScale;
    const spriteScaleY = runtimeBaseScale * t.scaleY * worldScale;
    const scaledOffsetX = t.offset.x * runtimeBaseScale * worldScale * facing;
    const scaledOffsetY = t.offset.y * runtimeBaseScale * worldScale;
    const anchorX = targetHeightAnimationAnchorX(index, group, groupImages);
    const anchorY = targetHeightAnimationAnchorY(index, group, groupImages);
    const originX = origin.x + scaledOffsetX + (img.width * 0.5 - anchorX) * spriteScaleX * facing;
    const originY = origin.y + scaledOffsetY + (img.height * 0.5 - anchorY) * spriteScaleY;
    const topLeftX = originX - (img.width * spriteScaleX) / 2;
    const topLeftY = origin.y + scaledOffsetY - anchorY * spriteScaleY;
    const rotation = (Number(t.rotation || 0) * facing * Math.PI) / 180;
    if (Math.abs(rotation) > 0.0001) {
      const corners = [
        { x: topLeftX - originX, y: topLeftY - originY },
        { x: topLeftX + img.width * spriteScaleX - originX, y: topLeftY - originY },
        { x: topLeftX + img.width * spriteScaleX - originX, y: topLeftY + img.height * spriteScaleY - originY },
        { x: topLeftX - originX, y: topLeftY + img.height * spriteScaleY - originY },
      ].map((point) => ({
        x: originX + point.x * Math.cos(rotation) - point.y * Math.sin(rotation),
        y: originY + point.x * Math.sin(rotation) + point.y * Math.cos(rotation),
      }));
      const xs = corners.map((point) => point.x);
      const ys = corners.map((point) => point.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      return {
        x: minX,
        y: minY,
        originX,
        originY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }
    return {
      x: topLeftX,
      y: topLeftY,
      originX,
      originY,
      width: img.width * spriteScaleX,
      height: img.height * spriteScaleY,
    };
  }
  const spriteScaleX = runtimeBaseScale * t.scaleX * worldScale;
  const spriteScaleY = runtimeBaseScale * t.scaleY * worldScale;
  if (usesSceneTopLeftAnchor(group)) {
    const width = img.width * spriteScaleX;
    const height = img.height * spriteScaleY;
    const x = origin.x + t.offset.x * runtimeBaseScale * worldScale * facing - (flipH ? width : 0);
    const y = origin.y + t.offset.y * runtimeBaseScale * worldScale;
    const originX = x + width / 2;
    const originY = y + height / 2;
    const rotation = (Number(t.rotation || 0) * facing * Math.PI) / 180;
    if (Math.abs(rotation) > 0.0001) {
      const corners = [
        { x: x - originX, y: y - originY },
        { x: x + width - originX, y: y - originY },
        { x: x + width - originX, y: y + height - originY },
        { x: x - originX, y: y + height - originY },
      ].map((point) => ({
        x: originX + point.x * Math.cos(rotation) - point.y * Math.sin(rotation),
        y: originY + point.x * Math.sin(rotation) + point.y * Math.cos(rotation),
      }));
      const xs = corners.map((point) => point.x);
      const ys = corners.map((point) => point.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        originX,
        originY,
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    }
    return {
      x,
      y,
      originX,
      originY,
      width,
      height,
    };
  }
  let x = origin.x + t.offset.x * runtimeBaseScale * worldScale * facing;
  let y = origin.y + t.offset.y * runtimeBaseScale * worldScale;
  if (group.type === "character") {
    const centerX = Number(config?.references?.playerSpriteCenterX || 512);
    const footY = Number(config?.references?.playerSpriteFootY || 512);
    const anchorX = Number(group.anchorX ?? centerX);
    x = origin.x + (-(anchorX - centerX) * t.scaleX + t.offset.x) * runtimeBaseScale * worldScale * facing;
    y = origin.y + (-footY * t.scaleY + t.offset.y) * runtimeBaseScale * worldScale;
  }
  if (group.type === "vfx") {
    const store = valueStore(group);
    const anchor = cloneVector(store[group.anchor] || group.anchorValue || { x: img.width, y: img.height });
    return {
      x: x - anchor.x * spriteScaleX,
      y: y - anchor.y * spriteScaleY,
      originX: x,
      originY: y,
      width: img.width * spriteScaleX,
      height: img.height * spriteScaleY,
    };
  }
  if (group.type === "boss") {
    y = origin.y + (-img.height * t.scaleY * 0.5 + t.offset.y) * runtimeBaseScale * worldScale;
  }
  return {
    x: x - img.width * spriteScaleX / 2,
    y: y - img.height * spriteScaleY / 2,
    originX: x,
    originY: y,
    width: img.width * spriteScaleX,
    height: img.height * spriteScaleY,
  };
}

function compositeOwnerFrameIndex(layerIndex = selectedFrame, ownerGroup = previewOwnerGroup) {
  if (!ownerGroup?.frames?.length) return 0;
  return Math.min(Math.max(layerIndex, 0), ownerGroup.frames.length - 1);
}

function effectiveFlipH(group, options = {}) {
  return Boolean(options.flipH ?? group?.flipH === true);
}

function compositeLayerFlipH(layerGroup, ownerGroup) {
  return Boolean(ownerGroup?.flipH === true) !== Boolean(layerGroup?.flipH === true);
}

function compositeLayerTransform(layerGroup, layerIndex, ownerGroup, ownerIndex) {
  const owner = frameTransform(ownerIndex, ownerGroup);
  const layer = frameTransform(layerIndex, layerGroup);
  let offsetX = owner.offset.x + layer.offset.x * owner.scaleX;
  if (ownerGroup?.flipH === true) {
    offsetX = owner.offset.x - layer.offset.x * owner.scaleX;
  }
  return {
    scale: owner.scale * layer.scale,
    scaleX: owner.scaleX * layer.scaleX,
    scaleY: owner.scaleY * layer.scaleY,
    offset: {
      x: offsetX,
      y: owner.offset.y + layer.offset.y * owner.scaleY,
    },
    rotation: Number(owner.rotation || 0) + Number(layer.rotation || 0),
  };
}

function currentFrameRect(index = selectedFrame) {
  if (currentGroup?.previewOwner && previewOwnerGroup && previewOwnerImages.length) {
    const ownerIndex = compositeOwnerFrameIndex(index, previewOwnerGroup);
    return frameScreenRect(index, currentGroup, images, {
      transform: compositeLayerTransform(currentGroup, index, previewOwnerGroup, ownerIndex),
      flipH: compositeLayerFlipH(currentGroup, previewOwnerGroup),
    });
  }
  return frameScreenRect(index);
}

function coordinateOwnerFrameIndex(layerIndex = selectedFrame) {
  if (!coordinateOwnerGroup?.frames?.length) return 0;
  const window = attachedVfxPlaybackWindow(currentGroup);
  if (window.owner?.uiId === coordinateOwnerGroup.uiId) {
    return clampInteger(window.start + layerIndex, 0, window.end);
  }
  return Math.min(Math.max(layerIndex, 0), coordinateOwnerGroup.frames.length - 1);
}

function drawCoordinateMarker(point, label, color) {
  if (!point) return;
  const size = 10 * devicePixelRatio;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5 * devicePixelRatio, 1.5);
  ctx.beginPath();
  ctx.moveTo(point.x - size, point.y);
  ctx.lineTo(point.x + size, point.y);
  ctx.moveTo(point.x, point.y - size);
  ctx.lineTo(point.x, point.y + size);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(point.x, point.y, 3.2 * devicePixelRatio, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${12 * devicePixelRatio}px system-ui, sans-serif`;
  ctx.fillText(label, point.x + 9 * devicePixelRatio, point.y - 18 * devicePixelRatio);
  ctx.restore();
}

function drawCoordinateMarkers() {
  if (!currentGroup || !images.length) return;
  const currentOffset = frameTransform().offset;
  const currentPoint = coordinateToScreen(currentOffset);
  drawCoordinateMarker(currentPoint, `Current ${round(currentOffset.x)}, ${round(currentOffset.y)}`, "rgba(242, 162, 60, .96)");
  if (!coordinateOwnerGroup || !coordinateOwnerImages.length || coordinateOwnerGroup.uiId === currentGroup.uiId) return;
  const ownerIndex = coordinateOwnerFrameIndex();
  const ownerOffset = frameTransform(ownerIndex, coordinateOwnerGroup).offset;
  const ownerPoint = coordinateToScreen(ownerOffset, ownerIndex, coordinateOwnerGroup, coordinateOwnerImages, true);
  drawCoordinateMarker(ownerPoint, `Owner ${coordinateOwnerGroup.name}`, "rgba(145, 215, 255, .94)");
  ctx.save();
  ctx.strokeStyle = "rgba(145, 215, 255, .58)";
  ctx.fillStyle = "rgba(203, 238, 255, .92)";
  ctx.lineWidth = Math.max(1.25 * devicePixelRatio, 1.25);
  ctx.setLineDash([7 * devicePixelRatio, 5 * devicePixelRatio]);
  ctx.beginPath();
  ctx.moveTo(ownerPoint.x, ownerPoint.y);
  ctx.lineTo(currentPoint.x, currentPoint.y);
  ctx.stroke();
  ctx.setLineDash([]);
  const delta = {
    x: currentOffset.x - ownerOffset.x,
    y: currentOffset.y - ownerOffset.y,
  };
  ctx.font = `${12 * devicePixelRatio}px Consolas, "Cascadia Mono", monospace`;
  ctx.fillText(
    `delta ${round(delta.x)}, ${round(delta.y)}`,
    (ownerPoint.x + currentPoint.x) * 0.5 + 8 * devicePixelRatio,
    (ownerPoint.y + currentPoint.y) * 0.5 + 8 * devicePixelRatio
  );
  ctx.restore();
}

function updateCoordHud() {
  if (!els.coordHud) return;
  if (!currentGroup) {
    els.coordHud.textContent = t("coordHudIdle");
    return;
  }
  const pointer = pointerStagePoint ? screenToCoordinate(pointerStagePoint) : null;
  const currentOffset = frameTransform().offset;
  const parts = [
    pointer ? `${language === "zh" ? "鼠标" : "Mouse"} ${round(pointer.x)}, ${round(pointer.y)}` : (language === "zh" ? "鼠标 -, -" : "Mouse -, -"),
    `${language === "zh" ? "偏移" : "Offset"} ${round(currentOffset.x)}, ${round(currentOffset.y)}`,
  ];
  if (coordinateOwnerGroup && coordinateOwnerImages.length && coordinateOwnerGroup.uiId !== currentGroup.uiId) {
    const ownerIndex = coordinateOwnerFrameIndex();
    const ownerOffset = frameTransform(ownerIndex, coordinateOwnerGroup).offset;
    parts.push(`${language === "zh" ? "参考" : "Owner"} ${round(ownerOffset.x)}, ${round(ownerOffset.y)}`);
    parts.push(`${language === "zh" ? "差值" : "Delta"} ${round(currentOffset.x - ownerOffset.x)}, ${round(currentOffset.y - ownerOffset.y)}`);
  }
  els.coordHud.textContent = parts.join(" | ");
}

function isPointInsideFrame(event, index = selectedFrame) {
  const rect = currentFrameRect(index);
  if (!rect) return false;
  const stageRect = els.stage.getBoundingClientRect();
  const x = (event.clientX - stageRect.left) * devicePixelRatio;
  const y = (event.clientY - stageRect.top) * devicePixelRatio;
  const padding = Math.max(18 * devicePixelRatio, Math.min(rect.width, rect.height) * 0.18);
  const minSize = 72 * devicePixelRatio;
  const extraX = Math.max(0, minSize - rect.width) * 0.5;
  const extraY = Math.max(0, minSize - rect.height) * 0.5;
  return x >= rect.x - padding - extraX
    && x <= rect.x + rect.width + padding + extraX
    && y >= rect.y - padding - extraY
    && y <= rect.y + rect.height + padding + extraY;
}

function drawFrame(index, alpha, selected, group = currentGroup, groupImages = images, options = {}) {
  const img = groupImages[index];
  if (!img) return;
  const t = renderTransformForGroup(options.transform || frameTransform(index, group), group);
  const runtimeBaseScale = runtimeBaseScaleForGroup(index, group, groupImages);
  const spriteScaleX = runtimeBaseScale * t.scaleX * view.zoom * devicePixelRatio;
  const spriteScaleY = runtimeBaseScale * t.scaleY * view.zoom * devicePixelRatio;
  const rect = frameScreenRect(index, group, groupImages, options);
  const flipH = effectiveFlipH(group, options);
  const facing = flipH ? -1 : 1;
  if (!rect) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.translate(rect.originX, rect.originY);
  ctx.rotate((Number(t.rotation || 0) * facing * Math.PI) / 180);
  if (flipH) ctx.scale(-1, 1);
  if (group.type === "vfx") {
    const store = valueStore(group);
    const anchor = cloneVector(store[group.anchor] || group.anchorValue || { x: img.width, y: img.height });
    ctx.drawImage(img, -anchor.x * spriteScaleX, -anchor.y * spriteScaleY, img.width * spriteScaleX, img.height * spriteScaleY);
  } else {
    ctx.drawImage(img, -img.width * spriteScaleX / 2, -img.height * spriteScaleY / 2, img.width * spriteScaleX, img.height * spriteScaleY);
  }
  if (selected) {
    ctx.strokeStyle = "rgba(145,215,255,.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-5, -5, 10, 10);
  }
  ctx.restore();
}

function sequenceOverlapEnabled(group = currentGroup) {
  return Boolean(group?.sequenceOverlap) && (group.frames?.length || 0) > 1;
}

function sequenceOverlapAlpha(group = currentGroup) {
  return Math.max(0, Math.min(1, Number(group?.sequenceOverlapAlpha ?? 0.48)));
}

function timedPlayableFrameIndex(group) {
  if (!group?.frames?.length) return 0;
  const playable = [];
  for (let index = 0; index < group.frames.length; index += 1) {
    if (!framePlayback(index, group).disabled) playable.push(index);
  }
  if (!playable.length) return 0;
  const fps = rawGroupPlaybackFps(group);
  return playable[Math.floor((performance.now() / 1000) * fps) % playable.length];
}

function drawSequenceOverlapFrame(index, alpha, group = currentGroup, groupImages = images, options = {}) {
  if (!playing || !sequenceOverlapEnabled(group)) return;
  const nextIndex = nextPlayableFrameInGroup(group, index).index;
  if (nextIndex === index) return;
  drawFrame(nextIndex, alpha * sequenceOverlapAlpha(group), false, group, groupImages, options);
}

function playbackNeedsContinuousDraw() {
  if (!playing || !currentGroup) return false;
  if (sequenceOverlapEnabled(currentGroup)) return true;
  return attachedLayerGroups(currentGroup).some((group) => group.independentPlayback === true || sequenceOverlapEnabled(group));
}

function drawAttachedLayersForOwner(ownerGroup, ownerIndex, alpha) {
  for (const layerGroup of attachedLayerGroups(ownerGroup)) {
    if (layerGroup.uiId === currentGroup?.uiId) continue;
    const layerImages = attachedLayerImageSets.get(layerGroup.uiId) || [];
    if (!layerImages.length) continue;
    const layerIndex = layerGroup.independentPlayback === true && playing
      ? timedPlayableFrameIndex(layerGroup)
      : Math.min(ownerIndex, layerImages.length - 1);
    const layerOptions = {
      transform: compositeLayerTransform(layerGroup, layerIndex, ownerGroup, ownerIndex),
      flipH: compositeLayerFlipH(layerGroup, ownerGroup),
    };
    drawSequenceOverlapFrame(layerIndex, alpha, layerGroup, layerImages, {
      transform: compositeLayerTransform(layerGroup, nextPlayableFrameInGroup(layerGroup, layerIndex).index, ownerGroup, ownerIndex),
      flipH: compositeLayerFlipH(layerGroup, ownerGroup),
    });
    drawFrame(layerIndex, alpha, false, layerGroup, layerImages, layerOptions);
  }
}

function frameImageAttachmentScreenRect(attachment, index = selectedFrame, group = currentGroup, groupImages = images) {
  if (!attachment?.path || !group) return;
  const img = cachedImageForFrame(attachment);
  if (!img) {
    loadImageCached(attachment).then(() => draw()).catch(() => {});
    return;
  }
  const ownerTransform = frameTransform(index, group);
  const ownerRect = frameScreenRect(index, group, groupImages, { transform: ownerTransform });
  if (!ownerRect) return;
  const ownerRenderTransform = renderTransformForGroup(ownerTransform, group);
  const local = normalizeAttachmentTransform(attachment.transform);
  const runtimeBaseScale = runtimeBaseScaleForGroup(index, group, groupImages);
  const flipH = effectiveFlipH(group);
  const facing = flipH ? -1 : 1;
  const worldScale = view.zoom * devicePixelRatio;
  // Match Godot _apply_frame_image_attachments: local scale changes size only,
  // while local offset is measured from the owner sprite origin.
  const spriteScaleX = runtimeBaseScale * ownerRenderTransform.scaleX * local.scaleX * worldScale;
  const spriteScaleY = runtimeBaseScale * ownerRenderTransform.scaleY * local.scaleY * worldScale;
  const originX = ownerRect.originX + local.offset.x * ownerRenderTransform.scaleX * runtimeBaseScale * worldScale * facing;
  const originY = ownerRect.originY + local.offset.y * ownerRenderTransform.scaleY * runtimeBaseScale * worldScale;
  const rotation = (Number(ownerRenderTransform.rotation || 0) + Number(local.rotation || 0)) * facing;
  const width = img.width * Math.abs(spriteScaleX);
  const height = img.height * Math.abs(spriteScaleY);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const rotationRadians = (rotation * Math.PI) / 180;
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map((point) => rotatePoint(point, rotationRadians, { x: originX, y: originY }));
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    originX,
    originY,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    halfWidth,
    halfHeight,
    rotation: rotationRadians,
    drawWidth: width,
    drawHeight: height,
    flipH,
    img,
  };
}

function pointInAttachmentRect(point, rect, padding = 0) {
  const local = rotateVector({ x: point.x - rect.originX, y: point.y - rect.originY }, -rect.rotation);
  return local.x >= -rect.drawWidth / 2 - padding
    && local.x <= rect.drawWidth / 2 + padding
    && local.y >= -rect.drawHeight / 2 - padding
    && local.y <= rect.drawHeight / 2 + padding;
}

function hitTestDirectManipulationAttachment(event) {
  const attachment = directManipulationAttachment();
  if (!attachment) return null;
  const frameIndex = attachmentFrameIndex(attachment, currentGroup);
  const rect = frameImageAttachmentScreenRect(attachment, frameIndex, currentGroup, images);
  if (!rect) return null;
  const padding = Math.max(6 * devicePixelRatio, 6);
  return pointInAttachmentRect(stagePoint(event), rect, padding) ? attachment : null;
}

function attachmentOffsetDeltaFromClientDelta(dx, dy, attachment = selectedFrameAttachment()) {
  const index = attachmentFrameIndex(attachment, currentGroup);
  const ownerTransform = frameTransform(index, currentGroup);
  const ownerRenderTransform = renderTransformForGroup(ownerTransform, currentGroup);
  const runtimeBaseScale = runtimeBaseScaleForGroup(index, currentGroup, images);
  const facing = effectiveFlipH(currentGroup) ? -1 : 1;
  const scaleX = ownerRenderTransform.scaleX * runtimeBaseScale * view.zoom * facing;
  const scaleY = ownerRenderTransform.scaleY * runtimeBaseScale * view.zoom;
  const safeScaleX = Math.abs(scaleX) > 0.0001 ? scaleX : (scaleX < 0 ? -0.0001 : 0.0001);
  const safeScaleY = Math.abs(scaleY) > 0.0001 ? scaleY : (scaleY < 0 ? -0.0001 : 0.0001);
  return {
    x: dx / safeScaleX,
    y: dy / safeScaleY,
  };
}

function pushAttachmentWheelUndo(label) {
  if (!attachmentWheelUndoTimer || attachmentWheelUndoLabel !== label) {
    pushUndo(label);
    attachmentWheelUndoLabel = label;
  }
  clearTimeout(attachmentWheelUndoTimer);
  attachmentWheelUndoTimer = setTimeout(() => {
    attachmentWheelUndoTimer = null;
    attachmentWheelUndoLabel = "";
  }, 400);
}

function attachmentWheelMode() {
  if (heldAttachmentTransformKeys.has("r")) return "rotate";
  if (heldAttachmentTransformKeys.has("z")) return "scale";
  return "";
}

function clampAttachmentScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(20, Math.max(0.001, numeric));
}

function scaleAttachmentAxis(value, fallback, factor) {
  const numeric = Number(value);
  const base = Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  return clampAttachmentScale(base * factor);
}

function applySelectedAttachmentWheel(event) {
  const mode = attachmentWheelMode();
  if (!mode) return false;
  const attachment = hitTestDirectManipulationAttachment(event);
  if (!attachment) return true;
  activateFrameAttachmentForEditing(attachment);
  const transform = normalizeAttachmentTransform(attachment.transform);
  if (mode === "rotate") {
    pushAttachmentWheelUndo("rotate attached image");
    const rotationDelta = event.deltaY < 0 ? 2 : -2;
    attachment.transform = normalizeAttachmentTransform({
      ...transform,
      rotation: transform.rotation + rotationDelta,
    });
  } else {
    pushAttachmentWheelUndo("scale attached image");
    const factor = event.deltaY < 0 ? 1.04 : 1 / 1.04;
    const previousScale = Number(transform.scale || 1);
    const nextScale = clampAttachmentScale(previousScale * factor);
    attachment.transform = normalizeAttachmentTransform({
      ...transform,
      scale: nextScale,
      scaleX: scaleAttachmentAxis(transform.scaleX, previousScale, factor),
      scaleY: scaleAttachmentAxis(transform.scaleY, previousScale, factor),
    });
  }
  markDirty();
  syncAdjustmentInputs();
  renderFilmstrip();
  draw();
  return true;
}

function drawFrameImageAttachment(attachment, index, alpha, group = currentGroup, groupImages = images) {
  const rect = frameImageAttachmentScreenRect(attachment, index, group, groupImages);
  if (!rect) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.translate(rect.originX, rect.originY);
  ctx.rotate(rect.rotation);
  if (rect.flipH) ctx.scale(-1, 1);
  ctx.drawImage(rect.img, -rect.drawWidth / 2, -rect.drawHeight / 2, rect.drawWidth, rect.drawHeight);
  if (selectedAttachmentId === attachment.id) {
    ctx.strokeStyle = "rgba(255, 196, 74, .95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-rect.drawWidth / 2, -rect.drawHeight / 2, rect.drawWidth, rect.drawHeight);
  }
  ctx.restore();
}

function drawFrameImageAttachments(index, alpha, layer, group = currentGroup, groupImages = images) {
  for (const attachment of drawableFrameAttachments(index, layer, group)) {
    drawFrameImageAttachment(attachment, index, alpha, group, groupImages);
  }
}

function drawCompositeFrame(index, alpha, selected) {
  if (currentGroup?.previewOwner && previewOwnerGroup && previewOwnerImages.length) {
    const ownerIndex = compositeOwnerFrameIndex(index, previewOwnerGroup);
    drawFrame(ownerIndex, Math.min(alpha, 0.72), false, previewOwnerGroup, previewOwnerImages);
    drawFrameImageAttachments(index, alpha, "below", currentGroup, images);
    if (selected) {
      const nextIndex = nextPlayableFrameInGroup(currentGroup, index).index;
      drawSequenceOverlapFrame(index, alpha, currentGroup, images, {
        transform: compositeLayerTransform(currentGroup, nextIndex, previewOwnerGroup, ownerIndex),
        flipH: compositeLayerFlipH(currentGroup, previewOwnerGroup),
      });
    }
    drawFrame(index, alpha, selected, currentGroup, images, {
      transform: compositeLayerTransform(currentGroup, index, previewOwnerGroup, ownerIndex),
      flipH: compositeLayerFlipH(currentGroup, previewOwnerGroup),
    });
    drawFrameImageAttachments(index, alpha, "above", currentGroup, images);
    return;
  }
  if (selected) drawSequenceOverlapFrame(index, alpha);
  drawFrameImageAttachments(index, alpha, "below");
  drawFrame(index, alpha, selected);
  drawFrameImageAttachments(index, alpha, "above");
  drawAttachedLayersForOwner(currentGroup, index, alpha);
}

function drawBox(boxName) {
  const rect = boxScreenRect(boxName);
  if (!rect) return;
  const box = rect.box;
  const selected = selectedBox === boxName;
  const styles = {
    hitbox: {
      fill: "rgba(255, 90, 66, .16)",
      stroke: "rgba(255, 112, 82, .94)",
      label: "rgba(255, 178, 156, .96)",
      handle: "rgba(255, 112, 82, 1)",
    },
    hurtbox: {
      fill: "rgba(99, 196, 255, .13)",
      stroke: "rgba(99, 196, 255, .92)",
      label: "rgba(184, 230, 255, .96)",
      handle: "rgba(99, 196, 255, 1)",
    },
    collisionbox: {
      fill: "rgba(76, 224, 132, .12)",
      stroke: "rgba(80, 220, 125, .95)",
      label: "rgba(186, 255, 210, .98)",
      handle: "rgba(80, 220, 125, 1)",
    },
  };
  const style = styles[boxName] || styles.hurtbox;
  ctx.save();
  ctx.globalAlpha = box.enabled === false ? 0.36 : 1;
  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = (selected ? 2.5 : 1.5) * devicePixelRatio;
  ctx.setLineDash(selected ? [] : [7 * devicePixelRatio, 5 * devicePixelRatio]);
  ctx.translate(rect.centerX, rect.centerY);
  ctx.rotate(rect.rotation);
  ctx.fillRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height);
  ctx.strokeRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height);
  ctx.setLineDash([]);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = box.enabled === false ? 0.36 : 1;
  ctx.fillStyle = style.label;
  ctx.font = `${12 * devicePixelRatio}px system-ui, sans-serif`;
  const label = box.enabled === false ? `${t(boxName)} preview` : t(boxName);
  ctx.fillText(label, rect.left + 6 * devicePixelRatio, rect.top - 7 * devicePixelRatio);
  if (selected) {
    ctx.fillStyle = "#0a0a0a";
    ctx.strokeStyle = style.handle;
    for (const handle of editableBoxHandleRects(boxName, rect)) {
      ctx.fillRect(handle.x, handle.y, handle.width, handle.height);
      ctx.strokeRect(handle.x, handle.y, handle.width, handle.height);
    }
  }
  ctx.restore();
}

function drawBoxes() {
  if (!showBoxes || !canEditBoxes()) return;
  for (const boxName of BOX_DRAW_ORDER.filter((name) => selectedBoxes.has(name))) drawBox(boxName);
}

function drawReferenceFrameOverlay() {
  if (!referenceFrame) return;
  if (referenceFrameHiddenByKey) return;
  const referenceImages = referenceFrame.images || [];
  if (!referenceImages[referenceFrame.index]) referenceImages[referenceFrame.index] = referenceFrame.image;
  drawFrame(referenceFrame.index, 0.48, false, referenceFrame.group, referenceImages, {
    transform: referenceFrame.transform,
    alignFloor: referenceFrame.group?.uiId !== currentGroup.uiId,
  });
}

function canvasHintLines() {
  const lines = [];
  if (selectedFrameAttachment()) {
    lines.push({
      text: t("frameAttachmentCanvasHint"),
      active: true,
    });
  }
  if (referenceFrame) {
    lines.push({
      text: t("referenceFrameHideHint"),
      active: referenceFrameHiddenByKey,
    });
  }
  if (showBoxes && canEditBoxes()) {
    lines.push({
      text: t("boxEditHint"),
      active: false,
    });
  }
  return lines;
}

function drawCanvasHints() {
  const lines = canvasHintLines();
  if (!lines.length) return;
  const paddingX = 11 * devicePixelRatio;
  const paddingY = 8 * devicePixelRatio;
  const lineHeight = 19 * devicePixelRatio;
  const margin = 22 * devicePixelRatio;
  ctx.save();
  ctx.font = `${13 * devicePixelRatio}px system-ui, "Microsoft YaHei UI", sans-serif`;
  const width = Math.max(...lines.map((line) => ctx.measureText(line.text).width)) + paddingX * 2;
  const height = paddingY * 2 + lineHeight * lines.length;
  const x = Math.max(margin, els.stage.width - width - margin);
  const y = margin;
  ctx.fillStyle = "rgba(8, 11, 13, .72)";
  ctx.strokeStyle = lines.some((line) => line.active) ? "rgba(255, 196, 74, .72)" : "rgba(145, 215, 255, .52)";
  ctx.lineWidth = Math.max(1, devicePixelRatio);
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.fill();
  ctx.stroke();
  ctx.textBaseline = "middle";
  lines.forEach((line, index) => {
    ctx.fillStyle = line.active ? "rgba(255, 224, 150, .95)" : "rgba(203, 238, 255, .92)";
    ctx.fillText(line.text, x + paddingX, y + paddingY + lineHeight * index + lineHeight / 2);
  });
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, els.stage.width, els.stage.height);
  drawGrid();
  if (!currentGroup || !images.length) {
    updateCoordHud();
    return;
  }
  const chain = playbackChainGroup();
  if (ghost && chain && chain.uiId !== currentGroup.uiId && chainImages.length) {
    drawAlignedFloorLabel(`Then group aligned to Floor top: ${chain.name}`);
    for (let i = 0; i < chainImages.length; i += 1) {
      if (!framePlayback(i, chain).disabled) drawFrame(i, 0.18, false, chain, chainImages);
    }
  }
  if (ghost) {
    for (let i = 0; i < images.length; i += 1) {
      if (i !== selectedFrame && !selectedFrames.has(i) && !isReferenceFrame(i) && !framePlayback(i).disabled) drawCompositeFrame(i, 0.22, false);
    }
  }
  for (const frameIndex of selectedFrameIndexes()) {
    if (frameIndex !== selectedFrame && !framePlayback(frameIndex).disabled) {
      drawCompositeFrame(frameIndex, 0.72, true);
    }
  }
  drawCompositeFrame(selectedFrame, 1, true);
  drawReferenceFrameOverlay();
  drawBoxes();
  drawCoordinateMarkers();
  drawCanvasHints();
  updateCoordHud();
}

function updateSelectedFromInputs(transform = transformFromAdjustmentInputs()) {
  const attachment = selectedFrameAttachment();
  if (attachment) {
    attachment.transform = normalizeAttachmentTransform(transform);
    markDirty();
    renderFilmstrip();
    draw();
    return;
  }
  if (!canEditFrameTransform()) return;
  for (const frameIndex of selectedFrameIndexes()) {
    setFrameTransform(frameIndex, transform);
  }
  renderFilmstrip();
  draw();
}

function updateCharacterFromInputs(transform = transformFromAdjustmentInputs()) {
  if (!canEditCharacterTransform()) return;
  const store = valueStore();
  if (!currentGroup?.characterScale) return;
  const scale = Number(transform.scale);
  store[currentGroup.characterScale] = scale;
  if (currentGroup.characterScaleVector) {
    const scaleVector = scaleVectorFromTransform(transform);
    if (nearlyEqual(scaleVector.x, scale) && nearlyEqual(scaleVector.y, scale)) {
      delete store[currentGroup.characterScaleVector];
    } else {
      store[currentGroup.characterScaleVector] = scaleVector;
    }
  }
  if (currentGroup.characterOffset) store[currentGroup.characterOffset] = cloneVector(transform.offset);
  if (currentGroup.characterRotation) store[currentGroup.characterRotation] = Number(transform.rotation || 0);
  markDirty();
  syncFrameInputs();
  renderFilmstrip();
  updateGroupMeta();
  draw();
}

function updateSelectedPlaybackFromInputs({ preserveDuration = false, changeDuration = true } = {}) {
  if (!canEditFramePlayback()) return;
  const previousDurationSeconds = preserveDuration ? groupPlaybackDurationSeconds() : 0;
  const targetMs = Math.max(MIN_FRAME_DURATION_MS, Math.round(Number(els.frameDuration.value || MIN_FRAME_DURATION_MS)));
  const selectedIndexes = selectedFrameIndexes();
  const durationChanged = changeDuration && selectedIndexes.some((frameIndex) => Math.round(frameDurationMs(frameIndex, currentGroup)) !== targetMs);
  const hasGroupTiming = durationChanged && groupHasGroupTimeOverride();
  if (hasGroupTiming && !window.confirm(t("frameTimeConflict"))) {
    syncFrameInputs();
    return;
  }
  if (hasGroupTiming) {
    if (!els.frameDuration?.dataset.undoUsed) pushUndo("frame duration");
    clearGroupTimeOverride(currentGroup);
  }
  for (const frameIndex of selectedIndexes) {
    const playback = framePlayback(frameIndex, currentGroup);
    setFramePlayback(frameIndex, {
      duration: changeDuration ? frameDurationMultiplierFromMs(targetMs, currentGroup) : playback.duration,
      disabled: els.frameDisabled.checked,
    });
  }
  if (preserveDuration) preserveGroupPlaybackDuration(previousDurationSeconds);
  syncFrameInputs();
  renderFilmstrip();
  updateWorkbenchHud();
  draw();
}

function adjustFrameDurationMs(index, deltaMs) {
  if (!currentGroup || !canEditFramePlayback() || usesAttachedPlaybackTiming()) return;
  const frameIndex = clampFrameIndex(index, currentGroup);
  const nextMs = Math.max(MIN_FRAME_DURATION_MS, Math.round(frameDurationMs(frameIndex, currentGroup) + deltaMs));
  const hasGroupTiming = groupHasGroupTimeOverride();
  if (hasGroupTiming && !window.confirm(t("frameTimeConflict"))) {
    syncFrameInputs();
    return;
  }
  pushUndo("frame duration");
  setSingleFrameSelection(frameIndex, currentGroup);
  const playback = framePlayback(frameIndex, currentGroup);
  if (hasGroupTiming) clearGroupTimeOverride(currentGroup);
  setFramePlayback(frameIndex, {
    ...playback,
    duration: frameDurationMultiplierFromMs(nextMs, currentGroup),
  }, currentGroup);
  syncFrameInputs();
  renderFilmstrip();
  updateWorkbenchHud();
  draw();
}

function updateGroupPlaybackFromInputs() {
  if (!els.fps || !els.fpsValue || !els.rootMotionX || !els.rootMotionY) return;
  if (!canEditFramePlayback()) return;
  if (usesAttachedPlaybackTiming()) {
    if (!els.vfxStartFrame || !els.vfxEndFrame) return;
    setGroupPlaybackData({
      start_frame: Number(els.vfxStartFrame.value || 1) - 1,
      end_frame: Number(els.vfxEndFrame.value || els.vfxStartFrame.value || 1) - 1,
    });
    syncGroupPlaybackInputs();
    updateGroupMeta();
    updateWorkbenchHud();
    return;
  }
  setGroupPlaybackData({
    fps: Number(els.fps.value || groupPlaybackFps()),
    root_motion: {
      x: Number(els.rootMotionX.value || 0),
      y: Number(els.rootMotionY.value || 0),
    },
  });
  els.fpsValue.textContent = round(groupPlaybackFps());
  updateGroupMeta();
  updateWorkbenchHud();
}

function updateBaseFromInputs(transform = transformFromAdjustmentInputs()) {
  if (!canEditGroupTransform()) return;
  const store = valueStore();
  const previousBase = baseEditSnapshot?.groupUiId === currentGroup?.uiId ? baseEditSnapshot.base : baseTransform();
  const nextBase = transform;
  const scaleRatio = previousBase.scale !== 0 ? nextBase.scale / previousBase.scale : 1;
  const previousScaleX = Number(previousBase.scaleX ?? previousBase.scale);
  const previousScaleY = Number(previousBase.scaleY ?? previousBase.scale);
  const scaleXRatio = previousScaleX !== 0 ? Number(nextBase.scaleX ?? nextBase.scale) / previousScaleX : 1;
  const scaleYRatio = previousScaleY !== 0 ? Number(nextBase.scaleY ?? nextBase.scale) / previousScaleY : 1;
  const offsetDelta = {
    x: nextBase.offset.x - previousBase.offset.x,
    y: nextBase.offset.y - previousBase.offset.y,
  };
  const rotationDelta = Number(nextBase.rotation || 0) - Number(previousBase.rotation || 0);
  const storeOverrides = overrideStore();
  const sourceOverrides = baseEditSnapshot?.groupUiId === currentGroup?.uiId ? baseEditSnapshot.overrides : storeOverrides;
  const animationName = tuningAnimationName(currentGroup);
  if (sourceOverrides !== storeOverrides) {
    for (const key of Object.keys(storeOverrides)) {
      if (key.startsWith(`${animationName}:`)) delete storeOverrides[key];
    }
  }
  for (const key of Object.keys(sourceOverrides)) {
    if (!key.startsWith(`${animationName}:`)) continue;
    const override = structuredClone(sourceOverrides[key]);
    if (!override) continue;
    if (Number.isFinite(Number(override.visual_size))) {
      override.visual_size = Number(override.visual_size) * scaleRatio;
    }
    const overrideScale = cloneScaleVector(override.visual_scale, Number(override.visual_size || nextBase.scale));
    override.visual_scale = {
      x: overrideScale.x * scaleXRatio,
      y: overrideScale.y * scaleYRatio,
    };
    if (nearlyEqual(override.visual_scale.x, override.visual_size) && nearlyEqual(override.visual_scale.y, override.visual_size)) {
      delete override.visual_scale;
    }
    if (override.offset) {
      override.offset = {
        x: Number(override.offset.x || 0) + offsetDelta.x,
        y: Number(override.offset.y || 0) + offsetDelta.y,
      };
    }
    override.rotation = Number(override.rotation ?? previousBase.rotation ?? 0) + rotationDelta;
    storeOverrides[key] = override;
  }
  store[currentGroup.scale] = nextBase.scale;
  if (currentGroup.scaleVector) store[currentGroup.scaleVector] = { x: Number(nextBase.scaleX), y: Number(nextBase.scaleY) };
  store[currentGroup.offset] = nextBase.offset;
  if (currentGroup.rotation) store[currentGroup.rotation] = Number(nextBase.rotation || 0);
  markDirty();
  syncFrameInputs();
  renderFilmstrip();
  updateGroupMeta();
  draw();
}

function updateAdjustmentFromInputs() {
  const transform = transformFromAdjustmentInputs();
  if (adjustmentMode === "character") {
    updateCharacterFromInputs(transform);
  } else if (adjustmentMode === "frame") {
    updateSelectedFromInputs(transform);
  } else {
    updateBaseFromInputs(transform);
  }
}

function animate(time) {
  if (!currentGroup || !images.length || playbackSwitching) {
    requestAnimationFrame(animate);
    return;
  }
  const interval = (1000 / groupPlaybackFps(currentGroup)) * Math.max(0.001, effectiveFrameDurationMultiplier(selectedFrame, currentGroup));
  let advanced = false;
  if (playing && time - lastPlay > interval) {
    advancePlayback();
    lastPlay = time;
    advanced = true;
  }
  if (!advanced && playbackNeedsContinuousDraw()) {
    draw();
  }
  requestAnimationFrame(animate);
}

function firstPlayableFrame(group) {
  for (let index = 0; index < group.frames.length; index += 1) {
    if (!framePlayback(index, group).disabled) return index;
  }
  return 0;
}

function nextPlayableFrameInGroup(group, index) {
  for (let step = 1; step <= group.frames.length; step += 1) {
    const candidate = (index + step) % group.frames.length;
    if (!framePlayback(candidate, group).disabled) {
      return { index: candidate, wrapped: candidate <= index };
    }
  }
  return { index, wrapped: true };
}

async function loadImagesForBoxGeneration(group) {
  if (group?.uiId === currentGroup?.uiId && images.length) return images;
  return Promise.all((group?.frames || []).map((frame) => loadImageCached(frame).catch(() => null)));
}

async function ensureCollisionBoxOverridesForSave() {
  if (!Array.isArray(config?.groups)) return;
  for (const group of config.groups) {
    if (!canEditBox("collisionbox", group) || !Array.isArray(group.frames) || !group.frames.length) continue;
    const groupImages = await loadImagesForBoxGeneration(group);
    const store = boxOverrideStore(group);
    for (let index = 0; index < group.frames.length; index += 1) {
      const key = frameBoxKey(index, group);
      const entry = structuredClone(store[key] || {});
      const base = defaultCollisionBox(index, group, groupImages);
      const existing = entry.collisionbox || {};
      entry.collisionbox = normalizeFrameBox("collisionbox", {
        offset: existing.offset ?? base.offset,
        size: existing.size ?? base.size,
        rotation: 0,
        enabled: existing.enabled ?? base.enabled,
      });
      store[key] = entry;
    }
  }
}

function playbackChainGroup() {
  if (!els.chainGroupSelect) return null;
  return (config?.groups || []).find((group) => group.uiId === els.chainGroupSelect.value) || null;
}

async function switchPlaybackGroup(group, frameIndex) {
  playbackSwitching = true;
  await selectGroup(group, { frameIndex, preserveView: true, stopPlayback: false });
  playFrameAudio(frameIndex, group);
  playbackSwitching = false;
}

function advancePlayback() {
  const primary = playbackPrimaryGroup || currentGroup;
  const secondary = playbackSecondaryGroup;
  const next = nextPlayableFrameInGroup(currentGroup, selectedFrame);
  if (!secondary || secondary.uiId === primary.uiId || !next.wrapped) {
    setSingleFrameSelection(next.index, currentGroup);
    syncFrameInputs();
    renderFilmstrip();
    draw();
    playFrameAudio(next.index, currentGroup);
    return;
  }
  const nextGroup = currentGroup.uiId === primary.uiId ? secondary : primary;
  if (!els.chainGroupSelect) {
    switchPlaybackGroup(nextGroup, firstPlayableFrame(nextGroup));
    return;
  }
  if (nextGroup.uiId === secondary.uiId) {
    els.chainGroupSelect.value = primary.uiId;
  } else {
    els.chainGroupSelect.value = secondary.uiId;
  }
  switchPlaybackGroup(nextGroup, firstPlayableFrame(nextGroup));
}

async function save() {
  if (saveInFlight) return;
  saveInFlight = true;
  updateSaveState();
  updateAdjustmentFromInputs();
  pruneNoopFrameOverrides();
  await ensureCollisionBoxOverridesForSave();
  const frameAudioBindingsForSave = await collectFrameAudioBindingsForSave();
  try {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: activeProjectId(),
        values: collectTuningValues(),
        scene_settings: collectSceneSettings(),
        frame_audio_bindings: frameAudioBindingsForSave,
        frame_image_attachments: collectFrameImageAttachmentsForSave(),
        frame_visual_overrides: frameOverrides,
        attack_vfx_frame_overrides: vfxFrameOverrides,
        frame_playback_overrides: framePlaybackOverrides,
        attack_vfx_playback_overrides: vfxPlaybackOverrides,
        frame_box_overrides: frameBoxOverrides,
        boss: {
          values: collectBossTuningValues(),
          boss_frame_visual_overrides: bossFrameOverrides,
          boss_frame_playback_overrides: bossPlaybackOverrides,
        },
        act2StatueBoss: {
          values: collectAct2StatueBossTuningValues(),
          frame_visual_overrides: act2StatueBossFrameOverrides,
          frame_playback_overrides: act2StatueBossPlaybackOverrides,
        },
        huangXian: {
          values: collectHuangXianTuningValues(),
          frame_visual_overrides: huangXianFrameOverrides,
          frame_playback_overrides: huangXianPlaybackOverrides,
        },
        soul: {
          values: collectSoulTuningValues(),
          frame_visual_overrides: soulFrameOverrides,
          frame_playback_overrides: soulPlaybackOverrides,
          frame_box_overrides: soulFrameBoxOverrides,
        },
        yechengProps: {
          values: collectYechengPropTuningValues(),
        },
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const result = await res.json().catch(() => ({}));
    if (Array.isArray(result.warnings)) config.warnings = result.warnings;
    saveInFlight = false;
    markClean();
    const warningText = Array.isArray(result.warnings) && result.warnings.length
      ? t("warnings", { warnings: result.warnings.join("\n") })
      : "";
    status(warningText.trim());
  } catch (error) {
    saveInFlight = false;
    updateSaveState();
    throw error;
  }
}

function collectTuningValues() {
  const result = {};
  const seenProfiles = new Set();
  for (const group of config.groups.filter((entry) => !entry.tuningTarget)) {
    if (group.profileId && !seenProfiles.has(group.profileId)) {
      seenProfiles.add(group.profileId);
      if (group.characterScale && values[group.characterScale] != null) result[group.characterScale] = values[group.characterScale];
      if (group.characterScaleVector && values[group.characterScaleVector] != null) result[group.characterScaleVector] = values[group.characterScaleVector];
      if (group.characterOffset && values[group.characterOffset] != null) result[group.characterOffset] = values[group.characterOffset];
      if (group.characterRotation && values[group.characterRotation] != null) result[group.characterRotation] = values[group.characterRotation];
    }
    if (values[group.scale] != null) result[group.scale] = values[group.scale];
    if (group.scaleVector && values[group.scaleVector] != null) result[group.scaleVector] = values[group.scaleVector];
    if (values[group.offset] != null) result[group.offset] = values[group.offset];
    if (group.rotation && values[group.rotation] != null) result[group.rotation] = values[group.rotation];
    if (group.anchor && values[group.anchor] != null) result[group.anchor] = values[group.anchor];
  }
  return result;
}

function collectBossTuningValues() {
  const result = {};
  for (const group of config.groups.filter((entry) => entry.tuningTarget === "boss")) {
    if (bossValues[group.scale] != null) result[group.scale] = bossValues[group.scale];
    if (group.scaleVector && bossValues[group.scaleVector] != null) result[group.scaleVector] = bossValues[group.scaleVector];
    if (bossValues[group.offset] != null) result[group.offset] = bossValues[group.offset];
  }
  return result;
}

function collectAct2StatueBossTuningValues() {
  const result = {};
  for (const group of config.groups.filter((entry) => entry.tuningTarget === "act2_statue_boss")) {
    if (act2StatueBossValues[group.scale] != null) result[group.scale] = act2StatueBossValues[group.scale];
    if (group.scaleVector && act2StatueBossValues[group.scaleVector] != null) result[group.scaleVector] = act2StatueBossValues[group.scaleVector];
    if (act2StatueBossValues[group.offset] != null) result[group.offset] = act2StatueBossValues[group.offset];
  }
  return result;
}

function collectHuangXianTuningValues() {
  const result = {};
  for (const group of config.groups.filter((entry) => entry.tuningTarget === "huang_xian")) {
    if (huangXianValues[group.scale] != null) result[group.scale] = huangXianValues[group.scale];
    if (group.scaleVector && huangXianValues[group.scaleVector] != null) result[group.scaleVector] = huangXianValues[group.scaleVector];
    if (huangXianValues[group.offset] != null) result[group.offset] = huangXianValues[group.offset];
  }
  return result;
}

function collectSoulTuningValues() {
  const result = {};
  for (const group of config.groups.filter((entry) => entry.tuningTarget === "soul")) {
    if (soulValues[group.scale] != null) result[group.scale] = soulValues[group.scale];
    if (group.scaleVector && soulValues[group.scaleVector] != null) result[group.scaleVector] = soulValues[group.scaleVector];
    if (soulValues[group.offset] != null) result[group.offset] = soulValues[group.offset];
    if (group.anchor && soulValues[group.anchor] != null) result[group.anchor] = soulValues[group.anchor];
  }
  return result;
}

function collectYechengPropTuningValues() {
  const result = {};
  for (const group of config.groups.filter((entry) => entry.tuningTarget === "yecheng_props")) {
    if (yechengPropValues[group.scale] != null) result[group.scale] = yechengPropValues[group.scale];
    if (group.scaleVector && yechengPropValues[group.scaleVector] != null) result[group.scaleVector] = yechengPropValues[group.scaleVector];
    if (yechengPropValues[group.offset] != null) result[group.offset] = yechengPropValues[group.offset];
  }
  return result;
}

els.projectSelect.addEventListener("change", () => {
  activateProject(els.projectSelect.value).catch((error) => status(t("projectSwitchFailed", { message: error.message })));
});
els.refreshProject.addEventListener("click", () => {
  imageCache.clear();
  loadConfig().then(resizeCanvas).catch((error) => status(t("projectRefreshFailed", { message: error.message })));
});
if (els.languageSelect) {
  els.languageSelect.addEventListener("change", () => {
    language = els.languageSelect.value === "en" ? "en" : "zh";
    localStorage.setItem("xsxbFrameTuner.language", language);
    applyLanguage();
  });
}
for (const button of els.languageButtons) {
  button.addEventListener("click", () => {
    language = button.dataset.language === "en" ? "en" : "zh";
    localStorage.setItem("xsxbFrameTuner.language", language);
    applyLanguage();
  });
}
for (const button of els.themeButtons) {
  button.addEventListener("click", () => {
    uiTheme = normalizeTheme(button.dataset.theme);
    localStorage.setItem("xsxbFrameTuner.theme", uiTheme);
    applyUiTheme();
  });
}
if (els.canvasColor) {
  els.canvasColor.addEventListener("input", () => {
    canvasColor = normalizeColor(els.canvasColor.value);
    localStorage.setItem("xsxbFrameTuner.canvasColor", canvasColor);
    applyCanvasColor();
    draw();
  });
}
if (els.sceneSelect) {
  els.sceneSelect.addEventListener("change", () => {
    selectedSceneId = els.sceneSelect.value || "";
    if (selectedSceneId) localStorage.setItem("xsxbFrameTuner.scene", selectedSceneId);
    syncSceneInputs();
    draw();
  });
}
if (els.sceneScale) {
  armInputUndo(els.sceneScale, "scene scale");
  els.sceneScale.addEventListener("input", updateSceneScaleFromInput);
  els.sceneScale.addEventListener("change", syncSceneInputs);
}
els.groupSelect.addEventListener("change", () => selectGroup(config.groups.find((group) => group.uiId === els.groupSelect.value)));
els.profileSelect.addEventListener("change", () => {
  selectedProfileId = els.profileSelect.value || "all";
  localStorage.setItem("animationTuner.profile", selectedProfileId);
  const groups = renderGroupSelect(currentGroup?.uiId);
  const nextGroup = groups.find((group) => group.uiId === currentGroup?.uiId) || groups[0];
  selectGroup(nextGroup);
});
els.groupSearch.addEventListener("input", () => {
  groupSearch = els.groupSearch.value || "";
  localStorage.setItem("animationTuner.groupSearch", groupSearch);
  const groups = renderGroupSelect(currentGroup?.uiId);
  const currentVisible = groups.some((group) => group.uiId === currentGroup?.uiId);
  if (!currentVisible && groups[0]) selectGroup(groups[0]);
});
if (els.chainGroupSelect) {
  els.chainGroupSelect.addEventListener("change", async () => {
    if (playing) {
      playbackPrimaryGroup = currentGroup;
      playbackSecondaryGroup = playbackChainGroup();
      if (playbackSecondaryGroup?.uiId === playbackPrimaryGroup.uiId) playbackSecondaryGroup = null;
    }
    await loadChainImages();
    updateGroupMeta();
    renderFilmstrip();
    draw();
  });
}
function armInputUndo(input, label) {
  input.addEventListener("focus", () => inputEditSnapshots.set(input, { label, state: cloneState() }));
  input.addEventListener("blur", () => {
    inputEditSnapshots.delete(input);
    delete input.dataset.undoUsed;
  });
  input.addEventListener("input", () => {
    if (inputEditSnapshots.has(input) && !input.dataset.undoUsed) {
      const snapshot = inputEditSnapshots.get(input);
      undoStack.push(snapshot);
      if (undoStack.length > 80) undoStack.shift();
      redoStack = [];
      updateHistoryControls();
      input.dataset.undoUsed = "1";
    }
  });
  input.addEventListener("change", () => {
    delete input.dataset.undoUsed;
    inputEditSnapshots.delete(input);
  });
}

function syncFrameAxisScaleToUniform() {
  els.frameScaleX.value = els.frameScale.value;
  els.frameScaleY.value = els.frameScale.value;
}

function syncBaseAxisScaleToUniform() {
  els.baseScaleX.value = els.baseScale.value;
  els.baseScaleY.value = els.baseScale.value;
}

function setAdjustmentMode(mode) {
  adjustmentMode = normalizeAdjustmentMode(mode);
  baseEditSnapshot = null;
  boxEditSnapshot = null;
  localStorage.setItem(ADJUSTMENT_MODE_KEY, adjustmentMode);
  syncAdjustmentInputs();
}

function audioFileFromList(fileList) {
  const files = Array.from(fileList || []);
  return files.find((file) => {
    if (!file) return false;
    if (String(file.type || "").startsWith("audio/")) return true;
    return /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file.name || "");
  }) || null;
}

function imageFileFromList(fileList) {
  const files = Array.from(fileList || []);
  return files.find((file) => {
    if (!file) return false;
    if (String(file.type || "").startsWith("image/")) return true;
    return /\.(png|jpe?g|webp|gif)$/i.test(file.name || "");
  }) || null;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function imageSizeFromDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width || 0, height: img.naturalHeight || img.height || 0 });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

async function uploadFrameAttachmentImage(file, id) {
  const data = await readFileAsDataUrl(file);
  const size = await imageSizeFromDataUrl(data);
  const res = await fetch("/api/frame-attachment-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectId: activeProjectId(),
      id,
      name: file.name || "image",
      type: file.type || "",
      width: size.width,
      height: size.height,
      data,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const result = await res.json();
  return result.image;
}

async function bindFrameImageAttachmentFile(file, index = selectedFrame, group = currentGroup) {
  if (!file || !group) return false;
  const frameIndex = clampFrameIndex(index, group);
  const id = newLocalId("layer");
  try {
    const image = await uploadFrameAttachmentImage(file, id);
    pushUndo("add attached image");
    const attachment = normalizeFrameImageAttachment({
      id,
      key: frameImageAttachmentKey(frameIndex, group),
      metadata: frameImageAttachmentMetadata(frameIndex, group),
      name: image.name || file.name || "image",
      path: image.path,
      assetHash: image.assetHash,
      type: image.type || file.type || "",
      width: image.width,
      height: image.height,
      layer: "above",
      layerOrder: nextAboveAttachmentLayerOrder(frameIndex, group),
      transform: { scale: 1, scaleX: 1, scaleY: 1, offset: { x: 0, y: 0 }, rotation: 0 },
    });
    frameImageAttachments.push(attachment);
    await loadImageCached(attachment).catch(() => null);
    selectFrameImageAttachment(attachment, frameIndex, group);
    markDirty();
    status(t("frameAttachmentAdded", { name: attachment.name }));
    return true;
  } catch (error) {
    status(t("frameAttachmentUploadFailed", { message: error.message }));
    return false;
  }
}

function removeFrameImageAttachment(attachmentId) {
  const attachment = frameImageAttachments.find((entry) => entry.id === attachmentId);
  if (!attachment || !window.confirm(t("frameAttachmentDeleteConfirm"))) return;
  pushUndo("remove attached image");
  frameImageAttachments = frameImageAttachments.filter((entry) => entry.id !== attachmentId);
  if (selectedAttachmentId === attachmentId) clearSelectedAttachment();
  markDirty();
  syncFrameInputs();
  renderFilmstrip();
  draw();
  status(t("frameAttachmentRemoved"));
}

function collectFrameImageAttachmentsForSave() {
  const normalized = frameImageAttachments.map((attachment) => normalizeFrameImageAttachment(attachment));
  const byFrame = new Map();
  normalized.forEach((attachment, index) => {
    const key = attachment.key || attachment.frameKey || `__missing_${index}`;
    if (!byFrame.has(key)) byFrame.set(key, []);
    byFrame.get(key).push({ attachment, index });
  });
  byFrame.forEach((entries) => {
    const above = entries
      .filter((entry) => attachmentLayerOrder(entry.attachment) > 0)
      .sort((a, b) => attachmentLayerOrder(b.attachment) - attachmentLayerOrder(a.attachment) || a.index - b.index);
    above.forEach((entry, orderIndex) => {
      entry.attachment.layerOrder = above.length - orderIndex;
      entry.attachment.layer = "above";
    });
    const below = entries
      .filter((entry) => attachmentLayerOrder(entry.attachment) < 0)
      .sort((a, b) => attachmentLayerOrder(b.attachment) - attachmentLayerOrder(a.attachment) || a.index - b.index);
    below.forEach((entry, orderIndex) => {
      entry.attachment.layerOrder = -(orderIndex + 1);
      entry.attachment.layer = "below";
    });
  });
  return normalized;
}

async function bindFrameAudioFile(file, index = selectedFrame, group = currentGroup) {
  if (!file || !group) return false;
  const frameIndex = clampFrameIndex(index, group);
  await setFrameAudioBinding(file, frameIndex, group);
  markDirty();
  await syncFrameAudioBindingsToGame().catch((error) => {
    status(t("boxSyncFailed", { message: error.message }));
  });
  clearSelectedAttachment();
  if (els.frameAudioFile) els.frameAudioFile.value = "";
  if (group.uiId === currentGroup?.uiId) {
    setSingleFrameSelection(frameIndex, currentGroup);
    syncFrameInputs();
  } else {
    syncFrameAudioInputs();
  }
  renderFilmstrip();
  draw();
  status(t("boundFrameSfx", { name: file.name }));
  return true;
}

async function removeFrameAudioFromCard(index = selectedFrame, group = currentGroup) {
  if (!group) return false;
  const frameIndex = clampFrameIndex(index, group);
  if (!frameAudioBinding(frameIndex, group)) return false;
  if (!window.confirm(t("frameSfxDeleteConfirm"))) return false;
  await clearFrameAudioBinding(frameIndex, group);
  markDirty();
  await syncFrameAudioBindingsToGame().catch((error) => {
    status(t("frameSfxDeleteFailed", { message: error.message }));
  });
  syncFrameAudioInputs();
  renderFilmstrip();
  draw();
  status(t("frameSfxDeleted"));
  return true;
}

function isTypingTarget(event) {
  const target = event.target;
  if (!target) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

function isNumberInputTarget(event) {
  const target = event.target;
  return target instanceof HTMLInputElement && target.type === "number";
}

function trackAttachmentTransformKey(event, pressed) {
  const key = String(event.key || "").toLowerCase();
  if (key !== "r" && key !== "z") return false;
  if (pressed && isTypingTarget(event)) return false;
  if (pressed) heldAttachmentTransformKeys.add(key);
  else heldAttachmentTransformKeys.delete(key);
  return true;
}

function initPanelState() {
  document.querySelectorAll(".panel[data-panel]").forEach((panel) => {
    const key = `animationTuner.panel.${panel.dataset.panel}`;
    const saved = localStorage.getItem(key);
    if (saved) panel.open = saved === "open";
    panel.addEventListener("toggle", () => {
      localStorage.setItem(key, panel.open ? "open" : "closed");
    });
  });
}

initPanelState();

els.frameScale.addEventListener("input", syncFrameAxisScaleToUniform);
for (const input of [els.frameScale, els.frameScaleX, els.frameScaleY, els.frameX, els.frameY, els.frameRotation]) {
  armInputUndo(input, "frame input");
  input.addEventListener("input", updateSelectedFromInputs);
}
armInputUndo(els.frameDuration, "frame duration");
els.frameDuration.addEventListener("input", updateSelectedPlaybackFromInputs);
if (els.groupTimeMs) {
  armInputUndo(els.groupTimeMs, "group time");
  els.groupTimeMs.addEventListener("input", applyGroupTimeFromInput);
  els.groupTimeMs.addEventListener("change", applyGroupTimeFromInput);
}
if (els.frameAudioFile) {
  els.frameAudioFile.addEventListener("change", async () => {
    const file = audioFileFromList(els.frameAudioFile.files);
    await bindFrameAudioFile(file);
  });
}
if (els.frameAudioDrop) {
  for (const eventName of ["dragenter", "dragover"]) {
    els.frameAudioDrop.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (!currentGroup) return;
      event.dataTransfer.dropEffect = "copy";
      els.frameAudioDrop.classList.add("dragOver");
    });
  }
  for (const eventName of ["dragleave", "dragend"]) {
    els.frameAudioDrop.addEventListener(eventName, () => {
      els.frameAudioDrop.classList.remove("dragOver");
    });
  }
  els.frameAudioDrop.addEventListener("drop", async (event) => {
    event.preventDefault();
    els.frameAudioDrop.classList.remove("dragOver");
    if (!currentGroup) return;
    const file = audioFileFromList(event.dataTransfer?.files);
    if (!file) {
      status(t("dropAudioFile"));
      return;
    }
    await bindFrameAudioFile(file);
  });
}
if (els.clearFrameAudio) {
  els.clearFrameAudio.addEventListener("click", async () => {
    await removeFrameAudioFromCard(selectedFrame, currentGroup);
  });
}
els.frameDisabled.addEventListener("change", () => {
  pushUndo("toggle frame");
  updateSelectedPlaybackFromInputs({ preserveDuration: groupHasGroupTimeOverride(), changeDuration: false });
});
els.frameReference.addEventListener("change", () => {
  setReferenceFrameEnabled(els.frameReference.checked);
});
for (const [mode, input] of [
  ["character", els.adjustCharacter],
  ["group", els.adjustGroup],
  ["frame", els.adjustFrame],
]) {
  input.addEventListener("change", () => {
    if (input.checked) {
      setAdjustmentMode(mode);
    } else {
      syncAdjustmentModeInputs();
    }
  });
}
els.baseScale.addEventListener("input", () => {
  syncBaseAxisScaleToUniform();
  updateAdjustmentFromInputs();
});

document.querySelectorAll(".numberStep").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    const input = document.querySelector(`#${button.dataset.stepTarget}`);
    stepAdjustmentInput(input, Number(button.dataset.stepDir || 0));
    input?.focus({ preventScroll: true });
  });
});

for (const input of adjustmentNumberInputs()) {
  armInputUndo(input, "base input");
  input.addEventListener("focus", () => {
    if (selectedFrameAttachment()) {
      baseEditSnapshot = null;
      boxEditSnapshot = null;
      return;
    }
    boxEditSnapshot = createBoxEditSnapshot(adjustmentMode);
    if (adjustmentMode === "group") {
      baseEditSnapshot = {
        groupUiId: currentGroup?.uiId,
        base: structuredClone(baseTransform()),
        overrides: structuredClone(overrideStore()),
      };
    }
  });
  input.addEventListener("blur", () => {
    baseEditSnapshot = null;
    boxEditSnapshot = null;
  });
  input.addEventListener("change", () => {
    baseEditSnapshot = null;
    boxEditSnapshot = null;
  });
  input.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey) return;
    if ((input === els.baseX || input === els.baseY) && stepOffsetByArrowKey(event.key, event.shiftKey ? 10 : 1)) {
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      stepAdjustmentInput(input, 1, event.shiftKey ? 10 : 1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      stepAdjustmentInput(input, -1, event.shiftKey ? 10 : 1);
      return;
    }
    if (event.key === "PageUp") {
      event.preventDefault();
      stepAdjustmentInput(input, 1, 10);
      return;
    }
    if (event.key === "PageDown") {
      event.preventDefault();
      stepAdjustmentInput(input, -1, 10);
      return;
    }
    if (["Tab", "Escape", "Enter"].includes(event.key)) return;
    event.preventDefault();
  });
  input.addEventListener("paste", (event) => event.preventDefault());
  input.addEventListener("drop", (event) => event.preventDefault());
  if (input !== els.baseScale) input.addEventListener("input", updateAdjustmentFromInputs);
}

els.showBoxes.addEventListener("change", () => {
  showBoxes = els.showBoxes.checked;
  if (!showBoxes) boxOnlyMode = false;
  saveBoxViewPrefs();
  syncBoxInputs();
  draw();
});

if (els.boxOnlyMode) {
  els.boxOnlyMode.addEventListener("change", () => {
    boxOnlyMode = false;
    saveBoxViewPrefs();
    syncBoxInputs();
    draw();
  });
}

for (const input of els.boxChoiceInputs) {
  input.addEventListener("change", () => {
    const boxName = input.dataset.boxChoice;
    if (!canEditBox(boxName)) return;
    if (input.checked) {
      selectedBoxes.add(boxName);
      selectedBox = boxName;
      showBoxes = true;
    } else {
      selectedBoxes.delete(boxName);
      if (selectedBox === boxName) selectedBox = firstEditableSelectedBox();
    }
    saveBoxViewPrefs();
    syncBoxInputs();
    draw();
  });
}

for (const input of [els.boxX, els.boxY, els.boxW, els.boxH, els.boxRotation].filter(Boolean)) {
  armInputUndo(input, "box input");
  input.addEventListener("input", updateSelectedBoxFromInputs);
}

if (els.boxEnabled) {
  els.boxEnabled.addEventListener("change", () => {
    pushUndo("toggle box");
    updateSelectedBoxFromInputs();
    syncBoxInputs();
  });
}

if (els.clearBox) {
  els.clearBox.addEventListener("click", () => {
    if (!selectedBox) return;
    pushUndo("clear box");
    for (const frameIndex of selectedFrameIndexes()) {
      clearBoxOverride(selectedBox, frameIndex);
    }
    syncBoxInputs();
    draw();
  });
}

if (els.deleteBox) {
  els.deleteBox.addEventListener("click", () => {
    if (!selectedBox) return;
    pushUndo("delete box");
    for (const frameIndex of selectedFrameIndexes()) {
      deleteBoxOnFrame(selectedBox, frameIndex);
    }
    syncBoxInputs();
    draw();
  });
}

els.applyBaseToFrame.addEventListener("click", () => {
  if (!canEditFrameTransform()) return;
  pushUndo("copy base to frame");
  const base = baseTransform();
  for (const frameIndex of selectedFrameIndexes()) {
    setFrameTransform(frameIndex, base);
  }
  syncFrameInputs();
  renderFilmstrip();
  draw();
});

if (els.undo) els.undo.addEventListener("click", undo);
if (els.undoTop) els.undoTop.addEventListener("click", undo);
if (els.redoTop) els.redoTop.addEventListener("click", redo);

if (els.clearFrame) {
  els.clearFrame.addEventListener("click", () => {
    if (!canEditFrameTransform() && !canEditFramePlayback()) return;
    pushUndo("clear frame");
    for (const frameIndex of selectedFrameIndexes()) {
      delete overrideStore()[tuningFrameKey(frameIndex, currentGroup)];
      delete playbackStore()[tuningFrameKey(frameIndex, currentGroup)];
    }
    markDirty();
    syncFrameInputs();
    renderFilmstrip();
    draw();
  });
}

if (els.clearGroup) {
  els.clearGroup.addEventListener("click", () => {
    if (!canEditFrameTransform() && !canEditFramePlayback()) return;
    pushUndo("clear group overrides");
    const store = overrideStore();
    for (const key of Object.keys(store)) {
      if (groupOwnsFrameKey(currentGroup, key)) delete store[key];
    }
    const playback = playbackStore();
    for (const key of Object.keys(playback)) {
      if (groupOwnsFrameKey(currentGroup, key)) delete playback[key];
    }
    markDirty();
    syncFrameInputs();
    renderFilmstrip();
    draw();
  });
}

if (els.playPause) {
  els.playPause.addEventListener("click", () => {
    clearSelectedAttachment();
    playing = !playing;
    if (playing) {
      playbackPrimaryGroup = currentGroup;
      playbackSecondaryGroup = playbackChainGroup();
      if (playbackSecondaryGroup?.uiId === playbackPrimaryGroup.uiId) playbackSecondaryGroup = null;
      setSingleFrameSelection(framePlayback(selectedFrame).disabled ? firstPlayableFrame(currentGroup) : selectedFrame, currentGroup);
      lastPlay = 0;
      playFrameAudio(selectedFrame, currentGroup);
    } else {
      playbackPrimaryGroup = null;
      playbackSecondaryGroup = null;
    }
    els.playPause.textContent = playing ? t("pause") : t("play");
    syncFrameInputs();
    renderFilmstrip();
    draw();
  });
}

if (els.ghostToggle) {
  els.ghostToggle.addEventListener("click", () => {
    ghost = !ghost;
    els.ghostToggle.classList.toggle("active", ghost);
    draw();
  });
}

els.resetView.addEventListener("click", () => { fitView(); draw(); });
els.save.addEventListener("click", () => save().catch((error) => status(t("saveFailed", { message: error.message }))));
if (els.fps) {
  armInputUndo(els.fps, "group fps");
  els.fps.addEventListener("input", updateGroupPlaybackFromInputs);
}
for (const input of [els.vfxStartFrame, els.vfxEndFrame].filter(Boolean)) {
  armInputUndo(input, "vfx action frame window");
  input.addEventListener("input", updateGroupPlaybackFromInputs);
}
for (const input of [els.rootMotionX, els.rootMotionY].filter(Boolean)) {
  armInputUndo(input, "group root motion");
  input.addEventListener("input", updateGroupPlaybackFromInputs);
}

els.stage.addEventListener("pointerdown", (event) => {
  pointerStagePoint = stagePoint(event);
  updateCoordHud();
  const beginDrag = (nextDrag) => {
    els.stage.setPointerCapture(event.pointerId);
    els.stage.classList.add("dragging");
    drag = nextDrag;
  };
  const boxHit = hitTestBoxes(event);
  if (boxHit) {
    selectedBox = boxHit.boxName;
    selectedBoxes.add(selectedBox);
    showBoxes = true;
    if (boxHit.mode === "box-alt-block") {
      syncBoxInputs();
      draw();
      return;
    }
    pushUndo(boxHit.mode === "box-resize" ? "resize box" : "drag box");
    const box = frameBox(selectedBox);
    beginDrag({
      mode: boxHit.mode,
      handle: boxHit.handle,
      x: event.clientX,
      y: event.clientY,
      boxName: selectedBox,
      offset: cloneVector(box.offset),
      size: cloneVector(box.size),
      rotation: Number(box.rotation || 0),
      enabled: box.enabled !== false,
      boxes: selectedFrameIndexes().map((frameIndex) => ({
        index: frameIndex,
        box: structuredClone(frameBox(selectedBox, frameIndex)),
      })),
    });
    syncBoxInputs();
    draw();
    return;
  }
  const attachment = hitTestDirectManipulationAttachment(event);
  if (attachment) {
    const frameIndex = attachmentFrameIndex(attachment, currentGroup);
    activateFrameAttachmentForEditing(attachment);
    pushUndo("drag attached image");
    beginDrag({
      mode: "attachment",
      x: event.clientX,
      y: event.clientY,
      attachmentId: attachment.id,
      frameIndex,
      transform: structuredClone(normalizeAttachmentTransform(attachment.transform)),
    });
    draw();
    return;
  }
  beginDrag({ mode: "pan", x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y });
});

els.stage.addEventListener("pointermove", (event) => {
  pointerStagePoint = stagePoint(event);
  if (!drag) {
    updateCoordHud();
    return;
  }
  if (drag.mode === "pan") {
    view.x = drag.viewX + (event.clientX - drag.x) * devicePixelRatio;
    view.y = drag.viewY + (event.clientY - drag.y) * devicePixelRatio;
    draw();
    return;
  }
  const dx = (event.clientX - drag.x) / view.zoom;
  const dy = (event.clientY - drag.y) / view.zoom;
  if (drag.mode === "box-move") {
    for (const entry of drag.boxes || []) {
      const collision = isCollisionBox(drag.boxName);
      const localDelta = boxOffsetDeltaFromScreenDelta({ x: dx, y: dy }, entry.index);
      setBoxOverride(drag.boxName, {
        offset: {
          x: entry.box.offset.x + localDelta.x,
          y: collision ? collisionOffsetYForHeight(entry.box.size.y) : entry.box.offset.y + localDelta.y,
        },
        size: entry.box.size,
        rotation: collision ? 0 : entry.box.rotation,
        enabled: entry.box.enabled,
      }, entry.index);
    }
    syncBoxInputs();
    draw();
    return;
  }
  if (drag.mode === "box-resize") {
    const minSize = 4;
    for (const entry of drag.boxes || []) {
      if (isCollisionBox(drag.boxName)) {
        const localDelta = boxOffsetDeltaFromScreenDelta({ x: dx, y: dy }, entry.index);
        let left = -entry.box.size.x / 2;
        let right = entry.box.size.x / 2;
        if (drag.handle.includes("w")) left += localDelta.x;
        if (drag.handle.includes("e")) right += localDelta.x;
        if (right - left < minSize) {
          if (drag.handle.includes("w")) left = right - minSize;
          else right = left + minSize;
        }
        const width = right - left;
        const heightDelta = drag.handle.includes("n") ? -localDelta.y : 0;
        const height = Math.max(minSize, entry.box.size.y + heightDelta);
        setBoxOverride(drag.boxName, {
          offset: {
            x: entry.box.offset.x + (left + right) / 2,
            y: collisionOffsetYForHeight(height),
          },
          size: { x: width, y: height },
          rotation: 0,
          enabled: entry.box.enabled,
        }, entry.index);
        continue;
      }
      const rotation = (Number(entry.box.rotation || 0) * Math.PI) / 180;
      const localDelta = boxResizeDeltaFromScreenDelta({ x: dx, y: dy }, entry.box.rotation, entry.index);
      let left = -entry.box.size.x / 2;
      let right = entry.box.size.x / 2;
      let top = -entry.box.size.y / 2;
      let bottom = entry.box.size.y / 2;
      if (drag.handle.includes("w")) left += localDelta.x;
      if (drag.handle.includes("e")) right += localDelta.x;
      if (drag.handle.includes("n")) top += localDelta.y;
      if (drag.handle.includes("s")) bottom += localDelta.y;
      if (right - left < minSize) {
        if (drag.handle.includes("w")) left = right - minSize;
        else right = left + minSize;
      }
      if (bottom - top < minSize) {
        if (drag.handle.includes("n")) top = bottom - minSize;
        else bottom = top + minSize;
      }
      const localCenter = { x: (left + right) / 2, y: (top + bottom) / 2 };
      const worldCenter = rotateVector(localCenter, rotation);
      setBoxOverride(drag.boxName, {
        offset: { x: entry.box.offset.x + worldCenter.x, y: entry.box.offset.y + worldCenter.y },
        size: { x: right - left, y: bottom - top },
        rotation: entry.box.rotation,
        enabled: entry.box.enabled,
      }, entry.index);
    }
    syncBoxInputs();
    draw();
    return;
  }
  if (drag.mode === "attachment") {
    const attachment = frameImageAttachments.find((entry) => entry.id === drag.attachmentId);
    if (!attachment) return;
    const localDelta = attachmentOffsetDeltaFromClientDelta(
      event.clientX - drag.x,
      event.clientY - drag.y,
      attachment
    );
    attachment.transform = normalizeAttachmentTransform({
      ...drag.transform,
      offset: {
        x: drag.transform.offset.x + localDelta.x,
        y: drag.transform.offset.y + localDelta.y,
      },
    });
    markDirty();
    syncAdjustmentInputs();
    renderFilmstrip();
    draw();
    return;
  }
  drag = null;
  els.stage.classList.remove("dragging");
  updateCoordHud();
});

els.stage.addEventListener("pointerup", () => {
  drag = null;
  els.stage.classList.remove("dragging");
  updateCoordHud();
});

els.stage.addEventListener("pointercancel", () => {
  drag = null;
  pointerStagePoint = null;
  els.stage.classList.remove("dragging");
  updateCoordHud();
});

els.stage.addEventListener("lostpointercapture", () => {
  drag = null;
  els.stage.classList.remove("dragging");
  updateCoordHud();
});

els.stage.addEventListener("pointerleave", () => {
  if (drag) return;
  pointerStagePoint = null;
  updateCoordHud();
});

els.stage.addEventListener("wheel", (event) => {
  event.preventDefault();
  pointerStagePoint = stagePoint(event);
  if (applySelectedAttachmentWheel(event)) return;
  zoomViewAt(event);
}, { passive: false });

window.addEventListener("keydown", (event) => {
  const command = event.ctrlKey || event.metaKey;
  if (command && event.key.toLowerCase() === "s") {
    event.preventDefault();
    save().catch((error) => status(t("saveFailed", { message: error.message })));
    return;
  }
  if (command && event.key.toLowerCase() === "c" && copyFrameImageAttachments()) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (command && event.key.toLowerCase() === "v" && pasteFrameImageAttachments()) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const typing = isTypingTarget(event);
  const trackingAttachmentKey = (!typing || isNumberInputTarget(event)) && trackAttachmentTransformKey(event, true);
  if (trackingAttachmentKey && isNumberInputTarget(event)) event.preventDefault();
  if (referenceFrame && !command && !event.altKey && !event.isComposing && event.key.toLowerCase() === "h") {
    if (!typing || isNumberInputTarget(event)) {
      event.preventDefault();
      event.stopPropagation();
      if (!referenceFrameHiddenByKey) {
        referenceFrameHiddenByKey = true;
        draw();
      }
      return;
    }
  }
  if (typing) return;
  if (event.key === " " && els.playPause) {
    event.preventDefault();
    els.playPause.click();
  }
});

window.addEventListener("keyup", (event) => {
  trackAttachmentTransformKey(event, false);
  if (event.key.toLowerCase() !== "h") return;
  if (!referenceFrameHiddenByKey) return;
  referenceFrameHiddenByKey = false;
  draw();
});

window.addEventListener("blur", () => {
  heldAttachmentTransformKeys.clear();
  if (!referenceFrameHiddenByKey) return;
  referenceFrameHiddenByKey = false;
  draw();
});

window.addEventListener("beforeunload", (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

window.addEventListener("resize", resizeCanvas);
requestAnimationFrame(animate);
applyUiTheme();
applyCanvasColor();
applyLanguage();
loadConfig().then(resizeCanvas).catch((error) => status(t("loadFailed", { message: error.message })));
