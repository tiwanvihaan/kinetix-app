import { mean, std } from "@/lib/analysis";
import { QualityChecker, unreliable, ALGORITHM_VERSIONS, median, resampleUniform, round } from "@/lib/quality";

const FS = 50;
const MIN_FS = 20;
const MIN_STEPS = 10;

// Moving average on a uniform series.
const smooth = (a, w) => a.map((_, i) => mean(a.slice(Math.max(0, i - w), i + w + 1)));

// samples: [{t (ms), mag (accel magnitude incl. gravity), gz (strongest rotation rate deg/s, or null)}]
// turnWindow: {startMs, endMs} (user-marked), optional.
export function analyzeGait(samples, turnWindow) {
  const q = new QualityChecker();
  if (samples.length < 100) {
    q.flag("too_little_data", `Only ${samples.length} motion samples were recorded.`, "major");
    return unreliable("gait", q.result("Keep the phone snug at your waist and walk the full distance."), { sample_count: samples.length });
  }
  const ts = samples.map((s) => s.t);
  const dur = (ts[ts.length - 1] - ts[0]) / 1000;
  const rawFs = (samples.length - 1) / dur;
  if (rawFs < MIN_FS) {
    q.flag("low_rate", `This device reported motion at only ${round(rawFs, 0)} Hz; at least ${MIN_FS} Hz is needed to time steps.`, "major");
    return unreliable("gait", q.result("Try a different phone or browser that provides faster motion sensing."), { sample_rate_hz: round(rawFs, 1) });
  }

  // Uniform resampling. Sensor gaps stay as gaps (null) — they are NOT treated as the person standing still.
  const { values, gaps } = resampleUniform(ts, samples.map((s) => s.mag), FS, 300);
  const t0 = ts[0];
  const timeOf = (i) => t0 + (i * 1000) / FS;
  const gapMs = gaps.reduce((s, g) => s + (g.end - g.start), 0);
  if (gapMs > dur * 1000 * 0.15) q.flag("sensor_gaps", `${Math.round((gapMs / (dur * 1000)) * 100)}% of the recording had no sensor data (likely the screen locked or the browser throttled sensors).`, "major");
  else if (gaps.length) q.flag("some_gaps", `${gaps.length} short interruption(s) in the sensor data were excluded from timing.`, "minor", 0.1);

  // Fill nulls with the previous valid value ONLY for the smoothing filter; step detection skips any index inside a gap.
  const inGap = values.map((v) => v == null);
  let last = mean(values.filter((v) => v != null)) || 9.81;
  const filled = values.map((v) => { if (v != null) last = v; return last; });
  // High-pass: remove gravity/orientation by subtracting a ~1.5 s moving average.
  const baseline = smooth(filled, Math.round(FS * 0.75));
  const acc = filled.map((v, i) => v - baseline[i]);
  const sm = smooth(acc, 2);

  // Adaptive threshold from the person's own signal (robust), with a plausibility floor on step spacing.
  const absDev = sm.map((v) => Math.abs(v));
  const level = median(absDev) || 0;
  const thr = Math.max(0.4, level * 1.6);
  const minGapMs = 280;
  const steps = [];
  for (let i = 2; i < sm.length - 2; i++) {
    if (inGap[i]) continue;
    if (sm[i] > thr && sm[i] >= sm[i - 1] && sm[i] > sm[i + 1]) {
      const t = timeOf(i);
      if (!steps.length || t - steps[steps.length - 1] >= minGapMs) steps.push(t);
      else if (sm[i] > sm[steps.length ? Math.round(((steps[steps.length - 1] - t0) * FS) / 1000) : 0]) steps[steps.length - 1] = t;
    }
  }
  if (steps.length < MIN_STEPS) {
    q.flag("few_steps", `Only ${steps.length} steps were detected (at least ${MIN_STEPS} needed).`, "major");
    return unreliable("gait", q.result("Keep the phone snug at your waist or in a front pocket and walk the full distance at a steady pace."), { step_count: steps.length, sample_rate_hz: round(rawFs, 1) });
  }

  // Step intervals; an interval that spans a sensor gap or exceeds 2 s is a pause/gap, not a step interval.
  const intervals = [];
  const spanGap = (a, b) => gaps.some((g) => g.start < b && g.end > a);
  for (let i = 1; i < steps.length; i++) {
    const iv = steps[i] - steps[i - 1];
    if (iv < 2000 && !spanGap(steps[i - 1], steps[i])) intervals.push({ iv, at: steps[i] });
  }
  const ivs = intervals.map((x) => x.iv);
  if (ivs.length < MIN_STEPS - 2) {
    q.flag("irregular", "Step timing could not be measured over enough consecutive steps.", "major");
    return unreliable("gait", q.result("Walk at a steady pace without stopping."), { step_count: steps.length });
  }
  const medIv = median(ivs);
  const meanIv = mean(ivs);

  // Cadence plausibility (steps/min). Outside ~40-200 means detection is probably wrong.
  const cadence = 60000 / meanIv;
  if (cadence < 40 || cadence > 200) q.flag("implausible_cadence", `The detected cadence (${Math.round(cadence)} steps/min) is outside the plausible walking range, so step detection may be wrong.`, "major");

  // Left/right asymmetry from alternating intervals — only meaningful with enough steps.
  const odd = ivs.filter((_, i) => i % 2 === 0);
  const even = ivs.filter((_, i) => i % 2 === 1);
  let asym = null;
  if (odd.length >= 4 && even.length >= 4) asym = (Math.abs(mean(odd) - mean(even)) / ((mean(odd) + mean(even)) / 2)) * 100;
  else q.flag("short_for_asym", "Too few steps to measure left/right asymmetry.", "minor", 0.05);

  // Turn: separate walking pace before and after the user-marked turn from the turn itself.
  let turnTime = null;
  let turnRoughness = null;
  let paceBefore = null;
  let paceAfter = null;
  let peakTurnRate = null;
  if (turnWindow) {
    const inTurn = samples.filter((s) => s.t >= turnWindow.startMs && s.t <= turnWindow.endMs && s.gz != null);
    if (inTurn.length > 10) {
      let accDeg = 0, startT = null, endT = null;
      for (let i = 1; i < inTurn.length; i++) {
        const dt = (inTurn[i].t - inTurn[i - 1].t) / 1000;
        if (dt > 0.3) continue; // skip across data gaps
        const rate = Math.abs(inTurn[i].gz);
        if (rate > 25 && startT == null) startT = inTurn[i].t;
        if (startT != null) accDeg += rate * dt;
        if (startT != null && accDeg >= 160) { endT = inTurn[i].t; break; }
      }
      if (startT != null && endT != null) turnTime = (endT - startT) / 1000;
      else q.flag("turn_not_detected", "A full 180° turn was not detected by the rotation sensor, so turn time is unavailable.", "minor", 0.1);
      const rates = inTurn.map((s) => Math.abs(s.gz)).filter((r) => r > 25);
      if (rates.length > 5) { turnRoughness = (std(rates) / mean(rates)) * 100; peakTurnRate = Math.max(...rates); }
    } else {
      q.flag("no_rotation_data", "No rotation-sensor data was available during the turn, so turn time is unavailable.", "minor", 0.1);
    }
    const before = intervals.filter((x) => x.at < turnWindow.startMs).map((x) => x.iv);
    const after = intervals.filter((x) => x.at > turnWindow.endMs).map((x) => x.iv);
    if (before.length >= 4) paceBefore = 60000 / mean(before);
    if (after.length >= 4) paceAfter = 60000 / mean(after);
  } else {
    q.flag("turn_not_marked", "The turn was not marked, so turn time and walking-versus-turning comparisons are unavailable.", "minor", 0.1);
  }

  const quality = q.result("Walk a straight, clear path at a steady pace with the phone snug at your waist.");
  if (quality.status === "unreliable") return unreliable("gait", quality, { step_count: steps.length });

  return {
    algorithm: ALGORITHM_VERSIONS.gait,
    quality,
    sample_count: samples.length,
    sample_rate_hz: round(rawFs, 1),
    step_count: steps.length,
    duration_s: round(dur, 1),
    stride_freq_hz: round(1000 / meanIv, 2),
    cadence_spm: round(cadence, 0),
    median_step_interval_ms: round(medIv, 0),
    step_variability_pct: round((std(ivs) / meanIv) * 100, 1),
    asymmetry_pct: round(asym, 1),
    turn_time_s: round(turnTime, 2),
    turn_roughness_pct: round(turnRoughness, 1),
    peak_turn_rate_dps: round(peakTurnRate, 0),
    cadence_before_turn_spm: round(paceBefore, 0),
    cadence_after_turn_spm: round(paceAfter, 0),
    sensor_gap_s: round(gapMs / 1000, 1),
    unavailable: [asym == null ? "step asymmetry" : null, turnTime == null ? "turn time" : null, paceBefore == null || paceAfter == null ? "pace before/after turn" : null].filter(Boolean),
  };
}