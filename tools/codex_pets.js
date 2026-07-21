const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const CODEX_PETS_PROJECT_ID = "codex_pets";
const CODEX_PETS_PROJECT_LABEL = "Codex 宠物";
const ATLAS_WIDTH = 1536;
const ATLAS_HEIGHT = 1872;
const ATLAS_HEIGHT_V2 = 2288;
const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;

const PET_STATES = [
  { id: "idle", row: 0, durations: [280, 110, 110, 140, 140, 320] },
  { id: "running-right", row: 1, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  { id: "running-left", row: 2, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  { id: "waving", row: 3, durations: [140, 140, 140, 280] },
  { id: "jumping", row: 4, durations: [140, 140, 140, 140, 280] },
  { id: "failed", row: 5, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
  { id: "waiting", row: 6, durations: [150, 150, 150, 150, 150, 260] },
  { id: "running", row: 7, durations: [120, 120, 120, 120, 120, 220] },
  { id: "review", row: 8, durations: [150, 150, 150, 150, 150, 280] },
];
const LOOK_DIRECTIONS = [
  "up", "up-right-1", "up-right-2", "right", "down-right-1", "down-right-2", "down", "down-left-1",
  "down-left-2", "left", "up-left-1", "up-left-2", "up-left-3", "up-left-4", "up-left-5", "up-left-6",
];

const BUILTIN_PETS = {
  codex: { displayName: "Codex", description: "The original Codex companion." },
  dewey: { displayName: "Dewey", description: "A calm companion for focused workspace days" },
  fireball: { displayName: "Fireball", description: "Hot path energy for fast iteration." },
  hoots: { displayName: "Hoots", description: "A sharp-eyed owl for polished work in a blink." },
  rocky: { displayName: "Rocky", description: "A steady rock when the diff gets large." },
  seedy: { displayName: "Seedy", description: "Small green shoots for new ideas." },
  stacky: { displayName: "Stacky", description: "A balanced stack for deep work." },
  bsod: { displayName: "BSOD", description: "A tiny blue-screen gremlin." },
  "null-signal": { displayName: "Null Signal", description: "Quiet signal from the void." },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function codexHome() {
  return path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"));
}

function codexPetRoot() {
  return path.join(codexHome(), "pets");
}

function ensureCodexPetsProject(projectStore) {
  const registry = projectStore.readRegistry();
  const petRoot = codexPetRoot();
  fs.mkdirSync(petRoot, { recursive: true });
  const existing = registry.projects.find((project) => project.id === CODEX_PETS_PROJECT_ID);
  if (existing) {
    const nextRoot = path.resolve(petRoot);
    if (existing.kind !== "codex_pets" || existing.petRoot !== nextRoot || existing.projectRoot !== nextRoot) {
      existing.kind = "codex_pets";
      existing.label = existing.label || CODEX_PETS_PROJECT_LABEL;
      existing.petRoot = nextRoot;
      existing.projectRoot = nextRoot;
      return projectStore.writeRegistry(registry);
    }
    return registry;
  }
  registry.projects.push({
    id: CODEX_PETS_PROJECT_ID,
    label: CODEX_PETS_PROJECT_LABEL,
    kind: "codex_pets",
    projectRoot: path.resolve(petRoot),
    petRoot: path.resolve(petRoot),
    dataDir: `data/projects/${CODEX_PETS_PROJECT_ID}`,
    workspaceDir: `workspace/projects/${CODEX_PETS_PROJECT_ID}`,
  });
  if (!registry.activeProjectId) registry.activeProjectId = CODEX_PETS_PROJECT_ID;
  return projectStore.writeRegistry(registry);
}

function readAsarHeader(asarPath) {
  const fd = fs.openSync(asarPath, "r");
  try {
    const prefix = Buffer.alloc(16);
    fs.readSync(fd, prefix, 0, prefix.length, 0);
    const headerStringSize = prefix.readUInt32LE(12);
    const headerBuffer = Buffer.alloc(headerStringSize);
    fs.readSync(fd, headerBuffer, 0, headerStringSize, 16);
    return {
      header: JSON.parse(headerBuffer.toString("utf8")),
      dataOffset: 8 + prefix.readUInt32LE(4),
    };
  } finally {
    fs.closeSync(fd);
  }
}

function walkAsar(node, base = "", result = []) {
  for (const [name, entry] of Object.entries(node?.files || {})) {
    const entryPath = `${base}/${name}`;
    if (entry?.files) walkAsar(entry, entryPath, result);
    else result.push({ path: entryPath, ...entry });
  }
  return result;
}

function windowsAsarCandidates() {
  if (process.platform !== "win32") return [];
  const roots = [
    path.join(process.env.ProgramFiles || "C:\\Program Files", "WindowsApps"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Codex", "resources"),
  ];
  const candidates = [];
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    if (path.basename(root).toLowerCase() === "resources") {
      candidates.push(path.join(root, "app.asar"));
      continue;
    }
    let names = [];
    try {
      names = fs.readdirSync(root);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!/^OpenAI\.Codex_/i.test(name)) continue;
      candidates.push(path.join(root, name, "app", "resources", "app.asar"));
    }
  }
  try {
    const script = [
      "$result=@()",
      "$pkg=Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue | Sort-Object Version -Descending",
      "foreach($item in $pkg){$result+=(Join-Path $item.InstallLocation 'app\\resources\\app.asar')}",
      "$proc=Get-Process -Name codex -ErrorAction SilentlyContinue | Select-Object -First 1",
      "if($proc -and $proc.Path){$result+=(Join-Path (Split-Path $proc.Path -Parent) 'app.asar')}",
      "$result | Select-Object -Unique",
    ].join("; ");
    const output = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
      windowsHide: true,
    });
    candidates.push(...String(output).split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  } catch {
    // Codex may be installed outside Appx, or PowerShell may be unavailable.
  }
  return candidates;
}

function findCodexAsar() {
  const candidates = [
    process.env.CODEX_APP_ASAR || "",
    process.resourcesPath ? path.join(process.resourcesPath, "app.asar") : "",
    "/Applications/Codex.app/Contents/Resources/app.asar",
    ...windowsAsarCandidates(),
  ].filter((candidate) => candidate && fs.existsSync(candidate));
  return candidates
    .map((candidate) => ({ candidate, mtimeMs: fs.statSync(candidate).mtimeMs }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.candidate || "";
}

function builtinIdFromAssetName(fileName) {
  const match = /^(.+)-spritesheet-v\d+-[^/]+\.webp$/i.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

function titleFromId(id) {
  return String(id || "Pet").split(/[-_]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function extractBuiltinPets(asarPath, outputDir, previous = {}) {
  if (!asarPath) return [];
  const { header, dataOffset } = readAsarHeader(asarPath);
  const entries = walkAsar(header)
    .filter((entry) => /\/webview\/assets\/[^/]+-spritesheet-v\d+-[^/]+\.webp$/i.test(entry.path));
  const fd = fs.openSync(asarPath, "r");
  const pets = [];
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    for (const entry of entries) {
      const assetName = path.posix.basename(entry.path);
      const id = builtinIdFromAssetName(assetName);
      if (!id) continue;
      const destination = path.join(outputDir, `${id}.webp`);
      const previousPet = previous[id] || {};
      const current = fs.existsSync(destination) && fs.statSync(destination).size === Number(entry.size || 0)
        && previousPet.sourceAsset === assetName;
      if (!current) {
        const buffer = Buffer.alloc(Number(entry.size || 0));
        fs.readSync(fd, buffer, 0, buffer.length, dataOffset + Number(entry.offset || 0));
        const temp = `${destination}.tmp`;
        fs.writeFileSync(temp, buffer);
        fs.renameSync(temp, destination);
      }
      const metadata = BUILTIN_PETS[id] || { displayName: titleFromId(id), description: "Built-in Codex companion." };
      pets.push({
        id,
        profileId: id,
        displayName: metadata.displayName,
        description: metadata.description,
        kind: "builtin",
        writable: false,
        spritesheetPath: destination,
        sourceAsset: assetName,
        sourceDirectory: "",
      });
    }
  } finally {
    fs.closeSync(fd);
  }
  return pets;
}

function safePetSpritePath(petDir, requested) {
  const fullPath = path.resolve(petDir, String(requested || "spritesheet.webp"));
  const relative = path.relative(petDir, fullPath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? fullPath : "";
}

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return clone(fallback);
  }
}

function discoverCustomPets(petRoot, outputDir, previous = {}) {
  if (!fs.existsSync(petRoot)) return [];
  fs.mkdirSync(outputDir, { recursive: true });
  const pets = [];
  for (const entry of fs.readdirSync(petRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const petDir = path.join(petRoot, entry.name);
    const manifestPath = path.join(petDir, "pet.json");
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath, {});
    const id = String(manifest.id || entry.name).trim() || entry.name;
    const source = safePetSpritePath(petDir, manifest.spritesheetPath || "spritesheet.webp");
    if (!source || !fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
    const cacheName = `${id.replace(/[^A-Za-z0-9._-]+/g, "_") || entry.name}.webp`;
    const destination = path.join(outputDir, cacheName);
    const sourceStat = fs.statSync(source);
    const previousPet = previous[`custom:${id}`] || {};
    const current = fs.existsSync(destination)
      && fs.statSync(destination).size === sourceStat.size
      && Number(previousPet.sourceMtimeMs || 0) === sourceStat.mtimeMs;
    if (!current) fs.copyFileSync(source, destination);
    pets.push({
      id,
      profileId: `custom:${id}`,
      displayName: String(manifest.displayName || id),
      description: String(manifest.description || "Custom Codex companion."),
      kind: "custom",
      writable: true,
      spritesheetPath: destination,
      installedSpritesheetPath: source,
      sourceDirectory: petDir,
      sourceMtimeMs: sourceStat.mtimeMs,
    });
  }
  return pets.sort((left, right) => left.displayName.localeCompare(right.displayName));
}

function relativeToRoot(root, filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function petProfile(root, pet) {
  const atlasPath = relativeToRoot(root, pet.spritesheetPath);
  const stat = fs.statSync(pet.spritesheetPath);
  const atlasSize = parseWebpSize(fs.readFileSync(pet.spritesheetPath));
  const spriteVersionNumber = atlasSize.height === ATLAS_HEIGHT_V2 ? 2 : 1;
  const animations = PET_STATES.map((state) => ({
    id: state.id,
    name: state.id,
    type: "pet",
    anchorMode: "canvas_bottom_center",
    fps: 1000,
    source: atlasPath,
    supports: ["character_transform", "group_transform", "frame_transform", "reference_frame"],
    frames: state.durations.map((duration, column) => ({
      id: `${state.id}_${String(column + 1).padStart(2, "0")}`,
      name: `${state.id} ${column + 1}`,
      path: atlasPath,
      width: CELL_WIDTH,
      height: CELL_HEIGHT,
      duration,
      crop: {
        x: column * CELL_WIDTH,
        y: state.row * CELL_HEIGHT,
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
        sheetWidth: ATLAS_WIDTH,
        sheetHeight: atlasSize.height || ATLAS_HEIGHT,
      },
      assetVersion: `${stat.size}-${Math.floor(stat.mtimeMs)}`,
    })),
  }));
  if (spriteVersionNumber === 2) {
    animations.push({
      id: "looking",
      name: "looking",
      type: "pet",
      anchorMode: "canvas_bottom_center",
      fps: 8,
      source: atlasPath,
      supports: ["character_transform", "group_transform", "frame_transform", "reference_frame"],
      frames: LOOK_DIRECTIONS.map((direction, index) => ({
        id: `looking_${String(index).padStart(2, "0")}`,
        name: direction,
        path: atlasPath,
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
        duration: 1,
        crop: {
          x: (index % 8) * CELL_WIDTH,
          y: (9 + Math.floor(index / 8)) * CELL_HEIGHT,
          width: CELL_WIDTH,
          height: CELL_HEIGHT,
          sheetWidth: ATLAS_WIDTH,
          sheetHeight: ATLAS_HEIGHT_V2,
        },
        assetVersion: `${stat.size}-${Math.floor(stat.mtimeMs)}`,
      })),
    });
  }
  return {
    id: pet.profileId,
    label: pet.kind === "custom" ? `${pet.displayName} · 自定义` : `${pet.displayName} · 内置`,
    kind: "pet",
    bodyScale: 1,
    runtimeScale: 1,
    supports: ["character_transform", "group_transform", "frame_transform", "reference_frame"],
    pet: {
      id: pet.id,
      displayName: pet.displayName,
      description: pet.description,
      kind: pet.kind,
      writable: pet.writable,
      sourceDirectory: pet.sourceDirectory,
      spriteVersionNumber,
      atlasWidth: atlasSize.width,
      atlasHeight: atlasSize.height,
    },
    animations,
  };
}

function syncCodexPetProject(root, projectStore, project) {
  if (!project || project.kind !== "codex_pets") return { pets: [], warnings: [] };
  const paths = projectStore.projectPaths(project);
  const workspaceDir = projectStore.projectWorkspaceDir(project);
  const catalogPath = path.join(paths.dataDir, "codex_pets_catalog.json");
  const previousCatalog = readJson(catalogPath, { pets: [] });
  const previousById = Object.fromEntries((previousCatalog.pets || []).map((pet) => [pet.profileId, pet]));
  const asarPath = findCodexAsar();
  const builtins = asarPath
    ? extractBuiltinPets(asarPath, path.join(workspaceDir, "spritesheets", "builtin"), previousById)
    : [];
  const custom = discoverCustomPets(project.petRoot || codexPetRoot(), path.join(workspaceDir, "spritesheets", "custom"), previousById);
  const pets = [...builtins, ...custom];
  const manifest = {
    schemaVersion: 1,
    projectKind: "codex_pets",
    profiles: pets.map((pet) => petProfile(root, pet)),
  };
  projectStore.writeJson(paths.manifest, manifest);
  projectStore.writeJson(catalogPath, {
    schemaVersion: 1,
    asarPath,
    petRoot: project.petRoot || codexPetRoot(),
    pets: pets.map((pet) => ({
      id: pet.id,
      profileId: pet.profileId,
      displayName: pet.displayName,
      description: pet.description,
      kind: pet.kind,
      writable: pet.writable,
      spritesheetPath: pet.spritesheetPath,
      installedSpritesheetPath: pet.installedSpritesheetPath || "",
      sourceDirectory: pet.sourceDirectory,
      sourceAsset: pet.sourceAsset || "",
      sourceMtimeMs: pet.sourceMtimeMs || 0,
    })),
  });
  const warnings = [];
  if (!asarPath) warnings.push("未找到 Codex 应用资源；自定义宠物仍可使用，但内置宠物暂不可见。");
  if (asarPath && !builtins.length) warnings.push("找到了 Codex 应用，但没有识别到内置宠物图集。");
  return { pets, warnings, asarPath, petRoot: project.petRoot || codexPetRoot() };
}

function parseWebpSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return { width: 0, height: 0 };
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === "VP8X" && data + 10 <= buffer.length) {
      return {
        width: 1 + buffer.readUIntLE(data + 4, 3),
        height: 1 + buffer.readUIntLE(data + 7, 3),
      };
    }
    if (type === "VP8 " && data + 13 <= buffer.length && buffer[data + 6] === 0x9d && buffer[data + 7] === 0x01 && buffer[data + 8] === 0x2a) {
      return {
        width: buffer.readUInt16LE(data + 9) & 0x3fff,
        height: buffer.readUInt16LE(data + 11) & 0x3fff,
      };
    }
    if (type === "VP8L" && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      const b1 = buffer[data + 1];
      const b2 = buffer[data + 2];
      const b3 = buffer[data + 3];
      const b4 = buffer[data + 4];
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
      };
    }
    offset = data + size + (size % 2);
  }
  return { width: 0, height: 0 };
}

function decodeWebpDataUrl(dataUrl) {
  const match = /^data:image\/webp;base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || ""));
  if (!match) throw new Error("Expected a WebP data URL.");
  const buffer = Buffer.from(match[1], "base64");
  const size = parseWebpSize(buffer);
  if (size.width !== ATLAS_WIDTH || ![ATLAS_HEIGHT, ATLAS_HEIGHT_V2].includes(size.height)) {
    throw new Error(`Codex pet atlas must be ${ATLAS_WIDTH}x${ATLAS_HEIGHT} (v1) or ${ATLAS_WIDTH}x${ATLAS_HEIGHT_V2} (v2); received ${size.width}x${size.height}.`);
  }
  return buffer;
}

function petIdSlug(value, fallback = "pet") {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .toLowerCase();
  return slug || fallback;
}

function uniquePetId(petRoot, requested) {
  const base = petIdSlug(requested);
  let id = base;
  let suffix = 2;
  while (fs.existsSync(path.join(petRoot, id))) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function importCodexPet(project, payload) {
  if (!project || project.kind !== "codex_pets") throw new Error("The active project is not the Codex Pets project.");
  const buffer = decodeWebpDataUrl(payload.data);
  const petRoot = path.resolve(project.petRoot || codexPetRoot());
  fs.mkdirSync(petRoot, { recursive: true });
  const displayName = String(payload.displayName || payload.name || "New Pet").trim() || "New Pet";
  const id = uniquePetId(petRoot, payload.id || displayName);
  const petDir = path.join(petRoot, id);
  fs.mkdirSync(petDir, { recursive: false });
  const spritePath = path.join(petDir, "spritesheet.webp");
  fs.writeFileSync(spritePath, buffer);
  const manifest = {
    id,
    displayName,
    description: String(payload.description || "Custom Codex companion."),
    spritesheetPath: "spritesheet.webp",
    spriteVersionNumber: parseWebpSize(buffer).height === ATLAS_HEIGHT_V2 ? 2 : 1,
  };
  fs.writeFileSync(path.join(petDir, "pet.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { id, profileId: `custom:${id}`, petDir, spritePath };
}

function exportCodexPet(projectStore, project, payload) {
  if (!project || project.kind !== "codex_pets") throw new Error("The active project is not the Codex Pets project.");
  const profileId = String(payload.profileId || "");
  const catalogPath = path.join(projectStore.projectPaths(project).dataDir, "codex_pets_catalog.json");
  const catalog = readJson(catalogPath, { pets: [] });
  const pet = (catalog.pets || []).find((entry) => entry.profileId === profileId);
  if (!pet || !pet.writable || !pet.installedSpritesheetPath) throw new Error(`Codex pet is read-only or missing: ${profileId}`);
  const buffer = decodeWebpDataUrl(payload.data);
  const destination = path.resolve(pet.installedSpritesheetPath);
  const petDir = path.resolve(pet.sourceDirectory || path.dirname(destination));
  const relative = path.relative(petDir, destination);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Codex pet spritesheet path escaped its pet directory.");
  const backup = path.join(path.dirname(destination), "spritesheet.xsxb-backup.webp");
  if (fs.existsSync(destination) && !fs.existsSync(backup)) fs.copyFileSync(destination, backup);
  const temp = `${destination}.tmp`;
  fs.writeFileSync(temp, buffer);
  fs.renameSync(temp, destination);
  return { ok: true, profileId, destination, backup: fs.existsSync(backup) ? backup : "" };
}

function clearExportedPetTuning(projectStore, project, profileIds) {
  const ids = new Set((profileIds || []).map(String));
  if (!ids.size) return;
  const tuningPath = projectStore.projectPaths(project).tuning;
  const tuning = projectStore.readJson(tuningPath, {});
  const values = tuning.values && typeof tuning.values === "object" ? tuning.values : {};
  for (const key of Object.keys(values)) {
    if ([...ids].some((id) => key.startsWith(`profiles.${id}.`))) delete values[key];
  }
  for (const storeName of ["frame_visual_overrides", "frame_playback_overrides", "frame_box_overrides"]) {
    const store = tuning[storeName] && typeof tuning[storeName] === "object" ? tuning[storeName] : {};
    for (const key of Object.keys(store)) {
      if ([...ids].some((id) => key.startsWith(`${id}/`))) delete store[key];
    }
    tuning[storeName] = store;
  }
  tuning.values = values;
  projectStore.writeJson(tuningPath, tuning);
}

module.exports = {
  ATLAS_HEIGHT,
  ATLAS_HEIGHT_V2,
  ATLAS_WIDTH,
  CELL_HEIGHT,
  CELL_WIDTH,
  CODEX_PETS_PROJECT_ID,
  PET_STATES,
  clearExportedPetTuning,
  codexPetRoot,
  decodeWebpDataUrl,
  ensureCodexPetsProject,
  exportCodexPet,
  findCodexAsar,
  importCodexPet,
  parseWebpSize,
  syncCodexPetProject,
};
