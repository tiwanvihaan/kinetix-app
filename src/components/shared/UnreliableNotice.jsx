import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

// Shown when a recording was too poor to measure. Nothing is saved and nothing is flagged: the person is asked to retest.
export default function UnreliableNotice({ quality, onRetry }) {
  const issues = quality?.issues || [];
  return (
    <section className="space-y-4 rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950" role="alert">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <h2 className="text-base font-semibold">This recording can’t be measured reliably</h2>
      </div>
      <p className="text-sm leading-relaxed">No result was saved, so this attempt won’t affect your history or trends.</p>
      {issues.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {issues.map((i) => <li key={i.code}>{i.message}</li>)}
        </ul>
      )}
      {quality?.retest && <p className="text-sm font-medium leading-relaxed">{quality.retest}</p>}
      <Button size="lg" className="w-full" onClick={onRetry}>Try again</Button>
    </section>
  );
}