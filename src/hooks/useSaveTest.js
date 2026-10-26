import { useState } from "react";
import { saveTest } from "@/lib/sessionApi";

export default function useSaveTest(testType) {
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [rejected, setRejected] = useState(null);

  // An analysis marked `unreliable` is never saved or flagged: the quality report is shown so the person can retest.
  const save = async (metrics, raw, deviceNotes) => {
    if (metrics?.unreliable) {
      setRejected(metrics.quality);
      return null;
    }
    setSaving(true);
    const rec = saveTest({ testType, metrics, raw, deviceNotes });
    setResult({ metrics, flag: rec.flag, reason: rec.flag_reason });
    setSaving(false);
    return rec;
  };
  const reset = () => { setResult(null); setRejected(null); };
  return { save, saving, result, rejected, reset };
}