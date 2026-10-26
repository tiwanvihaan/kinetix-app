// Per-frame measurements from a small camera image (RGBA pixels, W x H). No image is kept: only these numbers.
//
// There is no face detector on-device here, so `face` is a PROXY: how much of the oval looks like a lit, textured, skin-toned
// face rather than an empty or flat background. Frames where the proxy is low are excluded from the blink analysis,
// never counted as "not blinking".

export const W = 160;
export const H = 120;

// Regions as fractions of the frame: [x, y, w, h].
export const REGIONS = {
  eyeL: [0.28, 0.34, 0.14, 0.08],
  eyeR: [0.58, 0.34, 0.14, 0.08],
  brow: [0.28, 0.24, 0.44, 0.07],
  mouth: [0.36, 0.64, 0.28, 0.14],
  oval: [0.25, 0.12, 0.5, 0.76],
};

const luma = (img, k) => 0.299 * img[k] + 0.587 * img[k + 1] + 0.114 * img[k + 2];
const avg = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const spread = (a) => { const m = avg(a); return Math.sqrt(avg(a.map((v) => (v - m) ** 2))); };

export function regionLuma(img, [x, y, w, h]) {
  const px = [];
  const x0 = Math.floor(x * W), y0 = Math.floor(y * H), x1 = Math.floor((x + w) * W), y1 = Math.floor((y + h) * H);
  for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) px.push(luma(img, (j * W + i) * 4));
  return px;
}

// Share of pixels in the oval that are skin-toned (simple RGB rule that works across a wide range of skin tones).
function skinShare(img) {
  const [x, y, w, h] = REGIONS.oval;
  const x0 = Math.floor(x * W), y0 = Math.floor(y * H), x1 = Math.floor((x + w) * W), y1 = Math.floor((y + h) * H);
  let skin = 0, n = 0;
  for (let j = y0; j < y1; j += 2) {
    for (let i = x0; i < x1; i += 2) {
      const k = (j * W + i) * 4;
      const r = img[k], g = img[k + 1], b = img[k + 2];
      n += 1;
      if (r > 40 && r > g && g > b * 0.8 && r - b > 12 && Math.max(r, g, b) - Math.min(r, g, b) > 10) skin += 1;
    }
  }
  return n ? skin / n : 0;
}

// previous: the previous frame's whole-image luma samples (or null). Returns {frame, whole} to carry forward.
export function measureFrame(img, previous) {
  const eyes = [...regionLuma(img, REGIONS.eyeL), ...regionLuma(img, REGIONS.eyeR)];
  const lower = [...regionLuma(img, REGIONS.brow), ...regionLuma(img, REGIONS.mouth)];
  const ovalPx = regionLuma(img, REGIONS.oval);
  const bright = avg(ovalPx);
  // Whole-frame motion on a coarse grid: head or camera movement shows up everywhere, a blink only in the eye area.
  const whole = [];
  for (let j = 0; j < H; j += 6) for (let i = 0; i < W; i += 6) whole.push(luma(img, (j * W + i) * 4));
  const shift = previous && previous.whole.length === whole.length ? avg(whole.map((v, i) => Math.abs(v - previous.whole[i]))) / 255 * 8 : 0;
  const move = previous && previous.lower.length === lower.length ? avg(lower.map((v, i) => Math.abs(v - previous.lower[i]))) / 255 : 0;
  // A real face has texture and skin tone inside the oval; an empty wall or a covered lens does not.
  const face = Math.min(1, skinShare(img) * 1.6) * (spread(ovalPx) > 12 ? 1 : 0.3);
  return {
    frame: { eye: spread(eyes) / 128, bright, face, shift, move },
    carry: { whole, lower },
  };
}