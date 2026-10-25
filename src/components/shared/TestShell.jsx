import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { TESTS } from "@/lib/testCatalog";
import Disclaimer from "@/components/shared/Disclaimer";

export default function TestShell({ testType, children }) {
  const t = TESTS[testType];
  return (
    <div className="mx-auto min-h-screen w-full max-w-xl px-5 pb-12 pt-4 sm:pt-8">
      <Link to="/" className="-ml-1 inline-flex h-11 items-center gap-0.5 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <header className="mb-6 mt-2">
        <h1 className="text-2xl">{t.title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.blurb}</p>
      </header>
      <div className="space-y-5">{children}</div>
      <Disclaimer className="mt-10 border-t pt-5" />
    </div>
  );
}