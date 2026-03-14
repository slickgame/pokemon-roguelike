import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Modifier registry ──────────────────────────────────────────────────────────
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

// ── Relic registry (inline — no local imports in Deno) ─────────────────────────
const RELIC_IDS = [
  "field_medic_patch","lucky_coin","ration_pack","scout_compass",
  "band_of_resonance","cracked_everstone","ether_lens","gym_scout_contract",
  "focus_charm","surge_battery","bargain_seal","relic_of_mastery",
];
function hasRelic(relics, id) {
  return Array.isArray(relics) && relics.some(r => r.id === id);
}

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
  const battlesWon   = actions.filter(a => a.actionType === 'battle_end' && a.payload?.summary?.winner === 'player').length;
  const battlesLost  = actions.filter(a => a.actionType === 'battle_end' && a.payload?.summary?.winner === 'enemy').length;
  const gymsDefeated = actions.filter(a => a.actionType === 'gym_defeated').length;
  let faints = 0;
  for (const a of actions) {
    if (a.actionType === 'battle_end' && a.payload?.summary?.playerFaints) faints += a.payload.summary.playerFaints;
  }
  const startedAt  = run.startedAt ? new Date(run.startedAt).getTime() : null;
  const endedAt    = new Date(nowIso).getTime();
  const durationMs = startedAt ? endedAt - startedAt : null;
  const baseAether  = gymsDefeated >= 1 ? 100 : battlesWon * 10;
  const activeIds   = Object.keys(run.modifiers ?? {}).filter(id => run.modifiers[id]);
  let rawPct = 0;
  for (const id of activeIds) rawPct += (MODIFIER_REGISTRY[id]?.aetherPct ?? 0);

  // relic_of_mastery: +10% aether
  const relics = run.results?.progress?.relics ?? [];
  if (hasRelic(relics, "relic_of_mastery")) rawPct += 10;

  const modifierTotalPct = Math.max(-90, Math.min(200, rawPct));
  const aetherEarned = Math.max(0, Math.floor(baseAether * (1 + modifierTotalPct / 100)));
  return { baseAether, modifierTotalPct, aetherEarned, battlesWon, battlesLost, faints, durationMs, gymsDefeated, scoreVersion: 'm12_v1' };
}

// Deterministic RNG
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

// ── Relic effect helpers ───────────────────────────────────────────────────────
function applyMoneyRelics(relics, baseMoney, nodeType) {
  if (!relics || !baseMoney) return baseMoney ?? 0;
  const isTrainer = typeof nodeType === "string" && nodeType.startsWith("trainer");
  if (isTrainer && hasRelic(relics, "lucky_coin")) {
    return Math.floor(baseMoney * 1.20);
  }
  return baseMoney;
}

function applyAfterBattleHeal(partyState, relics) {
  if (!hasRelic(relics, "field_medic_patch") || !partyState) return partyState;
  return partyState.map(p => {
    if (!p || p.fainted) return p;
    return { ...p, currentHP: Math.min(p.currentHP + 5, p.maxHP) };
  });
}

function applyRationPack(relics, rng) {
  if (!hasRelic(relics, "ration_pack") || !rng) return {};
  return rng() < 0.25 ? { potion: 1 } : {};
}

const TIER_MONEY_BASE  = { weak: 50, avg: 80, skilled: 120, boss: 220 };
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

// Event relic drop chance (8%)
const EVENT_RELIC_CHANCE = 0.08;

const EVENT_SPECIES = {
  10: { id: 10, name: "Caterpie", types: ["bug"], baseStats: { hp:45, atk:30, def:35, spa:20, spd:20, spe:45 }, abilities: ["shield_dust"] },
  13: { id: 13, name: "Weedle", types: ["bug","poison"], baseStats: { hp:40, atk:35, def:30, spa:20, spd:20, spe:50 }, abilities: ["shield_dust"] },
  16: { id: 16, name: "Pidgey", types: ["normal","flying"], baseStats: { hp:40, atk:45, def:40, spa:35, spd:35, spe:56 }, abilities: ["keen_eye"] },
  21: { id: 21, name: "Spearow", types: ["normal","flying"], baseStats: { hp:40, atk:60, def:30, spa:31, spd:31, spe:70 }, abilities: ["keen_eye"] },
  43: { id: 43, name: "Oddish", types: ["grass","poison"], baseStats: { hp:45, atk:50, def:55, spa:75, spd:65, spe:30 }, abilities: ["chlorophyll"] },
  69: { id: 69, name: "Bellsprout", types: ["grass","poison"], baseStats: { hp:50, atk:75, def:35, spa:70, spd:30, spe:40 }, abilities: ["chlorophyll"] },
};

