import { QualityChecker, unreliable, ALGORITHM_VERSIONS, median, mad, round } from "@/lib/quality";
import { mean, std } from "@/lib/analysis";

// Taps closer together than this cannot be two deliberate finger taps (duplicate / touch-bounce events).
export const MIN_INTERVAL_MS = 60;
// A pause is a gap much longer than the person's own typical interval.
const PAUSE_FACTOR = 3;
const PAUSE_MIN_MS = 500;

// taps: [{t (ms from first tap), side: 'L'|'R', dur (ms the finger stayed down, optional)}]
// windowMs: the length of the test window, measured from the first tap.
export function analyzeTapping(rawTaps, windowMs) {
  const q = new QualityChecker();
  const sorted = [...rawTaps].sort((a, b) => a.t - b.t);

  // 1) Remove duplicate / bounce events and prolonged contacts (a press-and-hold is not a tap).
  const taps = [];
  let duplicates = 0;
  let prolonged = 0;
  for (const tap of sorted) {
    if (tap.dur != null && tap.dur > 600) { prolonged += 1; continue; }
    const last = taps[taps.length - 1];
    if (last && tap.t - last.t < MIN_INTERVAL_MS) { duplicates += 1; continue; }
    taps.push(tap);
  }
  const rejected = duplicates + prolonged;
  if (rejected > 0) q.flag("rejected_events", `${rejected} touch event(s) were ignored as accidental or duplicate (${duplicates} too close together, ${prolonged} held too long).`, "minor", Math.min(0.3, rejected * 0.03));

  if (taps.length < 8) {
    q.flag("too_few_taps", `Only ${taps.length} valid taps were recorded.`, "major");
    return unreliable("tapping", q.result("Tap the two buttons alternately and keep going for the full 15 seconds."), { tap_count: taps.length });
  }

  const intervals = [];
  for (let i = 1; i < taps.length; i++) intervals.push(taps[i].t - taps[i - 1].t);
  const med = median(intervals);

  // 2) Pauses: gaps far above the person's own median interval. Reported separately, not treated as slow tapping.
  const pauseLimit = Math.max(PAUSE_MIN_MS, med * PAUSE_FACTOR);
  const pauses = [];
  intervals.forEach((iv, i) => { if (iv > pauseLimit) pauses.push({ at_ms: Math.round(taps[i].t), length_ms: Math.round(iv) }); });
  const activeIntervals = intervals.filter((iv) => iv <= pauseLimit);

  const firstT = taps[0].t;
  const lastT = taps[taps.length - 1].t;
  const spanS = (lastT - firstT) / 1000;
  if (windowMs && lastT < windowMs * 0.6) {
    q.flag("ended_early", "Tapping stopped well before the end of the test.", "major");
  }
  if (spanS <= 0) q.flag("no_span", "No usable time span.", "major");

  // 3) Rate, using time between the first and last valid tap (not the nominal window).
  const rate = (taps.length - 1) / spanS;

  // 4) Rhythm: robust variability (MAD-based) as well as classic CV, over non-pause intervals.
  const meanActive = mean(activeIntervals);
  const cv = (std(activeIntervals) / meanActive) * 100;
  const robustCv = ((1.4826 * mad(activeIntervals)) / med) * 100;

  // 5) Alternation, per hand/finger.
  const alternations = taps.slice(1).filter((t, i) => t.side !== taps[i].side).length;
  const alternationPct = (alternations / (taps.length - 1)) * 100;
  const bySide = {};
  for (const side of ["L", "R"]) {
    const st = taps.filter((t) => t.side === side);
    const ivs = [];
    for (let i = 1; i < st.length; i++) ivs.push(st[i].t - st[i - 1].t);
    bySide[side] = { count: st.length, mean_interval_ms: st.length > 1 ? round(mean(ivs), 0) : null };
  }
  const sideBalance = Math.min(bySide.L.count, bySide.R.count) / Math.max(bySide.L.count, bySide.R.count);
  if (sideBalance < 0.6) q.flag("one_sided", "Most taps landed on one button, so alternation could not be measured well.", "minor", 0.2);

  // 6) Change over time: fit a straight line to interval vs time on active intervals.
  //    Only reported when there are enough intervals to say anything.
  let slowingPctPerTenS = null;
  let fatiguePct = null;
  if (activeIntervals.length >= 12) {
    const half = Math.floor(activeIntervals.length / 2);
    const a = mean(activeIntervals.slice(0, half));
    const b = mean(activeIntervals.slice(half));
    fatiguePct = ((b - a) / a) * 100;
    const xs = taps.slice(1).filter((_, i) => intervals[i] <= pauseLimit).map((t) => t.t / 1000);
    const mx = mean(xs);
    const my = mean(activeIntervals);
    let num = 0, den = 0;
    xs.forEach((x, i) => { num += (x - mx) * (activeIntervals[i] - my); den += (x - mx) ** 2; });
    slowingPctPerTenS = den > 0 ? ((num / den) * 10 / my) * 100 : null;
  } else {
    q.flag("short_for_trend", "Too few taps to measure change over time reliably.", "minor", 0.1);
  }

  // 7) Plausibility: faster than ~12 taps/s alternating is not physiologically plausible for finger taps.
  if (rate > 12) q.flag("implausible_rate", "The tap rate is higher than a finger can normally achieve; input may be duplicated.", "major");

  const quality = q.result("Rest your hand, alternate the two buttons evenly, and keep going until the timer ends.");
  if (quality.status === "unreliable") return unreliable("tapping", quality, { tap_count: taps.length });

  return {
    algorithm: ALGORITHM_VERSIONS.tapping,
    quality,
    tap_count: taps.length,
    taps_per_sec: round(rate, 2),
    mean_interval_ms: round(meanActive, 0),
    median_interval_ms: round(med, 0),
    rhythm_cv_pct: round(cv, 1),
    rhythm_robust_cv_pct: round(robustCv, 1),
    alternation_accuracy_pct: round(alternationPct, 1),
    fatigue_pct: round(fatiguePct, 1),
    slowing_pct_per_10s: round(slowingPctPerTenS, 1),
    pause_count: pauses.length,
    longest_pause_ms: pauses.length ? Math.max(...pauses.map((p) => p.length_ms)) : 0,
    ignored_touch_events: rejected,
    index_taps: bySide.L.count,
    middle_taps: bySide.R.count,
    pauses: pauses.slice(0, 10),
    unavailable: slowingPctPerTenS == null ? ["change over time"] : [],
  };
}