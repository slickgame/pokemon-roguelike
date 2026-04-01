import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

const DB_SPECIES = [
  {
    id: 1,
    name: "Bulbasaur",
    types: ["grass", "poison"],
    baseStats: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 },
    abilities: ["overgrow"],
  },
  {
    id: 4,
    name: "Charmander",
    types: ["fire"],
    baseStats: { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 },
    abilities: ["blaze"],
  },
  {
    id: 7,
    name: "Squirtle",
    types: ["water"],
    baseStats: { hp: 44, atk: 48, def: 65, spa: 50, spd: 64, spe: 43 },
    abilities: ["torrent"],
  },
  {
    id: 10,
    name: "Caterpie",
    types: ["bug"],
    baseStats: { hp: 45, atk: 30, def: 35, spa: 20, spd: 20, spe: 45 },
    abilities: ["shield_dust"],
  },
  {
    id: 13,
    name: "Weedle",
    types: ["bug", "poison"],
    baseStats: { hp: 40, atk: 35, def: 30, spa: 20, spd: 20, spe: 50 },
    abilities: ["shield_dust"],
  },
  {
    id: 16,
    name: "Pidgey",
    types: ["normal", "flying"],
    baseStats: { hp: 40, atk: 45, def: 40, spa: 35, spd: 35, spe: 56 },
    abilities: ["keen_eye"],
  },
  {
    id: 21,
    name: "Spearow",
    types: ["normal", "flying"],
    baseStats: { hp: 40, atk: 60, def: 30, spa: 31, spd: 31, spe: 70 },
    abilities: ["keen_eye"],
  },
  {
    id: 25,
    name: "Pikachu",
    types: ["electric"],
    baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
    abilities: ["static"],
  },
  {
    id: 43,
    name: "Oddish",
    types: ["grass", "poison"],
    baseStats: { hp: 45, atk: 50, def: 55, spa: 75, spd: 65, spe: 30 },
    abilities: ["chlorophyll"],
  },
  {
    id: 69,
    name: "Bellsprout",
    types: ["grass", "poison"],
    baseStats: { hp: 50, atk: 75, def: 35, spa: 70, spd: 30, spe: 40 },
    abilities: ["chlorophyll"],
  },
  {
    id: 2,
    name: "Ivysaur",
    types: ["grass", "poison"],
    baseStats: { hp: 60, atk: 62, def: 63, spa: 80, spd: 80, spe: 60 },
    abilities: ["overgrow"],
  },
  {
    id: 5,
    name: "Charmeleon",
    types: ["fire"],
    baseStats: { hp: 58, atk: 64, def: 58, spa: 80, spd: 65, spe: 80 },
    abilities: ["blaze"],
  },
  {
    id: 8,
    name: "Wartortle",
    types: ["water"],
    baseStats: { hp: 59, atk: 63, def: 80, spa: 65, spd: 80, spe: 58 },
    abilities: ["torrent"],
  },
  {
    id: 11,
    name: "Metapod",
    types: ["bug"],
    baseStats: { hp: 50, atk: 20, def: 55, spa: 25, spd: 25, spe: 30 },
    abilities: ["shed_skin"],
  },
  {
    id: 14,
    name: "Kakuna",
    types: ["bug", "poison"],
    baseStats: { hp: 45, atk: 25, def: 50, spa: 25, spd: 25, spe: 35 },
    abilities: ["shed_skin"],
  },
  {
    id: 17,
    name: "Pidgeotto",
    types: ["normal", "flying"],
    baseStats: { hp: 63, atk: 60, def: 55, spa: 50, spd: 50, spe: 71 },
    abilities: ["keen_eye"],
  },
  {
    id: 22,
    name: "Fearow",
    types: ["normal", "flying"],
    baseStats: { hp: 65, atk: 90, def: 65, spa: 61, spd: 61, spe: 100 },
    abilities: ["keen_eye"],
  },
  {
    id: 44,
    name: "Gloom",
    types: ["grass", "poison"],
    baseStats: { hp: 60, atk: 65, def: 70, spa: 85, spd: 75, spe: 40 },
    abilities: ["chlorophyll"],
  },
  {
    id: 70,
    name: "Weepinbell",
    types: ["grass", "poison"],
    baseStats: { hp: 65, atk: 90, def: 50, spa: 85, spd: 45, spe: 55 },
    abilities: ["chlorophyll"],
  },
];

