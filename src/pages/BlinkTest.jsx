import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import ErrorNotice from "@/components/shared/ErrorNotice";
import TestShell from "@/components/shared/TestShell";
import TestResult from "@/components/shared/TestResult";
import useSaveTest from "@/hooks/useSaveTest";
import UnreliableNotice from "@/components/shared/UnreliableNotice";
import { analyzeBlink } from "@/lib/blinkAnalysis";
import { measureFrame, W, H } from "@/lib/blinkFrame";

const DURATION_MS = 45000;

export default function BlinkTest() {
  const { save, saving, result, rejected, reset } = useSaveTest("blink");
  const [stage, setStage] = useState("intro"); // intro | running | done
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const video = useRef(null);
  const canvas = useRef(document.createElement("canvas"));
  const stream = useRef(null);
  const frames = useRef([]);
  const prev = useRef(null);
  const loop = useRef(null);
  const t0 = useRef(0);

  const stopCamera = () => {
    clearInterval(loop.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => stopCamera, []);

  const begin = async () => {
    setError("");
    reset();
    frames.current = [];
    prev.current = null;
    if (!navigator.mediaDevices?.getUserMedia) { setError("This browser can’t access the camera."); return; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 }, audio: false });
    } catch { setError("Camera permission was declined. Enable it in your browser settings to run this test."); return; }
    setStage("running");
    setProgress(0);
  };

  // Attach the stream once the video element is on screen, then sample frames.
  useEffect(() => {
    if (stage !== "running" || !video.current || !stream.current) return;
    video.current.srcObject = stream.current;
    video.current.play().catch(() => {});
    const c = canvas.current;
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    t0.current = performance.now();
    loop.current = setInterval(() => {
      const now = performance.now() - t0.current;
      setProgress(Math.min(100, (now / DURATION_MS) * 100));
      if (video.current.readyState >= 2) {
        ctx.drawImage(video.current, 0, 0, W, H);
        const img = ctx.getImageData(0, 0, W, H).data;
        // Only numbers are kept from each image; the image itself is discarded immediately.
        const { frame, carry } = measureFrame(img, prev.current);
        prev.current = carry;
        frames.current.push({ t: now, ...frame });
      }
      if (now >= DURATION_MS) finish();
    }, 66);
  }, [stage]);

  const finish = async () => {
    stopCamera();
    setStage("done");
    const m = analyzeBlink(frames.current);
    await save(m, {}, "Front camera, on-device estimate");
  };

  return (
    <TestShell testType="blink">
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {stage === "intro" && (
        <Card className="space-y-4 p-5">
          <p className="text-sm leading-relaxed">Hold the phone at eye level in a well-lit room and look at the front camera for 45 seconds. Blink naturally and relax your face — you can quietly count backwards from 100 by 7s.</p>
          <p className="text-sm text-muted-foreground">The camera image is analyzed on your device and is never recorded, saved or sent anywhere. This is a rough estimate of blink rate and facial movement, not a clinical measurement.</p>
          <Button size="lg" className="w-full" onClick={begin}>Allow camera & begin</Button>
        </Card>
      )}
      {stage === "running" && (
        <Card className="space-y-4 p-5">
          <div className="relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-md bg-black">
            <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-4/5 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white/70" />
          </div>
          <p className="text-center text-sm text-muted-foreground">Keep your face inside the oval and look at the camera.</p>
          <Progress value={progress} />
        </Card>
      )}
      {rejected && <UnreliableNotice quality={rejected} onRetry={() => { reset(); setStage("intro"); }} />}
      {stage === "done" && !result && !rejected && <p className="text-center text-sm text-muted-foreground">{saving ? "Analyzing and saving…" : ""}</p>}
      {result && <TestResult testType="blink" {...result} onRetry={() => setStage("intro")} />}
    </TestShell>
  );
}