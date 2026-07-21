(function initTimingModes(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.XsxbTimingModes = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function averageFrameTiming(totalDurationMs, playableFrameCount, baseFps, minFrameDurationMs = 1) {
    const count = Math.max(0, Math.trunc(Number(playableFrameCount) || 0));
    const totalMs = Number(totalDurationMs);
    const fps = Math.max(0.001, Number(baseFps) || 12);
    if (count <= 0 || !Number.isFinite(totalMs) || totalMs <= 0) return null;
    const durationMs = Math.max(minFrameDurationMs, totalMs / count);
    return {
      durationMs,
      multiplier: Math.max(0.001, (durationMs / 1000) * fps),
    };
  }

  function groupFpsForDuration(durationUnits, totalDurationMs, minFrameDurationMs = 1) {
    const units = Number(durationUnits);
    const totalMs = Math.max(minFrameDurationMs, Number(totalDurationMs) || minFrameDurationMs);
    if (!Number.isFinite(units) || units <= 0) return null;
    return units / (totalMs / 1000);
  }

  function frameSynchronousEffectSample(
    animationTimeSeconds,
    frameStartSeconds,
    frameDurationSeconds,
    baseFrameDurationSeconds,
    maxSubdivisions = 64,
  ) {
    const frameStart = Number(frameStartSeconds) || 0;
    const duration = Math.max(0.000001, Number(frameDurationSeconds) || 0.000001);
    const baseDuration = Math.max(0.000001, Number(baseFrameDurationSeconds) || duration);
    const subdivisionLimit = Math.max(1, Math.trunc(Number(maxSubdivisions) || 64));
    const subdivisions = Math.min(subdivisionLimit, Math.max(1, Math.round(duration / baseDuration)));
    const step = duration / subdivisions;
    const elapsedInFrame = Math.min(
      Math.max(0, (Number(animationTimeSeconds) || 0) - frameStart),
      Math.max(0, duration - Number.EPSILON),
    );
    const sampleIndex = Math.min(subdivisions - 1, Math.floor(elapsedInFrame / step));
    return {
      time: frameStart + (sampleIndex + 0.5) * step,
      sampleIndex,
      subdivisions,
      step,
    };
  }

  return { averageFrameTiming, groupFpsForDuration, frameSynchronousEffectSample };
});
