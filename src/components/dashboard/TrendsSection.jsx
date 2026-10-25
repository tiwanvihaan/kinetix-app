import React, { useState } from "react";
import { TEST_ORDER } from "@/lib/testCatalog";
import TrendCard from "@/components/dashboard/TrendCard";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 0 },
];

export default function TrendsSection({ sessions }) {
  const [days, setDays] = useState(30);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base">Progress over time</h2>
          <p className="text-xs text-muted-foreground">One key measure per test. Compare your own results over time.</p>
        </div>
        <div className="inline-flex rounded-md bg-secondary p-0.5" role="group" aria-label="Trend time range">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              aria-pressed={days === r.days}
              onClick={() => setDays(r.days)}
              className={`h-8 min-w-[44px] rounded px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                days === r.days ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {TEST_ORDER.map((t) => (
          <TrendCard key={t} sessions={sessions} testType={t} days={days} />
        ))}
      </div>
    </section>
  );
}