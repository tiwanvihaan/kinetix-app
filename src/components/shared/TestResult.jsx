import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import FlagBadge from "@/components/shared/FlagBadge";
import MetricGrid from "@/components/shared/MetricGrid";
import QualityNote from "@/components/shared/QualityNote";
import { EDUCATION, TEST_ORDER } from "@/lib/testCatalog";

export default function TestResult({ testType, metrics, flag, reason, onRetry }) {
  const next = TEST_ORDER[TEST_ORDER.indexOf(testType) + 1];
  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <FlagBadge flag={flag} />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" /> Saved on this device</span>
        </div>
        <MetricGrid testType={testType} metrics={metrics} />
        <QualityNote quality={metrics?.quality} />
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm leading-relaxed">{reason}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{EDUCATION[testType]}</p>
        </div>
      </section>
      <div className="space-y-2">
        {next ? (
          <Button asChild size="lg" className="w-full"><Link to={`/test/${next}`}>Next test</Link></Button>
        ) : (
          <Button asChild size="lg" className="w-full"><Link to="/summary">View session summary</Link></Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onRetry}>Repeat test</Button>
          <Button asChild variant="outline"><Link to="/summary">Skip to summary</Link></Button>
        </div>
      </div>
    </div>
  );
}