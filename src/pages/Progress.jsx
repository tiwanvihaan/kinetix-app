import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { TESTS, TEST_ORDER } from "@/lib/testCatalog";
import { getResults } from "@/lib/localStore";
import TrendsSection from "@/components/dashboard/TrendsSection";
import FlagBadge from "@/components/shared/FlagBadge";
import Disclaimer from "@/components/shared/Disclaimer";

export default function Progress() {
  const [sessions] = useState(getResults);
  const total = sessions.length;

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-6 pb-16 pt-9 sm:pt-12 lg:px-5 lg:pb-12 lg:pt-8">
      <header className="mb-8 lg:mb-6">
        <h1 className="text-3xl tracking-tight lg:text-2xl">Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total === 0
            ? "No results yet. Run an assessment to start building your baseline."
            : `${total} saved result${total === 1 ? "" : "s"} on this device.`}
        </p>
      </header>

      <div className="mb-10">
        <TrendsSection sessions={sessions} />
      </div>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base">Recent results</h2>
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-muted-foreground">
            <Link to="/history">All history <ChevronRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        {total === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Nothing saved yet.</p>
        ) : (
          <div className="space-y-6">
            {TEST_ORDER.map((t) => {
              const rows = sessions.filter((s) => s.test_type === t).slice(0, 3);
              if (!rows.length) return null;
              return (
                <div key={t}>
                  <h3 className="mb-2 text-sm font-medium">{TESTS[t].title}</h3>
                  <div className="divide-y overflow-hidden rounded-lg border bg-card">
                    {rows.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                        <span className="tabular-nums">{new Date(s.completed_at).toLocaleString()}</span>
                        <FlagBadge flag={s.flag} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Disclaimer className="border-t pt-5" />
    </div>
  );
}