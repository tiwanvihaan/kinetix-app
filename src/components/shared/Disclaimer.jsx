import React from "react";
import { Info } from "lucide-react";

export default function Disclaimer({ className = "" }) {
  return (
    <div className={`flex gap-3 text-xs leading-relaxed text-muted-foreground ${className}`} role="note">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-medium text-foreground">Screening signal, not a diagnosis.</span> These results can’t diagnose or rule out any
        condition. Please talk with a healthcare professional about any concerns.
      </p>
    </div>
  );
}