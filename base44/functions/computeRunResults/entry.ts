import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Modifier registry (server-side source of truth) ───────────────────────────
const MODIFIER_REGISTRY = {
  xp_share_on:           { aetherPct: 0,   tags: [] },
  xp_share_off:          { aetherPct: 10,  tags: ["difficulty"] },
  starter_pool_expand_5: { aetherPct: -5,  tags: ["economy"] },
  starter_rerolls_3:     { aetherPct: -5,  tags: ["economy"] },
  kanto_starter_direct:  { aetherPct: -10, tags: ["economy"] },
  type_diversity_soft:   { aetherPct: -5,  tags: ["ruleset"] },
  type_diversity_hard:   { aetherPct: -10, tags: ["ruleset"] },
  cull_rank_1:           { aetherPct: -10, tags: ["ruleset"] },
  cull_rank_1_2:         { aetherPct: -20, tags: ["ruleset"] },
  start_money_300:       { aetherPct: -5,  tags: ["economy"] },
  start_money_600:       { aetherPct: -10, tags: ["economy"] },
  enemy_iv_floor_10:     { aetherPct: 10,  tags: ["difficulty"] },
  permadeath:            { aetherPct: 25,  tags: ["difficulty", "hardcore", "permadeath"] },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { runId } = await req.json();
    if (!runId) return Response.json({ error: "runId required" }, { status: 400 });

    const run = await base44.entities.Run.get(runId);
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    if (run.playerId !== user.id && user.role !== "admin")
      return Response.json({ error: "Forbidden" }, { status: 403 });

    const actions = await base44.asServiceRole.entities.RunAction.filter({ runId });
    actions.sort((a, b) => a.idx - b.idx);

    const battlesWon   = actions.filter(a => a.actionType === "battle_end" && a.payload?.winner === "player").length;
    const battlesLost  = actions.filter(a => a.actionType === "battle_end" && a.payload?.winner === "enemy").length;
    const gymsDefeated = actions.filter(a => a.actionType === "gym_defeated").length;

    let faints = actions.filter(a => a.actionType === "pokemon_fainted").length;
    if (faints === 0) {
      for (const a of actions) {
        if (a.actionType === "battle_end" && a.payload?.playerFaints) faints += a.payload.playerFaints;
      }
    }

    const startedAt  = run.startedAt ? new Date(run.startedAt).getTime() : null;
    const endedAt    = run.endedAt   ? new Date(run.endedAt).getTime()   : Date.now();
    const durationMs = startedAt ? endedAt - startedAt : null;

    const baseAether = gymsDefeated >= 1 ? 100 : battlesWon * 10;

    const activeIds = Object.keys(run.modifiers ?? {}).filter(id => run.modifiers[id]);
    let rawPct = 0;
    for (const id of activeIds) rawPct += (MODIFIER_REGISTRY[id]?.aetherPct ?? 0);
    const modifierTotalPct = Math.max(-90, Math.min(200, rawPct));

    const aetherEarned = Math.max(0, Math.floor(baseAether * (1 + modifierTotalPct / 100)));

    const results = {
      baseAether, modifierTotalPct, aetherEarned,
      battlesWon, battlesLost, faints, durationMs, gymsDefeated,
      scoreVersion: "m9_v1",
    };

    return Response.json({ results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});