import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, Lock } from "lucide-react";
import { endActiveSession } from "@/lib/sessionApi";
import Disclaimer from "@/components/shared/Disclaimer";
import KinetixLogo from "@/components/shared/KinetixLogo";

export default function Dashboard() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 pb-16 pt-12 sm:pt-16 lg:px-5 lg:pb-12 lg:pt-14">
      <div className="flex flex-1 flex-col justify-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground lg:h-12 lg:w-12">
          <KinetixLogo className="h-9 w-9 lg:h-7 lg:w-7" strokeWidth={2.2} />
        </span>
        <h1 className="mt-7 text-4xl tracking-tight sm:text-5xl lg:mt-6 lg:text-3xl">Kinetix</h1>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground sm:text-xl lg:mt-3 lg:text-base">
          Kinetix is a Parkinson&rsquo;s self-monitoring companion. It assists you with Parkinson&rsquo;s by privately tracking small changes in your movement, speech, and facial patterns — helping you spot trends and prepare a clear report to bring to your doctor visits.
        </p>
        <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground lg:text-sm">
          It&rsquo;s a self-monitoring tool, not a treatment: Kinetix doesn&rsquo;t diagnose or treat Parkinson&rsquo;s, and it never replaces professional medical advice.
        </p>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground lg:mt-2">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" /> Results stay on this device. Nothing is collected.
        </p>

        <div className="mt-9 lg:mt-8">
          <Button asChild size="lg" className="h-14 w-full text-base sm:w-auto sm:px-10 lg:h-11 lg:px-8" onClick={endActiveSession}>
            <Link to="/assessments"><Play className="h-5 w-5" /> Start session</Link>
          </Button>
        </div>
      </div>

      <footer className="pt-10 lg:pt-6">
        <Disclaimer />
      </footer>
    </div>
  );
}