const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const OFFICIAL_REPOSITORY = "https://github.com/sparklecatta-lang/XSXB-Frame-Tuner.git";
const OFFICIAL_BRANCH = "main";
const SKILL_NAME = "xsxb-frame-tuner";

function runGit(root, args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: options.timeout ?? 20000,
  });
  if (result.error) {
    if (options.allowFailure) return { ok: false, status: result.status, output: "", error: result.error.message };
    throw result.error;
  }
  const output = String(result.stdout || "").trim();
  const error = String(result.stderr || "").trim();
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(error || output || `git ${args.join(" ")} failed with exit code ${result.status}`);
  }
  return { ok: result.status === 0, status: result.status, output, error };
}

function trustedRemote(remote) {
  const value = String(remote || "").trim();
  return /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)sparklecatta-lang\/XSXB-Frame-Tuner(?:\.git)?\/?$/i.test(value);
}

function candidateSkillTargets(env = process.env, home = os.homedir()) {
  const candidates = [];
  if (env.CODEX_HOME) candidates.push(path.join(env.CODEX_HOME, "skills", SKILL_NAME));
  const userHome = env.USERPROFILE || env.HOME || home;
  if (userHome) {
    candidates.push(path.join(userHome, ".codex", "skills", SKILL_NAME));
    candidates.push(path.join(userHome, ".agents", "skills", SKILL_NAME));
  }
  return [...new Set(candidates.map((entry) => path.resolve(entry)))];
}

function resolveSkillTarget(env = process.env, home = os.homedir()) {
  const candidates = candidateSkillTargets(env, home);
  const existing = candidates.find((entry) => fs.existsSync(entry));
  if (existing) return existing;
  if (!candidates.length) throw new Error("Cannot resolve the user skill directory.");
  return candidates[0];
}

function inspectLocalRepository(root) {
  const gitDir = path.join(root, ".git");
  if (!fs.existsSync(gitDir)) {
    return {
      supported: false,
      blockReason: "not_git_clone",
      currentCommit: "",
      branch: "",
      remote: "",
      remoteTrusted: false,
      trackedDirty: false,
      skillTarget: resolveSkillTarget(),
    };
  }
  const currentCommit = runGit(root, ["rev-parse", "HEAD"]).output;
  const branch = runGit(root, ["branch", "--show-current"]).output;
  const remote = runGit(root, ["remote", "get-url", "origin"], { allowFailure: true }).output;
  const trackedStatus = runGit(root, ["status", "--porcelain", "--untracked-files=no"]).output;
  return {
    supported: true,
    blockReason: "",
    currentCommit,
    branch,
    remote,
    remoteTrusted: trustedRemote(remote),
    trackedDirty: Boolean(trackedStatus),
    skillTarget: resolveSkillTarget(),
  };
}

function latestOfficialCommit() {
  const result = runGit(process.cwd(), ["ls-remote", OFFICIAL_REPOSITORY, `refs/heads/${OFFICIAL_BRANCH}`], { timeout: 15000 });
  const commit = String(result.output || "").split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error("GitHub did not return a valid main-branch commit.");
  return commit;
}

function updateBlockReason(local, updateAvailable) {
  if (!local.supported) return "not_git_clone";
  if (!local.remoteTrusted) return "untrusted_remote";
  if (local.branch !== OFFICIAL_BRANCH) return "wrong_branch";
  if (local.trackedDirty) return "tracked_changes";
  return updateAvailable ? "" : "up_to_date";
}

function checkForUpdates(root) {
  const local = inspectLocalRepository(root);
  if (!local.supported) {
    return {
      ...local,
      latestCommit: "",
      updateAvailable: false,
      canUpdate: false,
      checkedAt: new Date().toISOString(),
    };
  }
  const latestCommit = latestOfficialCommit();
  const updateAvailable = latestCommit !== local.currentCommit;
  const blockReason = updateBlockReason(local, updateAvailable);
  return {
    ...local,
    latestCommit,
    updateAvailable,
    canUpdate: updateAvailable && !blockReason,
    blockReason,
    checkedAt: new Date().toISOString(),
  };
}

function samePath(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, targetPath);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, targetPath);
    else throw new Error(`Unsupported bundled skill entry: ${sourcePath}`);
  }
}

function syncSkillDirectory(source, target) {
  if (!fs.existsSync(path.join(source, "SKILL.md"))) throw new Error(`Bundled skill is missing: ${source}`);
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
    const resolved = fs.realpathSync(target);
    if (samePath(resolved, source)) return { target, changed: false, mode: "linked" };
    throw new Error(`Refusing to replace a skill symlink that points outside this tuner: ${target}`);
  }

  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });
  const stamp = `${process.pid}-${Date.now()}`;
  const staging = path.join(parent, `.${SKILL_NAME}.update-${stamp}`);
  const backup = path.join(parent, `.${SKILL_NAME}.backup-${stamp}`);
  let movedExisting = false;
  try {
    copyDirectory(source, staging);
    if (fs.existsSync(target)) {
      fs.renameSync(target, backup);
      movedExisting = true;
    }
    fs.renameSync(staging, target);
    if (movedExisting) fs.rmSync(backup, { recursive: true, force: true });
    return { target, changed: true, mode: "copied" };
  } catch (error) {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
    if (movedExisting && !fs.existsSync(target) && fs.existsSync(backup)) fs.renameSync(backup, target);
    throw error;
  }
}

function performUpdate(root) {
  const before = inspectLocalRepository(root);
  const blockReason = updateBlockReason(before, true);
  if (blockReason) throw new Error(`Update blocked: ${blockReason}`);

  runGit(root, ["fetch", "--prune", "origin", OFFICIAL_BRANCH], { timeout: 120000 });
  const latestCommit = runGit(root, ["rev-parse", `origin/${OFFICIAL_BRANCH}`]).output;
  if (latestCommit !== before.currentCommit) {
    const ancestor = runGit(root, ["merge-base", "--is-ancestor", before.currentCommit, `origin/${OFFICIAL_BRANCH}`], { allowFailure: true });
    if (!ancestor.ok) throw new Error("Local main is not a fast-forward ancestor of origin/main.");
    runGit(root, ["merge", "--ff-only", `origin/${OFFICIAL_BRANCH}`], { timeout: 120000 });
  }

  const afterCommit = runGit(root, ["rev-parse", "HEAD"]).output;
  const skillSource = path.join(root, "skills", SKILL_NAME);
  const skillResult = syncSkillDirectory(skillSource, before.skillTarget);
  return {
    updated: afterCommit !== before.currentCommit,
    previousCommit: before.currentCommit,
    currentCommit: afterCommit,
    latestCommit,
    skill: skillResult,
    restartRequired: true,
  };
}

module.exports = {
  OFFICIAL_BRANCH,
  OFFICIAL_REPOSITORY,
  candidateSkillTargets,
  checkForUpdates,
  inspectLocalRepository,
  latestOfficialCommit,
  performUpdate,
  resolveSkillTarget,
  syncSkillDirectory,
  trustedRemote,
  updateBlockReason,
};
