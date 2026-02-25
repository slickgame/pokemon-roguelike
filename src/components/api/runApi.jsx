import { base44 } from "@/api/base44Client";

export const runApi = {
  startRun: (isRanked = false, modifierIds = []) =>
    base44.functions.invoke("startRun", { isRanked, modifierIds }).then(r => r.data),

  appendAction: (runId, actionType, payload = {}) =>
    base44.functions.invoke("appendRunAction", { runId, actionType, payload }).then(r => r.data),

  finishRun: (runId, summary = {}) =>
    base44.functions.invoke("finishRun", { runId, summary }).then(r => r.data),

  getRun: (runId) =>
    base44.functions.invoke("getRun", { runId }).then(r => r.data.run),

  listRunActions: (runId) =>
    base44.functions.invoke("listRunActions", { runId }).then(r => r.data.actions),

  abandonRun: (runId, reason = "abandoned") =>
    base44.functions.invoke("abandonRun", { runId, reason }).then(r => r.data),
};