// Kinetix keeps everything on this device only (browser localStorage).
// Nothing is ever sent to a server.
const KEY = "kinetix_results_v1";
const NAME_KEY = "kinetix_report_name_v1";
const PREFS_KEY = "kinetix_prefs_v1";

const DEFAULT_PREFS = { reduceMotion: false, largerText: false };

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
};

// Newest first.
export const getResults = () => read().sort((a, b) => (a.completed_at < b.completed_at ? 1 : -1));

export function addResult(record) {
  const rec = { id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, ...record };
  localStorage.setItem(KEY, JSON.stringify([...read(), rec]));
  return rec;
}

export const clearResults = () => {
  localStorage.removeItem(KEY);
  localStorage.removeItem(NAME_KEY);
};

// Optional name typed onto the printed report; stays on this device.
export const getReportName = () => localStorage.getItem(NAME_KEY) || "";
export const setReportName = (n) => localStorage.setItem(NAME_KEY, n);

// App display preferences; stay on this device.
const readPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } };
export const getPrefs = () => ({ ...DEFAULT_PREFS, ...readPrefs() });
export const setPrefs = (patch) => {
  const next = { ...DEFAULT_PREFS, ...getPrefs(), ...patch };
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("kinetix:prefs-changed"));
  return next;
};