import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import ErrorNotice from "@/components/shared/ErrorNotice";
import TestShell from "@/components/shared/TestShell";
import TestResult from "@/components/shared/TestResult";
import useSaveTest from "@/hooks/useSaveTest";
import UnreliableNotice from "@/components/shared/UnreliableNotice";
import { analyzeGait } from "@/lib/gaitAnalysis";

const MAX_MS = 90000;
const COUNTDOWN_S = 10;

const speak = (text) => {
  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  } catch { /* audio cues are optional */ }
};

export default function GaitTest() {
  const { save, saving, result, rejected, reset } = useSaveTest("gait");
  const [stage, setStage] = useState("intro"); // intro | countdown | walking | turning | back | done
  const [count, setCount] = useState(COUNTDOWN_S);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const samples = useRef([]);
  const turn = useRef({ startMs: null, endMs: null });
  const handler = useRef(null);
  const timer = useRef(null);
  const t0 = useRef(0);
  const gyroOk = useRef(false);

  const supported = typeof window !== "undefined" && "DeviceMotionEvent" in window;

  const begin = async () => {
    setError("");
    reset();
    samples.current = [];
    turn.current = { startMs: null, endMs: null };
    if (!supported) { setError("This device or browser doesn’t provide motion sensors. Please open the app on a smartphone."); return; }
    try {
      if (typeof DeviceMotionEvent.requestPermission === "function") {
        const r = await DeviceMotionEvent.requestPermission();
        if (r !== "granted") { setError("Motion sensor permission was declined. Enable it in your browser settings to run this test."); return; }
      }
    } catch { setError("Couldn’t get motion sensor permission."); return; }
    speak("Place the phone in your pocket or at your waistband. Starting in ten seconds.");
    setStage("countdown");
    let c = COUNTDOWN_S;
    setCount(c);
    timer.current = setInterval(() => {
      c -= 1;
      setCount(c);
      if (c <= 0) { clearInterval(timer.current); startRecording(); }
    }, 1000);
  };

  const startRecording = () => {
    setStage("walking");
    speak("Go. Walk in a straight line for twenty meters.");
    t0.current = performance.now();
    handler.current = (e) => {
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a || a.x == null) return;
      const r = e.rotationRate;
      // device may be in any orientation, so use the strongest rotation axis as the "turning" signal
      const gz = r && r.alpha != null ? [r.alpha, r.beta, r.gamma].reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0) : null;
      if (gz != null) gyroOk.current = true;
      samples.current.push({ t: performance.now() - t0.current, mag: Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2), gz });
    };
    window.addEventListener("devicemotion", handler.current);
    timer.current = setInterval(() => {
      const e = performance.now() - t0.current;
      setElapsed(e);
      if (e > MAX_MS) finishRef.current();
    }, 250);
  };

  const stopRecording = () => {
    clearInterval(timer.current);
    window.removeEventListener("devicemotion", handler.current);
  };

  const markTurnStart = () => {
    turn.current.startMs = performance.now() - t0.current;
    setStage("turning");
    speak("Turn around now.");
  };
  const markTurnEnd = () => {
    turn.current.endMs = performance.now() - t0.current;
    setStage("back");
    speak("Walk back to where you started.");
  };

  const finish = async () => {
    stopRecording();
    setStage("done");
    speak("Finished. Well done.");
    const m = analyzeGait(samples.current, turn.current.startMs != null && turn.current.endMs != null ? { startMs: turn.current.startMs, endMs: turn.current.endMs } : null);
    await save(m, { step_count: m.step_count }, gyroOk.current ? "Accelerometer + gyroscope" : "Accelerometer only (turn time unavailable)");
  };

  const finishRef = useRef(finish);
  finishRef.current = finish;

  const active = ["walking", "turning", "back"].includes(stage);

  return (
    <TestShell testType="gait">
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {stage === "intro" && (
        <Card className="space-y-4 p-5">
          <p className="text-sm leading-relaxed">You’ll need about 20 meters of clear, flat space. Put the phone in a front pocket or secure it at your waistband, then walk 20 m in a straight line, turn 180°, and walk back at your normal pace.</p>
          <p className="text-sm text-muted-foreground">You’ll get a 10-second countdown and spoken cues. Motion data is analyzed on your device and never sent anywhere. Walk somewhere safe, free of obstacles.</p>
          <Button size="lg" className="w-full" onClick={begin}>Allow sensors & begin</Button>
        </Card>
      )}
      {stage === "countdown" && (
        <Card className="space-y-2 px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">Place the phone at your waist or in a pocket.</p>
          <p className="text-6xl font-semibold tabular-nums tracking-tight">{count}</p>
        </Card>
      )}
      {active && (
        <Card className="space-y-4 p-5">
          <p className="text-sm font-medium leading-relaxed">
            {stage === "walking" && "Walk straight ahead for about 20 meters."}
            {stage === "turning" && "Turn around 180°, then tap when you’re facing back."}
            {stage === "back" && "Walk back to where you started, then tap Finish."}
          </p>
          <Progress value={Math.min(100, (elapsed / MAX_MS) * 100)} />
          <p className="text-center text-sm text-muted-foreground tabular-nums">Recording… {Math.round(elapsed / 1000)} s</p>
          {stage === "walking" && <Button size="lg" className="w-full" onClick={markTurnStart}>I’m at the turning point</Button>}
          {stage === "turning" && <Button size="lg" className="w-full" onClick={markTurnEnd}>Turn done — walking back</Button>}
          {stage === "back" && <Button size="lg" className="w-full" onClick={finish}>Finish</Button>}
        </Card>
      )}
      {rejected && <UnreliableNotice quality={rejected} onRetry={() => { reset(); setStage("intro"); }} />}
      {stage === "done" && !result && !rejected && <p className="text-center text-sm text-muted-foreground">{saving ? "Analyzing and saving…" : ""}</p>}
      {result && <TestResult testType="gait" {...result} onRetry={() => setStage("intro")} />}
    </TestShell>
  );
}