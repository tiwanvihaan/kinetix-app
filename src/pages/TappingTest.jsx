import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import TestShell from "@/components/shared/TestShell";
import TestResult from "@/components/shared/TestResult";
import useSaveTest from "@/hooks/useSaveTest";
import UnreliableNotice from "@/components/shared/UnreliableNotice";
import { analyzeTapping } from "@/lib/tappingAnalysis";

const DURATION = 15000;

export default function TappingTest() {
  const { save, saving, result, rejected, reset } = useSaveTest("tapping");
  const [phase, setPhase] = useState("intro"); // intro | running | done
  const [elapsed, setElapsed] = useState(0);
  const [count, setCount] = useState(0);
  const [lastSide, setLastSide] = useState(null);
  const taps = useRef([]);
  const startRef = useRef(0);
  const downAt = useRef(null);

  const begin = () => {
    taps.current = [];
    setCount(0);
    setLastSide(null);
    setElapsed(0);
    reset();
    setPhase("running");
    startRef.current = 0;
  };

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      if (!startRef.current) return;
      const e = performance.now() - startRef.current;
      setElapsed(e);
      if (e >= DURATION) {
        clearInterval(id);
        finish();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [phase]);

  const finish = async () => {
    setPhase("done");
    const metrics = analyzeTapping(taps.current, DURATION);
    await save(metrics, { intervals: taps.current.slice(1).map((t, i) => Math.round(t.t - taps.current[i].t)) });
  };

  const tap = (side) => {
    if (phase !== "running") return;
    const now = performance.now();
    if (!startRef.current) startRef.current = now;
    const entry = { t: now - startRef.current, side };
    taps.current.push(entry);
    downAt.current = { entry, now };
    setCount((c) => c + 1);
    setLastSide(side);
  };

  // How long the finger stayed down lets the analysis ignore a press-and-hold.
  const release = () => {
    const d = downAt.current;
    if (d) d.entry.dur = performance.now() - d.now;
    downAt.current = null;
  };

  return (
    <TestShell testType="tapping">
      {phase === "intro" && (
        <Card className="space-y-4 p-5">
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            <li>Rest your hand on a table with the phone in front of you.</li>
            <li>Use your index and middle finger to alternate between the two buttons.</li>
            <li>Tap as fast and evenly as you can. The timer starts at your first tap.</li>
          </ol>
          <Button size="lg" className="w-full" onClick={begin}>Start</Button>
        </Card>
      )}
      {rejected && <UnreliableNotice quality={rejected} onRetry={() => { reset(); setPhase("intro"); }} />}
      {phase !== "intro" && !result && !rejected && (
        <div className="space-y-3">
          <Progress value={(elapsed / DURATION) * 100} />
          <p className="text-center text-sm text-muted-foreground tabular-nums">
            {startRef.current ? `${Math.max(0, (DURATION - elapsed) / 1000).toFixed(1)} s left` : "Tap to begin"} · {count} taps
          </p>
          <div className="grid grid-cols-2 gap-3">
            {["L", "R"].map((s) => (
              <button
                key={s}
                aria-label={s === "L" ? "Left tap button" : "Right tap button"}
                disabled={phase !== "running"}
                onPointerDown={(e) => { e.preventDefault(); tap(s); }}
                onPointerUp={release}
                onPointerCancel={release}
                className={`h-64 touch-manipulation select-none rounded-lg text-xl font-medium transition-colors sm:h-72 ${
                  lastSide === s ? "bg-primary/70 text-primary-foreground" : "bg-primary text-primary-foreground"
                } disabled:opacity-60`}
              >
                {s === "L" ? "Index" : "Middle"}
              </button>
            ))}
          </div>
          {saving && <p className="text-center text-sm text-muted-foreground">Saving…</p>}
        </div>
      )}
      {result && <TestResult testType="tapping" {...result} onRetry={() => setPhase("intro")} />}
    </TestShell>
  );
}