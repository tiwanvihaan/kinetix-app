import React from "react";
import { METRIC_LABELS } from "@/lib/testCatalog";

export default function MetricGrid({ testType, metrics }) {
  const defs = METRIC_LABELS[testType] || [];
  const shown = defs.filter(([k]) => metrics?.[k] != null);
  if (!shown.length) return <p className="text-sm text-muted-foreground">Not enough data was captured to compute metrics.</p>;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
      {shown.map(([k, label, unit]) => (
        <div key={k}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">
            {metrics[k]}
            {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}