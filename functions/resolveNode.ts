import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Modifier registry (mirrors resolveEncounterFromBattle) ─────────────────────
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

async function awardAetherToPlayer(base44, authUserId, delta) {
  const d = Number(delta ?? 0);
  if (Number.isNaN(d) || d <= 0) return { ok: false, reason: 'invalid_delta' };
  const players = await base44.asServiceRole.entities.Player.filter({ authUserId });
  const player = players?.[0];
  if (!player) return { ok: false, reason: 'player_not_found' };
  const current = Number.isNaN(Number(player.aether)) ? 0 : Number(player.aether ?? 0);
  await base44.asServiceRole.entities.Player.update(player.id, { aether: current + d });
  return { ok: true, after: current + d };
}

async function computeAndFinalizeRun(base44, run, nowIso) {
  const actions = await base44.asServiceRole.entities.RunAction.filter({ runId: run.id });
  actions.sort((a, b) => a.idx - b.idx);
  const battlesWon  = actions.filter(a => a.actionType === 'battle_end' && a.payload?.summary?.winner === 'player').length;
  const battlesLost = actions.filter(a => a.actionType === 'battle_end' && a.payload?.summary?.winner === 'enemy').length;
  const gymsDefeated = actions.filter(a => a.actionType === 'gym_defeated').length;
  let faints = 0;
  for (const a of actions) {
    if (a.actionType === 'battle_end' && a.payload?.summary?.playerFaints) faints += a.payload.summary.playerFaints;
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
  return { baseAether, modifierTotalPct, aetherEarned, battlesWon, battlesLost, faints, durationMs, gymsDefeated, scoreVersion: 'm11_v1' };
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

const TIER_MONEY       = { weak: 50, avg: 80, skilled: 120, boss: 0 };
const TIER_DROP_CHANCE = { weak: 0.60, avg: 0.70, skilled: 0.80 };

const NODE_LABELS = {
  trainer_weak: "Weak Trainer",
  trainer_avg:  "Average Trainer",
  trainer_ace:  "Ace Trainer",
  trainer:      "Trainer",
  gym:          "Gym Leader",
  center:       "Pokémon Center",
  shop:         "PokéMart",
  event:        "Event",
  event_item:   "Supply Find",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { runId, resolution } = body;
    if (!runId || !resolution) {
      return Response.json({ error: 'runId and resolution required' }, { status: 400 });
    }

    const run = await base44.entities.Run.get(runId);
    if (!run) return Response.json({ error: 'Run not found' }, { status: 404 });
    if (run.playerId !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (run.status !== 'active') {
      // If run is finished (e.g., gym battle loss), still return gracefully
      const existingProgress = run.results?.progress ?? {};
      return Response.json({ ok: true, alreadyFinished: true, nodeCompleteSummary: { nodeId: existingProgress.currentNodeId, nodeType: existingProgress.pendingEncounter?.nodeType } });
    }

    const existingProgress = run.results?.progress ?? {};
    const pending = existingProgress.pendingEncounter ?? null;

    // If already resolved (idempotent), return last summary
    if (!pending || pending.status === 'resolved') {
      return Response.json({ ok: true, alreadyResolved: true, nodeCompleteSummary: pending?.lastSummary ?? null });
    }

    const { nodeId, nodeType } = pending;
    const nodeLabel = NODE_LABELS[nodeType] ?? nodeType ?? "Node";
    const partyState = existingProgress.partyState ?? null;

    const completedNodeIds = [...(existingProgress.completedNodeIds ?? [])];
    if (!completedNodeIds.includes(nodeId)) completedNodeIds.push(nodeId);

    let updatedProgress;
    let nodeCompleteSummary;
    let shouldFinishRun = false;
    let finishOutcome = null;

    // ── Battle resolution ──────────────────────────────────────────────────────
    if (resolution.type === 'battle') {
      const { winner, faintCount, battleId } = resolution;
      const outcome = winner === 'player' ? 'win' : 'loss';

      if (outcome === 'win') {
        const tier = pending.tier ?? 'weak';
        const moneyDelta = TIER_MONEY[tier] ?? 50;
        const dropChance = TIER_DROP_CHANCE[tier] ?? 0.6;
        const rewardRng = makeRng(`${run.seed}:reward:${nodeId}`);
        const dropsPotion = rewardRng() < dropChance ? 1 : 0;
        const currentMoney = existingProgress.money ?? 0;
        const currentInventory = existingProgress.inventory ?? { potion: 0, revive: 0 };
        const newInventory = { ...currentInventory, potion: (currentInventory.potion ?? 0) + dropsPotion };

        nodeCompleteSummary = {
          nodeId, nodeType, nodeLabel,
          outcome: 'win',
          moneyDelta,
          itemsDelta: dropsPotion > 0 ? { potion: dropsPotion } : {},
          faintCount: faintCount ?? 0,
        };

        updatedProgress = {
          ...existingProgress,
          routeId: existingProgress.routeId ?? 'route1',
          currentNodeId: nodeId,
          completedNodeIds,
          pendingEncounter: { ...pending, status: 'resolved', lastSummary: nodeCompleteSummary },
          money: currentMoney + moneyDelta,
          inventory: newInventory,
          partyState,
        };

        if (nodeType === 'gym') {
          shouldFinishRun = true;
          finishOutcome = 'player';
        }
      } else {
        // Loss — run ends
        nodeCompleteSummary = {
          nodeId, nodeType, nodeLabel,
          outcome: 'loss',
          moneyDelta: 0, itemsDelta: {}, faintCount: faintCount ?? 0,
        };
        updatedProgress = {
          ...existingProgress,
          pendingEncounter: { ...pending, status: 'resolved', lastSummary: nodeCompleteSummary },
          partyState,
        };
        shouldFinishRun = true;
        finishOutcome = 'enemy';
      }
    }
    // ── Center resolution ──────────────────────────────────────────────────────
    else if (resolution.type === 'center') {
      const healed = (partyState ?? []).map(p => ({ ...p, currentHP: p.maxHP, fainted: false, status: null, moves: p.moves.map(m => ({ ...m, pp: m.ppMax ?? m.pp })) }));
      nodeCompleteSummary = { nodeId, nodeType, nodeLabel: 'Pokémon Center', outcome: 'healed', moneyDelta: 0, itemsDelta: {}, faintCount: 0 };
      updatedProgress = {
        ...existingProgress,
        routeId: existingProgress.routeId ?? 'route1',
        currentNodeId: nodeId,
        completedNodeIds,
        pendingEncounter: { ...pending, status: 'resolved', lastSummary: nodeCompleteSummary },
        partyState: healed,
      };
    }
    // ── Event / Event Item resolution ──────────────────────────────────────────
    else if (resolution.type === 'event' || resolution.type === 'event_item') {
      const itemsDelta = resolution.itemsDelta ?? { potion: 1 };
      const currentInventory = existingProgress.inventory ?? { potion: 0, revive: 0 };
      const newInventory = { ...currentInventory };
      for (const [item, qty] of Object.entries(itemsDelta)) {
        newInventory[item] = (newInventory[item] ?? 0) + (qty ?? 0);
      }
      nodeCompleteSummary = { nodeId, nodeType, nodeLabel: NODE_LABELS[nodeType] ?? 'Event', outcome: 'collected', moneyDelta: 0, itemsDelta, faintCount: 0 };
      updatedProgress = {
        ...existingProgress,
        routeId: existingProgress.routeId ?? 'route1',
        currentNodeId: nodeId,
        completedNodeIds,
        pendingEncounter: { ...pending, status: 'resolved', lastSummary: nodeCompleteSummary },
        inventory: newInventory,
        partyState,
      };
    }
    // ── Shop resolution (stub) ────────────────────────────────────────────────
    else if (resolution.type === 'shop') {
      nodeCompleteSummary = { nodeId, nodeType, nodeLabel: 'PokéMart', outcome: 'visited', moneyDelta: 0, itemsDelta: {}, faintCount: 0 };
      updatedProgress = {
        ...existingProgress,
        routeId: existingProgress.routeId ?? 'route1',
        currentNodeId: nodeId,
        completedNodeIds,
        pendingEncounter: { ...pending, status: 'resolved', lastSummary: nodeCompleteSummary },
        partyState,
      };
    }
    else {
      return Response.json({ error: `Unknown resolution type: ${resolution.type}` }, { status: 400 });
    }

    // ── Persist + log ──────────────────────────────────────────────────────────
    const nextIdx = (run.nextActionIdx ?? 0) + 1;

    await Promise.all([
      base44.entities.Run.update(runId, {
        results: { ...(run.results ?? {}), progress: updatedProgress },
      }),
      base44.entities.RunAction.create({
        runId, idx: nextIdx, actionType: 'node_resolved',
        payload: { nodeId, nodeType, resolution: resolution.type, summary: nodeCompleteSummary },
      }),
    ]);
    await base44.entities.Run.update(runId, { nextActionIdx: nextIdx });

    // ── Finish run if needed ───────────────────────────────────────────────────
    if (shouldFinishRun) {
      const nowIso = new Date().toISOString();
      const resultsSummary = await computeAndFinalizeRun(base44, run, nowIso);

      let aetherAwarded = false;
      let playerAetherAfter = null;
      if (resultsSummary.aetherEarned > 0) {
        const award = await awardAetherToPlayer(base44, run.playerId, resultsSummary.aetherEarned);
        if (award.ok) { aetherAwarded = true; playerAetherAfter = award.after; }
      } else {
        aetherAwarded = true;
      }

      const finishIdx = nextIdx + 1;
      await Promise.all([
        base44.entities.Run.update(runId, {
          status: 'finished', endedAt: nowIso, nextActionIdx: finishIdx,
          results: {
            ...(run.results ?? {}),
            progress: updatedProgress,
            winner: finishOutcome,
            reason: finishOutcome === 'enemy' ? 'battle_loss' : (nodeType === 'gym' ? 'gym_cleared' : 'completed'),
            resultsSummary, finalizedAt: nowIso,
            aetherAwarded, aetherDelta: resultsSummary.aetherEarned, playerAetherAfter,
          },
        }),
        base44.entities.RunAction.create({
          runId, idx: finishIdx, actionType: 'run_finished',
          payload: { resultsSummary, aetherAwarded, playerAetherAfter },
        }),
      ]);

      nodeCompleteSummary.resultsSummary = resultsSummary;
      nodeCompleteSummary.runFinished = true;
    }

    return Response.json({ ok: true, nodeCompleteSummary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});