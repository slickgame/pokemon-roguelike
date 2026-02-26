import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Inline species + moves (same as buildBattleFromRun) ───────────────────────
const SPECIES = [
  { id: 1,  name: "Bulbasaur",  types: ["grass","poison"],   baseStats: { hp:45, atk:49, def:49, spa:65, spd:65, spe:45 }, abilities: ["overgrow"] },
  { id: 4,  name: "Charmander", types: ["fire"],             baseStats: { hp:39, atk:52, def:43, spa:60, spd:50, spe:65 }, abilities: ["blaze"] },
  { id: 7,  name: "Squirtle",   types: ["water"],            baseStats: { hp:44, atk:48, def:65, spa:50, spd:64, spe:43 }, abilities: ["torrent"] },
  { id: 10, name: "Caterpie",   types: ["bug"],              baseStats: { hp:45, atk:30, def:35, spa:20, spd:20, spe:45 }, abilities: ["shield_dust"] },
  { id: 25, name: "Pikachu",    types: ["electric"],         baseStats: { hp:35, atk:55, def:40, spa:50, spd:50, spe:90 }, abilities: ["static"] },
  { id: 19, name: "Rattata",    types: ["normal"],           baseStats: { hp:30, atk:56, def:35, spa:25, spd:35, spe:72 }, abilities: ["run_away"] },
  { id: 23, name: "Ekans",      types: ["poison"],           baseStats: { hp:35, atk:60, def:44, spa:40, spd:54, spe:55 }, abilities: ["shed_skin"] },
  { id: 74, name: "Geodude",    types: ["rock","ground"],    baseStats: { hp:40, atk:80, def:100, spa:30, spd:30, spe:20 }, abilities: ["rock_head"] },
  { id: 66, name: "Machop",     types: ["fighting"],         baseStats: { hp:70, atk:80, def:50, spa:35, spd:35, spe:35 }, abilities: ["guts"] },
  { id: 95, name: "Onix",       types: ["rock","ground"],    baseStats: { hp:35, atk:45, def:160, spa:30, spd:45, spe:70 }, abilities: ["rock_head"] },
];

const MOVES_BY_TYPE = {
  grass:    { id: "vine_whip",     name: "Vine Whip",     type: "grass",    category: "physical", power: 45,   accuracy: 100, pp: 25 },
  fire:     { id: "ember",         name: "Ember",         type: "fire",     category: "special",  power: 40,   accuracy: 100, pp: 25 },
  water:    { id: "water_gun",     name: "Water Gun",     type: "water",    category: "special",  power: 40,   accuracy: 100, pp: 25 },
  bug:      { id: "string_shot",   name: "String Shot",   type: "bug",      category: "status",   power: null, accuracy: 95,  pp: 40 },
  electric: { id: "thunder_shock", name: "ThunderShock",  type: "electric", category: "special",  power: 40,   accuracy: 100, pp: 30 },
  poison:   { id: "poison_sting",  name: "Poison Sting",  type: "poison",   category: "physical", power: 15,   accuracy: 100, pp: 35 },
  normal:   { id: "tackle",        name: "Tackle",        type: "normal",   category: "physical", power: 40,   accuracy: 100, pp: 35 },
  rock:     { id: "rock_throw",    name: "Rock Throw",    type: "rock",     category: "physical", power: 50,   accuracy: 90,  pp: 15 },
  ground:   { id: "mud_slap",      name: "Mud Slap",      type: "ground",   category: "special",  power: 20,   accuracy: 100, pp: 10 },
  fighting: { id: "karate_chop",   name: "Karate Chop",   type: "fighting", category: "physical", power: 50,   accuracy: 100, pp: 25 },
};
const TACKLE = { id: "tackle", name: "Tackle", type: "normal", category: "physical", power: 40, accuracy: 100, pp: 35 };
const NATURES = ["Hardy","Lonely","Brave","Adamant","Naughty","Bold","Docile","Relaxed","Impish","Lax","Timid","Hasty","Serious","Jolly","Naive","Modest","Mild","Quiet","Bashful","Rash","Calm","Gentle","Sassy","Careful","Quirky"];

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

