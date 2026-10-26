import { TESTS, METRIC_LABELS, FLAG_STYLES, EDUCATION } from "@/lib/testCatalog";

// Build a plain-text report from saved results (newest first).
export function buildReportText({ name, sessions, generatedAt = new Date() }) {
  const lines = [];
  lines.push("KINETIX SCREENING REPORT");
  lines.push(`Name: ${name || "—"}`);
  lines.push(`Generated: ${generatedAt.toLocaleString()}`);
  lines.push("");
  lines.push("IMPORTANT: These are screening signals from a smartphone, not a medical diagnosis.");
  lines.push("");
  Object.keys(TESTS).forEach((t) => {
    const rows = sessions.filter((s) => s.test_type === t);
    if (!rows.length) return;
    const latest = rows[0];
    const prev = rows[1];
    lines.push(`${TESTS[t].title.toUpperCase()} — ${new Date(latest.completed_at).toLocaleString()}`);
    lines.push(`  Status: ${FLAG_STYLES[latest.flag]?.label || latest.flag}`);
    METRIC_LABELS[t].forEach(([k, label, unit]) => {
      if (latest.metrics?.[k] == null) return;
      const cur = latest.metrics[k];
      const old = prev?.metrics?.[k];
      const delta = old != null && typeof cur === "number" ? ` (prev ${old}, ${cur - old >= 0 ? "+" : ""}${Math.round((cur - old) * 100) / 100})` : "";
      lines.push(`  ${label}: ${cur}${unit ? " " + unit : ""}${delta}`);
    });
    if (latest.flag_reason) lines.push(`  Note: ${latest.flag_reason}`);
    lines.push(`  Context: ${EDUCATION[t]}`);
    lines.push(`  Results on record: ${rows.length}`);
    lines.push("");
  });
  return lines.join("\n");
}

export function printReport(text) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<title>Kinetix report</title><pre style="font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap;padding:24px">${text.replace(/</g, "&lt;")}</pre>`);
  w.document.close();
  w.print();
}