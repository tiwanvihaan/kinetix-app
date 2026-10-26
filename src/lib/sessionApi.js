import { evaluateMetrics } from "@/lib/testCatalog";
import { addResult } from "@/lib/localStore";

export const newSessionId = () => `s_${Date.now().toString(36)}`;

export function getActiveSessionId() {
  let id = sessionStorage.getItem("nt_session");
  if (!id) {
    id = newSessionId();
    sessionStorage.setItem("nt_session", id);
  }
  return id;
}
export const endActiveSession = () => sessionStorage.removeItem("nt_session");

// Save a completed test on this device only.
export function saveTest({ testType, metrics, raw, deviceNotes }) {
  const { flag, reason } = evaluateMetrics(testType, metrics);
  return addResult({
    test_type: testType,
    session_id: getActiveSessionId(),
    completed_at: new Date().toISOString(),
    metrics,
    raw_summary: raw || {},
    flag,
    flag_reason: reason,
    device_notes: deviceNotes || "",
  });
}