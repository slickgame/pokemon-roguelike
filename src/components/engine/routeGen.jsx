// ── Deterministic Route Graph Generator ──────────────────────────────────────

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

function rngInt(rng, max) { return Math.floor(rng() * max); }
function rngChoice(rng, arr) { return arr[rngInt(rng, arr.length)]; }

function pickTier(rng) {
  const r = rng();
  if (r < 0.50) return "weak";
  if (r < 0.85) return "avg";
  return "skilled";
}

function pickNodeType(rng, routeIndex) {
  const r = rng();
  if (routeIndex >= 2) {
    if (r < 0.72) return "trainer";
    if (r < 0.82) return "center";
    if (r < 0.92) return "shop";
    return "event";
  }
  if (r < 0.65) return "trainer";
  if (r < 0.77) return "center";
  if (r < 0.89) return "shop";
  return "event";
}

function buildLayers(rng, routeIndex) {
  if (routeIndex <= 1) {
    const layers = [
      { width: 1 }, { width: 2 }, { width: 2 }, { width: 1 }, { width: 2 },
      { width: rng() > 0.4 ? 2 : 3 }, { width: 2 }, { width: 1 }, { width: 2 },
      { width: 2 }, { width: 1 }, { width: 1 },
    ];
    return layers;
  }

  // Route 2+ : 15-20 total nodes (including start + gym)
  const targetNodes = 15 + rngInt(rng, 6); // [15..20]
  const layers = [{ width: 1 }];
  let remaining = targetNodes - 2; // reserve pre-boss + boss

  while (remaining > 1) {
    const width = Math.max(1, Math.min(3, 1 + rngInt(rng, 3)));
    const use = Math.min(width, remaining - 1);
    layers.push({ width: use });
    remaining -= use;
  }

  layers.push({ width: 1 }); // pre-boss merge
  layers.push({ width: 1 }); // gym
  return layers;
}

/**
 * generateRouteGraph({ seed, routeId, routeIndex })
 */
export function generateRouteGraph({ seed, routeId = "route1", routeIndex = 1 }) {
  const rng = makeRng(`${seed}:route:${routeIndex}:graph`);
  const layers = buildLayers(rng, routeIndex);

  const nodes = [];
  let nodeId = 0;
  const layerNodes = [];

  for (let l = 0; l < layers.length; l++) {
    const width = layers[l].width;
    const isStart = l === 0;
    const isBoss = l === layers.length - 1;
    const layerArr = [];

    for (let b = 0; b < width; b++) {
      const id = `n${nodeId++}`;
      let type, tier, meta;

      if (isStart) {
        type = "event"; tier = null; meta = { label: "Route Start", reward: "none" };
      } else if (isBoss) {
        type = "gym"; tier = "boss";
        meta = { gymId: `gym_${routeIndex}`, leaderName: routeIndex === 1 ? "Brock" : `Route ${routeIndex} Gym`, badge: routeIndex === 1 ? "Boulder Badge" : `Route ${routeIndex} Badge` };
      } else {
        type = pickNodeType(rng, routeIndex);
        tier = type === "trainer" ? pickTier(rng) : null;
        meta = buildNodeMeta(type, tier, rng);
      }

      nodes.push({ id, type, tier, layer: l, branchIdx: b, nextIds: [], meta });
      layerArr.push(id);
    }
    layerNodes.push(layerArr);
  }

  for (let l = 0; l < layers.length - 1; l++) {
    const curr = layerNodes[l];
    const next = layerNodes[l + 1];

    if (curr.length === 1 && next.length > 1) {
      nodes.find(n => n.id === curr[0]).nextIds = [...next];
    } else if (curr.length > 1 && next.length === 1) {
      for (const cId of curr) nodes.find(n => n.id === cId).nextIds = [next[0]];
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
        const adjIdx = (targetIdx + 1) % next.length;
        if (rng() < 0.35 && !node.nextIds.includes(next[adjIdx])) node.nextIds.push(next[adjIdx]);
      }
    }
  }

  enforceConstraints(nodes);
  enforceGuarantees(nodes, rng, routeIndex);

  return {
    routeId,
    routeIndex,
    nodes,
    startNodeId: layerNodes[0][0],
    bossNodeId: layerNodes[layerNodes.length - 1][0],
  };
}

function buildNodeMeta(type, tier, rng) {
  if (type === "trainer") {
    const names = {
      weak: ["Youngster Joey", "Lass Haley", "Bug Catcher Travis"],
      avg: ["Hiker Robert", "Camper Todd", "Picnicker Susan"],
      skilled: ["Ace Trainer May", "Cooltrainer Nick", "Rival Barry"],
    };
    return { trainerName: rngChoice(rng, names[tier] ?? names.weak) };
  }
  if (type === "center") return { label: "Pokémon Center" };
  if (type === "shop") return { label: "Poké Mart", stock: ["potion"] };
  if (type === "event") return { label: "Item Found", reward: "potion" };
  return {};
}

function enforceConstraints(nodes) {
  for (const node of nodes) {
    if (node.type === "gym" || (node.type === "event" && node.meta?.label === "Route Start")) continue;
    if (node.type === "center") {
      const preds = nodes.filter(n => n.nextIds.includes(node.id));
      for (const pred of preds) {
        if (pred.type === "shop") {
          pred.type = "event";
          pred.tier = null;
          pred.meta = { label: "Item Found", reward: "potion" };
        }
      }
    }
  }
}

function enforceGuarantees(nodes, rng, routeIndex) {
  const contentNodes = nodes.filter(n => n.type !== "gym" && !(n.meta?.label === "Route Start"));
  const minShops = routeIndex >= 2 ? 3 : 2;

  const shops = contentNodes.filter(n => n.type === "shop");
  let missingShops = Math.max(0, minShops - shops.length);
  const trainers = contentNodes.filter(n => n.type === "trainer");
  const shuffled = [...trainers].sort(() => rng() - 0.5);

  for (const t of shuffled) {
    if (missingShops <= 0) break;
    const preds = nodes.filter(n => n.nextIds.includes(t.id));
    const hasAdjacentCenter = preds.some(p => p.type === "center") || t.nextIds.some(nid => nodes.find(n => n.id === nid)?.type === "center");
    if (!hasAdjacentCenter) {
      t.type = "shop"; t.tier = null; t.meta = { label: "Poké Mart", stock: ["potion"] };
      missingShops--;
    }
  }

  const centers = contentNodes.filter(n => n.type === "center");
  if (centers.length === 0) {
    const candidates = contentNodes.filter(n => n.type === "trainer" && n.tier === "weak");
    if (candidates.length > 0) {
      const pick = candidates[rngInt(rng, candidates.length)];
      pick.type = "center"; pick.tier = null; pick.meta = { label: "Pokémon Center" };
    }
  }
}

export function serializeGraph(graph) {
  return {
    routeId: graph.routeId,
    routeIndex: graph.routeIndex,
    startNodeId: graph.startNodeId,
    bossNodeId: graph.bossNodeId,
    nodes: graph.nodes.map(n => ({
      id: n.id,
      type: n.type,
      tier: n.tier ?? null,
      layer: n.layer,
      nextIds: n.nextIds,
      metaLabel: n.meta?.label ?? n.meta?.trainerName ?? null,
    })),
  };
}

export function hashGraph(graph) {
  let h = 2166136261;
  const str = graph.nodes.map(n => `${n.id}:${n.type}:${n.tier}:${n.nextIds.join(",")}`).join("|");
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}
