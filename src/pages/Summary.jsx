import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { TESTS, TEST_ORDER, EDUCATION } from "@/lib/testCatalog";
import { getActiveSessionId, endActiveSession } from "@/lib/sessionApi";
import { getResults, getReportName, setReportName } from "@/lib/localStore";
import MetricGrid from "@/components/shared/MetricGrid";
import FlagBadge from "@/components/shared/FlagBadge";
import Disclaimer from "@/components/shared/Disclaimer";
import ReportActions from "@/components/shared/ReportActions";
import { KEY_METRIC } from "@/lib/keyMetrics";

function Delta({ cur, prev }) {
  if (cur == null || prev == null) return <span className="text-xs text-muted-foreground">No prior result</span>;
  const d = Math.round((cur - prev) * 100) / 100;
  const Icon = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus;
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {d > 0 ? "+" : ""}{d} vs last time</span>;
}

export default function Summary() {
  const sid = getActiveSessionId();
  const all = getResults();
  const [name, setName] = useState(getReportName);
  const current = all.filter((s) => s.session_id === sid);
  const flagged = current.filter((s) => s.flag !== "typical");
  const missing = TEST_ORDER.filter((t) => !current.some((s) => s.test_type === t));

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-5 pb-12 pt-4 sm:pt-8">
      <Link to="/" className="-ml-1 inline-flex h-11 items-center gap-0.5 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mb-6 mt-2 text-2xl">Session summary</h1>

      {!current.length && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">No tests completed in this session yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Run an assessment and your results will appear here.</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/test/tapping">Start with finger tapping</Link></Button>
        </div>
      )}

      {current.length > 0 && (
        <div className="divide-y overflow-hidden rounded-lg border bg-card">
          {current.map((s) => {
            const km = KEY_METRIC[s.test_type];
            const prev = all.find((x) => x.test_type === s.test_type && x.session_id !== sid && x.completed_at < s.completed_at);
            return (
              <section key={s.id} className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base">{TESTS[s.test_type].title}</h2>
                  <FlagBadge flag={s.flag} />
                </div>
                <MetricGrid testType={s.test_type} metrics={s.metrics} />
                <Delta cur={s.metrics?.[km]} prev={prev?.metrics?.[km]} />
                <div className="space-y-1.5">
                  <p className="text-sm leading-relaxed">{s.flag_reason}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{EDUCATION[s.test_type]}</p>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {missing.length > 0 && current.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-base">Not yet completed</h2>
          <div className="flex flex-wrap gap-2">
            {missing.map((t) => <Button key={t} asChild variant="outline"><Link to={TESTS[t].path}>{TESTS[t].short}</Link></Button>)}
          </div>
        </section>
      )}

      {current.length > 0 && (
        <section className="mt-8 rounded-lg bg-accent p-5">
          <h2 className="mb-2 text-base">Suggested next steps</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            {flagged.length === 0 && <li>Everything measured today was in the typical screening range. Keep repeating tests regularly to build your baseline.</li>}
            {flagged.length > 0 && <li>{flagged.length} measure{flagged.length > 1 ? "s were" : " was"} worth a closer look. Repeat in a few days under similar conditions to see if it persists.</li>}
            {flagged.some((f) => f.flag === "discuss") && <li>Consider printing this report and talking it through with a doctor or neurologist.</li>}
            <li>If you notice new symptoms, don’t wait for the app — contact a healthcare professional.</li>
          </ul>
        </section>
      )}

      {all.length > 0 && (
        <section className="mt-8 space-y-3">
          <div>
            <h2 className="text-base">Printable report</h2>
            <p className="mt-1 text-sm text-muted-foreground">Includes your latest results with changes from your previous ones.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rn" className="text-sm font-medium">Name on report <span className="font-normal text-muted-foreground">(optional, only appears on the printout)</span></Label>
            <Input id="rn" value={name} onChange={(e) => { setName(e.target.value); setReportName(e.target.value); }} />
          </div>
          <ReportActions name={name} sessions={all} />
        </section>
      )}

      <Button asChild size="lg" className="mt-8 w-full" onClick={endActiveSession}><Link to="/">Done</Link></Button>
      <Disclaimer className="mt-10 border-t pt-5" />
    </div>
  );
}