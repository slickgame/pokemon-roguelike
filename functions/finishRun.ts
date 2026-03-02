import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Modifier registry for scoring (source of truth) ───────────────────────────
const MODIFIER_REGISTRY = {
  xp_share_on:           { aetherPct: 0 },
  xp_share_off:          { aetherPct: 10 },
  starter_pool_expand_5: { aetherPct: -5 },
  starter_rerolls_3:     { aetherPct: -5 },
  kanto_starter_direct:  { aetherPct: -10 },
  type_diversity_soft:   { aetherPct: -5 },
  type_diversity_hard:   { aetherPct: -10 },
  cull_rank_1:           { aetherPct: -10 },
  cull_rank_1_2:         { aetherPct: -20 },
  start_money_300:       { aetherPct: -5 },
  start_money_600:       { aetherPct: -10 },
  enemy_iv_floor_10:     { aetherPct: 10 },
  permadeath:            { aetherPct: 25 },
};

function computeRunResults(run, actions) {
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
  const endedAt    = Date.now();
  const durationMs = startedAt ? endedAt - startedAt : null;

  const baseAether = gymsDefeated >= 1 ? 100 : battlesWon * 10;

  const activeIds = Object.keys(run.modifiers ?? {}).filter(id => run.modifiers[id]);
  let rawPct = 0;
  for (const id of activeIds) rawPct += (MODIFIER_REGISTRY[id]?.aetherPct ?? 0);
  const modifierTotalPct = Math.max(-90, Math.min(200, rawPct));

  const aetherEarned = Math.max(0, Math.floor(baseAether * (1 + modifierTotalPct / 100)));

  return {
    baseAether,
    modifierTotalPct,
    aetherEarned,
    battlesWon,
    battlesLost,
    faints,
    durationMs,
    gymsDefeated,
    scoreVersion: "m9_v1",
  };
}

// Safe aether award — only sets aetherAwarded=true AFTER confirmed Player update
async function awardAetherToPlayer(base44, authUserId, delta) {
  const d = Number(delta ?? 0);
  if (Number.isNaN(d) || d <= 0) return { ok: false, reason: 'invalid_delta' };

  const players = await base44.asServiceRole.entities.Player.filter({ authUserId });
  const player = players?.[0];
  if (!player) return { ok: false, reason: 'player_not_found' };

  const current = Number.isNaN(Number(player.aether)) ? 0 : Number(player.aether ?? 0);
  const newValue = current + d;

  await base44.asServiceRole.entities.Player.update(player.id, { aether: newValue });

  // Confirm persisted
  const confirm = await base44.asServiceRole.entities.Player.get(player.id);
  const after = Number.isNaN(Number(confirm?.aether)) ? newValue : Number(confirm?.aether ?? newValue);

  return { ok: true, playerEntityId: player.id, after };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { runId } = body;
    if (!runId) return Response.json({ error: "runId is required" }, { status: 400 });

    const run = await base44.entities.Run.get(runId);
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    if (run.playerId !== user.id && user.role !== "admin")
      return Response.json({ error: "Forbidden" }, { status: 403 });
    if (run.status !== "active")
      return Response.json({ error: "Run is not active" }, { status: 400 });

    const endedAt = new Date().toISOString();

    // Load actions for scoring
    const actions = await base44.asServiceRole.entities.RunAction.filter({ runId });
    actions.sort((a, b) => a.idx - b.idx);

    const runForCompute = { ...run, endedAt };
    const resultsSummary = computeRunResults(runForCompute, actions);

    const existingResults = run.results ?? {};

    // Guard: prevent double-award
    if (existingResults.aetherAwarded === true) {
      return Response.json({ ok: true, resultsSummary: existingResults.resultsSummary, alreadyFinalized: true });
    }

    // Award aether — only mark awarded if Player update confirmed
    let aetherAwarded = false;
    let playerAetherAfter = null;
    let aetherAwardError = null;

    if (resultsSummary.aetherEarned > 0) {
      const award = await awardAetherToPlayer(base44, run.playerId, resultsSummary.aetherEarned);
      if (award.ok) {
        aetherAwarded = true;
        playerAetherAfter = award.after;
      } else {
        aetherAwardError = award.reason;
      }
    } else {
      // No aether to award, still mark done
      aetherAwarded = true;
      playerAetherAfter = null;
    }

    const updatedResults = {
      ...existingResults,
      resultsSummary,
      finalizedAt: endedAt,
      aetherAwarded,
      aetherDelta: resultsSummary.aetherEarned,
      playerAetherAfter,
      ...(aetherAwardError ? { aetherAwardError } : {}),
    };

    await base44.asServiceRole.entities.Run.update(runId, {
      status: "finished",
      endedAt,
      results: updatedResults,
    });

    // Log run_finished action
    const currentRun = (await base44.asServiceRole.entities.Run.filter({ id: runId }))[0];
    const nextIdx = (currentRun?.nextActionIdx ?? 0) + 1;
    await Promise.all([
      base44.asServiceRole.entities.RunAction.create({
        runId,
        idx: nextIdx,
        actionType: "run_finished",
        payload: { resultsSummary, aetherAwarded, playerAetherAfter },
      }),
      base44.asServiceRole.entities.Run.update(runId, { nextActionIdx: nextIdx }),
    ]);

    return Response.json({ ok: true, resultsSummary, aetherAwarded, playerAetherAfter });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});