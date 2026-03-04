import { createPageUrl } from "@/utils";
import { setActiveRunId } from "@/lib/activeRun";

function getPendingType(pendingEncounter) {
  return pendingEncounter?.type ?? pendingEncounter?.nodeType ?? null;
}

export function getRouteToRunState(run) {
  if (!run?.id) return createPageUrl("Home");

  if (run.status !== "active") {
    return createPageUrl(`Results?runId=${run.id}`);
  }

  const progress = run.results?.progress ?? {};
  const pendingReward = progress.pendingReward ?? null;
  if (pendingReward?.type === "relic") {
    return createPageUrl(`RelicReward?runId=${run.id}&nodeId=${pendingReward.nodeId ?? ""}&source=${pendingReward.source ?? "gym"}`);
  }

  const pendingEncounter = progress.pendingEncounter ?? null;
  if (pendingEncounter && pendingEncounter.status !== "resolved") {
    const pendingType = getPendingType(pendingEncounter);
    if (["battle", "trainer", "gym"].includes(pendingType) || pendingEncounter.battleId) {
      return createPageUrl(`Battle?runId=${run.id}&battleId=${pendingEncounter.battleId ?? ""}&nodeId=${pendingEncounter.nodeId ?? ""}&routeId=${pendingEncounter.routeId ?? progress.routeId ?? "route1"}`);
    }
    if (["event", "event_item"].includes(pendingType)) {
      return createPageUrl(`EventNode?runId=${run.id}&nodeId=${pendingEncounter.nodeId ?? ""}`);
    }
    if (pendingType === "shop") {
      return createPageUrl(`Shop?runId=${run.id}&nodeId=${pendingEncounter.nodeId ?? ""}`);
    }
    if (pendingType === "center") {
      return createPageUrl(`Center?runId=${run.id}&nodeId=${pendingEncounter.nodeId ?? ""}`);
    }
  }

  return createPageUrl(`RunMap?runId=${run.id}`);
}

export function routeToRunState(navigate, run) {
  if (!run?.id) {
    navigate(createPageUrl("Home"));
    return;
  }
  setActiveRunId(run.id);
  navigate(getRouteToRunState(run));
}
