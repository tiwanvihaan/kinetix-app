import { Hand, Activity, PenTool, Footprints, Mic, Eye } from "lucide-react";

export const PHASES = {
  prevention: { label: "Prevention", color: "bg-emerald-100 text-emerald-800" },
  prodromal: { label: "Prodromal signs", color: "bg-amber-100 text-amber-800" },
  motor: { label: "Active motor signs", color: "bg-sky-100 text-sky-800" },
};

export const TESTS = {
  tapping: { key: "tapping", title: "Finger Tapping", short: "Tapping", icon: Hand, phase: "motor", minutes: 1, blurb: "Alternate two buttons as fast as you can for 15 seconds.", path: "/test/tapping" },
  tremor: { key: "tremor", title: "Tremor & Stability", short: "Tremor", icon: Activity, phase: "motor", minutes: 1, blurb: "Hold the phone at rest, then arm extended, 10 seconds each.", path: "/test/tremor" },
  spiral: { key: "spiral", title: "Spiral Drawing", short: "Spiral", icon: PenTool, phase: "motor", minutes: 1, blurb: "Trace a spiral from the inside out.", path: "/test/spiral" },
  gait: { key: "gait", title: "Walk & Turn", short: "Gait", icon: Footprints, phase: "motor", minutes: 2, blurb: "Walk 20 m with the phone at your waist, turn 180°, and walk back.", path: "/test/gait" },
  voice: { key: "voice", title: "Voice & Speech", short: "Voice", icon: Mic, phase: "motor", minutes: 1, blurb: "Hold a steady “Ahhh” as long as you can.", path: "/test/voice" },
  blink: { key: "blink", title: "Blink & Expression", short: "Blink", icon: Eye, phase: "motor", minutes: 1, blurb: "Look at the front camera for 45 seconds to measure blink rate and facial expressiveness.", path: "/test/blink" },
};

export const TEST_ORDER = ["tapping", "tremor", "spiral", "gait", "voice", "blink"];

export const FLAG_STYLES = {
  typical: { label: "Within typical range", dot: "bg-emerald-600" },
  monitor: { label: "Worth monitoring", dot: "bg-amber-500" },
  discuss: { label: "Discuss with a clinician", dot: "bg-rose-600" },
};

export const METRIC_LABELS = {
  tapping: [
    ["taps_per_sec", "Taps per second", ""],
    ["rhythm_cv_pct", "Rhythm variability", "%"],
    ["alternation_accuracy_pct", "Alternation accuracy", "%"],
    ["fatigue_pct", "Slowing over time", "%"],
  ],
  tremor: [
    ["rest_band_ratio", "Resting 4–6 Hz share", ""],
    ["postural_band_ratio", "Postural 4–6 Hz share", ""],
    ["rest_rms", "Resting movement (RMS)", ""],
    ["postural_rms", "Postural movement (RMS)", ""],
  ],
  spiral: [
    ["mean_deviation_pct", "Mean deviation from template", "%"],
    ["roughness_rad", "Line roughness", "rad"],
    ["speed_variability_pct", "Speed variability", "%"],
    ["duration_s", "Duration", "s"],
  ],
  gait: [
    ["cadence_spm", "Cadence", "steps/min"],
    ["stride_freq_hz", "Step frequency", "Hz"],
    ["asymmetry_pct", "Step asymmetry", "%"],
    ["step_variability_pct", "Step variability", "%"],
    ["turn_time_s", "180° turn time", "s"],
    ["duration_s", "Total time", "s"],
  ],
  voice: [
    ["sustained_s", "Sustained time", "s"],
    ["jitter_pct", "Pitch steadiness (jitter, estimate)", "%"],
    ["shimmer_pct", "Volume steadiness (shimmer, estimate)", "%"],
    ["mean_pitch_hz", "Mean pitch", "Hz"],
    ["pitch_sd_semitones", "Pitch variation", "semitones"],
    ["volume_dropoff_db", "Volume drop-off", "dB"],
    ["break_count", "Breaks in voicing", ""],
  ],
  blink: [
    ["blinks_per_min", "Blink rate", "per min"],
    ["blink_count", "Blinks counted", ""],
    ["mean_blink_ms", "Typical blink length", "ms"],
    ["expressiveness", "Facial expressiveness", ""],
    ["valid_s", "Usable recording time", "s"],
  ],
};

