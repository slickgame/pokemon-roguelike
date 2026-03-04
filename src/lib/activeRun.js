const ACTIVE_RUN_KEY = "activeRunId";

export function getActiveRunId() {
  return localStorage.getItem(ACTIVE_RUN_KEY);
}

export function setActiveRunId(runId) {
  if (!runId) return;
  localStorage.setItem(ACTIVE_RUN_KEY, runId);
}

export function clearActiveRunId() {
  localStorage.removeItem(ACTIVE_RUN_KEY);
}
