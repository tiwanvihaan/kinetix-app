import { QualityChecker, unreliable, ALGORITHM_VERSIONS, round } from "@/lib/quality";
import { mean, std } from "@/lib/analysis";

const RESAMPLE_N = 240;

// Archimedean reference spiral r = a*theta. Returned as a dense polyline.
export function referenceSpiral(cx, cy, maxR, turns = 3, steps = 600) {
  const maxTheta = turns * 2 * Math.PI;
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * maxTheta;
    const r = (th / maxTheta) * maxR;
    out.push({ x: cx + r * Math.cos(th), y: cy + r * Math.sin(th), theta: th, r });
  }
  return out;
}

// Distance from point to a polyline (true segment distance, not nearest vertex).
function distToPolyline(p, poly) {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1e-9;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    if (d < best) best = d;
  }
  return best;
}

// Resample a stroke to equal arc-length spacing so results do not depend on touch sampling rate or drawing speed.
export function resampleByArcLength(points, n) {
  const d = [0];
  for (let i = 1; i < points.length; i++) d.push(d[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = d[d.length - 1];
  if (total === 0) return [];
  const out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total;
    while (j < d.length - 1 && d[j] < target) j++;
    const seg = d[j] - d[j - 1] || 1e-9;
    const f = (target - d[j - 1]) / seg;
    out.push({ x: points[j - 1].x + (points[j].x - points[j - 1].x) * f, y: points[j - 1].y + (points[j].y - points[j - 1].y) * f });
  }
  return out;
}

// points: [{x,y,t,p}] in canvas coordinates; strokeBreaks: indices where the finger was lifted.
// geometry: {cx, cy, maxR} of the displayed reference spiral.
export function analyzeSpiral(points, geometry, { strokeBreaks = [] } = {}) {
  const q = new QualityChecker();
  const { cx, cy, maxR } = geometry;
  if (points.length < 30) {
    q.flag("too_short", "The drawing was too short to analyse.", "major");
    return unreliable("spiral", q.result("Trace the full spiral from the centre outward."), { point_count: points.length });
  }

  const pts = points;
  const reference = referenceSpiral(cx, cy, maxR);
  const durationS = (pts[pts.length - 1].t - pts[0].t) / 1000;

  // Coverage: how far around/out did the person get? Compare drawn radial extent with the reference.
  const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const maxDrawnR = Math.max(...radii);
  const coverage = Math.min(1, maxDrawnR / maxR);
  const startR = radii[0];
  if (coverage < 0.6) q.flag("incomplete", `The drawing reached only ${Math.round(coverage * 100)}% of the spiral's outer size.`, "major");
  if (startR > maxR * 0.25) q.flag("start_off_centre", "The drawing did not start near the centre.", "minor", 0.15);
  if (strokeBreaks.length > 0) q.flag("lifted", `The finger was lifted ${strokeBreaks.length} time(s); the pieces were analysed as one path.`, "minor", Math.min(0.3, strokeBreaks.length * 0.1));
  if (durationS < 2) q.flag("too_fast", "The drawing was completed in under 2 seconds.", "minor", 0.15);

  // Timing quality: touch sample rate (not pointer coalescing) governs how speed can be analysed.
  const dts = [];
  for (let i = 1; i < pts.length; i++) dts.push(pts[i].t - pts[i - 1].t);
  const medianDt = [...dts].sort((a, b) => a - b)[Math.floor(dts.length / 2)];
  const inputHz = medianDt > 0 ? 1000 / medianDt : null;
  const speedReliable = inputHz != null && inputHz >= 30;
  if (!speedReliable) q.flag("low_input_rate", "This screen reported touch positions too slowly to measure drawing speed reliably.", "minor", 0.1);

  // Scale normalisation: deviation is expressed as a percentage of the spiral's outer radius so different
  // screen sizes and display scaling produce comparable numbers.
  const deviations = pts.map((p) => distToPolyline(p, reference));
  const meanDevPx = mean(deviations);
  const meanDevPct = (meanDevPx / maxR) * 100;
  const maxDevPct = (Math.max(...deviations) / maxR) * 100;

  // Equal-arc-length path used for shape measures that should not depend on speed.
  const path = resampleByArcLength(pts, RESAMPLE_N);
  const resDev = path.map((p) => distToPolyline(p, reference));

  // Smoothness: high-frequency roughness = mean absolute second difference of the path itself (turning angle changes),
  // normalised by step length so it is dimensionless and independent of screen size.
  const angles = [];
  for (let i = 1; i < path.length; i++) angles.push(Math.atan2(path[i].y - path[i - 1].y, path[i].x - path[i - 1].x));
  const turn = [];
  for (let i = 1; i < angles.length; i++) {
    let d = angles[i] - angles[i - 1];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    turn.push(d);
  }
  // Smooth spiral: turning angle changes slowly. Roughness = mean |change in turning angle| (radians per step).
  const rough = [];
  for (let i = 1; i < turn.length; i++) rough.push(Math.abs(turn[i] - turn[i - 1]));
  const roughness = mean(rough);
  const reversals = turn.filter((d) => d < -0.01).length; // turning against the spiral's direction
  const dominant = turn.reduce((s, d) => s + d, 0) >= 0 ? 1 : -1;
  const reversalPct = (turn.filter((d) => d * dominant < -0.05).length / Math.max(1, turn.length)) * 100;

  // Spacing: radial gap between successive turns, measured on the drawn path at the start-angle crossing.
  const crossings = [];
  for (let i = 1; i < pts.length; i++) {
    const a1 = Math.atan2(pts[i - 1].y - cy, pts[i - 1].x - cx);
    const a2 = Math.atan2(pts[i].y - cy, pts[i].x - cx);
    if (a1 < 0 && a2 >= 0 && Math.abs(a2 - a1) < Math.PI) crossings.push(Math.hypot(pts[i].x - cx, pts[i].y - cy));
  }
  const gaps = [];
  for (let i = 1; i < crossings.length; i++) gaps.push(crossings[i] - crossings[i - 1]);
  const spacingCv = gaps.length >= 2 ? (std(gaps) / (mean(gaps) || 1)) * 100 : null;

  // Progressive change: does deviation grow from the first third of the path to the last third?
  const third = Math.floor(resDev.length / 3);
  const early = mean(resDev.slice(0, third));
  const late = mean(resDev.slice(-third));
  const progressionPct = ((late - early) / (maxR)) * 100;

  // Speed variability (only when the input rate supports it).
  let speedCv = null;
  let meanSpeed = null;
  if (speedReliable) {
    const speeds = [];
    for (let i = 1; i < pts.length; i++) {
      const dt = pts[i].t - pts[i - 1].t;
      if (dt > 0) speeds.push((Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) / dt) * 1000);
    }
    meanSpeed = mean(speeds);
    speedCv = (std(speeds) / (meanSpeed || 1)) * 100;
  }

  const pressures = pts.map((p) => p.p).filter((v) => v && v > 0 && v !== 0.5);
  const quality = q.result("Trace the whole spiral from the centre outward in one smooth motion.");
  if (quality.status === "unreliable") return unreliable("spiral", quality, { point_count: pts.length });

  // Overlay: the analysed (resampled) path with per-point deviation, for display only.
  const overlay = path.map((p, i) => ({ x: round(p.x, 1), y: round(p.y, 1), dev: round(resDev[i], 1) }));

  return {
    algorithm: ALGORITHM_VERSIONS.spiral,
    quality,
    point_count: pts.length,
    duration_s: round(durationS, 1),
    input_rate_hz: round(inputHz, 0),
    coverage_pct: round(coverage * 100, 0),
    mean_deviation_pct: round(meanDevPct, 1),
    max_deviation_pct: round(maxDevPct, 1),
    mean_deviation_px: round(meanDevPx, 1),
    roughness_rad: round(roughness, 3),
    reversal_pct: round(reversalPct, 1),
    spacing_cv_pct: round(spacingCv, 1),
    deviation_change_pct: round(progressionPct, 1),
    speed_variability_pct: round(speedCv, 1),
    mean_speed_px_s: round(meanSpeed, 0),
    mean_pressure: pressures.length > 5 ? round(mean(pressures), 2) : null,
    tremor_index: round(roughness * 10, 2),
    unavailable: [spacingCv == null ? "turn spacing" : null, speedCv == null ? "drawing speed" : null, pressures.length > 5 ? null : "pen pressure"].filter(Boolean),
    overlay,
  };
}