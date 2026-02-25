import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Inline DB (MVP 151 subset) ────────────────────────────────────────────────
const SPECIES = [
  { id: 1,  name: "Bulbasaur",  types: ["grass","poison"],   baseStats: { hp:45, atk:49, def:49, spa:65, spd:65, spe:45 }, abilities: ["overgrow"] },
  { id: 4,  name: "Charmander", types: ["fire"],             baseStats: { hp:39, atk:52, def:43, spa:60, spd:50, spe:65 }, abilities: ["blaze"] },
  { id: 7,  name: "Squirtle",   types: ["water"],            baseStats: { hp:44, atk:48, def:65, spa:50, spd:64, spe:43 }, abilities: ["torrent"] },
  { id: 10, name: "Caterpie",   types: ["bug"],              baseStats: { hp:45, atk:30, def:35, spa:20, spd:20, spe:45 }, abilities: ["shield_dust"] },
  { id: 25, name: "Pikachu",    types: ["electric"],         baseStats: { hp:35, atk:55, def:40, spa:50, spd:50, spe:90 }, abilities: ["static"] },
];
const MVP_ALLOWED_IDS = new Set([1, 4, 7, 10, 25]);
// starterRank for cull (all rank 1 for simplicity)
const STARTER_RANK = { 1:1, 4:1, 7:1, 10:2, 25:2 };
const KANTO_STARTER_IDS = new Set([1, 4, 7]);
const NATURES = ["Hardy","Lonely","Brave","Adamant","Naughty","Bold","Docile","Relaxed","Impish","Lax","Timid","Hasty","Serious","Jolly","Naive","Modest","Mild","Quiet","Bashful","Rash","Calm","Gentle","Sassy","Careful","Quirky"];

// ── Deterministic RNG (mulberry32) ────────────────────────────────────────────
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function makeRng(seedStr) {
  let s = hashString(String(seedStr));
  return {
    next: () => {
      s |= 0; s = s + 0x6d2b79f5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    },
    nextInt: (max) => { let s2 = hashString(String(seedStr)); return Math.floor(makeRng(String(s2)).next() * max); },
    shuffle: function(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

function getStarterConfig(modifiers = {}) {
  return {
    poolSize: modifiers.starter_pool_expand_5 ? 5 : 3,
    kantoDirectStep: !!modifiers.kanto_starter_direct,
    typeDiversityMode: modifiers.type_diversity_hard ? "hard"
      : modifiers.type_diversity_soft ? "soft"
      : "none",
  };
}

function buildEligibleSpecies(modifiers = {}) {
  let eligible = SPECIES.filter(s => MVP_ALLOWED_IDS.has(s.id));
  const cullRank = modifiers.cull_rank_1_2 ? 2 : modifiers.cull_rank_1 ? 1 : 0;
  if (cullRank > 0) {
    const culled = eligible.filter(s => (STARTER_RANK[s.id] ?? 99) > cullRank);
    if (culled.length >= 3) eligible = culled;
  }
  return eligible;
}

function generatePoolFirstPick(seed, step, eligibleSpecies, pickedIds, config) {
  const subSeed = `${seed}:step${step}:reroll0`;
  const rng = makeRng(subSeed);

  if (config.kantoDirectStep && step === 0) {
    const kantoPool = eligibleSpecies.filter(s => KANTO_STARTER_IDS.has(s.id));
    if (kantoPool.length >= 3) return kantoPool[0];
  }

  let pool = eligibleSpecies.filter(s => !pickedIds.has(s.id));
  pool = rng.shuffle(pool);
  return pool[0] ?? null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { runId } = await req.json();
    if (!runId) return Response.json({ error: "runId required" }, { status: 400 });

    // Load run
    const runs = await base44.entities.Run.filter({ id: runId });
    const run = runs[0];
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    if (run.playerId !== user.id && user.role !== "admin")
      return Response.json({ error: "Forbidden" }, { status: 403 });
    if (run.status !== "active")
      return Response.json({ error: "Run is not active" }, { status: 400 });

    // Load existing actions
    const actions = await base44.asServiceRole.entities.RunAction.filter({ runId });
    actions.sort((a, b) => a.idx - b.idx);

    const hasConfirm = actions.some(a => a.actionType === "starter_confirm");
    if (hasConfirm) {
      const picks = actions
        .filter(a => a.actionType === "starter_pick")
        .map(a => a.payload?.speciesId);
      return Response.json({ ok: true, alreadyConfirmed: true, picks });
    }

    const modifiers = run.modifiers ?? {};
    const config = getStarterConfig(modifiers);
    const eligibleSpecies = buildEligibleSpecies(modifiers);

    const existingPicks = actions.filter(a => a.actionType === "starter_pick");
    const pickedIds = new Set(existingPicks.map(a => Number(a.payload?.speciesId)));
    const pickedSpeciesIds = [...pickedIds];

    // Determine how many picks are still needed
    const stepsNeeded = [];
    for (let step = 0; step < 3; step++) {
      if (existingPicks.find(a => a.payload?.step === step || a.payload?.step === ["A","B","C"][step])) continue;
      stepsNeeded.push(step);
    }

    // If we can't tell by step field, just count picks
    const pickCount = existingPicks.length;
    const toAppend = [];

    for (let step = pickCount; step < 3; step++) {
      const species = generatePoolFirstPick(run.seed, step, eligibleSpecies, pickedIds, config);
      if (!species) return Response.json({ error: `No eligible species for step ${step}` }, { status: 500 });
      pickedIds.add(species.id);
      pickedSpeciesIds.push(species.id);
      toAppend.push({ actionType: "starter_pick", payload: { step: ["A","B","C"][step], speciesId: species.id, poolIdx: 0, rerollIdx: 0 } });
    }

    // Append any missing picks
    for (const action of toAppend) {
      await base44.functions.invoke("appendRunAction", { runId, ...action });
    }

    // Append starter_confirm
    await base44.functions.invoke("appendRunAction", {
      runId,
      actionType: "starter_confirm",
      payload: { speciesIds: pickedSpeciesIds },
    });

    return Response.json({ ok: true, alreadyConfirmed: false, picks: pickedSpeciesIds });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});