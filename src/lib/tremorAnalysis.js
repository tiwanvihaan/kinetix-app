import { QualityChecker, unreliable, ALGORITHM_VERSIONS, detrend, resampleUniform, longestRun, round } from "@/lib/quality";
import { mean, std } from "@/lib/analysis";

const TARGET_FS = 50; // uniform analysis rate (Hz)
const MIN_FS = 25; // below this, 4-6 Hz cannot be measured reliably (Nyquist plus margin)
const MIN_SECONDS = 6;

// Hann-windowed DFT power on a uniform series; returns {freqs, power} from 0.5 to maxF in 0.25 Hz steps.
export function powerSpectrum(x, fs, maxF = 15) {
  const n = x.length;
  const m = mean(x);
  const w = x.map((v, i) => (v - m) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
  const freqs = [];
  const power = [];
  for (let f = 0.5; f <= Math.min(maxF, fs / 2); f += 0.25) {
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * f * i) / fs;
      re += w[i] * Math.cos(a);
      im -= w[i] * Math.sin(a);
    }
    freqs.push(f);
    power.push((re * re + im * im) / n);
  }
  return { freqs, power };
}

// Analyse one phase. samples: [{t (ms), mag}] acceleration magnitude (m/s^2, includes gravity).
export function analyzeTremorPhase(samples) {
  const issues = [];
  if (samples.length < 40) return { usable: false, reason: `Only ${samples.length} motion samples were received.`, issues };
  const ts = samples.map((s) => s.t);
  const rawSeconds = (ts[ts.length - 1] - ts[0]) / 1000;
  const rawFs = (samples.length - 1) / rawSeconds;
  if (rawFs < MIN_FS) return { usable: false, reason: `This device reported motion at only ${round(rawFs, 0)} Hz; at least ${MIN_FS} Hz is needed to measure 4–6 Hz tremor reliably.`, sampleRate: round(rawFs, 1), issues };

  const { values, gaps } = resampleUniform(ts, samples.map((s) => s.mag), TARGET_FS);
  const clean = longestRun(values);
  const cleanSeconds = clean.length / TARGET_FS;
  if (cleanSeconds < MIN_SECONDS) return { usable: false, reason: `Only ${round(cleanSeconds, 1)} s of uninterrupted data was available (at least ${MIN_SECONDS} s needed).`, sampleRate: round(rawFs, 1), issues };

  // Drift (slow tilt / hand repositioning) is removed so it is not mistaken for tremor.
  const x = detrend(clean);
  const rms = std(x);
  const { freqs, power } = powerSpectrum(x, TARGET_FS);
  const total = power.reduce((s, v) => s + v, 0) || 1e-12;
  const share = (lo, hi) => power.reduce((s, v, i) => (freqs[i] >= lo && freqs[i] < hi ? s + v : s), 0) / total;
  let pk = 0;
  power.forEach((v, i) => { if (v > power[pk]) pk = i; });
  // A peak only counts as a tremor-like oscillation if it clearly stands above the broadband floor.
  const sortedP = [...power].sort((a, b) => a - b);
  const floor = sortedP[Math.floor(sortedP.length / 2)] || 1e-12;
  const peakProminence = power[pk] / floor;

  // Stability over the whole recording: RMS in consecutive 2 s windows.
  const win = TARGET_FS * 2;
  const winRms = [];
  for (let i = 0; i + win <= x.length; i += win) winRms.push(std(x.slice(i, i + win)));
  const rmsDrift = winRms.length >= 3 ? std(winRms) / (mean(winRms) || 1e-9) : null;

  // Directional changes: zero crossings of the detrended signal per second = dominant oscillation rate.
  let crossings = 0;
  for (let i = 1; i < x.length; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) crossings += 1;

  // Gross-movement check: a large low-frequency share means walking / repositioning, not hand tremor.
  const lowShare = share(0.5, 2);
  return {
    usable: true,
    sampleRate: round(rawFs, 1),
    seconds: round(cleanSeconds, 1),
    gapCount: gaps.length,
    rms: round(rms, 4),
    peak_hz: freqs[pk],
    peak_prominence: round(peakProminence, 1),
    band_4_6_ratio: round(share(4, 6.01), 3),
    band_6_12_ratio: round(share(6, 12.01), 3),
    low_freq_ratio: round(lowShare, 3),
    stability_rms_cv: round(rmsDrift, 2),
    oscillation_rate_hz: round(crossings / 2 / cleanSeconds, 2),
    issues,
  };
}

export function analyzeTremor({ rest, postural }) {
  const q = new QualityChecker();
  const r = analyzeTremorPhase(rest);
  const p = analyzeTremorPhase(postural);
  const unavailable = [];

  [["Resting", r], ["Postural", p]].forEach(([label, ph]) => {
    if (!ph.usable) {
      q.flag(`${label.toLowerCase()}_unusable`, `${label} phase: ${ph.reason}`, "minor", 0.5);
      unavailable.push(`${label.toLowerCase()} phase`);
    } else {
      if (ph.gapCount > 0) q.flag(`${label.toLowerCase()}_gaps`, `${label} phase had ${ph.gapCount} gap(s) in the sensor data; only the longest uninterrupted stretch was analysed.`, "minor", 0.1);
      if (ph.sampleRate < 40) q.flag(`${label.toLowerCase()}_lowfs`, `${label} phase sensor rate was ${ph.sampleRate} Hz, which limits frequency resolution above about ${Math.floor(ph.sampleRate / 2)} Hz.`, "minor", 0.1);
      if (ph.low_freq_ratio > 0.6 && ph.rms > 0.15) q.flag(`${label.toLowerCase()}_gross`, `${label} phase was dominated by slow, large movement (repositioning or body sway), so tremor-like movement cannot be separated from general instability.`, "minor", 0.25);
    }
  });
  if (!r.usable && !p.usable) {
    return unreliable("tremor", q.result("Hold the phone flat on your palm and keep still for the full 10 seconds in each phase."));
  }

  const quality = q.result("Hold the phone flat on your palm and keep still for the full 10 seconds in each phase.");
  const val = (ph, k) => (ph.usable ? ph[k] : null);
  return {
    algorithm: ALGORITHM_VERSIONS.tremor,
    quality,
    rest_band_ratio: val(r, "band_4_6_ratio"),
    rest_rms: val(r, "rms"),
    rest_peak_hz: val(r, "peak_hz"),
    rest_peak_prominence: val(r, "peak_prominence"),
    rest_stability_cv: val(r, "stability_rms_cv"),
    postural_band_ratio: val(p, "band_4_6_ratio"),
    postural_rms: val(p, "rms"),
    postural_peak_hz: val(p, "peak_hz"),
    postural_peak_prominence: val(p, "peak_prominence"),
    postural_stability_cv: val(p, "stability_rms_cv"),
    sample_rate_hz: Math.min(...[r, p].filter((x) => x.usable).map((x) => x.sampleRate)),
    unavailable,
    phases: { rest: r, postural: p },
  };
}