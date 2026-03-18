import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const RELICS = [
  { id: "field_medic_patch", rarity: "common" },
  { id: "lucky_coin",        rarity: "common" },
  { id: "ration_pack",       rarity: "common" },
  { id: "scout_compass",     rarity: "common" },
  { id: "band_of_resonance", rarity: "uncommon" },
  { id: "cracked_everstone", rarity: "uncommon" },
  { id: "ether_lens",        rarity: "uncommon" },
  { id: "gym_scout_contract",rarity: "uncommon" },
  { id: "focus_charm",       rarity: "rare" },
  { id: "surge_battery",     rarity: "rare" },
  { id: "bargain_seal",      rarity: "rare" },
  { id: "relic_of_mastery",  rarity: "legendary" },
];

const RARITY_ORDER = ["common", "uncommon", "rare", "legendary"];

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

function weightedPick(pool, weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function rarityWeight(rarity, slot) {
  // slot 0 (first pick, gym): bias toward uncommon/rare/legendary
  // slot 1,2: bias toward common/uncommon
  if (slot === 0) {
    return { common: 5, uncommon: 40, rare: 40, legendary: 15 }[rarity] ?? 10;
  }
  return { common: 50, uncommon: 35, rare: 12, legendary: 3 }[rarity] ?? 10;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { runId, source, nodeId } = await req.json();
    if (!runId || !source) return Response.json({ error: 'runId and source required' }, { status: 400 });

    const run = await base44.entities.Run.get(runId);
    if (!run) return Response.json({ error: 'Run not found' }, { status: 404 });

    const progress = run.results?.progress ?? {};
    const ownedRelics = progress.relics ?? [];
    const ownedIds = new Set(ownedRelics.map(r => r.id));

    // Compute cap (relic_of_mastery adds +1)
    const hasMastery = ownedIds.has("relic_of_mastery");
    const cap = hasMastery ? 9 : 8;

    if (ownedRelics.length >= cap) {
      return Response.json({ choices: [], reason: "cap_reached" });
    }

    const available = RELICS.filter(r => !ownedIds.has(r.id));
    if (available.length === 0) {
      return Response.json({ choices: [], reason: "pool_exhausted" });
    }

    const rng = makeRng(`${run.seed}:relic:${nodeId ?? source}`);
    const numChoices = Math.min(3, available.length);
    const choices = [];
    const used = new Set();
    let attempts = 0;

    while (choices.length < numChoices && attempts < 200) {
      attempts++;
      const slot = choices.length;
      const weights = available.filter(r => !used.has(r.id)).map(r => rarityWeight(r.rarity, slot));
      const pool    = available.filter(r => !used.has(r.id));
      if (pool.length === 0) break;

      const picked = weightedPick(pool, weights, rng);

      // For gym source slot 0: enforce at least 1 uncommon+ if none yet
      if (source === "gym" && slot === 0) {
        const nonCommon = pool.filter(r => r.rarity !== "common");
        if (nonCommon.length > 0 && picked.rarity === "common") continue;
      }

      used.add(picked.id);
      choices.push(picked.id);
    }

    return Response.json({ choices, source, nodeId });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});