// ── Deterministic Route Graph Generator ──────────────────────────────────────
// Slay-the-Spire-style: splits into branches that merge back, boss at end.

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

// Tier distribution: 50% weak, 35% avg, 15% skilled
function pickTier(rng) {
  const r = rng();
  if (r < 0.50) return "weak";
  if (r < 0.85) return "avg";
  return "skilled";
}

// Node type weights for non-special slots
// trainer: 65%, center: 12%, shop: 12%, event: 11%
function pickNodeType(rng) {
  const r = rng();
  if (r < 0.65) return "trainer";
  if (r < 0.77) return "center";
  if (r < 0.89) return "shop";
  return "event";
}

/**
 * generateRouteGraph({ seed, routeId })
 * Returns { routeId, nodes: Node[], startNodeId, bossNodeId }
 * 
 * Node: { id, type, tier, layer, branchIdx, nextIds, meta }
 */
export function generateRouteGraph({ seed, routeId = "route1" }) {
  const rng = makeRng(`${seed}:${routeId}:graph`);

  // ── Layer structure ────────────────────────────────────────────────────────
  // Layers: 0=start, 1..N-2=content, N-1=boss
  // Content layers alternate between "split" and "merge"
  // Layout: start → [branch pairs] → merge → [branch pairs] → merge → boss
  
  const layers = [
    { width: 1, split: false },  // layer 0: single start
    { width: 2, split: true },   // layer 1: 2-way split
    { width: 2, split: false },  // layer 2
    { width: 1, split: false },  // layer 3: merge
    { width: 2, split: true },   // layer 4: 2-way split
    { width: 3, split: false },  // layer 5: rare 3-way (occasionally)
    { width: 2, split: false },  // layer 6
    { width: 1, split: false },  // layer 7: merge
    { width: 2, split: true },   // layer 8: final split
    { width: 2, split: false },  // layer 9
    { width: 1, split: false },  // layer 10: pre-boss merge
    { width: 1, split: false },  // layer 11: BOSS
  ];

  // Randomly decide if layer 5 is 3-way or 2-way
  if (rng() > 0.4) layers[5].width = 2;

  const nodes = [];
  let nodeId = 0;

  // Build nodes layer by layer
  const layerNodes = []; // layerNodes[l] = array of node ids in that layer
  for (let l = 0; l < layers.length; l++) {
    const { width } = layers[l];
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
        meta = { gymId: "gym1", leaderName: "Brock", badge: "Boulder Badge" };
      } else {
        type = pickNodeType(rng);
        tier = type === "trainer" ? pickTier(rng) : null;
        meta = buildNodeMeta(type, tier, rng);
      }

      nodes.push({ id, type, tier, layer: l, branchIdx: b, nextIds: [], meta });
      layerArr.push(id);
    }
    layerNodes.push(layerArr);
  }

  // ── Wire edges (deterministic) ────────────────────────────────────────────
  for (let l = 0; l < layers.length - 1; l++) {
    const curr = layerNodes[l];
    const next = layerNodes[l + 1];

    if (curr.length === 1 && next.length > 1) {
      // Split: connect single node to all next
      const node = nodes.find(n => n.id === curr[0]);
      node.nextIds = [...next];
    } else if (curr.length > 1 && next.length === 1) {
      // Merge: all current connect to the single next
      for (const cId of curr) {
        nodes.find(n => n.id === cId).nextIds = [next[0]];
      }
    } else if (curr.length === next.length) {
      // Same width: pair up + add cross-connections for some
      for (let i = 0; i < curr.length; i++) {
        const node = nodes.find(n => n.id === curr[i]);
        // Always connect to same-index next
        node.nextIds.push(next[i]);
        // Cross-connect to adjacent with 40% chance
        if (curr.length > 1) {
          const adj = next[(i + 1) % next.length];
          if (rng() < 0.4 && !node.nextIds.includes(adj)) {
            node.nextIds.push(adj);
          }
        }
      }
    } else {
      // Different widths: distribute evenly
      for (let i = 0; i < curr.length; i++) {
        const node = nodes.find(n => n.id === curr[i]);
        const targetIdx = Math.floor((i / curr.length) * next.length);
        node.nextIds.push(next[targetIdx]);
        // Also optionally connect to adjacent
        const adjIdx = (targetIdx + 1) % next.length;
        if (rng() < 0.35 && !node.nextIds.includes(next[adjIdx])) {
          node.nextIds.push(next[adjIdx]);
        }
      }
    }
  }

  // ── Enforce constraints ───────────────────────────────────────────────────
  enforceConstraints(nodes, rng);

  // ── Enforce guarantee: 2 shops, 1-2 centers ───────────────────────────────
  enforceGuarantees(nodes, rng);

  return {
    routeId,
    nodes,
    startNodeId: layerNodes[0][0],
    bossNodeId: layerNodes[layerNodes.length - 1][0],
  };
}