const DB_MOVES = [
  {
    id: "tackle",
    name: "Tackle",
    type: "normal",
    category: "physical",
    power: 40,
    accuracy: 100,
    pp: 35,
    priority: 0,
    target: "single",
  },
  {
    id: "scratch",
    name: "Scratch",
    type: "normal",
    category: "physical",
    power: 40,
    accuracy: 100,
    pp: 35,
    priority: 0,
    target: "single",
  },
  {
    id: "ember",
    name: "Ember",
    type: "fire",
    category: "special",
    power: 40,
    accuracy: 100,
    pp: 25,
    priority: 0,
    target: "single",
    secondaryEffects: [{ chance: 10, status: "burn" }],
  },
  {
    id: "growl",
    name: "Growl",
    type: "normal",
    category: "status",
    power: null,
    accuracy: 100,
    pp: 40,
    priority: 0,
    target: "all_opponents",
    effects: {
      stageChanges: { target: "all_opponents", changes: { atk: -1 } },
    },
  },
  {
    id: "vine_whip",
    name: "Vine Whip",
    type: "grass",
    category: "physical",
    power: 45,
    accuracy: 100,
    pp: 25,
    priority: 0,
    target: "single",
  },
  {
    id: "water_gun",
    name: "Water Gun",
    type: "water",
    category: "special",
    power: 40,
    accuracy: 100,
    pp: 25,
    priority: 0,
    target: "single",
  },
  {
    id: "thunder_shock",
    name: "ThunderShock",
    type: "electric",
    category: "special",
    power: 40,
    accuracy: 100,
    pp: 30,
    priority: 0,
    target: "single",
  },
  {
    id: "quick_attack",
    name: "Quick Attack",
    type: "normal",
    category: "physical",
    power: 40,
    accuracy: 100,
    pp: 30,
    priority: 1,
    target: "single",
  },
  {
    id: "string_shot",
    name: "String Shot",
    type: "bug",
    category: "status",
    power: null,
    accuracy: 95,
    pp: 40,
    priority: 0,
    target: "all_opponents",
    effects: {
      stageChanges: { target: "all_opponents", changes: { spe: -1 } },
    },
  },
  {
    id: "tail_whip",
    name: "Tail Whip",
    type: "normal",
    category: "status",
    power: null,
    accuracy: 100,
    pp: 30,
    priority: 0,
    target: "all_opponents",
    effects: {
      stageChanges: { target: "all_opponents", changes: { def: -1 } },
    },
  },
  {
    id: "poison_sting",
    name: "Poison Sting",
    type: "poison",
    category: "physical",
    power: 15,
    accuracy: 100,
    pp: 35,
    priority: 0,
    target: "single",
    secondaryEffects: [{ chance: 30, status: "poison" }],
  },
  {
    id: "gust",
    name: "Gust",
    type: "flying",
    category: "special",
    power: 40,
    accuracy: 100,
    pp: 35,
    priority: 0,
    target: "single",
  },
  {
    id: "peck",
    name: "Peck",
    type: "flying",
    category: "physical",
    power: 35,
    accuracy: 100,
    pp: 35,
    priority: 0,
    target: "single",
  },
  {
    id: "absorb",
    name: "Absorb",
    type: "grass",
    category: "special",
    power: 20,
    accuracy: 100,
    pp: 25,
    priority: 0,
    target: "single",
  },
  {
    id: "growth",
    name: "Growth",
    type: "normal",
    category: "status",
    power: null,
    accuracy: null,
    pp: 20,
    priority: 0,
    target: "self",
    effects: { stageChanges: { target: "self", changes: { atk: 1, spa: 1 } } },
  },
];

const LEARNSETS = {
  1: { startMoves: ["tackle", "growl"] },
  4: { startMoves: ["scratch", "growl"] },
  7: { startMoves: ["tackle", "tail_whip"] },
  10: { startMoves: ["tackle", "string_shot"] },
  13: { startMoves: ["poison_sting", "string_shot"] },
  16: { startMoves: ["tackle", "gust"] },
  21: { startMoves: ["peck", "growl"] },
  25: { startMoves: ["thunder_shock", "growl"] },
  43: { startMoves: ["absorb", "growth"] },
  69: { startMoves: ["vine_whip", "growth"] },
};

const NATURES = [
  "Hardy",
  "Lonely",
  "Brave",
  "Adamant",
  "Naughty",
  "Bold",
  "Docile",
  "Relaxed",
  "Impish",
  "Lax",
  "Timid",
  "Hasty",
  "Serious",
  "Jolly",
  "Naive",
  "Modest",
  "Mild",
  "Quiet",
  "Bashful",
  "Rash",
  "Calm",
  "Gentle",
  "Sassy",
  "Careful",
  "Quirky",
];

const GENDER_RATIOS: Record<
  number,
  { male: number; female: number; genderless?: boolean }
> = {
  1: { male: 0.875, female: 0.125 },
  4: { male: 0.875, female: 0.125 },
  7: { male: 0.875, female: 0.125 },
  10: { male: 0.5, female: 0.5 },
  13: { male: 0.5, female: 0.5 },
  16: { male: 0.5, female: 0.5 },
  21: { male: 0.5, female: 0.5 },
  25: { male: 0.5, female: 0.5 },
  43: { male: 0.5, female: 0.5 },
  69: { male: 0.5, female: 0.5 },
};

const NATURE_EFFECTS: Record<
  string,
  { up: string | null; down: string | null }
