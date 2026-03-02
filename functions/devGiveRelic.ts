import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const RELIC_IDS = new Set([
  "field_medic_patch","lucky_coin","ration_pack","scout_compass",
  "band_of_resonance","cracked_everstone","ether_lens","gym_scout_contract",
  "focus_charm","surge_battery","bargain_seal","relic_of_mastery",
]);

const RELIC_RARITY = {
  field_medic_patch: "common", lucky_coin: "common", ration_pack: "common", scout_compass: "common",
  band_of_resonance: "uncommon", cracked_everstone: "uncommon", ether_lens: "uncommon", gym_scout_contract: "uncommon",
  focus_charm: "rare", surge_battery: "rare", bargain_seal: "rare",
  relic_of_mastery: "legendary",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { runId, relicId } = await req.json();
    if (!runId || !relicId) return Response.json({ error: 'runId and relicId required' }, { status: 400 });

    const run = await base44.entities.Run.get(runId);
    if (!run) return Response.json({ error: 'Run not found' }, { status: 404 });
    if (run.playerId !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (run.isRanked === true) return Response.json({ error: 'Dev tools disabled on ranked runs' }, { status: 403 });

    if (!RELIC_IDS.has(relicId)) return Response.json({ error: `Unknown relic: ${relicId}` }, { status: 400 });

    const progress = run.results?.progress ?? {};
    const relics = progress.relics ?? [];

    if (relics.some(r => r.id === relicId)) return Response.json({ error: 'Relic already owned' }, { status: 400 });

    const relicCap = relics.some(r => r.id === "relic_of_mastery") ? 9 : 8;
    if (relics.length >= relicCap) return Response.json({ error: `Relic cap reached (${relicCap})` }, { status: 400 });

    const newRelic = { id: relicId, rarity: RELIC_RARITY[relicId] ?? "common", acquiredFrom: "dev", acquiredNodeId: null, acquiredAt: new Date().toISOString() };
    const newRelics = [...relics, newRelic];

    const nextIdx = (run.nextActionIdx ?? 0) + 1;
    await Promise.all([
      base44.entities.Run.update(runId, {
        results: { ...(run.results ?? {}), progress: { ...progress, relics: newRelics } },
        nextActionIdx: nextIdx,
      }),
      base44.entities.RunAction.create({ runId, idx: nextIdx, actionType: 'dev_relic_granted', payload: { relicId } }),
    ]);

    return Response.json({ ok: true, relics: newRelics });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});