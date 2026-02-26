import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── DB Bundle (mirrors components/db/dbLoader exactly) ────────────────────────
// NOTE: Deno functions are deployed independently and cannot import local files.
// This data is the single source of truth — keep in sync with dbLoader.js.

const DB_SPECIES = [
  { id: 1,  name: "Bulbasaur",  types: ["grass","poison"],  baseStats: { hp:45, atk:49, def:49, spa:65, spd:65, spe:45 }, abilities: ["overgrow"],    learnset: ["tackle","growl","vine_whip"] },
  { id: 4,  name: "Charmander", types: ["fire"],            baseStats: { hp:39, atk:52, def:43, spa:60, spd:50, spe:65 }, abilities: ["blaze"],       learnset: ["scratch","growl","ember"] },
  { id: 7,  name: "Squirtle",   types: ["water"],           baseStats: { hp:44, atk:48, def:65, spa:50, spd:64, spe:43 }, abilities: ["torrent"],     learnset: ["tackle","tail_whip","water_gun"] },
  { id: 10, name: "Caterpie",   types: ["bug"],             baseStats: { hp:45, atk:30, def:35, spa:20, spd:20, spe:45 }, abilities: ["shield_dust"], learnset: ["tackle","string_shot"] },
  { id: 25, name: "Pikachu",    types: ["electric"],        baseStats: { hp:35, atk:55, def:40, spa:50, spd:50, spe:90 }, abilities: ["static"],     learnset: ["thunder_shock","growl","quick_attack"] },
];

const DB_MOVES = [
  { id: "tackle",        name: "Tackle",       type: "normal",   category: "physical", power: 40,   accuracy: 100, pp: 35, priority: 0, target: "single" },
  { id: "scratch",       name: "Scratch",      type: "normal",   category: "physical", power: 40,   accuracy: 100, pp: 35, priority: 0, target: "single" },
  { id: "ember",         name: "Ember",        type: "fire",     category: "special",  power: 40,   accuracy: 100, pp: 25, priority: 0, target: "single" },
  { id: "growl",         name: "Growl",        type: "normal",   category: "status",   power: null, accuracy: 100, pp: 40, priority: 0, target: "all_opponents" },
  { id: "vine_whip",     name: "Vine Whip",    type: "grass",    category: "physical", power: 45,   accuracy: 100, pp: 25, priority: 0, target: "single" },
  { id: "water_gun",     name: "Water Gun",    type: "water",    category: "special",  power: 40,   accuracy: 100, pp: 25, priority: 0, target: "single" },
  { id: "thunder_shock", name: "ThunderShock", type: "electric", category: "special",  power: 40,   accuracy: 100, pp: 30, priority: 0, target: "single" },
  { id: "quick_attack",  name: "Quick Attack", type: "normal",   category: "physical", power: 40,   accuracy: 100, pp: 30, priority: 1, target: "single" },
  { id: "string_shot",   name: "String Shot",  type: "bug",      category: "status",   power: null, accuracy: 95,  pp: 40, priority: 0, target: "all_opponents" },
  { id: "tail_whip",     name: "Tail Whip",    type: "normal",   category: "status",   power: null, accuracy: 100, pp: 30, priority: 0, target: "all_opponents" },
];

const MVP_CONFIG = {
  allowedSpeciesIds: [1, 4, 7, 10, 25],
};

const NATURES = ["Hardy","Lonely","Brave","Adamant","Naughty","Bold","Docile","Relaxed","Impish","Lax","Timid","Hasty","Serious","Jolly","Naive","Modest","Mild","Quiet","Bashful","Rash","Calm","Gentle","Sassy","Careful","Quirky"];

// ── DB Lookups ────────────────────────────────────────────────────────────────
const _speciesMap = {};
for (const s of DB_SPECIES) _speciesMap[s.id] = s;

const _movesMap = {};
for (const m of DB_MOVES) _movesMap[m.id] = m;

