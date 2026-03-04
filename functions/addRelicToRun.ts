import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const VALID_RELIC_IDS = new Set([
  "field_medic_patch","lucky_coin","ration_pack","scout_compass",
  "band_of_resonance","cracked_everstone","ether_lens","gym_scout_contract",
  "focus_charm","surge_battery","bargain_seal","relic_of_mastery",
]);

function postGymHealParty(partyState) {
  if (!Array.isArray(partyState)) return partyState;
  return partyState.map((p) => {
    if (!p) return p;
    const healedHp = Math.min(p.maxHP ?? p.currentHP ?? 0, (p.currentHP ?? 0) + Math.ceil((p.maxHP ?? 0) * 0.5));
    return {
      ...p,
      currentHP: healedHp,
      fainted: healedHp <= 0 ? !!p.fainted : false,
    };
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { runId, relicId, source, nodeId } = await req.json();
    if (!runId || !relicId) return Response.json({ error: 'runId and relicId required' }, { status: 400 });
    if (!VALID_RELIC_IDS.has(relicId)) return Response.json({ error: `Unknown relic: ${relicId}` }, { status: 400 });

    const run = await base44.entities.Run.get(runId);
    if (!run) return Response.json({ error: 'Run not found' }, { status: 404 });
    if (run.playerId !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rawProgress = run.results?.progress ?? {};
    const progress = {
      ...rawProgress,
      pendingReward: rawProgress.pendingReward ?? null,
      pendingRouteAdvance: rawProgress.pendingRouteAdvance ?? null,
    };

    const relics = [...(progress.relics ?? [])];
    const hasMastery = relics.some(r => r.id === "relic_of_mastery");
    const cap = hasMastery ? 9 : 8;

    if (relics.length >= cap) {
      return Response.json({ error: 'Relic cap reached', cap }, { status: 400 });
    }
    if (relics.some(r => r.id === relicId)) {
      return Response.json({ error: 'Relic already owned', relicId }, { status: 400 });
    }

    const newRelic = {
      id: relicId,
      acquiredFrom: source ?? "unknown",
      acquiredNodeId: nodeId ?? null,
      acquiredAt: new Date().toISOString(),
    };
    relics.push(newRelic);

    const updatedProgress = {
      ...progress,
      relics,
      pendingReward: null,
      // Intentionally keep pendingRouteAdvance for NodeComplete -> Continue pipeline.
      routeAdvanceReady: progress.pendingRouteAdvance ? true : (progress.routeAdvanceReady ?? false),
    };

    const nextIdx = (run.nextActionIdx ?? 0) + 1;

    await Promise.all([
      base44.entities.Run.update(runId, {
        results: { ...(run.results ?? {}), progress: updatedProgress },
      }),
      base44.entities.RunAction.create({
        runId,
        idx: nextIdx,
        actionType: 'relic_taken',
        payload: { relicId, source: source ?? "unknown", nodeId: nodeId ?? null },
      }),
      base44.asServiceRole.entities.Run.update(runId, { nextActionIdx: nextIdx }),
    ]);

    return Response.json({ ok: true, relic: newRelic, totalRelics: relics.length, nextScreen: 'node_complete' });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
