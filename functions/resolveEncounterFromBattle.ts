import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

      // If gym — finish run
      if (nodeType === 'gym') {
        const gymIdx = rewardIdx + 1;
        await base44.entities.RunAction.create({ runId, idx: gymIdx, actionType: 'gym_defeated', payload: { gymId: 'gym1', routeId: updatedProgress.routeId } });
        await base44.entities.Run.update(runId, {
          status: 'finished', endedAt: new Date().toISOString(), nextActionIdx: gymIdx,
          results: { ...(run.results ?? {}), progress: updatedProgress, winner: 'player', gymDefeated: true },
        });
      }
    } else {
      // loss — persist final party state
      updatedProgress = {
        ...existingProgress,
        pendingEncounter: null,
        partyState,
      };

      const nextIdx = (run.nextActionIdx ?? 0) + 1;
      await Promise.all([
        base44.entities.Run.update(runId, {
          status: 'finished', endedAt: new Date().toISOString(),
          results: { ...(run.results ?? {}), progress: updatedProgress, winner: 'enemy', reason: 'battle_loss' },
        }),
        base44.entities.RunAction.create({ runId, idx: nextIdx, actionType: 'node_resolved', payload: { nodeId, nodeType, battleId, outcome: 'loss' } }),
      ]);
      await base44.entities.Run.update(runId, { nextActionIdx: nextIdx });
    }

    return Response.json({ progress: updatedProgress, outcome });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});