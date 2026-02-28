import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Inline DB ─────────────────────────────────────────────────────────────────
const SPECIES = [
  { id: 1,  name: "Bulbasaur",  types: ["grass","poison"],   baseStats: { hp:45, atk:49, def:49, spa:65, spd:65, spe:45 }, abilities: ["overgrow"] },
  { id: 4,  name: "Charmander", types: ["fire"],             baseStats: { hp:39, atk:52, def:43, spa:60, spd:50, spe:65 }, abilities: ["blaze"] },
  { id: 7,  name: "Squirtle",   types: ["water"],            baseStats: { hp:44, atk:48, def:65, spa:50, spd:64, spe:43 }, abilities: ["torrent"] },
  { id: 10, name: "Caterpie",   types: ["bug"],              baseStats: { hp:45, atk:30, def:35, spa:20, spd:20, spe:45 }, abilities: ["shield_dust"] },
  { id: 25, name: "Pikachu",    types: ["electric"],         baseStats: { hp:35, atk:55, def:40, spa:50, spd:50, spe:90 }, abilities: ["static"] },
];

const MOVES_BY_TYPE = {
  grass:    { id: "vine_whip",     name: "Vine Whip",     type: "grass",    category: "physical", power: 45,   accuracy: 100, pp: 25 },
  fire:     { id: "ember",         name: "Ember",         type: "fire",     category: "special",  power: 40,   accuracy: 100, pp: 25 },
  water:    { id: "water_gun",     name: "Water Gun",     type: "water",    category: "special",  power: 40,   accuracy: 100, pp: 25 },
  bug:      { id: "string_shot",   name: "String Shot",   type: "bug",      category: "status",   power: null, accuracy: 95,  pp: 40 },
  electric: { id: "thunder_shock", name: "ThunderShock",  type: "electric", category: "special",  power: 40,   accuracy: 100, pp: 30 },
  poison:   { id: "poison_sting",  name: "Poison Sting",  type: "poison",   category: "physical", power: 15,   accuracy: 100, pp: 35 },
  normal:   { id: "tackle",        name: "Tackle",        type: "normal",   category: "physical", power: 40,   accuracy: 100, pp: 35 },
};
const TACKLE = { id: "tackle", name: "Tackle", type: "normal", category: "physical", power: 40, accuracy: 100, pp: 35 };

const NATURES = ["Hardy","Lonely","Brave","Adamant","Naughty","Bold","Docile","Relaxed","Impish","Lax","Timid","Hasty","Serious","Jolly","Naive","Modest","Mild","Quiet","Bashful","Rash","Calm","Gentle","Sassy","Careful","Quirky"];

// ── Gen 9 stat formula ────────────────────────────────────────────────────────
const NATURE_TABLE_B = {
  Hardy:{up:null,down:null},Lonely:{up:"atk",down:"def"},Brave:{up:"atk",down:"spe"},
  Adamant:{up:"atk",down:"spa"},Naughty:{up:"atk",down:"spd"},Bold:{up:"def",down:"atk"},
  Docile:{up:null,down:null},Relaxed:{up:"def",down:"spe"},Impish:{up:"def",down:"spa"},
  Lax:{up:"def",down:"spd"},Timid:{up:"spe",down:"atk"},Hasty:{up:"spe",down:"def"},
  Serious:{up:null,down:null},Jolly:{up:"spe",down:"spa"},Naive:{up:"spe",down:"spd"},
  Modest:{up:"spa",down:"atk"},Mild:{up:"spa",down:"def"},Quiet:{up:"spa",down:"spe"},
  Bashful:{up:null,down:null},Rash:{up:"spa",down:"spd"},Calm:{up:"spd",down:"atk"},
  Gentle:{up:"spd",down:"def"},Sassy:{up:"spd",down:"spe"},Careful:{up:"spd",down:"spa"},
  Quirky:{up:null,down:null},
};
function computeStatsB(baseStats, level, ivs = {}, nature = "Hardy") {
  const nm = NATURE_TABLE_B[nature] ?? { up: null, down: null };
  const out = {};
  for (const stat of ["hp","atk","def","spa","spd","spe"]) {
    const base = baseStats[stat] ?? 0;
    const iv = ivs[stat] ?? 0;
    if (stat === "hp") {
      out[stat] = Math.floor((2 * base + iv) * level / 100 + level + 10);
    } else {
      let val = Math.floor((2 * base + iv) * level / 100) + 5;
      if (nm.up === stat) val = Math.floor(val * 1.1);
      if (nm.down === stat) val = Math.floor(val * 0.9);
      out[stat] = val;
    }
  }
  return out;
}

