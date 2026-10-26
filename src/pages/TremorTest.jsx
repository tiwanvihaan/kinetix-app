import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import ErrorNotice from "@/components/shared/ErrorNotice";
import TestShell from "@/components/shared/TestShell";
import TestResult from "@/components/shared/TestResult";
import useSaveTest from "@/hooks/useSaveTest";
import UnreliableNotice from "@/components/shared/UnreliableNotice";
import { analyzeTremor } from "@/lib/tremorAnalysis";

const PHASE_MS = 10000;
const INSTR = {
  rest: "Resting phase: rest your hand flat on your lap or a table with the phone on your palm. Stay relaxed.",
  postural: "Postural phase: extend your arm straight out in front of you, phone flat on your palm.",
};

export default function TremorTest() {
  const { save, saving, result, rejected, reset } = useSaveTest("tremor");
  const [stage, setStage] = useState("intro"); // intro | rest-ready | rest | postural-ready | postural | done
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const data = useRef({ rest: [], postural: [] });
  const handler = useRef(null);
  const startedAt = useRef(0);
  const gyroOk = useRef(false);

  const supported = typeof window !== "undefined" && "DeviceMotionEvent" in window;

  const requestAccess = async () => {
    setError("");
    reset();
    data.current = { rest: [], postural: [] };
    if (!supported) { setError("This device or browser doesn’t provide motion sensors. Please open the app on a smartphone."); return; }
    try {
      if (typeof DeviceMotionEvent.requestPermission === "function") {
        const r = await DeviceMotionEvent.requestPermission();
        if (r !== "granted") { setError("Motion sensor permission was declined. Enable it in your browser settings to run this test."); return; }
      }
    } catch (e) { setError("Couldn’t get motion sensor permission."); return; }
    setStage("rest-ready");
  };

  const runPhase = (phase) => {
    setStage(phase);
    setProgress(0);
    startedAt.current = performance.now();
    const arr = data.current[phase];
    handler.current = (e) => {
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a || a.x == null) return;
      const mag = Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2);
      const r = e.rotationRate;
      const g = r && r.alpha != null ? Math.sqrt(r.alpha ** 2 + r.beta ** 2 + r.gamma ** 2) : null;
      if (g != null) gyroOk.current = true;
      arr.push({ t: performance.now(), mag, g });
    };
    window.addEventListener("devicemotion", handler.current);
    const iv = setInterval(async () => {
      const e = performance.now() - startedAt.current;
      setProgress((e / PHASE_MS) * 100);
      if (e >= PHASE_MS) {
        clearInterval(iv);
        window.removeEventListener("devicemotion", handler.current);
        if (phase === "rest") setStage("postural-ready");
        else finish();
      }
    }, 100);
  };

  const finish = async () => {
    setStage("done");
    const { rest, postural } = data.current;
    if (rest.length < 10 && postural.length < 10) {
      setError("No motion data was received. Your device may not have an accelerometer, or the browser blocked access.");
      setStage("intro");
      return;
    }
    // Timestamped samples go straight to the analysis, which resamples them evenly and skips sensor gaps.
    const metrics = analyzeTremor({ rest, postural });
    await save(metrics, { rest_samples: rest.length, postural_samples: postural.length }, gyroOk.current ? "Accelerometer + gyroscope" : "Accelerometer only");
  };

  const running = stage === "rest" || stage === "postural";

  return (
    <TestShell testType="tremor">
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {stage === "intro" && (
        <Card className="space-y-4 p-5">
          <p className="text-sm leading-relaxed">We’ll record your phone’s motion sensors for two 10-second phases. Sensor data is analyzed on your device and never sent anywhere.</p>
          <p className="text-sm text-muted-foreground">Your browser may ask permission to use motion sensors.</p>
          <Button size="lg" className="w-full" onClick={requestAccess}>Allow sensors & begin</Button>
        </Card>
      )}
      {(stage === "rest-ready" || stage === "postural-ready") && (
        <Card className="space-y-4 p-5">
          <p className="text-sm leading-relaxed">{INSTR[stage === "rest-ready" ? "rest" : "postural"]}</p>
          <Button size="lg" className="w-full" onClick={() => runPhase(stage === "rest-ready" ? "rest" : "postural")}>
            Start 10-second {stage === "rest-ready" ? "resting" : "postural"} phase
          </Button>
        </Card>
      )}
      {running && (
        <Card className="space-y-4 p-5">
          <p className="text-sm leading-relaxed">{INSTR[stage]}</p>
          <Progress value={progress} />
          <p className="text-center text-sm text-muted-foreground">Hold still… recording</p>
        </Card>
      )}
      {rejected && <UnreliableNotice quality={rejected} onRetry={() => { reset(); setStage("intro"); }} />}
      {stage === "done" && !result && !rejected && <p className="text-center text-sm text-muted-foreground">{saving ? "Analyzing and saving…" : ""}</p>}
      {result && <TestResult testType="tremor" {...result} onRetry={() => setStage("intro")} />}
    </TestShell>
  );
}