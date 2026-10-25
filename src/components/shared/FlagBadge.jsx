import React from "react";
import { FLAG_STYLES } from "@/lib/testCatalog";

export default function FlagBadge({ flag = "typical" }) {
  const s = FLAG_STYLES[flag] || FLAG_STYLES.typical;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}