// Minimal learnsets for move assignment
const LEARNSETS_B = {
  1:  { startMoves: ["tackle","growl"], levelUp: [{level:7,moveId:"vine_whip"}] },
  4:  { startMoves: ["scratch","growl"], levelUp: [{level:7,moveId:"ember"}] },
  7:  { startMoves: ["tackle","tail_whip"], levelUp: [{level:7,moveId:"water_gun"}] },
  10: { startMoves: ["tackle","string_shot"], levelUp: [] },
  25: { startMoves: ["thunder_shock","growl"], levelUp: [{level:9,moveId:"quick_attack"}] },
};
const MOVE_DB_B = {
  tackle:        { id:"tackle",        name:"Tackle",       type:"normal",   category:"physical", power:40,   pp:35 },
  scratch:       { id:"scratch",       name:"Scratch",      type:"normal",   category:"physical", power:40,   pp:35 },
  growl:         { id:"growl",         name:"Growl",        type:"normal",   category:"status",   power:null, pp:40 },
  ember:         { id:"ember",         name:"Ember",        type:"fire",     category:"special",  power:40,   pp:25 },
  vine_whip:     { id:"vine_whip",     name:"Vine Whip",    type:"grass",    category:"physical", power:45,   pp:25 },
  water_gun:     { id:"water_gun",     name:"Water Gun",    type:"water",    category:"special",  power:40,   pp:25 },
  thunder_shock: { id:"thunder_shock", name:"ThunderShock", type:"electric", category:"special",  power:40,   pp:30 },
  quick_attack:  { id:"quick_attack",  name:"Quick Attack", type:"normal",   category:"physical", power:40,   pp:30, priority:1 },
  string_shot:   { id:"string_shot",   name:"String Shot",  type:"bug",      category:"status",   power:null, pp:40 },
  tail_whip:     { id:"tail_whip",     name:"Tail Whip",    type:"normal",   category:"status",   power:null, pp:30 },
};

function buildStartingMoves(speciesId, level) {
  const ls = LEARNSETS_B[speciesId] ?? { startMoves: ["tackle"], levelUp: [] };
  const moveIds = [...ls.startMoves];
  // Add level-up moves already learned at current level
  for (const entry of ls.levelUp) {
    if (entry.level <= level && !moveIds.includes(entry.moveId)) {
      moveIds.push(entry.moveId);
    }
  }
  return moveIds.slice(0, 4).map(id => {
    const m = MOVE_DB_B[id] ?? { id, name: id, type: "normal", category: "physical", power: null, pp: 20 };
    return { ...m, currentPp: m.pp };
  });
}

// ── Deterministic RNG ─────────────────────────────────────────────────────────
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

// ── Build a Pokémon object ────────────────────────────────────────────────────
function buildPokemon(species, level, subSeed, overrideData = {}) {
  const rng = makeRng(subSeed);
  const nature = overrideData.nature ?? NATURES[rngInt(rng, NATURES.length)];
  const abilityId = overrideData.abilityId ?? species.abilities[rngInt(rng, species.abilities.length)];
  const shiny = overrideData.shiny ?? (rngInt(rng, 1024) === 0);
  const ivs = overrideData.ivs ?? { hp:0, atk:0, def:0, spa:0, spd:0, spe:0 };
  const exp = overrideData.exp ?? 0;

  const stats = computeStatsB(species.baseStats, level, ivs, nature);
  const hp = stats.hp;
  const moves = overrideData.moves ?? buildStartingMoves(species.id, level);

  return {
    speciesId: species.id,
    instanceId: overrideData.instanceId ?? `${subSeed}`,
    name: species.name,
    types: species.types,
    level,
    exp,
    nature,
    abilityId,
    shiny,
    ivs,
    baseStats: { ...species.baseStats, ...stats }, // computed stats stored for damage formula
    maxHp: hp,
    currentHp: overrideData.currentHP ?? hp,
    status: overrideData.status ?? null,
    statusTurns: 0,
    moves,
    fainted: overrideData.fainted ?? false,
  };
}

