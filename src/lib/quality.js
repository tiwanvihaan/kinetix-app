// Shared data-quality framework for all Kinetix tests.
//
// Every analysis returns a `quality` object:
//   { status: "good" | "fair" | "unreliable", score: 0..1, issues: [{code, message}], retest: string|null }
//
// IMPORTANT: `score` is a transparent data-quality score built from measurable checks
// (coverage, sample rate, signal level...). It is NOT a statistical confidence and NOT a
// medical probability. It has not been calibrated against clinical reference data.

// Bumped whenever an algorithm or threshold changes, and stored with every saved result
// so a result can be traced to the exact processing that produced it.
export const ALGORITHM_VERSIONS = {
  tapping: "tapping-2.0",
  tremor: "tremor-2.0",
  spiral: "spiral-2.0",
  gait: "gait-2.0",
  voice: "voice-2.0",
  blink: "blink-2.0",
};

// Which parts of each pipeline are validated against reference data. Nothing here has been
// validated against labeled clinical data; the UI states this plainly.
export const VALIDATION_STATUS = {
  summary: "Measurement methods are unit-tested on constructed signals. Screening thresholds are unvalidated heuristics and have not been tested against labeled clinical data.",
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class QualityChecker {
  constructor() {
    this.issues = [];
    this.penalties = [];
  }

  // severity: "minor" lowers the score; "major" makes the test unreliable.
  flag(code, message, severity = "minor", penalty = severity === "major" ? 1 : 0.2) {
    this.issues.push({ code, message, severity });
    this.penalties.push(penalty);
    return this;
  }

  result(retestHint = null) {
    const major = this.issues.some((i) => i.severity === "major");
    const score = clamp01(1 - this.penalties.reduce((s, p) => s + p, 0));
    const status = major || score < 0.5 ? "unreliable" : score < 0.8 ? "fair" : "good";
    return {
      status,
      score: Math.round(score * 100) / 100,
      issues: this.issues.map(({ code, message }) => ({ code, message })),
      retest: status === "unreliable" ? retestHint || "Please repeat this test." : null,
    };
  }
}

// An analysis that could not produce trustworthy measurements. Never carries invented numbers.
export function unreliable(testType, quality, extra = {}) {
  return { unreliable: true, ...extra, quality, algorithm: ALGORITHM_VERSIONS[testType] };
}

// ---------- Small numeric helpers (no fabricated values: they return null when data are absent) ----------
export const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const percentile = (a, p) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
};

// Median absolute deviation, a robust spread estimate that outliers cannot dominate.
export const mad = (a) => {
  const m = median(a);
  return m == null ? null : median(a.map((v) => Math.abs(v - m)));
};

// Remove a least-squares straight line (drift) from a series.
export function detrend(y) {
  const n = y.length;
  if (n < 2) return [...y];
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += y[i]; sxy += i * y[i]; sxx += i * i; }
  const d = n * sxx - sx * sx || 1;
  const slope = (n * sxy - sx * sy) / d;
  const icpt = (sy - slope * sx) / n;
  return y.map((v, i) => v - (icpt + slope * i));
}

// Resample irregular (t, v) samples onto a uniform grid at fs Hz by linear interpolation.
// Gaps larger than `maxGapMs` are NOT interpolated across: they are reported as gaps.
export function resampleUniform(ts, vs, fs, maxGapMs = 250) {
  const n = ts.length;
  if (n < 2) return { values: [], gaps: [], fs };
  const step = 1000 / fs;
  const out = [];
  const gaps = [];
  let j = 0;
  for (let t = ts[0]; t <= ts[n - 1]; t += step) {
    while (j < n - 2 && ts[j + 1] < t) j++;
    const t0 = ts[j];
    const t1 = ts[j + 1];
    if (t1 - t0 > maxGapMs) {
      if (!gaps.length || gaps[gaps.length - 1].end < t0) gaps.push({ start: t0, end: t1 });
      out.push(null);
      continue;
    }
    const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
    out.push(vs[j] + (vs[j + 1] - vs[j]) * f);
  }
  return { values: out, gaps, fs };
}

// Longest run of non-null values, used so a spectrum is never computed across a data gap.
export function longestRun(values) {
  let best = [0, 0];
  let start = -1;
  for (let i = 0; i <= values.length; i++) {
    const ok = i < values.length && values[i] != null;
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      if (i - start > best[1] - best[0]) best = [start, i];
      start = -1;
    }
  }
  return values.slice(best[0], best[1]);
}

export const round = (v, d = 2) => {
  if (v == null || Number.isNaN(v) || !Number.isFinite(v)) return null;
  const p = 10 ** d;
  return Math.round(v * p) / p;
};