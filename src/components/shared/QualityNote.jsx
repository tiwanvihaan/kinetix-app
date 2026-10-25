import React from "react";

const LABEL = { good: "Good", fair: "Fair" };

// Data-quality summary shown with a saved result so a "fair" recording is not over-interpreted.
export default function QualityNote({ quality }) {
  if (!quality) return null;
  const issues = quality.issues || [];
  return (
    <div className="space-y-1.5 border-t pt-4">
      <p className="text-sm">
        <span className="text-muted-foreground">Recording quality: </span>
        <span className="font-medium">{LABEL[quality.status] || quality.status}</span>
        <span className="ml-1 text-xs text-muted-foreground">({Math.round((quality.score ?? 0) * 100)}/100, a data-quality score, not a medical probability)</span>
      </p>
      {issues.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs leading-relaxed text-muted-foreground">
          {issues.map((i) => <li key={i.code}>{i.message}</li>)}
        </ul>
      )}
    </div>
  );
}