// Default screening heuristics -> {flag, reason}. Personalized thresholds override.
export function evaluateMetrics(testType, m) {
  let flag = "typical";
  const reasons = [];
  const bump = (level, reason) => {
    const rank = { typical: 0, monitor: 1, discuss: 2 };
    if (rank[level] > rank[flag]) flag = level;
    reasons.push(reason);
  };
  // A measure that could not be computed is null. It is skipped, never treated as zero, so missing data cannot trigger a flag.
  const has = (v) => v != null && !Number.isNaN(v);
  if (testType === "tapping") {
    if (has(m.taps_per_sec) && m.taps_per_sec < 3) bump("monitor", "Tapping speed was slower than the usual range.");
    if (has(m.fatigue_pct) && m.fatigue_pct > 25) bump("monitor", "Tapping slowed noticeably over the test.");
    if (has(m.rhythm_cv_pct) && m.rhythm_cv_pct > 35) bump("monitor", "Tap rhythm was uneven.");
  } else if (testType === "tremor") {
    if (has(m.rest_band_ratio) && has(m.rest_rms) && m.rest_band_ratio > 0.5 && m.rest_rms > 0.03) bump("monitor", "Movement at rest concentrated in the 4–6 Hz band.");
    if (has(m.postural_band_ratio) && has(m.postural_rms) && m.postural_band_ratio > 0.5 && m.postural_rms > 0.05) bump("monitor", "Movement with arm extended concentrated in the 4–6 Hz band.");
  } else if (testType === "spiral") {
    if (has(m.mean_deviation_pct) && m.mean_deviation_pct > 12) bump("monitor", "Tracing deviated from the template more than usual.");
    if (has(m.tremor_index) && m.tremor_index > 3) bump("monitor", "Line showed fine shaking.");
  } else if (testType === "gait") {
    if (has(m.cadence_spm) && m.cadence_spm < 85) bump("monitor", "Walking pace was slower than the usual range.");
    if (has(m.asymmetry_pct) && m.asymmetry_pct > 8) bump("monitor", "Left and right steps differed more than usual.");
    if (has(m.step_variability_pct) && m.step_variability_pct > 12) bump("monitor", "Step timing was uneven.");
    if (has(m.turn_time_s) && m.turn_time_s > 3) bump("monitor", "The 180° turn took longer than usual.");
  } else if (testType === "blink") {
    if (has(m.blinks_per_min) && m.blinks_per_min < 8) bump("monitor", "Blink rate was lower than the typical range (about 12–20 per minute).");
    if (has(m.expressiveness) && m.expressiveness < 1.5) bump("monitor", "Facial movement was lower than typical.");
  } else if (testType === "voice") {
    if (has(m.sustained_s) && m.sustained_s < 8) bump("monitor", "Sustained voice time was short.");
    if (has(m.jitter_pct) && m.jitter_pct > 1.5) bump("monitor", "Pitch steadiness (jitter) was higher than typical.");
    if (has(m.volume_dropoff_db) && m.volume_dropoff_db > 6) bump("monitor", "Voice volume dropped off during the sound.");
    if (has(m.break_count) && m.break_count > 0) bump("monitor", "The voice broke up during the sustained sound.");
  }
  // A "fair" quality recording is never allowed to look more certain than it is.
  if (m?.quality?.status === "fair" && flag !== "typical") reasons.push("Recording quality was only fair, so treat this with extra caution.");
  return { flag, reason: reasons.join(" ") || "Values were within the typical screening range." };
}

export const EDUCATION = {
  tapping: "Slower, uneven or fading tapping can be one of several movement signals clinicians look at. Many things — tiredness, medication, injury — also affect tapping speed.",
  tremor: "Parkinson-related tremor often appears at 4–6 Hz. Normal physiological tremor, caffeine, stress and some medicines can also show up in this range.",
  spiral: "Cramped or shaky drawings are used in clinics to observe fine motor control. A single drawing on a phone screen is only a rough signal.",
  gait: "Slower walking, uneven steps and hesitant turning are movement signals clinicians observe. Footwear, pain, tiredness and where you carry the phone also change these numbers.",
  voice: "A softer, more monotone or less steady voice is one of the acoustic signals clinicians track. Phone microphones vary, so compare your own results over time.",
  blink: "A reduced blink rate and less facial movement (sometimes called facial masking) are signals clinicians look at. Concentration, dry eyes, contact lenses and lighting also change blinking, and this is a rough camera estimate.",
};