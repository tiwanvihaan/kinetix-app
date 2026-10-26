import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Square } from "lucide-react";
import ErrorNotice from "@/components/shared/ErrorNotice";
import TestShell from "@/components/shared/TestShell";
import TestResult from "@/components/shared/TestResult";
import UnreliableNotice from "@/components/shared/UnreliableNotice";
import VoicePlayback from "@/components/voice/VoicePlayback";
import useSaveTest from "@/hooks/useSaveTest";
import { analyzeVoice, waveformEnvelope } from "@/lib/voiceAnalysis";
import { startRecorder, decodeToMono } from "@/lib/audioCapture";

const MAX_S = 25;

export default function VoiceTest() {
  const { save, saving, result, rejected, reset } = useSaveTest("voice");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [review, setReview] = useState(null); // {blob, envelope, durationS, markers} kept in memory only
  const recRef = useRef(null);
  const timerRef = useRef(null);
  const t0 = useRef(0);
  const stopping = useRef(false);

  const start = async () => {
    setError("");
    setReview(null);
    reset();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError("Microphone recording isn’t supported in this browser."); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch { setError("Microphone permission was declined. Allow microphone access in your browser settings and try again."); return; }
    stopping.current = false;
    recRef.current = startRecorder(stream, (rms) => setLevel(Math.min(1, rms * 6)));
    t0.current = performance.now();
    setSecs(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      const s = (performance.now() - t0.current) / 1000;
      setSecs(s);
      if (s >= MAX_S) stop();
    }, 100);
  };

  const stop = async () => {
    if (stopping.current) return;
    stopping.current = true;
    clearInterval(timerRef.current);
    setRecording(false);
    setBusy(true);
    const blob = await recRef.current.stop();
    const decoded = await decodeToMono(blob);
    if (!decoded) {
      setBusy(false);
      setError("This browser couldn’t read the recording. Please try again, or use a different browser.");
      return;
    }
    // The analysis only reads the samples; the recording is never changed.
    const m = analyzeVoice(decoded.samples, decoded.sampleRate);
    // Playback is offered for every take, including ones too poor to measure, so the person can hear what went wrong.
    setReview({ blob, envelope: waveformEnvelope(decoded.samples), durationS: decoded.samples.length / decoded.sampleRate, markers: m.markers || [] });
    // Display-only data stays out of the saved record.
    const { envelope, markers, ...saved } = m;
    await save(saved, { duration_s: m.duration_s }, "Microphone analysis in browser; audio kept in memory only, never stored");
    setBusy(false);
  };

  const retry = () => { setReview(null); reset(); };

  return (
    <TestShell testType="voice">
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {rejected && <UnreliableNotice quality={rejected} onRetry={retry} />}
      {!result && !rejected && (
        <Card className="space-y-5 p-5">
          <p className="text-sm leading-relaxed">Hold the phone about 15–20 cm from your mouth in a quiet room. Take a deep breath, then say “Ahhhh” steadily at a comfortable volume for as long as you can.</p>
          <p className="text-xs text-muted-foreground">Audio is analyzed on your device and kept only in memory while this page is open. Only the computed numbers are saved — the recording is never stored or sent anywhere.</p>
          {recording && (
            <div className="space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${level * 100}%` }} /></div>
              <p className="text-center text-3xl font-semibold tabular-nums tracking-tight">{secs.toFixed(1)} s</p>
            </div>
          )}
          {!recording ? (
            <Button size="lg" className="w-full" disabled={saving || busy} onClick={start}><Mic className="h-4 w-4" /> {busy || saving ? "Analyzing…" : "Start recording"}</Button>
          ) : (
            <Button variant="destructive" size="lg" className="w-full" onClick={stop}><Square className="h-4 w-4" /> Stop</Button>
          )}
        </Card>
      )}
      {(result || rejected) && review && (
        <section className="space-y-2 rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold">Listen back</h2>
          <p className="text-xs text-muted-foreground">Highlighted areas mark moments the analysis flagged. Drag along the waveform to jump to any point. This audio disappears when you leave the page.</p>
          <VoicePlayback {...review} />
        </section>
      )}
      {result && <TestResult testType="voice" {...result} onRetry={retry} />}
    </TestShell>
  );
}