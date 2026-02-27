import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Modifier registry (mirrors computeRunResults) ─────────────────────────────
const MODIFIER_REGISTRY = {
  xp_share_on:           { aetherPct: 0   },
  xp_share_off:          { aetherPct: 10  },
  starter_pool_expand_5: { aetherPct: -5  },
  starter_rerolls_3:     { aetherPct: -5  },
  kanto_starter_direct:  { aetherPct: -10 },
  type_diversity_soft:   { aetherPct: -5  },
  type_diversity_hard:   { aetherPct: -10 },
  cull_rank_1:           { aetherPct: -10 },
  cull_rank_1_2:         { aetherPct: -20 },
  start_money_300:       { aetherPct: -5  },
  start_money_600:       { aetherPct: -10 },
  enemy_iv_floor_10:     { aetherPct: 10  },
  permadeath:            { aetherPct: 25  },
};

async function awardAether(base44, run, aetherEarned) {
  if (aetherEarned <= 0) return 0;
  const player = await base44.asServiceRole.entities.Player.get(run.playerId);
  const newAether = (player?.aether ?? 0) + aetherEarned;
  await base44.asServiceRole.entities.Player.update(run.playerId, { aether: newAether });
  return newAether;
}

async function computeAndFinalizeRun(base44, run, updatedProgress, nowIso) {
  // Guard: already finalized
  if (run.results?.aetherAwarded === true) return run.results.resultsSummary;

  const actions = await base44.asServiceRole.entities.RunAction.filter({ runId: run.id });
  actions.sort((a, b) => a.idx - b.idx);

  const battlesWon   = actions.filter(a => a.actionType === 'battle_end' && a.payload?.summary?.winner === 'player').length;
  const battlesLost  = actions.filter(a => a.actionType === 'battle_end' && a.payload?.summary?.winner === 'enemy').length;
  const gymsDefeated = actions.filter(a => a.actionType === 'gym_defeated').length;

  let faints = actions.filter(a => a.actionType === 'pokemon_fainted').length;
  if (faints === 0) {
    for (const a of actions) {
      if (a.actionType === 'battle_end' && a.payload?.summary?.playerFaints) faints += a.payload.summary.playerFaints;
    }
  }

  const startedAt  = run.startedAt ? new Date(run.startedAt).getTime() : null;
  const endedAt    = new Date(nowIso).getTime();
  const durationMs = startedAt ? endedAt - startedAt : null;

  const baseAether = gymsDefeated >= 1 ? 100 : battlesWon * 10;

  const activeIds = Object.keys(run.modifiers ?? {}).filter(id => run.modifiers[id]);
  let rawPct = 0;
  for (const id of activeIds) rawPct += (MODIFIER_REGISTRY[id]?.aetherPct ?? 0);
  const modifierTotalPct = Math.max(-90, Math.min(200, rawPct));
  const aetherEarned = Math.max(0, Math.floor(baseAether * (1 + modifierTotalPct / 100)));

  return { baseAether, modifierTotalPct, aetherEarned, battlesWon, battlesLost, faints, durationMs, gymsDefeated, scoreVersion: 'm9_v1' };
}

