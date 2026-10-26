// Shared numeric helpers for Kinetix analysis. Per-test algorithms live in
// tappingAnalysis.js, tremorAnalysis.js, spiralAnalysis.js, gaitAnalysis.js,
// voiceAnalysis.js and blinkAnalysis.js. All results are screening signals, not diagnoses.

export const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

export const std = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
};

export function round(v, d = 2) {
  const p = 10 ** d;
  return Math.round(v * p) / p;
}