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

  function liteExportSamples(playableFrames, maxPhaseDurationMs = 80, exportEndMs = null, includeTerminal = false) {
    const phaseDurationMs = Math.min(1000, Math.max(1, Number(maxPhaseDurationMs) || 80));
    const phaseCountForDuration = (durationMs) => Math.max(1, Math.ceil(durationMs / phaseDurationMs - 1e-9));
    const frames = Array.isArray(playableFrames) ? playableFrames : [];
    const samples = [];
    let elapsedMs = 0;
    for (const frame of frames) {
      const durationMs = Math.max(0.001, Number(frame?.durationMs) || 0.001);
      const sampleCount = phaseCountForDuration(durationMs);
      const outputDurationMs = durationMs / sampleCount;
      for (let phaseIndex = 0; phaseIndex < sampleCount; phaseIndex += 1) {
        const phase = (phaseIndex + 0.5) / sampleCount;
        samples.push({
          timeMs: elapsedMs + phase * durationMs,
          frameIndex: Math.max(0, Math.trunc(Number(frame?.frameIndex) || 0)),
          durationMs: outputDurationMs,
          phase,
          reason: "frame_duration",
        });
      }
      elapsedMs += durationMs;
    }
    const requestedEndMs = Math.max(elapsedMs, Number(exportEndMs) || elapsedMs);
    const terminalDurationMs = requestedEndMs - elapsedMs;
    const lastFrameIndex = samples.at(-1)?.frameIndex || 0;
    if (terminalDurationMs > 0.001) {
      const count = phaseCountForDuration(terminalDurationMs);
      for (let index = 0; index < count; index += 1) {
        samples.push({
          timeMs: elapsedMs + (index + 0.5) * terminalDurationMs / count,
          frameIndex: lastFrameIndex,
          durationMs: terminalDurationMs / count,
          phase: 1,
          reason: "trail_terminal",
        });
      }
    }
    if (includeTerminal) {
      samples.push({
        timeMs: requestedEndMs,
        frameIndex: lastFrameIndex,
        durationMs: 1,
        phase: 1,
        reason: "trail_end",
      });
    }
    return samples.map((sample, index) => ({
      ...sample,
      index,
      time: sample.timeMs / 1000,
    }));
  }

  function distributeIntegerMilliseconds(values) {
    let exactElapsed = 0;
    let integerElapsed = 0;
    return (Array.isArray(values) ? values : []).map((value) => {
      exactElapsed += Math.max(1, Number(value) || 1);
      const nextIntegerElapsed = Math.max(integerElapsed + 1, Math.round(exactElapsed));
      const duration = nextIntegerElapsed - integerElapsed;
      integerElapsed = nextIntegerElapsed;
      return duration;
    });
  }

  return { averageFrameTiming, groupFpsForDuration, frameSynchronousEffectSample, liteExportSamples, distributeIntegerMilliseconds };
});
