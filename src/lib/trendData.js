import { KEY_METRIC } from "@/lib/keyMetrics";

const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const cutoffFor = (days) => (days ? Date.now() - days * 86400000 : 0);

// Whether a higher value of each test's key metric is generally a better result.
// null = neither direction is clearly better, so change is shown neutrally.
export const HIGHER_IS_BETTER = {
  tapping: true,
  tremor: false,
  spiral: false,
  gait: true,
  voice: false,
  blink: null,
};

// Oldest-first points for one test's key metric, within the last `days` days (0 = all).
// `sessions` is newest-first.
export function testSeries(sessions, testType, days) {
  const key = KEY_METRIC[testType];
  const cutoff = cutoffFor(days);
  return sessions
    .filter((s) => s.test_type === testType && new Date(s.completed_at).getTime() >= cutoff && s.metrics?.[key] != null)
    .reverse()
    .map((s) => ({ date: fmt(s.completed_at), [key]: s.metrics[key] }));
}

// Summary of progress across a series: latest value, change since the first reading, and direction.
export function seriesProgress(data, key, testType) {
  if (!data.length) return null;
  const first = data[0][key];
  const latest = data[data.length - 1][key];
  if (data.length < 2) return { latest, delta: null, tone: "neutral", count: data.length };
  const delta = latest - first;
  const pct = first ? (delta / Math.abs(first)) * 100 : 0;
  const better = HIGHER_IS_BETTER[testType];
  let tone = "neutral";
  if (better !== null && Math.abs(pct) >= 5) tone = (delta > 0) === better ? "better" : "worse";
  return { latest, delta, pct, tone, count: data.length };
}