function getSpeciesById(id) { return _speciesMap[id] ?? null; }
function getMoveById(id)    { return _movesMap[id] ?? null; }

// ── RNG ───────────────────────────────────────────────────────────────────────
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
function deterministicShuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rngInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Move selection from learnset ─────────────────────────────────────────────
// Returns move objects with currentPp set. Always tries: tackle, 1 STAB move, growl fallback.
function buildMoveset(species) {
  const learnset = species.learnset ?? [];
  const moves = [];

  // 1. Always include tackle (or scratch as normal physical fallback)
  const normalPhysical = learnset.find(id => {
    const m = getMoveById(id);
    return m && m.type === "normal" && m.category === "physical" && m.power;
  });
  if (normalPhysical) {
    const m = getMoveById(normalPhysical);
    moves.push({ ...m, currentPp: m.pp });
  }

  // 2. STAB move (non-normal type matching species primary type, with power)
  const primaryType = species.types[0];
  if (primaryType !== "normal") {
    const stabId = learnset.find(id => {
      const m = getMoveById(id);
      return m && m.type === primaryType && m.power;
    });
    if (stabId) {
      const m = getMoveById(stabId);
      moves.push({ ...m, currentPp: m.pp });
    }
  }

  // 3. If we only have 1 move (or 0), add growl as filler
  if (moves.length < 2) {
    const growl = getMoveById("growl");
    if (growl && learnset.includes("growl")) {
      moves.push({ ...growl, currentPp: growl.pp });
    }
  }

  return moves;
}

// ── Pokémon builder ───────────────────────────────────────────────────────────
function buildPokemon(species, level, subSeed) {
  const rng = makeRng(subSeed);
  const nature = NATURES[rngInt(rng, NATURES.length)];
  const abilityId = species.abilities[rngInt(rng, species.abilities.length)];
  const shiny = rngInt(rng, 1024) === 0;
  const moves = buildMoveset(species);
  const hp = Math.floor((2 * species.baseStats.hp * level) / 100) + level + 10;
  return {
    speciesId: species.id,
    name: species.name,
    types: species.types,
    level,
    nature,
    abilityId,
    shiny,
    ivs: { hp:0, atk:0, def:0, spa:0, spd:0, spe:0 },
    baseStats: species.baseStats,
    maxHp: hp,
    currentHp: hp,
    status: null,
    statusTurns: 0,
    moves,
    fainted: false,
  };
}