const EVENT_MOVES = {
  tackle: { id: "tackle", pp: 35 },
  string_shot: { id: "string_shot", pp: 40 },
  poison_sting: { id: "poison_sting", pp: 35 },
  gust: { id: "gust", pp: 35 },
  peck: { id: "peck", pp: 35 },
  absorb: { id: "absorb", pp: 25 },
  growth: { id: "growth", pp: 20 },
  vine_whip: { id: "vine_whip", pp: 25 },
};

const EVENT_LEARNSETS = {
  10: ["tackle", "string_shot"],
  13: ["poison_sting", "string_shot"],
  16: ["tackle", "gust"],
  21: ["peck", "growl"],
  43: ["absorb", "growth"],
  69: ["vine_whip", "growth"],
};

const EVENT_NATURES = ["Hardy","Lonely","Brave","Adamant","Naughty","Bold","Docile","Relaxed","Impish","Lax","Timid","Hasty","Serious","Jolly","Naive","Modest","Mild","Quiet","Bashful","Rash","Calm","Gentle","Sassy","Careful","Quirky"];


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

function rngInt(rng, max) {
  return Math.floor(rng() * max);
}

function pickTier(rng) {
  const r = rng();
  if (r < 0.50) return 'weak';
  if (r < 0.85) return 'avg';
  return 'skilled';
}

function pickNodeType(rng, routeIndex) {
  const r = rng();
  if (routeIndex >= 2) {
    if (r < 0.72) return 'trainer';
    if (r < 0.82) return 'center';
    if (r < 0.92) return 'shop';
    return 'event';
  }
  if (r < 0.65) return 'trainer';
  if (r < 0.77) return 'center';
  if (r < 0.89) return 'shop';
  return 'event';
}

function buildNodeMeta(type, tier) {
  if (type === 'trainer') return { trainerName: tier === 'skilled' ? 'Ace Trainer' : tier === 'avg' ? 'Trainer' : 'Youngster' };
  if (type === 'center') return { label: 'Pokémon Center' };
  if (type === 'shop') return { label: 'Poké Mart', stock: ['potion'] };
  if (type === 'event') return { label: 'Item Found', reward: 'potion' };
  return {};
}