// Deterministic RNG for reward drops
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function makeRng(seedStr) {
  let s = hashString(String(seedStr));
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const TIER_MONEY   = { weak: 50, avg: 80, skilled: 120, boss: 0 };
const TIER_DROP_CHANCE = { weak: 0.60, avg: 0.70, skilled: 0.80 };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { runId, battleId, outcome } = await req.json();
    if (!runId || !battleId || !outcome) {
      return Response.json({ error: 'Missing runId, battleId, or outcome' }, { status: 400 });
    }

    const run = await base44.entities.Run.get(runId);
    if (!run) return Response.json({ error: 'Run not found' }, { status: 404 });
    if (run.playerId !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (run.status !== 'active') {
      return Response.json({ error: 'Run is not active' }, { status: 400 });
    }

    const battle = await base44.entities.Battle.get(battleId);
    if (!battle) return Response.json({ error: 'Battle not found' }, { status: 404 });
    if (battle.runId !== runId) return Response.json({ error: 'Battle/Run mismatch' }, { status: 400 });

    const existingProgress = run.results?.progress ?? {};
    const pending = existingProgress.pendingEncounter ?? null;

    if (!pending || pending.battleId !== battleId) {
      return Response.json({ progress: existingProgress, alreadyResolved: true });
    }

    const { nodeId, nodeType } = pending;

    // Get partyState from the latest battle state (commitTurn already wrote it)
    // but we also accept it already in progress if commitTurn updated it
    const partyState = existingProgress.partyState ?? null;

    let updatedProgress;

    if (outcome === 'win') {
      const completedNodeIds = [...(existingProgress.completedNodeIds ?? [])];
      if (!completedNodeIds.includes(nodeId)) completedNodeIds.push(nodeId);

      // ── Compute rewards ────────────────────────────────────────────────────
      const tier = pending.tier ?? 'weak';
      const moneyDelta = TIER_MONEY[tier] ?? 50;
      const dropChance = TIER_DROP_CHANCE[tier] ?? 0.6;
      const rewardRng = makeRng(`${run.seed}:reward:${nodeId}`);
      const dropsPotion = rewardRng() < dropChance ? 1 : 0;

      const currentMoney = existingProgress.money ?? 0;
      const currentInventory = existingProgress.inventory ?? { potion: 0, revive: 0 };
      const newInventory = {
        ...currentInventory,
        potion: (currentInventory.potion ?? 0) + dropsPotion,
      };

      updatedProgress = {
        ...existingProgress,
        routeId: existingProgress.routeId ?? 'route1',
        currentNodeId: nodeId,
        completedNodeIds,
        pendingEncounter: null,
        money: currentMoney + moneyDelta,
        inventory: newInventory,
        partyState,
      };

      const runUpdateData = { results: { ...(run.results ?? {}), progress: updatedProgress } };

      const nextIdx = (run.nextActionIdx ?? 0) + 1;
      const rewardPayload = { nodeId, nodeType, battleId, outcome: 'win', moneyDelta, itemsDelta: dropsPotion > 0 ? { potion: dropsPotion } : {} };

      await Promise.all([
        base44.entities.Run.update(runId, runUpdateData),
        base44.entities.RunAction.create({ runId, idx: nextIdx, actionType: 'node_resolved', payload: { nodeId, nodeType, battleId, outcome: 'win' } }),
      ]);
      const rewardIdx = nextIdx + 1;
      await Promise.all([
        base44.entities.RunAction.create({ runId, idx: rewardIdx, actionType: 'reward_granted', payload: rewardPayload }),
        base44.entities.Run.update(runId, { nextActionIdx: rewardIdx }),
      ]);

      // If gym — finish run with resultsSummary + aether award
      if (nodeType === 'gym') {
        const nowIso = new Date().toISOString();
        const gymIdx = rewardIdx + 1;
        await base44.entities.RunAction.create({ runId, idx: gymIdx, actionType: 'gym_defeated', payload: { gymId: 'gym1', routeId: updatedProgress.routeId } });

        // Temporarily update run so computeAndFinalizeRun sees the gym action
        const runForCompute = { ...run, endedAt: nowIso };
        const resultsSummary = await computeAndFinalizeRun(base44, runForCompute, updatedProgress, nowIso);

        const finishIdx = gymIdx + 1;
        await base44.entities.RunAction.create({ runId, idx: finishIdx, actionType: 'run_finished', payload: { resultsSummary } });

        const playerAetherAfter = await awardAether(base44, run, resultsSummary.aetherEarned);
        await base44.entities.Run.update(runId, {
          status: 'finished', endedAt: nowIso, nextActionIdx: finishIdx,
          results: { ...(run.results ?? {}), progress: updatedProgress, winner: 'player', gymDefeated: true, resultsSummary, finalizedAt: nowIso, aetherAwarded: true, aetherDelta: resultsSummary.aetherEarned, playerAetherAfter },
        });
      }
    } else {
      // loss — persist final party state + compute resultsSummary + award aether
      const nowIso = new Date().toISOString();
      updatedProgress = {
        ...existingProgress,
        pendingEncounter: null,
        partyState,
      };

      const runForCompute = { ...run, endedAt: nowIso };
      const resultsSummary = await computeAndFinalizeRun(base44, runForCompute, updatedProgress, nowIso);

      const nextIdx = (run.nextActionIdx ?? 0) + 1;
      const finishIdx = nextIdx + 1;

      await Promise.all([
        base44.entities.Run.update(runId, {
          status: 'finished', endedAt: nowIso,
          results: { ...(run.results ?? {}), progress: updatedProgress, winner: 'enemy', reason: 'battle_loss', resultsSummary, finalizedAt: nowIso },
        }),
        base44.entities.RunAction.create({ runId, idx: nextIdx, actionType: 'node_resolved', payload: { nodeId, nodeType, battleId, outcome: 'loss' } }),
      ]);
      const playerAetherAfter = await awardAether(base44, run, resultsSummary.aetherEarned);
      await Promise.all([
        base44.entities.RunAction.create({ runId, idx: finishIdx, actionType: 'run_finished', payload: { resultsSummary } }),
        base44.entities.Run.update(runId, {
          nextActionIdx: finishIdx,
          results: { ...(run.results ?? {}), progress: updatedProgress, winner: 'enemy', reason: 'battle_loss', resultsSummary, finalizedAt: nowIso, aetherAwarded: true, aetherDelta: resultsSummary.aetherEarned, playerAetherAfter },
        }),
      ]);
    }

    return Response.json({ progress: updatedProgress, outcome });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});