// ── Tier config ───────────────────────────────────────────────────────────────
const TIER_LEVEL        = { weak: 5, avg: 6, skilled: 7, boss: 9 };
const TIER_ACTIVE_COUNT = { weak: 1, avg: 2, skilled: 3, boss: 3 };
const TIER_TRAINER_NAME = { weak: "Youngster", avg: "Camper", skilled: "Ace Trainer", boss: "Gym Leader Brock" };

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, nodeId, nodeType, tier, routeId } = await req.json();
    if (!runId || !nodeId) return Response.json({ error: "runId and nodeId required" }, { status: 400 });

    const runs = await base44.entities.Run.filter({ id: runId });
    const run = runs[0];
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    if (run.playerId !== user.id && user.role !== "admin")
      return Response.json({ error: "Forbidden" }, { status: 403 });

    // Get player starters from RunActions
    const actions = await base44.asServiceRole.entities.RunAction.filter({ runId });
    actions.sort((a, b) => a.idx - b.idx);

    const pickedIds = [];
    for (const a of actions) {
      if (a.actionType === "starter_pick" && a.payload?.speciesId) {
        pickedIds.push(Number(a.payload.speciesId));
      }
    }
    const hasConfirm = actions.some(a => a.actionType === "starter_confirm");
    if (!hasConfirm || pickedIds.length < 3) {
      return Response.json({ error: "Starters not confirmed" }, { status: 400 });
    }

    const isGym       = nodeType === "gym" || tier === "boss";
    const resolvedTier = tier ?? (isGym ? "boss" : "weak");
    const level        = TIER_LEVEL[resolvedTier] ?? TIER_LEVEL.weak;
    const activeCount  = TIER_ACTIVE_COUNT[resolvedTier] ?? 1;
    const benchCount   = Math.min(activeCount, 2);
    const trainerName  = TIER_TRAINER_NAME[resolvedTier] ?? "Trainer";

    // ── Player team ──────────────────────────────────────────────────────────
    const playerActive = pickedIds.slice(0, 3).map((sid, i) => {
      const sp = getSpeciesById(sid);
      if (!sp) return null;
      return buildPokemon(sp, 5, `${run.seed}:player:active:${i}:${sid}`);
    }).filter(Boolean);

    const allowedSpecies = MVP_CONFIG.allowedSpeciesIds.map(id => getSpeciesById(id)).filter(Boolean);
    const playerBenchPool = deterministicShuffle(
      allowedSpecies.filter(s => !pickedIds.includes(s.id)),
      makeRng(`${run.seed}:player:bench_select`)
    );
    const playerBench = playerBenchPool.slice(0, 3).map((sp, i) =>
      buildPokemon(sp, 5, `${run.seed}:player:bench:${i}:${sp.id}`)
    );

    // ── Enemy team ───────────────────────────────────────────────────────────
    const enemySeed = `${run.seed}:${routeId ?? "route1"}:${nodeId}:enemy`;
    const enemyRng  = makeRng(enemySeed);

    const enemyPool = deterministicShuffle(
      allowedSpecies.filter(s => !pickedIds.includes(s.id)),
      enemyRng
    );
    // If pool too small (player picked all), allow overlapping
    const fullPool = enemyPool.length >= activeCount + benchCount
      ? enemyPool
      : deterministicShuffle([...allowedSpecies], makeRng(`${enemySeed}:fallback`));

    const enemyActiveSpecies = fullPool.slice(0, activeCount);
    const enemyBenchSpecies  = fullPool.slice(activeCount, activeCount + benchCount);

    const enemyActive = enemyActiveSpecies.map((sp, i) =>
      buildPokemon(sp, level, `${enemySeed}:active:${i}:${sp.id}`)
    );
    const enemyBench = enemyBenchSpecies.map((sp, i) =>
      buildPokemon(sp, level, `${enemySeed}:bench:${i}:${sp.id}`)
    );

    // Pad player active to 3 slots
    while (playerActive.length < 3) {
      const extra = playerBenchPool[playerActive.length];
      if (!extra) break;
      playerActive.push(buildPokemon(extra, 5, `${run.seed}:player:extra:${playerActive.length}`));
    }

    const battleState = {
      player: { active: playerActive, bench: playerBench },
      enemy:  { active: enemyActive,  bench: enemyBench, trainerName },
      turnLog: [],
      rngCallCount: 0,
      winner: null,
      enemySwitchUsed: false,
      nodeId,
      routeId: routeId ?? "route1",
    };

    const battle = await base44.entities.Battle.create({
      runId,
      status: "active",
      turnNumber: 0,
      state: battleState,
      startedAt: new Date().toISOString(),
    });

    // Log node_enter action
    const currentRun = (await base44.asServiceRole.entities.Run.filter({ id: runId }))[0];
    const nextIdx = (currentRun?.nextActionIdx ?? 0) + 1;
    await Promise.all([
      base44.asServiceRole.entities.RunAction.create({
        runId, idx: nextIdx,
        actionType: "node_enter",
        payload: { routeId: routeId ?? "route1", nodeId, nodeType: nodeType ?? "trainer", tier: resolvedTier },
      }),
      base44.asServiceRole.entities.Run.update(runId, { nextActionIdx: nextIdx }),
    ]);

    return Response.json({ battleId: battle.id, state: battleState });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});