function generateRouteGraph(seed, routeIndex) {
  const routeId = `route${routeIndex}`;
  const rng = makeRng(`${seed}:route:${routeIndex}:graph`);
  const targetNodes = routeIndex >= 2 ? (15 + rngInt(rng, 6)) : 12;

  const layers = [{ width: 1 }];
  if (routeIndex <= 1) {
    layers.push({ width: 2 }, { width: 2 }, { width: 1 }, { width: 2 }, { width: rng() > 0.4 ? 2 : 3 }, { width: 2 }, { width: 1 }, { width: 2 }, { width: 2 }, { width: 1 });
  } else {
    let remaining = targetNodes - 2;
    while (remaining > 1) {
      const width = Math.max(1, Math.min(3, 1 + rngInt(rng, 3)));
      const use = Math.min(width, remaining - 1);
      layers.push({ width: use });
      remaining -= use;
    }
    layers.push({ width: 1 });
  }
  layers.push({ width: 1 });

  const nodes = [];
  const layerNodes = [];
  let nodeCounter = 0;

  for (let layer = 0; layer < layers.length; layer++) {
    const width = layers[layer].width;
    const layerIds = [];
    for (let branchIdx = 0; branchIdx < width; branchIdx++) {
      const id = `n${nodeCounter++}`;
      const isStart = layer === 0;
      const isBoss = layer === layers.length - 1;
      let type, tier, meta;
      if (isStart) {
        type = 'event'; tier = null; meta = { label: 'Route Start', reward: 'none' };
      } else if (isBoss) {
        type = 'gym'; tier = 'boss'; meta = { gymId: `gym_${routeIndex}`, badge: routeIndex === 1 ? 'Boulder Badge' : `Route ${routeIndex} Badge` };
      } else {
        type = pickNodeType(rng, routeIndex);
        tier = type === 'trainer' ? pickTier(rng) : null;
        meta = buildNodeMeta(type, tier);
      }
      nodes.push({ id, type, tier, layer, branchIdx, nextIds: [], meta });
      layerIds.push(id);
    }
    layerNodes.push(layerIds);
  }

  for (let l = 0; l < layerNodes.length - 1; l++) {
    const curr = layerNodes[l];
    const next = layerNodes[l + 1];
    if (curr.length === 1 && next.length > 1) {
      nodes.find(n => n.id === curr[0]).nextIds = [...next];
    } else if (curr.length > 1 && next.length === 1) {
      for (const cid of curr) nodes.find(n => n.id === cid).nextIds = [next[0]];
    } else if (curr.length === next.length) {
      for (let i = 0; i < curr.length; i++) {
        const node = nodes.find(n => n.id === curr[i]);
        node.nextIds.push(next[i]);
        if (curr.length > 1) {
          const adj = next[(i + 1) % next.length];
          if (rng() < 0.4 && !node.nextIds.includes(adj)) node.nextIds.push(adj);
        }
      }
    } else {
      for (let i = 0; i < curr.length; i++) {
        const node = nodes.find(n => n.id === curr[i]);
        const targetIdx = Math.floor((i / curr.length) * next.length);
        node.nextIds.push(next[targetIdx]);
      }
    }
  }

  return { routeId, routeIndex, nodes, startNodeId: layerNodes[0][0], bossNodeId: layerNodes[layerNodes.length - 1][0] };
}

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
      const rawProgress = run.results?.progress ?? {};
    const existingProgress = {
      ...rawProgress,
      pendingReward: rawProgress.pendingReward ?? null,
      pendingRouteAdvance: rawProgress.pendingRouteAdvance ?? null,
    };
      return Response.json({ ok: true, alreadyFinished: true, nodeCompleteSummary: { nodeId: existingProgress.currentNodeId, nodeType: existingProgress.pendingEncounter?.nodeType } });
    }

    const rawProgress = run.results?.progress ?? {};
    const existingProgress = {
      ...rawProgress,
      pendingReward: rawProgress.pendingReward ?? null,
      pendingRouteAdvance: rawProgress.pendingRouteAdvance ?? null,
    };
    const pending = existingProgress.pendingEncounter ?? null;

    if (!pending || pending.status === 'resolved') {
      return Response.json({ ok: true, alreadyResolved: true, nodeCompleteSummary: pending?.lastSummary ?? null });
    }

    const { nodeId, nodeType } = pending;
    const nodeLabel = NODE_LABELS[nodeType] ?? nodeType ?? "Node";
    const partyState = existingProgress.partyState ?? null;
    const relics     = existingProgress.relics ?? [];

    const completedNodeIds = [...(existingProgress.completedNodeIds ?? [])];
    if (!completedNodeIds.includes(nodeId)) completedNodeIds.push(nodeId);

    let updatedProgress;
    let nodeCompleteSummary;
    let shouldFinishRun = false;
    let finishOutcome   = null;
    let routeAdvancePayload = null;
    let nextScreen      = "node_complete"; // or "relic_reward"
    let relicSource     = null;

    const rewardRng = makeRng(`${run.seed}:reward:${nodeId}`);

    // ── Battle resolution ──────────────────────────────────────────────────────
    if (resolution.type === 'battle') {
      const { winner, faintCount, battleId } = resolution;
      const outcome = winner === 'player' ? 'win' : 'loss';

      if (outcome === 'win') {
        const tier       = pending.tier ?? 'weak';
        const baseMoney  = TIER_MONEY_BASE[tier] ?? 50;
        const moneyDelta = applyMoneyRelics(relics, baseMoney, nodeType);
        const dropChance = TIER_DROP_CHANCE[tier] ?? 0.6;

        let itemsDelta: Record<string, number> = {};
        if (rewardRng() < dropChance) {
          const baitChance =
            tier === 'skilled' ? 0.35 :
            tier === 'avg' ? 0.25 :
            0.15;

          if (rewardRng() < baitChance) {
            itemsDelta = { bait: 1 };
          } else {
            itemsDelta = { potion: 1 };
          }
        }

        const currentMoney = existingProgress.money ?? 0;
        const currentInv   = existingProgress.inventory ?? { potion: 0, revive: 0, bait: 0 };
        const newInventory = { ...currentInv };

        for (const [item, qty] of Object.entries(itemsDelta)) {
          newInventory[item] = (newInventory[item] ?? 0) + (qty ?? 0);
        }

        // field_medic_patch: heal party after battle
        const healedParty = applyAfterBattleHeal(partyState, relics);

        nodeCompleteSummary = {
          nodeId, nodeType, nodeLabel,
          outcome: 'win',
          moneyDelta,
          itemsDelta,
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
          partyState: healedParty ?? partyState,
          pendingReward: null,
        };

        if (nodeType === 'gym') {
          const fromRouteIndex = existingProgress.routeIndex ?? 1;
          const fromRouteId = existingProgress.routeId ?? `route${fromRouteIndex}`;
          const toRouteIndex = fromRouteIndex + 1;
          const toRouteId = `route${toRouteIndex}`;

          nodeCompleteSummary.gymCleared = true;
          nodeCompleteSummary.routeAdvancedFrom = { routeIndex: fromRouteIndex, routeId: fromRouteId };
          if (fromRouteIndex < 2) {
            nodeCompleteSummary.routeAdvancedTo = { routeIndex: toRouteIndex, routeId: toRouteId };
          }

          // Defer route transition until relic is taken so relic choice is never skipped.
          updatedProgress = {
            ...updatedProgress,
            routeCompleted: fromRouteIndex >= 2,
            pendingEncounter: { ...pending, status: 'resolved', lastSummary: nodeCompleteSummary },
            pendingReward: { type: 'relic', source: 'gym', nodeId },
            pendingRouteAdvance: fromRouteIndex >= 2 ? null : {
              fromRouteId,
              toRouteId,
              applyPostBossHeal: true,
            },
          };

          nextScreen = "relic_reward";
          relicSource = "gym";
        }
      } else {
        // Loss
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
        finishOutcome   = 'enemy';
      }
    }
    // ── Center ─────────────────────────────────────────────────────────────────
    else if (resolution.type === 'center') {
      const healed = (partyState ?? []).map(p => ({
        ...p,
        currentHP: p.maxHP,
        fainted: false,
        status: null,
        moves: p.moves.map(m => ({ ...m, pp: m.ppMax ?? m.pp })),
      }));
      nodeCompleteSummary = { nodeId, nodeType, nodeLabel: 'Pokémon Center', outcome: 'healed', moneyDelta: 0, itemsDelta: {}, faintCount: 0 };
      updatedProgress = {
        ...existingProgress,
        routeId: existingProgress.routeId ?? 'route1',
        currentNodeId: nodeId,
        completedNodeIds,
        pendingEncounter: { ...pending, status: 'resolved', lastSummary: nodeCompleteSummary },
        partyState: healed,
        pendingReward: null,
      };
    }
    // ── Event ──────────────────────────────────────────────────────────────────
    else if (resolution.type === 'event' || resolution.type === 'event_item') {
      const itemsDelta   = resolution.itemsDelta ?? { potion: 1 };
      const currentInv   = existingProgress.inventory ?? { potion: 0, revive: 0, bait: 0 };
      const newInventory = { ...currentInv };

      for (const [item, qty] of Object.entries(itemsDelta)) {
        newInventory[item] = (newInventory[item] ?? 0) + (qty ?? 0);
      }

      // ration_pack: chance of +1 extra potion
      const rationExtra = applyRationPack(relics, makeRng(`${run.seed}:ration:${nodeId}`));
      for (const [item, qty] of Object.entries(rationExtra)) {
        newInventory[item] = (newInventory[item] ?? 0) + qty;
      }
      const combinedDelta = { ...itemsDelta };
      for (const [item, qty] of Object.entries(rationExtra)) {
        combinedDelta[item] = (combinedDelta[item] ?? 0) + qty;
      }

      nodeCompleteSummary = { nodeId, nodeType, nodeLabel: NODE_LABELS[nodeType] ?? 'Event', outcome: 'collected', moneyDelta: 0, itemsDelta: combinedDelta, faintCount: 0 };
      updatedProgress = {
        ...existingProgress,
        routeId: existingProgress.routeId ?? 'route1',
        currentNodeId: nodeId,
        completedNodeIds,
        pendingEncounter: { ...pending, status: 'resolved', lastSummary: nodeCompleteSummary },
        inventory: newInventory,
        partyState,
        pendingReward: null,
      };

      // Roll relic chance for event nodes (8%, or forced by devFlags)
      const relicCap    = hasRelic(relics, "relic_of_mastery") ? 9 : 8;
      const relicRng    = makeRng(`${run.seed}:relic_chance:${nodeId}`);
      const devForced   = existingProgress.devFlags?.forceNextEventRelic === true;
      const rolledRelic = (devForced || relicRng() < EVENT_RELIC_CHANCE) && relics.length < relicCap;
      if (rolledRelic) {
        nextScreen  = "relic_reward";
        relicSource = "event";
        updatedProgress.pendingReward = { type: 'relic', source: 'event', nodeId };
        // Clear the one-time dev flag
        if (devForced) {
          updatedProgress.devFlags = { ...(updatedProgress.devFlags ?? existingProgress.devFlags ?? {}), forceNextEventRelic: false };
        }
      }
    }
    // ── Shop ───────────────────────────────────────────────────────────────────
    else if (resolution.type === 'shop') {
      nodeCompleteSummary = { nodeId, nodeType, nodeLabel: 'PokéMart', outcome: 'visited', moneyDelta: 0, itemsDelta: {}, faintCount: 0 };
      updatedProgress = {
        ...existingProgress,
        routeId: existingProgress.routeId ?? 'route1',
        currentNodeId: nodeId,
        completedNodeIds,
        pendingEncounter: { ...pending, status: 'resolved', lastSummary: nodeCompleteSummary },
        partyState,
        pendingReward: null,
      };
    }
    else {
      return Response.json({ error: `Unknown resolution type: ${resolution.type}` }, { status: 400 });
    }

    // ── Persist + log ──────────────────────────────────────────────────────────
    const nextIdx = (run.nextActionIdx ?? 0) + 1;
    const runActionsToCreate = [
      {
        runId, idx: nextIdx, actionType: 'node_resolved',
        payload: { nodeId, nodeType, resolution: resolution.type, summary: nodeCompleteSummary, nextScreen },
      },
    ];

    let finalActionIdx = nextIdx;
    if (nodeType === 'gym' && resolution.type === 'battle' && resolution.winner === 'player') {
      finalActionIdx += 1;
      runActionsToCreate.push({
        runId,
        idx: finalActionIdx,
        actionType: 'gym_defeated',
        payload: { routeId: nodeCompleteSummary?.routeAdvancedFrom?.routeId ?? (existingProgress.routeId ?? 'route1'), nodeId },
      });
    }

    await Promise.all([
      base44.entities.Run.update(runId, {
        results: { ...(run.results ?? {}), progress: updatedProgress },
        nextActionIdx: finalActionIdx,
      }),
      ...runActionsToCreate.map(a => base44.entities.RunAction.create(a)),
    ]);

    // ── Finish run if needed (gym win or battle loss) ─────────────────────────
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

      const finishIdx = finalActionIdx + 1;
      await Promise.all([
        base44.entities.Run.update(runId, {
          status: 'finished', endedAt: nowIso, nextActionIdx: finishIdx,
          results: {
            ...(run.results ?? {}),
            progress: updatedProgress,
            winner: finishOutcome,
            reason: finishOutcome === 'enemy' ? 'battle_loss' : 'completed',
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

    return Response.json({ ok: true, nodeCompleteSummary, nextScreen, relicSource });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