function buildNodeMeta(type, tier, rng) {
  if (type === "trainer") {
    const names = {
      weak:    ["Youngster Joey", "Lass Haley", "Bug Catcher Travis"],
      avg:     ["Hiker Robert", "Camper Todd", "Picnicker Susan"],
      skilled: ["Ace Trainer May", "Cooltrainer Nick", "Rival Barry"],
    };
    return { trainerName: rngChoice(rng, names[tier] ?? names.weak) };
  }
  if (type === "center") return { label: "Pokémon Center" };
  if (type === "shop") return { label: "Poké Mart", stock: ["potion"] };
  if (type === "event") return { label: "Item Found", reward: "potion" };
  return {};
}

function enforceConstraints(nodes, rng) {
  // No 3 consecutive trainers in a single branch — convert middle to event
  // No center immediately after shop — swap shop to event
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "gym" || node.type === "event" && node.meta?.label === "Route Start") continue;

    // Check predecessors
    const preds = nodes.filter(n => n.nextIds.includes(node.id));
    if (node.type === "center") {
      // If any pred is a shop, convert pred to event
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

function enforceGuarantees(nodes, rng) {
  const contentNodes = nodes.filter(n => n.type !== "gym" && !(n.meta?.label === "Route Start"));
  
  const shops = contentNodes.filter(n => n.type === "shop");
  const centers = contentNodes.filter(n => n.type === "center");

  // Need at least 2 shops
  let missingShops = Math.max(0, 2 - shops.length);
  const trainers = contentNodes.filter(n => n.type === "trainer");
  const shuffledTrainers = [...trainers].sort(() => rng() - 0.5);
  for (const t of shuffledTrainers) {
    if (missingShops <= 0) break;
    // Only convert if no adjacent center
    const preds = nodes.filter(n => n.nextIds.includes(t.id));
    const hasAdjacentCenter = preds.some(p => p.type === "center") || t.nextIds.some(nid => {
      const next = nodes.find(n => n.id === nid);
      return next?.type === "center";
    });
    if (!hasAdjacentCenter) {
      t.type = "shop"; t.tier = null; t.meta = { label: "Poké Mart", stock: ["potion"] };
      missingShops--;
    }
  }

  // Need at least 1 center
  if (centers.length === 0) {
    const candidates = contentNodes.filter(n => n.type === "trainer" && n.tier === "weak");
    if (candidates.length > 0) {
      const pick = candidates[rngInt(rng, candidates.length)];
      pick.type = "center"; pick.tier = null; pick.meta = { label: "Pokémon Center" };
    }
  }
}

// ── Compact serializer for logging ────────────────────────────────────────────
export function serializeGraph(graph) {
  return {
    routeId: graph.routeId,
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

// ── Simple hash of graph for anti-cheat ──────────────────────────────────────
export function hashGraph(graph) {
  let h = 2166136261;
  const str = graph.nodes.map(n => `${n.id}:${n.type}:${n.tier}:${n.nextIds.join(",")}`).join("|");
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}