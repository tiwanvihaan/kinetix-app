import { mean, std } from "@/lib/analysis";
import { QualityChecker, unreliable, ALGORITHM_VERSIONS, median, percentile, round } from "@/lib/quality";

// All functions here work on the ORIGINAL recorded samples (Float32Array, mono, -1..1). They only read them;
// the recording itself is never modified.

const FRAME_MS = 40;
const HOP_MS = 10;
const F0_MIN = 70;
const F0_MAX = 400;

export const toDb = (v) => 20 * Math.log10(Math.max(v, 1e-6));

// Normalised autocorrelation pitch on one frame. Returns {f0, clarity} (clarity = peak / energy, 0..1).
export function pitchOfFrame(x, sr) {
  const n = x.length;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += x[i] * x[i];
  if (energy < 1e-9) return { f0: 0, clarity: 0 };
  const minLag = Math.floor(sr / F0_MAX);
  const maxLag = Math.min(Math.floor(sr / F0_MIN), n - 2);
  // Normalise each lag by the energy of the two segments that actually overlap at that lag. Dividing by the whole-frame
  // energy shrinks the peak at longer lags (fewer overlapping samples) and under-reports how periodic the sound is.
  const ac = new Float32Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let c = 0;
    let e0 = 0;
    let e1 = 0;
    for (let i = 0; i < n - lag; i++) {
      c += x[i] * x[i + lag];
      e0 += x[i] * x[i];
      e1 += x[i + lag] * x[i + lag];
    }
    const d = Math.sqrt(e0 * e1);
    ac[lag] = d > 1e-12 ? c / d : 0;
  }
  // First strong local maximum (avoids octave errors from picking the global maximum).
  let best = -1;
  let bestV = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1] && ac[lag] > 0.3) {
      if (ac[lag] > bestV * 1.0 && (best < 0 || ac[lag] > bestV + 0.05)) { best = lag; bestV = ac[lag]; }
    }
  }
  if (best < 0) return { f0: 0, clarity: 0 };
  // Parabolic interpolation for sub-sample lag precision.
  const a = ac[best - 1], b = ac[best], c = ac[best + 1];
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  return { f0: sr / (best + shift), clarity: Math.min(1, bestV) };
}

// Short-time features across the whole recording.
export function frameFeatures(samples, sr) {
  const frameN = Math.round((sr * FRAME_MS) / 1000);
  const hop = Math.round((sr * HOP_MS) / 1000);
  const frames = [];
  for (let s = 0; s + frameN <= samples.length; s += hop) {
    const seg = samples.subarray(s, s + frameN);
    let e = 0;
    let zc = 0;
    for (let i = 0; i < seg.length; i++) { e += seg[i] * seg[i]; if (i && (seg[i - 1] < 0) !== (seg[i] < 0)) zc += 1; }
    const rms = Math.sqrt(e / seg.length);
    frames.push({ t: s / sr, rms, zcr: zc / seg.length, start: s });
  }
  return frames;
}

export function analyzeRecordingQuality(samples, sr, frames) {
  let peak = 0;
  let clipped = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
    if (a >= 0.985) clipped += 1;
  }
  const rmsAll = frames.map((f) => f.rms);
  const noiseFloor = percentile(rmsAll, 0.1) ?? 0;
  const loud = percentile(rmsAll, 0.9) ?? 0;
  // Energy-based SNR (loud vs quiet frames). It is only meaningful when the recording contains a real quiet stretch.
  const energySnr = toDb(loud) - toDb(Math.max(noiseFloor, 1e-5));
  // Periodicity-based SNR on the loudest frames: a steady vowel is periodic, so the non-periodic share of its energy is noise.
  // This is the harmonics-to-noise ratio, and it also works when the whole clip is a sustained sound with no quiet part.
  const sr2 = sr;
  const sized = Math.round((sr2 * FRAME_MS) / 1000);
  const loudFrames = frames.filter((f) => f.rms >= loud * 0.7).slice(0, 60);
  let hnrDb = null;
  if (loudFrames.length >= 5) {
    const claris = loudFrames.map((f) => pitchOfFrame(samples.subarray(f.start, f.start + sized), sr2).clarity).filter((c) => c > 0);
    if (claris.length >= 5) {
      const c = Math.min(0.999, Math.max(0.001, median(claris)));
      hnrDb = 10 * Math.log10(c / (1 - c));
    }
  }
  // If a real quiet stretch exists, the energy contrast is direct evidence; otherwise rely on periodicity.
  const hasQuietStretch = loud > 0 && noiseFloor < loud * 0.5;
  const snrDb = hasQuietStretch ? Math.max(energySnr, hnrDb ?? -Infinity) : hnrDb ?? energySnr;
  return { peak, clippedPct: (clipped / samples.length) * 100, noiseFloor, loud, snrDb, energySnrDb: energySnr, hnrDb };
}

