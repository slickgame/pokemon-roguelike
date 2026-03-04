import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

function routeIndexFromRouteId(routeId, fallback) {
  const m = String(routeId ?? '').match(/^route(\d+)$/);
  if (m) return Number(m[1]);
  return fallback;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { runId } = await req.json();
    if (!runId) return Response.json({ error: 'runId required' }, { status: 400 });

    const run = await base44.entities.Run.get(runId);
    if (!run) return Response.json({ error: 'Run not found' }, { status: 404 });
    if (run.playerId !== user.id && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const rawProgress = run.results?.progress ?? {};
    const progress = {
      ...rawProgress,
      pendingReward: rawProgress.pendingReward ?? null,
      pendingRouteAdvance: rawProgress.pendingRouteAdvance ?? null,
    };

    if (!progress.pendingRouteAdvance) {
      return Response.json({ ok: true, didAdvance: false });
    }

    const adv = progress.pendingRouteAdvance;
    const currentRouteIndex = progress.routeIndex ?? routeIndexFromRouteId(progress.routeId, 1) ?? 1;
    const toRouteId = adv.toRouteId ?? `route${currentRouteIndex + 1}`;
    const toRouteIndex = routeIndexFromRouteId(toRouteId, currentRouteIndex + 1);

    const nextGraph = generateRouteGraph(run.seed, toRouteIndex);

    const updatedProgress = {
      ...progress,
      routeId: toRouteId,
      routeIndex: toRouteIndex,
      routeGraph: nextGraph,
      currentNodeId: null,
      completedNodeIds: [],
      pendingEncounter: null,
      pendingRouteAdvance: null,
      routeAdvanceReady: false,
      partyState: adv.applyPostBossHeal ? postGymHealParty(progress.partyState) : progress.partyState,
    };

    const nextIdx = (run.nextActionIdx ?? 0) + 1;
    await Promise.all([
      base44.entities.Run.update(runId, { results: { ...(run.results ?? {}), progress: updatedProgress }, nextActionIdx: nextIdx }),
      base44.entities.RunAction.create({
        runId,
        idx: nextIdx,
        actionType: 'route_advanced',
        payload: {
          from: { routeId: adv.fromRouteId ?? progress.routeId ?? `route${currentRouteIndex}`, routeIndex: currentRouteIndex },
          to: { routeId: toRouteId, routeIndex: toRouteIndex },
          reason: 'gym_cleared',
        },
      }),
    ]);

    return Response.json({ ok: true, didAdvance: true, routeId: toRouteId, routeIndex: toRouteIndex });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
