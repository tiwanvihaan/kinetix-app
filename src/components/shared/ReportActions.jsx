import React from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { buildReportText, printReport } from "@/lib/report";

export default function ReportActions({ name, sessions }) {
  return (
    <Button variant="outline" className="w-full" onClick={() => printReport(buildReportText({ name, sessions }))}>
      <Printer className="h-4 w-4" /> Print report
    </Button>
  );
}