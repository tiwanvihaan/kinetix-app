import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { TESTS, METRIC_LABELS } from "@/lib/testCatalog";
import { KEY_METRIC } from "@/lib/keyMetrics";
import { testSeries, seriesProgress } from "@/lib/trendData";
import TrendChart from "@/components/shared/TrendChart";

const TONE = {
  better: { text: "text-emerald-700", note: "Improving" },
  worse: { text: "text-rose-700", note: "Declining" },
  neutral: { text: "text-muted-foreground", note: "Steady" },
};

const round = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

function Change({ progress }) {
  if (!progress || progress.delta == null) {
    return <span className="text-xs text-muted-foreground">Take it again to see change</span>;
  }
  const tone = TONE[progress.tone];
  const Icon = progress.delta > 0 ? ArrowUpRight : progress.delta < 0 ? ArrowDownRight : Minus;
  const note = progress.tone === "neutral" && Math.abs(progress.pct) >= 5 ? "Changed" : tone.note;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone.text}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {progress.delta > 0 ? "+" : ""}
      {round(progress.delta)} since first · {note}
    </span>
  );
}

export default function TrendCard({ sessions, testType, days }) {
  const key = KEY_METRIC[testType];
  const [, label, unit] = METRIC_LABELS[testType].find((m) => m[0] === key);
  const data = testSeries(sessions, testType, days);
  const progress = seriesProgress(data, key, testType);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">{TESTS[testType].title}</h3>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        {progress && (
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums leading-none">
              {round(progress.latest)}
              {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
            </p>
            <div className="mt-1.5"><Change progress={progress} /></div>
          </div>
        )}
      </div>
      <TrendChart data={data} dataKey={key} label={label} unit={unit} />
    </div>
  );
}