import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { TESTS, TEST_ORDER } from "@/lib/testCatalog";
import { getResults } from "@/lib/localStore";
import FlagBadge from "@/components/shared/FlagBadge";
import Disclaimer from "@/components/shared/Disclaimer";

export default function History() {
  const sessions = getResults();
  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-5 pb-12 pt-4 sm:pt-8">
      <Link to="/" className="-ml-1 inline-flex h-11 items-center gap-0.5 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mb-6 mt-2 text-2xl">History</h1>
      <div className="space-y-8">
        {TEST_ORDER.map((t) => {
          const rows = sessions.filter((s) => s.test_type === t);
          return (
            <section key={t}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-base">{TESTS[t].title}</h2>
                <span className="text-xs text-muted-foreground">{rows.length} result{rows.length === 1 ? "" : "s"}</span>
              </div>
              {rows.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No results yet.</p>
              ) : (
                <div className="divide-y overflow-hidden rounded-lg border bg-card">
                  {rows.slice(0, 5).map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="tabular-nums">{new Date(s.completed_at).toLocaleString()}</span>
                      <FlagBadge flag={s.flag} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <Disclaimer className="mt-10 border-t pt-5" />
    </div>
  );
}