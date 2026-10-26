import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { TESTS, TEST_ORDER } from "@/lib/testCatalog";
import { getResults } from "@/lib/localStore";
import FlagBadge from "@/components/shared/FlagBadge";
import Disclaimer from "@/components/shared/Disclaimer";

export default function Assessments() {
  const [sessions] = useState(getResults);
  const latestBy = (t) => sessions.find((s) => s.test_type === t);

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-6 pb-16 pt-9 sm:pt-12 lg:px-5 lg:pb-12 lg:pt-8">
      <header className="mb-8 lg:mb-6">
        <h1 className="text-3xl tracking-tight lg:text-2xl">Assessments</h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground lg:mt-1 lg:text-sm">Six short, on-device checks. Each takes one to two minutes.</p>
      </header>

      <div className="space-y-4 lg:space-y-3">
        {TEST_ORDER.map((t) => {
          const info = TESTS[t];
          const Icon = info.icon;
          const latest = latestBy(t);
          return (
            <article key={t} className="assessment-card rounded-xl border bg-card p-5 text-card-foreground lg:rounded-lg lg:p-4">
              <div className="flex items-start gap-4">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[15px] font-medium leading-tight">{info.title}</h2>
                    {latest && <FlagBadge flag={latest.flag} />}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-card-foreground">{info.blurb}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-card-foreground">
                      {latest ? `Last taken ${new Date(latest.completed_at).toLocaleDateString()}` : `About ${info.minutes} min · not yet taken`}
                    </span>
                    <Link
                      to={info.path}
                      className="inline-flex h-11 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-card-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9 lg:px-3"
                    >
                      <Play className="h-4 w-4" /> Start
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Disclaimer className="mt-10 border-t pt-5" />
    </div>
  );
}