// ── Deterministic shuffle using rng ──────────────────────────────────────────
function deterministicShuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rngInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { runId } = await req.json();
    if (!runId) return Response.json({ error: "runId required" }, { status: 400 });

    const runs = await base44.entities.Run.filter({ id: runId });
    const run = runs[0];
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    if (run.playerId !== user.id && user.role !== "admin")
      return Response.json({ error: "Forbidden" }, { status: 403 });

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
      return Response.json({
        errorCode: "STARTERS_NOT_CONFIRMED",
        error: "Complete starter selection first.",
      }, { status: 400 });
    }

    const BASE_LEVEL = 5;
    const speciesMap = {};
    for (const s of SPECIES) speciesMap[s.id] = s;

    // Pull existing partyState (if any) to restore exp/level/moves from persistence
    const existingPartyState = run.results?.progress?.partyState ?? [];
    const partyStateBySpecies = {};
    for (const ps of existingPartyState) {
      if (ps.speciesId) partyStateBySpecies[ps.speciesId] = ps;
    }

    function buildPlayerPokemon(sid, slotSeed) {
      const sp = speciesMap[sid];
      if (!sp) return null;
      const saved = partyStateBySpecies[sid];
      const level = saved?.level ?? BASE_LEVEL;
      const overrides = saved ? {
        exp: saved.exp ?? 0,
        level,
        nature: saved.nature,
        ivs: saved.ivs,
        currentHP: saved.currentHP,
        fainted: saved.fainted ?? false,
        status: saved.status ?? null,
        moves: saved.moves ? saved.moves.map(m => ({
          id: m.id, name: m.name ?? m.id, type: "normal", category: "physical",
          power: null, pp: m.ppMax ?? 20, currentPp: m.pp ?? 20, priority: 0,
          ...(MOVE_DB_B[m.id] ?? {}),
          currentPp: m.pp ?? m.ppMax ?? 20,
        })) : null,
      } : {};
      return buildPokemon(sp, level, slotSeed, overrides);
    }

    // ── Player team: 3 active (confirmed starters) + 3 bench ─────────────────
    const LEVEL = BASE_LEVEL;
    const playerActive = pickedIds.slice(0, 3).map((sid, i) => {
      return buildPlayerPokemon(sid, `${run.seed}:player:active:${i}:${sid}`);
    }).filter(Boolean);

    // Bench: pick from species NOT in player actives
    const playerBenchPool = deterministicShuffle(
      SPECIES.filter(s => !pickedIds.includes(s.id)),
      makeRng(`${run.seed}:player:bench_select`)
    );
    const playerBench = playerBenchPool.slice(0, 3).map((sp, i) =>
      buildPokemon(sp, LEVEL, `${run.seed}:player:bench:${i}:${sp.id}`)
    );

    // ── Enemy team: 3 active + 3 bench ───────────────────────────────────────
    const enemyActiveRng = makeRng(`${run.seed}:enemy:active_select`);
    const enemyActivePool = deterministicShuffle(
      SPECIES.filter(s => !pickedIds.includes(s.id)),
      enemyActiveRng
    );
    // Ensure at least 6 slots from full pool if needed
    const fullEnemyPool = deterministicShuffle([...SPECIES], makeRng(`${run.seed}:enemy:full_pool`));
    const usedEnemyIds = new Set();
    const enemyActiveSpecies = [];
    for (const sp of [...enemyActivePool, ...fullEnemyPool]) {
      if (enemyActiveSpecies.length >= 3) break;
      if (!usedEnemyIds.has(sp.id)) { enemyActiveSpecies.push(sp); usedEnemyIds.add(sp.id); }
    }
    const enemyBenchSpecies = [];
    for (const sp of fullEnemyPool) {
      if (enemyBenchSpecies.length >= 3) break;
      if (!usedEnemyIds.has(sp.id)) { enemyBenchSpecies.push(sp); usedEnemyIds.add(sp.id); }
    }

    const enemyActive = enemyActiveSpecies.map((sp, i) =>
      buildPokemon(sp, LEVEL, `${run.seed}:enemy:active:${i}:${sp.id}`)
    );
    const enemyBench = enemyBenchSpecies.map((sp, i) =>
      buildPokemon(sp, LEVEL, `${run.seed}:enemy:bench:${i}:${sp.id}`)
    );

    // State uses separate active/bench arrays (indices 0-2 map to active/bench arrays directly)
    const battleState = {
      player: {
        active: playerActive,   // array of 3 active Pokémon objects
        bench:  playerBench,    // array of 3 bench Pokémon objects
      },
      enemy: {
        active: enemyActive,
        bench:  enemyBench,
      },
      turnLog: [],
      rngCallCount: 0,
      winner: null,
      // Track enemy AI switch usage
      enemySwitchUsed: false,
    };

    const battle = await base44.entities.Battle.create({
      runId,
      status: "active",
      turnNumber: 0,
      state: battleState,
      startedAt: new Date().toISOString(),
    });

    return Response.json({ battleId: battle.id, state: battleState });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});