import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── DB Bundle (mirrors components/db/dbLoader — single source of truth shape) ─
const SPECIES = [
  { id: 1,  name: "Bulbasaur",  types: ["grass","poison"],  baseStats: { hp:45, atk:49, def:49, spa:65, spd:65, spe:45 }, abilities: ["overgrow"],    learnset: ["tackle","growl","vine_whip"] },
  { id: 4,  name: "Charmander", types: ["fire"],            baseStats: { hp:39, atk:52, def:43, spa:60, spd:50, spe:65 }, abilities: ["blaze"],       learnset: ["scratch","growl","ember"] },
  { id: 7,  name: "Squirtle",   types: ["water"],           baseStats: { hp:44, atk:48, def:65, spa:50, spd:64, spe:43 }, abilities: ["torrent"],     learnset: ["tackle","tail_whip","water_gun"] },
  { id: 10, name: "Caterpie",   types: ["bug"],             baseStats: { hp:45, atk:30, def:35, spa:20, spd:20, spe:45 }, abilities: ["shield_dust"], learnset: ["tackle","string_shot"] },
  { id: 25, name: "Pikachu",    types: ["electric"],        baseStats: { hp:35, atk:55, def:40, spa:50, spd:50, spe:90 }, abilities: ["static"],     learnset: ["thunder_shock","growl","quick_attack"] },
];

const MOVES = [
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const MOVES_MAP = {};
for (const m of MOVES) MOVES_MAP[m.id] = m;

const SPECIES_MAP = {};
for (const s of SPECIES) SPECIES_MAP[s.id] = s;

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

/** Build move list from species learnset: tackle + first STAB move, else growl */
function buildMovesForSpecies(species) {
  const learnset = species.learnset ?? [];
  const result = [];

  // Always include tackle (or scratch as fallback normal move)
  const normal = learnset.find(id => id === "tackle" || id === "scratch");
  if (normal && MOVES_MAP[normal]) result.push({ ...MOVES_MAP[normal], currentPp: MOVES_MAP[normal].pp });

  // Find first STAB move (type matches species primary type, has power, not already added)
  const primaryType = species.types[0];
  const stab = learnset.find(id => {
    const m = MOVES_MAP[id];
    return m && m.type === primaryType && m.power && !result.some(r => r.id === id);
  });
  if (stab) {
    result.push({ ...MOVES_MAP[stab], currentPp: MOVES_MAP[stab].pp });
  } else {
    // fallback: growl if in learnset
    const growl = learnset.find(id => id === "growl" && MOVES_MAP[id] && !result.some(r => r.id === id));
    if (growl) result.push({ ...MOVES_MAP[growl], currentPp: MOVES_MAP[growl].pp });
  }

  return result;
}

function buildPokemon(species, level, subSeed) {
  const rng = makeRng(subSeed);
  const nature = NATURES[rngInt(rng, NATURES.length)];
  const abilityId = species.abilities[rngInt(rng, species.abilities.length)];
  const shiny = rngInt(rng, 1024) === 0;
  const moves = buildMovesForSpecies(species);
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

// Tier config
const TIER_LEVEL        = { weak: 5, avg: 6, skilled: 7, boss: 9 };
const TIER_ACTIVE_COUNT = { weak: 1, avg: 2, skilled: 3, boss: 3 };
const TIER_TRAINER_NAME = { weak: "Youngster", avg: "Lass", skilled: "Ace Trainer", boss: "Gym Leader Brock" };

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

    // Get confirmed starters from RunActions
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

    const isGym = nodeType === "gym" || tier === "boss";
    const level = TIER_LEVEL[tier] ?? TIER_LEVEL.weak;
    const activeCount = TIER_ACTIVE_COUNT[tier] ?? 1;
    const benchCount = Math.min(activeCount, 2);
    const trainerName = TIER_TRAINER_NAME[tier] ?? "Trainer";

    // ── Player team (full HP rebuild from confirmed starters) ──────────────────
    const playerActive = pickedIds.slice(0, 3).map((sid, i) => {
      const sp = SPECIES_MAP[sid];
      if (!sp) return null;
      return buildPokemon(sp, 5, `${run.seed}:player:active:${i}:${sid}`);
    }).filter(Boolean);

    const playerBenchPool = deterministicShuffle(
      SPECIES.filter(s => !pickedIds.includes(s.id)),
      makeRng(`${run.seed}:player:bench_select`)
    );
    const playerBench = playerBenchPool.slice(0, 3).map((sp, i) =>
      buildPokemon(sp, 5, `${run.seed}:player:bench:${i}:${sp.id}`)
    );

    while (playerActive.length < 3) {
      const extra = playerBenchPool[playerActive.length];
      if (!extra) break;
      playerActive.push(buildPokemon(extra, 5, `${run.seed}:player:extra:${playerActive.length}`));
    }

    // ── Enemy team: select from allowedSpeciesIds, excluding player picks ──────
    const enemySeed = `${run.seed}:${routeId ?? "route1"}:${nodeId}:enemy`;
    const enemyRng = makeRng(enemySeed);

    const allowed = MVP_CONFIG.allowedSpeciesIds.map(id => SPECIES_MAP[id]).filter(Boolean);
    const enemyPool = deterministicShuffle(
      isGym ? allowed : allowed.filter(s => !pickedIds.includes(s.id)),
      enemyRng
    );
    // Pad if needed
    const fullPool = enemyPool.length >= activeCount + benchCount
      ? enemyPool
      : deterministicShuffle(allowed, makeRng(enemySeed + ":pad"));

    const enemyActive = fullPool.slice(0, activeCount).map((sp, i) =>
      buildPokemon(sp, level, `${enemySeed}:active:${i}:${sp.id}`)
    );
    const enemyBench = fullPool.slice(activeCount, activeCount + benchCount).map((sp, i) =>
      buildPokemon(sp, level, `${enemySeed}:bench:${i}:${sp.id}`)
    );

    const battleState = {
      player: { active: playerActive, bench: playerBench },
      enemy:  { active: enemyActive,  bench: enemyBench  },
      enemyTrainerName: trainerName,
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
        payload: { routeId: routeId ?? "route1", nodeId, nodeType: nodeType ?? "trainer", tier },
      }),
      base44.asServiceRole.entities.Run.update(runId, { nextActionIdx: nextIdx }),
    ]);

    return Response.json({ battleId: battle.id, state: battleState });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});