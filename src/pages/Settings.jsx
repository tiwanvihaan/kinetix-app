import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FileText, Lock, ChevronRight, SlidersHorizontal } from "lucide-react";
import { getResults, getReportName, setReportName, getPrefs, setPrefs } from "@/lib/localStore";
import ReportActions from "@/components/shared/ReportActions";
import ClearDataButton from "@/components/dashboard/ClearDataButton";
import Disclaimer from "@/components/shared/Disclaimer";

function PrefRow({ id, label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
        <p className="mt-0.5 text-xs text-muted-card-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function Settings() {
  const [sessions, setSessions] = useState(getResults);
  const [name, setName] = useState(getReportName);
  const [prefs, setPrefsState] = useState(getPrefs);

  const hasResults = sessions.length > 0;

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-6 pb-16 pt-9 sm:pt-12 lg:px-5 lg:pb-12 lg:pt-8">
      <header className="mb-8 lg:mb-6">
        <h1 className="text-3xl tracking-tight lg:text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything here stays on this device.</p>
      </header>

      {/* Doctor report */}
      <section className="mb-6 rounded-lg border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4.5 w-4.5 text-muted-card-foreground" aria-hidden="true" />
          <h2 className="text-base">Report for your doctor</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-card-foreground">
          Print a summary of your latest results to bring to an appointment. Nothing is sent anywhere — the report is generated on this device.
        </p>
        {hasResults ? (
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rn" className="text-sm font-medium">Name on report <span className="font-normal text-muted-card-foreground">(optional)</span></Label>
              <Input id="rn" value={name} onChange={(e) => { setName(e.target.value); setReportName(e.target.value); }} />
            </div>
            <ReportActions name={name} sessions={sessions} />
          </div>
        ) : (
          <div className="mt-4">
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-card-foreground">Run an assessment first, then you can print its results.</p>
            <Button asChild variant="outline" className="mt-3"><Link to="/assessments">Go to assessments</Link></Button>
          </div>
        )}
      </section>

      {/* Privacy & data */}
      <section className="mb-6 rounded-lg border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Lock className="h-4.5 w-4.5 text-muted-card-foreground" aria-hidden="true" />
          <h2 className="text-base">Privacy & data</h2>
        </div>
        <ul className="space-y-2 text-sm leading-relaxed text-muted-card-foreground">
          <li>Results, the optional report name, and your preferences are stored only in this browser on this device.</li>
          <li>Kinetix does not use accounts, cloud sync, analytics, or any server storage.</li>
          <li>Clearing your browser data erases everything saved here.</li>
        </ul>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link to="/history">View saved history <ChevronRight className="h-4 w-4" /></Link>
          </Button>
          <ClearDataButton onCleared={() => { setSessions([]); setName(""); }} />
        </div>
      </section>

      {/* App preferences */}
      <section className="mb-6 rounded-lg border bg-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <SlidersHorizontal className="h-4.5 w-4.5 text-muted-card-foreground" aria-hidden="true" />
          <h2 className="text-base">App preferences</h2>
        </div>
        <div className="mt-2 divide-y">
          <PrefRow
            id="reduce-motion"
            label="Reduce motion"
            description="Minimise animations and transitions across the app."
            checked={prefs.reduceMotion}
            onChange={(v) => setPrefsState(setPrefs({ reduceMotion: v }))}
          />
          <PrefRow
            id="larger-text"
            label="Larger text"
            description="Scale up the base text size for easier reading."
            checked={prefs.largerText}
            onChange={(v) => setPrefsState(setPrefs({ largerText: v }))}
          />
        </div>
      </section>

      <Disclaimer className="border-t pt-5" />
    </div>
  );
}