function buildPokemon(species, level, subSeed) {
  const rng = makeRng(subSeed);
  const nature = NATURES[rngInt(rng, NATURES.length)];
  const abilityId = species.abilities[rngInt(rng, species.abilities.length)];
  const shiny = rngInt(rng, 1024) === 0;
  const stab = MOVES_BY_TYPE[species.types[0]] ?? MOVES_BY_TYPE.normal;
  const moves = [
    { ...TACKLE, currentPp: TACKLE.pp },
    { ...stab,   currentPp: stab.pp },
  ];
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

// Tier → enemy level
const TIER_LEVEL = { weak: 5, avg: 6, skilled: 7, boss: 9 };
const TIER_SIZE  = { weak: 1, avg: 2, skilled: 3, boss: 3  }; // active mons

// Gym boss species pool (rock types for Brock)
const GYM_SPECIES = [74, 95]; // Geodude, Onix

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

    // Get player team from RunActions (starter_pick + starter_confirm)
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

    const speciesMap = {};
    for (const s of SPECIES) speciesMap[s.id] = s;

    const isGym = nodeType === "gym" || tier === "boss";
    const level = TIER_LEVEL[tier] ?? TIER_LEVEL.weak;
    const activeCount = TIER_SIZE[tier] ?? 1;
    const benchCount = isGym ? 3 : Math.min(activeCount, 2);

    // ── Player team (rebuild from confirmed starters at current HP) ────────────
    // For MVP: always rebuild at full HP (center heals tracked via actions)
    // Check if a center was used after the last battle to determine heal state
    const lastBattleEndIdx = Math.max(-1, ...actions
      .filter(a => a.actionType === "battle_end")
      .map(a => a.idx));
    const centerAfterBattle = actions.some(a =>
      a.actionType === "center_used" && a.idx > lastBattleEndIdx
    );

    // For now always build fresh at full HP (persistence of damage is future work)
    const playerActive = pickedIds.slice(0, 3).map((sid, i) => {
      const sp = speciesMap[sid];
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

    // ── Enemy team for this node ───────────────────────────────────────────────
    const enemySeed = `${run.seed}:${routeId ?? "route1"}:${nodeId}:enemy`;
    const enemyRng = makeRng(enemySeed);

    let enemyPool;
    if (isGym) {
      // Use gym-specific species
      enemyPool = deterministicShuffle(
        GYM_SPECIES.map(id => speciesMap[id]).filter(Boolean),
        enemyRng
      );
      // If pool smaller than needed, pad with shuffled full species
      if (enemyPool.length < activeCount + benchCount) {
        const padding = deterministicShuffle(
          SPECIES.filter(s => !GYM_SPECIES.includes(s.id)),
          enemyRng
        );
        enemyPool = [...enemyPool, ...padding];
      }
    } else {
      // Regular trainer: use species not picked by player
      enemyPool = deterministicShuffle(
        SPECIES.filter(s => !pickedIds.includes(s.id)),
        enemyRng
      );
      if (enemyPool.length < activeCount + benchCount) {
        const padding = deterministicShuffle([...SPECIES], enemyRng);
        enemyPool = [...new Map([...enemyPool, ...padding].map(s => [s.id, s])).values()];
      }
    }

    const enemyActiveSpecies = enemyPool.slice(0, activeCount);
    const enemyBenchSpecies  = enemyPool.slice(activeCount, activeCount + benchCount);

    const enemyActive = enemyActiveSpecies.map((sp, i) =>
      buildPokemon(sp, level, `${enemySeed}:active:${i}:${sp.id}`)
    );
    const enemyBench = enemyBenchSpecies.map((sp, i) =>
      buildPokemon(sp, level, `${enemySeed}:bench:${i}:${sp.id}`)
    );

    // Pad player active to 3 slots if needed
    while (playerActive.length < 3) {
      const extra = playerBenchPool[playerActive.length];
      if (!extra) break;
      playerActive.push(buildPokemon(extra, 5, `${run.seed}:player:extra:${playerActive.length}`));
    }

    const battleState = {
      player: { active: playerActive, bench: playerBench },
      enemy:  { active: enemyActive,  bench: enemyBench  },
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
    const runForIdx = await base44.asServiceRole.entities.Run.filter({ id: runId });
    const currentRun = runForIdx[0];
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