// Peak-per-bin waveform for display. A derived copy; the recording itself is never modified.
export function waveformEnvelope(samples, bins = 240) {
  const envelope = [];
  const per = Math.max(1, Math.floor(samples.length / bins));
  for (let b = 0; b < bins; b++) {
    let mx = 0;
    for (let i = b * per; i < Math.min(samples.length, (b + 1) * per); i++) mx = Math.max(mx, Math.abs(samples[i]));
    envelope.push(round(mx, 3));
  }
  return envelope;
}

// Sustained-vowel analysis (the task this app uses). Measures only what the recording supports.
export function analyzeVoice(samples, sr, opts = {}) {
  const q = new QualityChecker();
  const durationS = samples.length / sr;
  if (durationS < 2) {
    q.flag("too_short", `The recording was only ${round(durationS, 1)} s long.`, "major");
    return unreliable("voice", q.result("Take a breath and hold “Ahhh” steadily for at least 3 seconds."), { duration_s: round(durationS, 1) });
  }
  const frames = frameFeatures(samples, sr);
  const rq = analyzeRecordingQuality(samples, sr, frames);

  if (rq.peak < 0.03) q.flag("very_quiet", "The recording was very quiet. Move the phone closer to your mouth.", "major");
  else if (rq.peak < 0.1) q.flag("quiet", "The recording was quiet; results may be less precise.", "minor", 0.15);
  if (rq.clippedPct > 1) q.flag("clipping", `The audio was distorted by clipping (${round(rq.clippedPct, 1)}% of samples). Hold the phone further away or speak a little softer.`, "major");
  else if (rq.clippedPct > 0.1) q.flag("slight_clipping", "A small amount of clipping was detected.", "minor", 0.1);
  if (rq.snrDb < 15) q.flag("noisy", `Background noise was high (estimated signal-to-noise ${round(rq.snrDb, 0)} dB). Try a quieter room.`, rq.snrDb < 8 ? "major" : "minor", 0.25);

  // Voiced frames: enough energy above the noise floor, clear periodicity, and plausible pitch.
  // Quiet frames are only background noise if the sound in them is NOT periodic. In a sustained vowel the quiet frames are
  // the voice itself (steady, or fading), so using them as a noise floor would reject real phonation.
  // Voicing is decided by pitch clarity below; the energy gate just removes near-silence.
  const floorIsNoise = rq.hnrDb != null ? rq.hnrDb < 10 : rq.noiseFloor < rq.loud * 0.5;
  const energyGate = Math.max(floorIsNoise ? rq.noiseFloor * 3 : 0, rq.loud * 0.05, 0.005);
  const sized = Math.round((sr * FRAME_MS) / 1000);
  const analysed = frames.map((f) => {
    if (f.rms < energyGate) return { ...f, voiced: false };
    const p = pitchOfFrame(samples.subarray(f.start, f.start + sized), sr);
    return { ...f, f0: p.f0, clarity: p.clarity, voiced: p.f0 >= F0_MIN && p.f0 <= F0_MAX && p.clarity >= 0.5 };
  });
  const voiced = analysed.filter((f) => f.voiced);
  const voicedS = (voiced.length * HOP_MS) / 1000;
  if (voiced.length < 60) {
    q.flag("little_voicing", "A steady voiced sound was detected for less than 0.6 seconds.", "major");
    return unreliable("voice", q.result("Hold a clear, steady “Ahhh” in a quiet room, with the phone 15–20 cm from your mouth."), { duration_s: round(durationS, 1), quality_detail: rq });
  }

  // Pitch-outlier cleaning: remove octave jumps relative to the median (kept in the count, never replaced with invented values).
  const med = median(voiced.map((f) => f.f0));
  const clean = voiced.filter((f) => f.f0 > med * 0.75 && f.f0 < med * 1.33);
  const outliers = voiced.length - clean.length;
  if (outliers / voiced.length > 0.2) q.flag("pitch_unstable_tracking", "Pitch tracking was unstable in many frames; pitch measures may be unreliable.", "minor", 0.2);

  const f0s = clean.map((f) => f.f0);
  // Cycle-level approximations from 10 ms frame pitch: this is coarser than clinical jitter/shimmer (which use single glottal cycles),
  // so the values are labelled "frame-based" and are only comparable with this app's own earlier results.
  let jit = 0;
  for (let i = 1; i < f0s.length; i++) jit += Math.abs(1 / f0s[i] - 1 / f0s[i - 1]);
  const jitter = (jit / (f0s.length - 1) / mean(f0s.map((f) => 1 / f))) * 100;
  const amps = clean.map((f) => f.rms);
  let shim = 0;
  for (let i = 1; i < amps.length; i++) shim += Math.abs(amps[i] - amps[i - 1]);
  const shimmer = (shim / (amps.length - 1) / mean(amps)) * 100;

  // Volume over time and drop-off across the voiced stretch.
  const third = Math.max(1, Math.floor(amps.length / 3));
  const dropoff = toDb(mean(amps.slice(0, third))) - toDb(mean(amps.slice(-third)));

  // Pauses inside the phonation: gaps between voiced frames longer than 250 ms (breaks, breathiness, breaks in voicing).
  const voicedTimes = voiced.map((f) => f.t);
  const breaks = [];
  for (let i = 1; i < voicedTimes.length; i++) {
    const gap = voicedTimes[i] - voicedTimes[i - 1];
    if (gap > 0.25) breaks.push({ start: voicedTimes[i - 1] + FRAME_MS / 1000, end: voicedTimes[i], len: gap });
  }
  const firstVoiced = voicedTimes[0];
  const lastVoiced = voicedTimes[voicedTimes.length - 1] + FRAME_MS / 1000;
  // Sustained time = from first to last voiced frame minus breaks (continuous phonation, not total recording length).
  const sustained = lastVoiced - firstVoiced - breaks.reduce((s, b) => s + b.len, 0);

  // Pitch drift over time and pitch variability in semitones (independent of the person's average pitch).
  const semis = f0s.map((f) => 12 * Math.log2(f / mean(f0s)));
  const pitchSdSemi = std(semis);

  const quality = q.result("Hold the phone 15–20 cm from your mouth in a quiet room and say a steady “Ahhh”.");
  if (quality.status === "unreliable") return unreliable("voice", quality, { duration_s: round(durationS, 1), quality_detail: rq });

  // Markers: only events we can reliably identify are returned.
  const markers = [];
  markers.push({ kind: "voicing_start", t: round(firstVoiced, 2), label: "Voicing begins" });
  markers.push({ kind: "voicing_end", t: round(lastVoiced, 2), label: "Voicing ends" });
  breaks.forEach((b) => markers.push({ kind: "break", t: round(b.start, 2), end: round(b.end, 2), label: `Break in voicing (${round(b.len, 2)} s)` }));
  if (rq.clippedPct > 0.1) {
    for (let s = 0; s < samples.length; s += sr / 10) {
      let hit = false;
      for (let i = s; i < Math.min(samples.length, s + sr / 10); i++) if (Math.abs(samples[i]) >= 0.985) { hit = true; break; }
      if (hit) { markers.push({ kind: "clipping", t: round(s / sr, 2), label: "Clipping (distortion)" }); break; }
    }
  }

  const envelope = waveformEnvelope(samples, opts.bins);

  return {
    algorithm: ALGORITHM_VERSIONS.voice,
    quality,
    duration_s: round(durationS, 1),
    sample_rate_hz: sr,
    voiced_s: round(voicedS, 1),
    sustained_s: round(sustained, 1),
    voicing_ratio_pct: round((voicedS / durationS) * 100, 0),
    mean_pitch_hz: round(mean(f0s), 1),
    pitch_sd_hz: round(std(f0s), 2),
    pitch_sd_semitones: round(pitchSdSemi, 2),
    jitter_pct: round(jitter, 2),
    shimmer_pct: round(shimmer, 2),
    mean_volume_db: round(toDb(mean(amps)), 1),
    volume_dropoff_db: round(dropoff, 1),
    break_count: breaks.length,
    longest_break_s: breaks.length ? round(Math.max(...breaks.map((b) => b.len)), 2) : 0,
    snr_db: round(rq.snrDb, 0),
    clipped_pct: round(rq.clippedPct, 2),
    pitch_outlier_frames: outliers,
    markers,
    envelope,
    unavailable: ["speech rate and fluency (this task is a sustained vowel, not speech)", "true cycle-level jitter and shimmer (frame-based estimates are shown)"],
  };
}