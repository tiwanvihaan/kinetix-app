import React from "react";
import { AlertCircle } from "lucide-react";

export default function ErrorNotice({ children }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}