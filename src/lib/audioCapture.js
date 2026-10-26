// Records microphone audio with MediaRecorder and decodes it to mono Float32 samples for analysis.
// The recording stays in memory on this device. Nothing is uploaded and nothing is written to storage.

export function startRecorder(stream, onLevel) {
  const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) => window.MediaRecorder?.isTypeSupported?.(m));
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };

  // Live level meter only; the analysis uses the decoded recording, not this.
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const meter = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let e = 0;
    for (let i = 0; i < buf.length; i++) e += buf[i] * buf[i];
    onLevel?.(Math.sqrt(e / buf.length));
  }, 50);

  rec.start(250);

  const stop = () =>
    new Promise((resolve) => {
      rec.onstop = async () => {
        clearInterval(meter);
        ctx.close();
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        resolve(blob);
      };
      if (rec.state !== "inactive") rec.stop();
      else rec.onstop();
    });
  return { stop };
}

// Decode a recorded blob to mono samples at its native rate. Returns null if the browser cannot decode it.
export async function decodeToMono(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    const ch = audio.numberOfChannels;
    const out = new Float32Array(audio.length);
    for (let c = 0; c < ch; c++) {
      const data = audio.getChannelData(c);
      for (let i = 0; i < out.length; i++) out[i] += data[i] / ch;
    }
    return { samples: out, sampleRate: audio.sampleRate };
  } catch {
    return null;
  } finally {
    ctx.close();
  }
}