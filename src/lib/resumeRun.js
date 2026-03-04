import { createPageUrl } from "@/utils";
import { clearActiveRunId, setActiveRunId } from "@/lib/activeRun";

function pendingType(encounter) {
  return encounter?.type ?? encounter?.nodeType ?? null;
}

export async function resumeActiveRun({ base44, navigate, toast } = {}) {
  try {
    const res = await base44.functions.invoke("getMyActiveRun", {});
    const run = res.data?.run ?? null;

    if (!run) {
      clearActiveRunId();
      return null;
    }

    setActiveRunId(run.id);
    const progress = run.results?.progress ?? {};

    if (run.status !== "active") {
      navigate(createPageUrl(`Results?runId=${run.id}`));
      return run;
    }

    if (progress.pendingReward) {
      const reward = progress.pendingReward;
      navigate(createPageUrl(`RelicReward?runId=${run.id}&source=${reward.source ?? "gym"}&nodeId=${reward.nodeId ?? ""}`));
      return run;
    }

    const encounter = progress.pendingEncounter ?? null;
    if (encounter && encounter.status === "pending") {
      const kind = pendingType(encounter);
      if (["battle", "trainer", "gym"].includes(kind) || encounter.battleId) {
        navigate(createPageUrl(`Battle?runId=${run.id}&battleId=${encounter.battleId ?? ""}&nodeId=${encounter.nodeId ?? ""}`));
        return run;
      }
      if (["event", "event_item"].includes(kind)) {
        navigate(createPageUrl(`EventNode?runId=${run.id}&nodeId=${encounter.nodeId ?? ""}`));
        return run;
      }
      if (kind === "center") {
        navigate(createPageUrl(`Center?runId=${run.id}&nodeId=${encounter.nodeId ?? ""}`));
        return run;
      }
      if (kind === "shop") {
        navigate(createPageUrl(`Shop?runId=${run.id}&nodeId=${encounter.nodeId ?? ""}`));
        return run;
      }
    }

    navigate(createPageUrl(`RunMap?runId=${run.id}`));
    return run;
  } catch (error) {
    toast?.("Failed to resume active run.", "error");
    return null;
  }
}
