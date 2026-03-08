import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DB_SPECIES = [
  { id: 1,  name: "Bulbasaur",  types: ["grass","poison"],  baseStats: { hp:45, atk:49, def:49, spa:65, spd:65, spe:45 }, abilities: ["overgrow"] },
  { id: 4,  name: "Charmander", types: ["fire"],            baseStats: { hp:39, atk:52, def:43, spa:60, spd:50, spe:65 }, abilities: ["blaze"] },
  { id: 7,  name: "Squirtle",   types: ["water"],           baseStats: { hp:44, atk:48, def:65, spa:50, spd:64, spe:43 }, abilities: ["torrent"] },
  { id: 10, name: "Caterpie",   types: ["bug"],             baseStats: { hp:45, atk:30, def:35, spa:20, spd:20, spe:45 }, abilities: ["shield_dust"] },
  { id: 25, name: "Pikachu",    types: ["electric"],        baseStats: { hp:35, atk:55, def:40, spa:50, spd:50, spe:90 }, abilities: ["static"] },
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

const LEARNSETS = {
  1:  { startMoves: ["tackle","growl"] },
  4:  { startMoves: ["scratch","growl"] },
  7:  { startMoves: ["tackle","tail_whip"] },
  10: { startMoves: ["tackle","string_shot"] },
  25: { startMoves: ["thunder_shock","growl"] },
};

const NATURES = ["Hardy","Lonely","Brave","Adamant","Naughty","Bold","Docile","Relaxed","Impish","Lax","Timid","Hasty","Serious","Jolly","Naive","Modest","Mild","Quiet","Bashful","Rash","Calm","Gentle","Sassy","Careful","Quirky"];

const GENDER_RATIOS: Record<number, { male: number; female: number; genderless?: boolean }> = {
  1:  { male: 0.875, female: 0.125 },
  4:  { male: 0.875, female: 0.125 },
  7:  { male: 0.875, female: 0.125 },
  10: { male: 0.5, female: 0.5 },
  25: { male: 0.5, female: 0.5 },
};

const speciesMap: Record<number, any> = {};
for (const s of DB_SPECIES) speciesMap[s.id] = s;

const movesMap: Record<string, any> = {};
for (const m of DB_MOVES) movesMap[m.id] = m;

function getMoveById(id: string) {
  return movesMap[id] ?? null;
}

function hashString(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function makeRng(seedStr: string) {
  let s = hashString(String(seedStr));
  return () => {
    s |= 0;
    s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function rngInt(rng: () => number, max: number) {
  return Math.floor(rng() * max);
}

function rollGender(speciesId: number, rng: () => number) {
  const ratio = GENDER_RATIOS[speciesId];
  if (!ratio) return rng() < 0.5 ? "Male" : "Female";
  if (ratio.genderless) return "Genderless";
  return rng() < ratio.male ? "Male" : "Female";
}

function computeStats(baseStats: any, level: number) {
  const cs = (b: number) => Math.floor((2 * b * level) / 100 + 5);
  const chp = (b: number) => Math.floor((2 * b * level) / 100) + level + 10;
  return {
    hp: chp(baseStats.hp),
    atk: cs(baseStats.atk),
    def: cs(baseStats.def),
    spa: cs(baseStats.spa),
    spd: cs(baseStats.spd),
    spe: cs(baseStats.spe),
  };
}

function buildMoveset(species: any) {
  const learnset = LEARNSETS[species.id] ?? { startMoves: ["tackle"] };
  const moves = learnset.startMoves
    .map((id: string) => getMoveById(id))
    .filter(Boolean)
    .slice(0, 4)
    .map((m: any) => ({
      id: m.id,
      pp: m.pp,
      ppMax: m.pp,
    }));

  if (moves.length === 0) {
    const tackle = getMoveById("tackle");
    moves.push({
      id: tackle.id,
      pp: tackle.pp,
      ppMax: tackle.pp,
    });
  }

  return moves;
}

function buildInitialPartyPokemon(species: any, level: number, seed: string) {
  const rng = makeRng(seed);
  const nature = NATURES[rngInt(rng, NATURES.length)];
  const abilityId = species.abilities[rngInt(rng, species.abilities.length)];
  const shiny = rngInt(rng, 1024) === 0;
  const gender = rollGender(species.id, rng);
  const stats = computeStats(species.baseStats, level);

  return {
    speciesId: species.id,
    name: species.name,
    level,
    exp: 0,
    gender,
    types: species.types,
    nature,
    abilityId,
    shiny,
    ivs: {
      hp: 0,
      atk: 0,
      def: 0,
      spa: 0,
      spd: 0,
      spe: 0,
    },
    evs: {
      hp: 0,
      atk: 0,
      def: 0,
      spa: 0,
      spd: 0,
      spe: 0,
    },
    baseStats: species.baseStats,
    stats: {
      hp: stats.hp,
      atk: stats.atk,
      def: stats.def,
      spa: stats.spa,
      spd: stats.spd,
      spe: stats.spe,
    },
    currentHP: stats.hp,
    maxHP: stats.hp,
    fainted: false,
    status: null,
    heldItem: null,
    moves: buildMoveset(species),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { runId, actionType, payload = {} } = body;

    if (!runId || !actionType) {
      return Response.json({ error: "runId and actionType are required" }, { status: 400 });
    }

    const run = await base44.entities.Run.get(runId);
    if (!run) {
      return Response.json({ error: "Run not found" }, { status: 404 });
    }

    if (run.playerId !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (run.status !== "active") {
      return Response.json({ error: "Run is not active" }, { status: 400 });
    }

    const currentIdx = run.nextActionIdx ?? 0;
    await base44.entities.Run.update(runId, { nextActionIdx: currentIdx + 1 });

    await base44.entities.RunAction.create({
      runId,
      idx: currentIdx,
      actionType,
      payload,
    });

    if (actionType === "starter_confirm") {
      const team = Array.isArray(payload?.team) ? payload.team : [];
      const initialPartyState = team
        .map((entry: any, index: number) => {
          const speciesId = Number(entry?.speciesId);
          const species = speciesMap[speciesId];
          if (!species) return null;
          return buildInitialPartyPokemon(
            species,
            5,
            `${run.seed}:starter_confirm:${index}:${speciesId}`
          );
        })
        .filter(Boolean);

      const existingProgress = run.results?.progress ?? {};

      await base44.entities.Run.update(runId, {
        results: {
          ...(run.results ?? {}),
          progress: {
            ...existingProgress,
            partyState: initialPartyState,
            money: existingProgress.money ?? 0,
            inventory: existingProgress.inventory ?? { potion: 0, revive: 0 },
          },
        },
      });
    }

    return Response.json({ ok: true, idx: currentIdx });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});