import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Inline DB (mirrors dbLoader) ──────────────────────────────────────────────
const SPECIES = [
  { id: 1,  name: "Bulbasaur",  types: ["grass","poison"],   baseStats: { hp:45, atk:49, def:49, spa:65, spd:65, spe:45 }, abilities: ["overgrow"] },
  { id: 4,  name: "Charmander", types: ["fire"],             baseStats: { hp:39, atk:52, def:43, spa:60, spd:50, spe:65 }, abilities: ["blaze"] },
  { id: 7,  name: "Squirtle",   types: ["water"],            baseStats: { hp:44, atk:48, def:65, spa:50, spd:64, spe:43 }, abilities: ["torrent"] },
  { id: 10, name: "Caterpie",   types: ["bug"],              baseStats: { hp:45, atk:30, def:35, spa:20, spd:20, spe:45 }, abilities: ["shield_dust"] },
  { id: 25, name: "Pikachu",    types: ["electric"],         baseStats: { hp:35, atk:55, def:40, spa:50, spd:50, spe:90 }, abilities: ["static"] },
];
const MVP_ALLOWED = [1, 4, 7, 10, 25];

const MOVES_BY_TYPE = {
  grass: { id: "vine_whip", name: "Vine Whip", type: "grass", category: "physical", power: 45, accuracy: 100, pp: 25, priority: 0 },
  fire:  { id: "ember",     name: "Ember",     type: "fire",  category: "special",  power: 40, accuracy: 100, pp: 25, priority: 0 },
  water: { id: "water_gun", name: "Water Gun", type: "water", category: "special",  power: 40, accuracy: 100, pp: 25, priority: 0 },
  bug:   { id: "string_shot", name: "String Shot", type: "bug", category: "status", power: null, accuracy: 95, pp: 40, priority: 0 },
  electric: { id: "thunder_shock", name: "ThunderShock", type: "electric", category: "special", power: 40, accuracy: 100, pp: 30, priority: 0 },
  poison: { id: "growl", name: "Growl", type: "normal", category: "status", power: null, accuracy: 100, pp: 40, priority: 0 },
};
const TACKLE = { id: "tackle", name: "Tackle", type: "normal", category: "physical", power: 40, accuracy: 100, pp: 35, priority: 0 };
const GROWL   = { id: "growl",  name: "Growl",  type: "normal", category: "status",   power: null, accuracy: 100, pp: 40, priority: 0 };

const NATURES = ["Hardy","Lonely","Brave","Adamant","Naughty","Bold","Docile","Relaxed","Impish","Lax","Timid","Hasty","Serious","Jolly","Naive","Modest","Mild","Quiet","Bashful","Rash","Calm","Gentle","Sassy","Careful","Quirky"];

// ── Deterministic RNG (mulberry32) ────────────────────────────────────────────
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
function buildPokemon(species, level, subSeed) {
  const rng = makeRng(subSeed);
  const nature = NATURES[rngInt(rng, NATURES.length)];
  const abilityId = species.abilities[rngInt(rng, species.abilities.length)];
  const shiny = rngInt(rng, 1024) === 0;

  const stab = MOVES_BY_TYPE[species.types[0]] ?? GROWL;
  const moves = [
    { ...TACKLE, currentPp: TACKLE.pp },
    { ...stab, currentPp: stab.pp },
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
    ivs: { hp:0, atk:0, def:0, spa:0, spd:0, spe:0 }, // MVP stub
    baseStats: species.baseStats,
    maxHp: hp,
    currentHp: hp,
    status: null, // burn|poison|paralysis|sleep|freeze|null
    statusTurns: 0,
    moves,
    fainted: false,
  };
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

    // Load run actions to find picked starters
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
        message: "starter_confirm action not found. Use Starter Select or DEV Auto-Confirm Starters.",
      }, { status: 400 });
    }

    const LEVEL = 5;
    const speciesMap = {};
    for (const s of SPECIES) speciesMap[s.id] = s;

    // Build player team
    const playerTeam = pickedIds.slice(0, 3).map((sid, i) => {
      const sp = speciesMap[sid];
      if (!sp) return null;
      return buildPokemon(sp, LEVEL, `${run.seed}:player:${i}:${sid}`);
    }).filter(Boolean);

    // Build enemy team (exclude player species)
    const enemyPool = SPECIES.filter(s => !pickedIds.includes(s.id));
    const enemyRng = makeRng(`${run.seed}:enemy_select`);
    const shuffled = [...enemyPool].sort(() => enemyRng() - 0.5); // deterministic sort via rng
    const enemySpecies = shuffled.slice(0, Math.min(3, shuffled.length));
    // Pad with player species if needed (edge case: small db)
    while (enemySpecies.length < 3) enemySpecies.push(SPECIES[rngInt(enemyRng, SPECIES.length)]);

    const enemyTeam = enemySpecies.map((sp, i) =>
      buildPokemon(sp, LEVEL, `${run.seed}:enemy:${i}:${sp.id}`)
    );

    const battleState = {
      player: { team: playerTeam, active: [0, 1, 2] },
      enemy:  { team: enemyTeam,  active: [0, 1, 2] },
      turnLog: [],
      rngCallCount: 0,
      winner: null,
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