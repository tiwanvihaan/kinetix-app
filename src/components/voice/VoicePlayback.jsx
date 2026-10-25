import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

const W = 600;
const H = 80;

// Waveform with draggable playhead and flagged moments. Audio is played from memory on this device only.
export default function VoicePlayback({ blob, envelope, durationS, markers = [] }) {
  const audio = useRef(null);
  const wrap = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const tick = () => setPos(a.currentTime);
    const end = () => { setPlaying(false); setPos(0); };
    a.addEventListener("timeupdate", tick);
    a.addEventListener("ended", end);
    return () => { a.removeEventListener("timeupdate", tick); a.removeEventListener("ended", end); };
  }, [url]);

  const seekTo = (clientX) => {
    const r = wrap.current.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    audio.current.currentTime = f * durationS;
    setPos(f * durationS);
  };
  const drag = useRef(false);

  const toggle = () => {
    const a = audio.current;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };

  if (!url || !envelope?.length) return null;
  const barW = W / envelope.length;
  const visible = markers.filter((m) => m.kind === "break" || m.kind === "clipping");

  return (
    <div className="space-y-2">
      <audio ref={audio} src={url} preload="auto" />
      <div
        ref={wrap}
        role="slider"
        aria-label="Recording position"
        aria-valuemin={0}
        aria-valuemax={Math.round(durationS)}
        aria-valuenow={Math.round(pos)}
        tabIndex={0}
        className="relative touch-none select-none rounded-md border bg-card"
        onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); seekTo(e.clientX); }}
        onPointerMove={(e) => { if (drag.current) seekTo(e.clientX); }}
        onPointerUp={() => { drag.current = false; }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") audio.current.currentTime = Math.min(durationS, pos + 1);
          if (e.key === "ArrowLeft") audio.current.currentTime = Math.max(0, pos - 1);
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-20 w-full" preserveAspectRatio="none" aria-hidden="true">
          {visible.map((m, i) => (
            <rect key={i} x={(m.t / durationS) * W} y={0} width={Math.max(3, (((m.end ?? m.t + 0.1) - m.t) / durationS) * W)} height={H} className={m.kind === "break" ? "fill-amber-200" : "fill-rose-200"} />
          ))}
          {envelope.map((v, i) => {
            const h = Math.max(1.5, v * H * 0.95);
            return <rect key={i} x={i * barW} y={(H - h) / 2} width={Math.max(0.8, barW - 0.6)} height={h} className="fill-primary/70" />;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${(pos / durationS) * 100}%` }} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={toggle}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {playing ? "Pause" : "Play"}
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">{pos.toFixed(1)} / {durationS.toFixed(1)} s</span>
      </div>
      {visible.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {visible.map((m, i) => (
            <li key={i}>
              <button type="button" className="underline-offset-2 hover:underline" onClick={() => { audio.current.currentTime = Math.max(0, m.t - 0.3); setPos(m.t); }}>
                {m.t.toFixed(1)} s
              </button>{" "}
              · {m.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}