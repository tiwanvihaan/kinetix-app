import React, { useRef, useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import TestShell from "@/components/shared/TestShell";
import TestResult from "@/components/shared/TestResult";
import useSaveTest from "@/hooks/useSaveTest";
import UnreliableNotice from "@/components/shared/UnreliableNotice";
import { analyzeSpiral, referenceSpiral } from "@/lib/spiralAnalysis";

const SIZE = 340;
const GEOMETRY = { cx: SIZE / 2, cy: SIZE / 2, maxR: SIZE / 2 - 14 };

export default function SpiralTest() {
  const { save, saving, result, rejected, reset } = useSaveTest("spiral");
  const canvasRef = useRef(null);
  const points = useRef([]);
  const breaks = useRef([]);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [msg, setMsg] = useState("");
  const template = useMemo(() => referenceSpiral(GEOMETRY.cx, GEOMETRY.cy, GEOMETRY.maxR), []);

  const paint = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.beginPath();
    template.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = "#b8c7cc";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    points.current.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = "#0e5a6b";
    ctx.lineWidth = 3;
    ctx.stroke();
  };

  useEffect(() => { if (!result && !rejected) paint(); }, [result, rejected]);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE, t: performance.now(), p: e.pressure };
  };
  const down = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    // A second touch after the finger was lifted is recorded as a break, so the analysis can note it.
    if (points.current.length) breaks.current.push(points.current.length);
    drawing.current = true;
    points.current.push(pos(e));
    setHasInk(true);
  };
  const move = (e) => { if (!drawing.current) return; points.current.push(pos(e)); paint(); };
  const up = () => { drawing.current = false; };
  const clear = () => { points.current = []; breaks.current = []; setHasInk(false); setMsg(""); reset(); paint(); };

  const submit = async () => {
    const metrics = analyzeSpiral(points.current, GEOMETRY, { strokeBreaks: breaks.current });
    const hasPressure = points.current.some((p) => p.p && p.p > 0 && p.p !== 0.5);
    await save(metrics, { point_count: points.current.length }, hasPressure ? "Pressure supported" : "Pressure not available on this screen");
  };

  if (result) return <TestShell testType="spiral"><TestResult testType="spiral" {...result} onRetry={() => { reset(); clear(); }} /></TestShell>;
  if (rejected) return <TestShell testType="spiral"><UnreliableNotice quality={rejected} onRetry={clear} /></TestShell>;

  return (
    <TestShell testType="spiral">
      <p className="text-sm leading-relaxed">Start at the centre and trace the grey spiral outward with your index finger or a stylus, at your normal pace.</p>
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          aria-label="Spiral drawing area"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={{ touchAction: "none", width: "100%", maxWidth: SIZE, aspectRatio: "1/1" }}
          className="rounded-lg border bg-card"
        />
      </div>
      {msg && <p className="text-sm text-destructive" role="alert">{msg}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" onClick={clear}>Clear</Button>
        <Button size="lg" disabled={!hasInk || saving} onClick={submit}>{saving ? "Saving…" : "Finish"}</Button>
      </div>
    </TestShell>
  );
}