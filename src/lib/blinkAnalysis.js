import { mean, std } from "@/lib/analysis";
import { QualityChecker, unreliable, ALGORITHM_VERSIONS, median, mad, round } from "@/lib/quality";

// frames: [{t (ms), eye (eye-region contrast), bright (mean luma 0..255 of the face area), move (motion energy 0..1),
//           face (0..1 face-in-oval confidence proxy), shift (0..1 whole-frame motion = camera/head movement)}]
//
// Method: a blink is a brief, deep dip of the eye signal below the person's OWN robust baseline (median and MAD),
// lasting about 60-500 ms, while the face is visible, lighting is adequate and the head is not moving.
// Frames where the face is not visible, lighting is poor, or the whole frame moves are EXCLUDED from observation time —
// missing tracking is never counted as "no blinking".

const MIN_BRIGHT = 45;
const MAX_BRIGHT = 235;
const MIN_FACE = 0.5;
const MAX_SHIFT = 0.12;
const MIN_BLINK_MS = 60;
const MAX_BLINK_MS = 500;
const MIN_VALID_S = 20;

export function analyzeBlink(frames) {
  const q = new QualityChecker();
  if (frames.length < 60) {
    q.flag("too_few_frames", `Only ${frames.length} camera frames were captured.`, "major");
    return unreliable("blink", q.result("Make sure the camera is working, your face is well lit and in the oval."), { frame_count: frames.length });
  }
  const totalS = (frames[frames.length - 1].t - frames[0].t) / 1000;
  const fps = (frames.length - 1) / totalS;
  if (fps < 8) q.flag("low_fps", `The camera delivered only ${round(fps, 1)} frames per second, which can miss short blinks.`, "major");

  // 1) Per-frame validity. Each frame is accounted for as valid or excluded for a stated reason.
  const reason = frames.map((f) => {
    if (f.bright < MIN_BRIGHT) return "dark";
    if (f.bright > MAX_BRIGHT) return "overexposed";
    if (f.face != null && f.face < MIN_FACE) return "no_face";
    if (f.shift != null && f.shift > MAX_SHIFT) return "moving";
    return null;
  });
  const dt = frames.map((f, i) => (i ? f.t - frames[i - 1].t : 0));
  const sumDt = (r) => dt.reduce((s, d, i) => (reason[i] === r ? s + d : s), 0) / 1000;
  const validS = dt.reduce((s, d, i) => (reason[i] == null ? s + d : s), 0) / 1000;
  const excluded = { dark: sumDt("dark"), overexposed: sumDt("overexposed"), no_face: sumDt("no_face"), moving: sumDt("moving") };

  if (excluded.dark > totalS * 0.2) q.flag("too_dark", "The room was too dark for part of the recording. Face a light source.", "minor", 0.25);
  if (excluded.overexposed > totalS * 0.2) q.flag("overexposed", "The image was overexposed (bright light behind or on the face).", "minor", 0.25);
  if (excluded.no_face > totalS * 0.2) q.flag("face_lost", "Your face was outside the oval for part of the recording, so those moments were excluded.", "minor", 0.25);
  if (excluded.moving > totalS * 0.2) q.flag("head_moving", "Large head or camera movement was detected, so those moments were excluded.", "minor", 0.25);
  if (validS < MIN_VALID_S) {
    q.flag("not_enough_valid_time", `Only ${round(validS, 0)} s of the recording had a visible, well-lit, steady face (at least ${MIN_VALID_S} s needed).`, "major");
    return unreliable("blink", q.result("Hold the phone steady at eye level, face a light, keep your face in the oval and look at the camera."), { valid_s: round(validS, 1), total_s: round(totalS, 1) });
  }

  // 2) Baseline and noise from VALID frames only. Robust statistics so blinks do not distort the baseline.
  const validEye = frames.filter((_, i) => reason[i] == null).map((f) => f.eye);
  const base = median(validEye);
  const noise = 1.4826 * mad(validEye);
  if (!(noise > 0)) {
    q.flag("flat_signal", "The eye region showed almost no variation, so blinks could not be detected.", "major");
    return unreliable("blink", q.result("Move closer to the camera so your eyes are clearly visible."), { valid_s: round(validS, 1) });
  }
  // A blink must be a deep dip: below baseline by at least 3 noise units and by at least 25% of the typical eye signal.
  // Small dips (squints, eye movements, noise) are not counted.
  const drop = Math.max(3 * noise, 0.25 * base);
  const thr = base - drop;
  // Signal-to-noise: how large the camera noise is relative to the smallest dip we would accept as a blink.
  // Blinks occupy only ~3% of frames, so a low percentile of the signal measures noise, not blinks.
  // If the noise alone could produce a dip as deep as the blink threshold, blinks cannot be told from noise.
  const snr = drop / noise;
  if (snr < 4) q.flag("low_snr", "Eyelid movement was barely distinguishable from camera noise (try brighter, even lighting and move closer).", "major");

  // 3) Event detection over contiguous valid runs; a blink never spans an excluded stretch.
  const blinks = [];
  let i = 0;
  while (i < frames.length) {
    if (reason[i] == null && frames[i].eye < thr) {
      let j = i;
      while (j + 1 < frames.length && reason[j + 1] == null && frames[j + 1].eye < thr) j++;
      const startT = frames[i].t;
      const endT = frames[j].t;
      const dur = endT - startT + (dt[i] || 1000 / fps);
      const bounded = i > 0 && reason[i - 1] == null && j + 1 < frames.length && reason[j + 1] == null;
      if (bounded && dur >= MIN_BLINK_MS && dur <= MAX_BLINK_MS) {
        blinks.push({ t: startT, dur, depth: (base - Math.min(...frames.slice(i, j + 1).map((f) => f.eye))) / base });
      }
      i = j + 1;
    } else i += 1;
  }
  // Events longer than a blink (eyes closed / looking down) are reported, not counted as blinks.
  if (snr >= 4 && fps < 12) q.flag("fps_limits_duration", "At this frame rate, blink duration is only approximate.", "minor", 0.05);

  const quality = q.result("Hold the phone steady at eye level, face a light, keep your face in the oval and look at the camera.");
  if (quality.status === "unreliable") return unreliable("blink", quality, { valid_s: round(validS, 1), total_s: round(totalS, 1) });

  // 4) Measures, from valid observation time only.
  const ibis = [];
  for (let k = 1; k < blinks.length; k++) {
    const gap = blinks[k].t - blinks[k - 1].t;
    // Don't compute an interval across an excluded stretch.
    const crossesExcluded = reason.some((r, idx) => r != null && frames[idx].t > blinks[k - 1].t && frames[idx].t < blinks[k].t);
    if (!crossesExcluded) ibis.push(gap);
  }
  const moves = frames.filter((_, idx) => reason[idx] == null).map((f) => f.move);
  const perMin = (blinks.length / validS) * 60;

  return {
    algorithm: ALGORITHM_VERSIONS.blink,
    quality,
    frame_count: frames.length,
    fps: round(fps, 1),
    duration_s: round(totalS, 1),
    valid_s: round(validS, 1),
    valid_pct: round((validS / totalS) * 100, 0),
    blink_count: blinks.length,
    blinks_per_min: round(perMin, 1),
    mean_blink_ms: blinks.length ? round(mean(blinks.map((b) => b.dur)), 0) : null,
    median_ibi_s: ibis.length ? round(median(ibis) / 1000, 1) : null,
    ibi_variability_pct: ibis.length >= 4 ? round((std(ibis) / mean(ibis)) * 100, 0) : null,
    expressiveness: round(mean(moves) * 100, 1),
    expression_variability: round(std(moves) * 100, 1),
    signal_to_noise: round(snr, 1),
    excluded_s: { dark: round(excluded.dark, 1), overexposed: round(excluded.overexposed, 1), no_face: round(excluded.no_face, 1), moving: round(excluded.moving, 1) },
    unavailable: [blinks.length < 2 ? "inter-blink interval" : null, ibis.length < 4 ? "blink-interval variability" : null].filter(Boolean),
  };
}