> = {
  Hardy: { up: null, down: null },
  Lonely: { up: "atk", down: "def" },
  Brave: { up: "atk", down: "spe" },
  Adamant: { up: "atk", down: "spa" },
  Naughty: { up: "atk", down: "spd" },

  Bold: { up: "def", down: "atk" },
  Docile: { up: null, down: null },
  Relaxed: { up: "def", down: "spe" },
  Impish: { up: "def", down: "spa" },
  Lax: { up: "def", down: "spd" },

  Timid: { up: "spe", down: "atk" },
  Hasty: { up: "spe", down: "def" },
  Serious: { up: null, down: null },
  Jolly: { up: "spe", down: "spa" },
  Naive: { up: "spe", down: "spd" },

  Modest: { up: "spa", down: "atk" },
  Mild: { up: "spa", down: "def" },
  Quiet: { up: "spa", down: "spe" },
  Bashful: { up: null, down: null },
  Rash: { up: "spa", down: "spd" },

  Calm: { up: "spd", down: "atk" },
  Gentle: { up: "spd", down: "def" },
  Sassy: { up: "spd", down: "spe" },
  Careful: { up: "spd", down: "spa" },
  Quirky: { up: null, down: null },
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
  for (let i = 0; i < str.length; i++)
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function makeRng(seedStr: string) {
  let s = hashString(String(seedStr));
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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

function getNatureModifier(nature: string, statKey: string) {
  const effect = NATURE_EFFECTS[nature] ?? { up: null, down: null };
  if (effect.up === statKey) return 1.1;
  if (effect.down === statKey) return 0.9;
  return 1.0;
}

function computeStats(
  baseStats: any,
  level: number,
  ivs: any = {},
  evs: any = {},
  nature: string = "Hardy",
) {
  function hpStat(base: number, iv = 0, ev = 0) {
    return (
      Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) +
      level +
      10
    );
  }

  function otherStat(statKey: string, base: number, iv = 0, ev = 0) {
    const raw =
      Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
    return Math.floor(raw * getNatureModifier(nature, statKey));
  }

  return {
    hp: hpStat(baseStats.hp, ivs.hp ?? 0, evs.hp ?? 0),
    atk: otherStat("atk", baseStats.atk, ivs.atk ?? 0, evs.atk ?? 0),
    def: otherStat("def", baseStats.def, ivs.def ?? 0, evs.def ?? 0),
    spa: otherStat("spa", baseStats.spa, ivs.spa ?? 0, evs.spa ?? 0),
    spd: otherStat("spd", baseStats.spd, ivs.spd ?? 0, evs.spd ?? 0),
    spe: otherStat("spe", baseStats.spe, ivs.spe ?? 0, evs.spe ?? 0),
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

  const ivs = {
    hp: rngInt(rng, 32),
    atk: rngInt(rng, 32),
    def: rngInt(rng, 32),
    spa: rngInt(rng, 32),
    spd: rngInt(rng, 32),
    spe: rngInt(rng, 32),
  };

  const evs = {
    hp: 0,
    atk: 0,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 0,
  };

  const stats = computeStats(species.baseStats, level, ivs, evs, nature);

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
    ivs,
    evs,
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
      return Response.json(
        { error: "runId and actionType are required" },
        { status: 400 },
      );
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
            `${run.seed}:starter_confirm:${index}:${speciesId}`,
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
            boxState: existingProgress.boxState ?? [],
            money: 100,
            inventory: {
              potion: 3,
              revive: 0,
              bait: 0,
              pokeball: 3,
              great_ball: 1,
              burn_heal: 0,
            },
          },
        },
      });
    }

    if (actionType === "party_reorder") {
      const nextPartyState = Array.isArray(payload?.partyState)
        ? payload.partyState
        : null;

      if (!nextPartyState) {
        return Response.json(
          { error: "party_reorder requires payload.partyState" },
          { status: 400 },
        );
      }

      const existingProgress = run.results?.progress ?? {};

      await base44.entities.Run.update(runId, {
        results: {
          ...(run.results ?? {}),
          progress: {
            ...existingProgress,
            partyState: nextPartyState,
            boxState: existingProgress.boxState ?? [],
            money: existingProgress.money ?? 100,
            inventory: existingProgress.inventory ?? {
              potion: 3,
              revive: 0,
              bait: 0,
              pokeball: 3,
              great_ball: 1,
              burn_heal: 0,
            },
          },
        },
      });
    }

    if (actionType === "party_box_update") {
      const nextPartyState = Array.isArray(payload?.partyState)
        ? payload.partyState
        : null;
      const nextBoxState = Array.isArray(payload?.boxState)
        ? payload.boxState
        : null;

      if (!nextPartyState || !nextBoxState) {
        return Response.json(
          {
            error:
              "party_box_update requires payload.partyState and payload.boxState",
          },
          { status: 400 },
        );
      }

      const existingProgress = run.results?.progress ?? {};

      await base44.entities.Run.update(runId, {
        results: {
          ...(run.results ?? {}),
          progress: {
            ...existingProgress,
            partyState: nextPartyState,
            boxState: nextBoxState,
            money: existingProgress.money ?? 100,
            inventory: existingProgress.inventory ?? {
              potion: 3,
              revive: 0,
              bait: 0,
              pokeball: 3,
              great_ball: 1,
              burn_heal: 0,
            },
          },
        },
      });
    }

    return Response.json({ ok: true, idx: currentIdx });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
