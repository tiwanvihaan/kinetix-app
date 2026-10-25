import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { TESTS } from "@/lib/testCatalog";
import FlagBadge from "@/components/shared/FlagBadge";

export default function TestCard({ testType, latest }) {
  const t = TESTS[testType];
  const Icon = t.icon;
  return (
    <Link to={t.path} className="group flex min-h-[68px] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-tight">{t.title}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {latest ? `Last taken ${new Date(latest.completed_at).toLocaleDateString()}` : `About ${t.minutes} min · not yet taken`}
        </p>
      </div>
      {latest && <FlagBadge flag={latest.flag} />}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
    </Link>
  );
}