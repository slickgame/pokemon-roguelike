import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

// ── DB Bundle (mirrors components/db/dbLoader) ────────────────────────────────
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

// ── Learnset registry (authoritative source for starter + level-up moves) ─────
const LEARNSETS = {
  1: {
    startMoves: ["tackle", "growl"],
    levelUp: [{ level: 7, moveId: "vine_whip" }],
  },
  4: {
    startMoves: ["scratch", "growl"],
    levelUp: [{ level: 7, moveId: "ember" }],
  },
  7: {
    startMoves: ["tackle", "tail_whip"],
    levelUp: [{ level: 7, moveId: "water_gun" }],
  },
  10: { startMoves: ["tackle", "string_shot"], levelUp: [] },
  13: { startMoves: ["poison_sting", "string_shot"], levelUp: [] },
  16: { startMoves: ["tackle", "gust"], levelUp: [] },
  21: { startMoves: ["peck", "growl"], levelUp: [] },
  25: {
    startMoves: ["thunder_shock", "growl"],
    levelUp: [{ level: 9, moveId: "quick_attack" }],
  },
  43: { startMoves: ["absorb", "growth"], levelUp: [] },
  69: { startMoves: ["vine_whip", "growth"], levelUp: [] },
};

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

const MVP_CONFIG = { allowedSpeciesIds: [1, 4, 7, 10, 13, 16, 21, 25, 43, 69] };

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

function getNatureModifier(nature, statKey) {
  const effect = NATURE_EFFECTS[nature] ?? { up: null, down: null };
  if (effect.up === statKey) return 1.1;
  if (effect.down === statKey) return 0.9;
  return 1.0;
}

const GENDER_RATIOS: Record<
  number,
  { male: number; female: number; genderless?: boolean }
> = {
  1: { male: 0.875, female: 0.125 }, // Bulbasaur
  4: { male: 0.875, female: 0.125 }, // Charmander
  7: { male: 0.875, female: 0.125 }, // Squirtle
  10: { male: 0.5, female: 0.5 }, // Caterpie
  13: { male: 0.5, female: 0.5 }, // Weedle
  16: { male: 0.5, female: 0.5 }, // Pidgey
  21: { male: 0.5, female: 0.5 }, // Spearow
  25: { male: 0.5, female: 0.5 }, // Pikachu
  43: { male: 0.5, female: 0.5 }, // Oddish
  69: { male: 0.5, female: 0.5 }, // Bellsprout
};

function rollGender(speciesId: number, rng: () => number) {
  const ratio = GENDER_RATIOS[speciesId];
  if (!ratio) return rng() < 0.5 ? "Male" : "Female";
  if (ratio.genderless) return "Genderless";
  return rng() < ratio.male ? "Male" : "Female";
}

const _speciesMap = {};
for (const s of DB_SPECIES) _speciesMap[s.id] = s;
const _movesMap = {};
for (const m of DB_MOVES) _movesMap[m.id] = m;
function getSpeciesById(id) {
  return _speciesMap[id] ?? null;
}
function getMoveById(id) {
  return _movesMap[id] ?? null;
}

// ── RNG ───────────────────────────────────────────────────────────────────────
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++)
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function makeRng(seedStr) {
  let s = hashString(String(seedStr));
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngInt(rng, max) {
  return Math.floor(rng() * max);
}
function deterministicShuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rngInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Move selection from learnset registry ────────────────────────────────────
function buildMoveset(species) {
  const learnset = LEARNSETS[species.id] ?? {
    startMoves: ["tackle"],
    levelUp: [],
  };
  const moves = learnset.startMoves
    .map((id) => getMoveById(id))
    .filter(Boolean)
    .slice(0, 4)
    .map((m) => ({ ...m, currentPp: m.pp }));
  if (moves.length === 0) {
    const tackle = getMoveById("tackle");
    moves.push({ ...tackle, currentPp: tackle.pp });
  }
  return moves;
}

// ── Sanitize player actives: replace fainted active slots with healthy bench ──
// Works on the battle-ready active/bench arrays (not partyState snapshots).
// Returns { active, bench } with fainted slots filled from bench if possible.
function sanitizeActives(active, bench) {
  const newActive = [...active];
  const newBench = [...bench];

  for (let i = 0; i < newActive.length; i++) {
    const p = newActive[i];
    const needsSwap = !p || p.fainted || (p.currentHp ?? 0) <= 0;
    if (!needsSwap) continue;

    // Find first healthy bench candidate
    const benchIdx = newBench.findIndex(
      (b) => b && !b.fainted && (b.currentHp ?? 0) > 0,
    );
    if (benchIdx !== -1) {
      // Swap: put bench mon into active slot, put fainted (or null) into bench
      const incoming = newBench[benchIdx];
      newBench[benchIdx] = newActive[i]; // fainted goes to bench
      newActive[i] = incoming;
    } else {
      newActive[i] = null; // no healthy bench mon — empty slot
    }
  }

  return { active: newActive, bench: newBench };
}

// ── EV normalization (mirrors commitTurn.normalizeEvs) ────────────────────────
// Official caps: 252 per stat, 510 total. Overflow trimmed in stat order.
const EV_STAT_CAP = 252;
const EV_TOTAL_CAP = 510;
const EV_STAT_ORDER = ["hp", "atk", "def", "spa", "spd", "spe"];

/**
 * Ensure an EVs object has all six stats, each clamped to [0, 252],
 * and total ≤ 510. Overflow is trimmed in EV_STAT_ORDER order.
 * Identical behavior to normalizeEvs in commitTurn.ts.
 */
function normalizeEvs(evs) {
  let total = 0;
  const out = {};
  for (const stat of EV_STAT_ORDER) {
    const raw = Math.max(0, Math.floor(evs?.[stat] ?? 0));
    const capped = Math.min(raw, EV_STAT_CAP);
    const allowed = Math.min(capped, Math.max(0, EV_TOTAL_CAP - total));
    out[stat] = allowed;
    total += allowed;
  }
  return out;
}

// ── Stat computation ──────────────────────────────────────────────────────────
function computeStats(baseStats, level, ivs = {}, evs = {}, nature = "Hardy") {
  function hpStat(base, iv = 0, ev = 0) {
    return (
      Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) +
      level +
      10
    );
  }

  function otherStat(statKey, base, iv = 0, ev = 0) {
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

// ── Build Pokémon from species + level (fresh, used for enemies) ──────────────
function buildFreshPokemon(species, level, subSeed) {
  const rng = makeRng(subSeed);
  const nature = NATURES[rngInt(rng, NATURES.length)];
  const abilityId = species.abilities[rngInt(rng, species.abilities.length)];
  const shiny = rngInt(rng, 1024) === 0;
  const gender = rollGender(species.id, rng);
  const moves = buildMoveset(species);

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
    types: species.types,
    level,
    exp: 0,
    nature,
    abilityId,
    gender,
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
    maxHp: stats.hp,
    currentHp: stats.hp,
    status: null,
    statusTurns: 0,
    heldItem: null,
    moves,
    fainted: false,
  };
}

// ── Hydrate player Pokémon from partyState snapshot ───────────────────────────
function hydrateFromPartyState(partySnap, speciesMap) {
  const sp = speciesMap[partySnap.speciesId];
  if (!sp) return null;

  const moves = (partySnap.moves ?? [])
    .map((m) => {
      const dbMove = getMoveById(m.id);
      if (!dbMove) return null;
      return {
        ...dbMove,
        currentPp: m.pp,
        pp: m.ppMax ?? dbMove.pp,
      };
    })
    .filter(Boolean);

  if (moves.length === 0) {
    moves.push(...buildMoveset(sp));
  }

  const level = partySnap.level ?? 5;
  const exp = partySnap.exp ?? 0;
  const ivs = partySnap.ivs ?? {
    hp: 0,
    atk: 0,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 0,
  };
  // Normalize EVs on load — prevents corrupted/over-granted values from
  // inflating stats. Safe no-op when EVs are all 0.
  const evs = normalizeEvs(partySnap.evs ?? {});
  const baseStats = partySnap.baseStats ?? sp.baseStats;
  const freshStats = computeStats(
    baseStats,
    level,
    ivs,
    evs,
    partySnap.nature ?? "Hardy",
  );

  const resolvedStats = {
    hp: freshStats.hp,
    atk: freshStats.atk,
    def: freshStats.def,
    spa: freshStats.spa,
    spd: freshStats.spd,
    spe: freshStats.spe,
  };

  const maxHp = resolvedStats.hp;
  const currentHp = partySnap.fainted
    ? 0
    : Math.max(0, Math.min(partySnap.currentHP ?? maxHp, maxHp));

  return {
    speciesId: sp.id,
    name: partySnap.name ?? sp.name,
    types: partySnap.types ?? sp.types,
    level,
    exp,
    nature: partySnap.nature ?? "Hardy",
    abilityId: partySnap.abilityId ?? sp.abilities[0],
    gender: partySnap.gender ?? "Male",
    shiny: partySnap.shiny ?? false,
    ivs,
    evs,
    baseStats,
    stats: resolvedStats,
    maxHp,
    currentHp,
    status: partySnap.status ?? null,
    statusTurns: 0,
    heldItem: partySnap.heldItem ?? null,
    pendingEvolution: partySnap.pendingEvolution ?? null,
    lastSkippedEvolutionLevel:
      partySnap.lastSkippedEvolutionLevel === undefined
        ? null
        : partySnap.lastSkippedEvolutionLevel,
    moves,
    fainted: partySnap.fainted ?? false,
  };
}

// ── Initialize partyState for a fresh run ─────────────────────────────────────
function initPartyState(pickedIds, benchSpecies, seed) {
  const allSpecies = [
    ...pickedIds.map((sid, i) => ({
      sid,
      seed: `${seed}:player:active:${i}:${sid}`,
      level: 5,
    })),
    ...benchSpecies.map((sp, i) => ({
      sid: sp.id,
      seed: `${seed}:player:bench:${i}:${sp.id}`,
      level: 5,
    })),
  ];

  return allSpecies
    .map(({ sid, seed: subSeed, level }) => {
      const sp = _speciesMap[sid];
      if (!sp) return null;

      const poke = buildFreshPokemon(sp, level, subSeed);

      return {
        speciesId: poke.speciesId,
        name: poke.name,
        level: poke.level,
        exp: poke.exp ?? 0,
        gender: poke.gender ?? "Male",
        types: poke.types ?? [],
        nature: poke.nature ?? "Hardy",
        abilityId: poke.abilityId ?? null,
        shiny: poke.shiny ?? false,
        ivs: poke.ivs ?? {
          hp: 0,
          atk: 0,
          def: 0,
          spa: 0,
          spd: 0,
          spe: 0,
        },
        evs: poke.evs ?? {
          hp: 0,
          atk: 0,
          def: 0,
          spa: 0,
          spd: 0,
          spe: 0,
        },
        baseStats: poke.baseStats ?? sp.baseStats,
        stats: poke.stats ?? null,
        currentHP: poke.maxHp,
        maxHP: poke.maxHp,
        fainted: false,
        status: null,
        heldItem: null,
        pendingEvolution: null,
        lastSkippedEvolutionLevel: null,
        moves: poke.moves.map((m) => ({
          id: m.id,
          pp: m.pp,
          ppMax: m.pp,
        })),
      };
    })
    .filter(Boolean);
}

const TIER_LEVEL = { weak: 5, avg: 6, skilled: 7, boss: 9 };
const TIER_ACTIVE_COUNT = { weak: 1, avg: 2, skilled: 3, boss: 3 };
const TIER_TRAINER_NAME = {
  weak: "Youngster",
  avg: "Camper",
  skilled: "Ace Trainer",
  boss: "Gym Leader",
};

const GYM_LEADERS = {
  gym1: {
    trainerType: "gym",
    trainerId: "gym1",
    trainerName: "Leader Brock",
    aiTier: "boss",
    roster: [
      { speciesId: 7, level: 9, moves: ["tackle", "tail_whip", "water_gun"] },
      { speciesId: 1, level: 9, moves: ["tackle", "growl", "vine_whip"] },
      { speciesId: 4, level: 9, moves: ["scratch", "growl", "ember"] },
    ],
  },
  gym2: {
    trainerType: "gym",
    trainerId: "gym2",
    trainerName: "Leader Misty",
    aiTier: "boss",
    roster: [
      { speciesId: 7, level: 10, moves: ["tackle", "tail_whip", "water_gun"] },
      {
        speciesId: 25,
        level: 10,
        moves: ["thunder_shock", "growl", "quick_attack"],
      },
      { speciesId: 1, level: 10, moves: ["tackle", "growl", "vine_whip"] },
    ],
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, nodeId, nodeType, tier, routeId, pendingEncounter } =
      await req.json();
    if (!runId || !nodeId)
      return Response.json(
        { error: "runId and nodeId required" },
        { status: 400 },
      );

    const runs = await base44.entities.Run.filter({ id: runId });
    const run = runs[0];
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    if (run.playerId !== user.id && user.role !== "admin")
      return Response.json({ error: "Forbidden" }, { status: 403 });

    const actions = await base44.asServiceRole.entities.RunAction.filter({
      runId,
    });
    actions.sort((a, b) => a.idx - b.idx);

    const pickedIds = [];
    for (const a of actions) {
      if (a.actionType === "starter_pick" && a.payload?.speciesId) {
        pickedIds.push(Number(a.payload.speciesId));
      }
    }
    const hasConfirm = actions.some((a) => a.actionType === "starter_confirm");
    if (!hasConfirm || pickedIds.length < 3) {
      return Response.json(
        { error: "Starters not confirmed" },
        { status: 400 },
      );
    }

    const allowedSpecies = MVP_CONFIG.allowedSpeciesIds
      .map((id) => getSpeciesById(id))
      .filter(Boolean);
    const isGym = nodeType === "gym" || tier === "boss";
    const resolvedTier = tier ?? (isGym ? "boss" : "weak");
    const level = TIER_LEVEL[resolvedTier] ?? TIER_LEVEL.weak;
    const activeCount = TIER_ACTIVE_COUNT[resolvedTier] ?? 1;
    const benchCount = Math.min(activeCount, 2);
    const trainerName = TIER_TRAINER_NAME[resolvedTier] ?? "Trainer";
    const routeIndex = Number(run.results?.progress?.routeIndex ?? 1);
    const defaultGymId = routeIndex >= 2 ? "gym2" : "gym1";
    const gymProfile = isGym
      ? pendingEncounter?.trainerType === "gym" && pendingEncounter?.trainerId
        ? {
            trainerType: "gym",
            trainerId: pendingEncounter.trainerId,
            trainerName:
              pendingEncounter.trainerName ??
              GYM_LEADERS[pendingEncounter.trainerId]?.trainerName ??
              "Gym Leader",
            aiTier: pendingEncounter.aiTier ?? "boss",
            roster:
              Array.isArray(pendingEncounter.roster) &&
              pendingEncounter.roster.length > 0
                ? pendingEncounter.roster
                : (GYM_LEADERS[pendingEncounter.trainerId]?.roster ??
                  GYM_LEADERS[defaultGymId].roster),
          }
        : GYM_LEADERS[defaultGymId]
      : null;

    // ── Player team: hydrate from partyState or init fresh ──────────────────
    const existingProgress = run.results?.progress ?? {};
    const existingPartyState = existingProgress.partyState ?? null;

    let playerActive;
    let playerBench;
    let newPartyState = null;

    if (existingPartyState && existingPartyState.length >= 3) {
      // Hydrate from persisted state (respects HP/PP/fainted)
      const allHydrated = existingPartyState
        .map((snap) => hydrateFromPartyState(snap, _speciesMap))
        .filter(Boolean);
      const rawActive = allHydrated.slice(0, 3);
      const rawBench = allHydrated.slice(3);
      // Auto-fill fainted active slots with healthy bench mons
      const sanitized = sanitizeActives(rawActive, rawBench);
      playerActive = sanitized.active;
      playerBench = sanitized.bench;
      // Do not auto-generate extra starter bench Pokémon on existing runs
    } else {
      // Init fresh: only the 3 chosen starters
      playerActive = pickedIds
        .slice(0, 3)
        .map((sid, i) => {
          const sp = getSpeciesById(sid);
          if (!sp) return null;
          return buildFreshPokemon(
            sp,
            5,
            `${run.seed}:player:active:${i}:${sid}`,
          );
        })
        .filter(Boolean);

      playerBench = [];

      // Save initialized party state so future battles can persist it
      newPartyState = initPartyState(pickedIds, [], run.seed);
    }

    // ── Enemy team ───────────────────────────────────────────────────────────
    const enemySeed = `${run.seed}:${routeId ?? "route1"}:${nodeId}:enemy`;
    const enemyRng = makeRng(enemySeed);

    let enemyActive;
    let enemyBench;
    if (gymProfile) {
      const roster = gymProfile.roster.slice(0, 3);
      enemyActive = roster
        .map((slot, i) => {
          const sp = getSpeciesById(Number(slot.speciesId));
          if (!sp) return null;
          const poke = buildFreshPokemon(
            sp,
            slot.level ?? level,
            `${enemySeed}:gym:${i}:${sp.id}`,
          );
          const forcedMoves = (slot.moves ?? [])
            .map((id) => getMoveById(id))
            .filter(Boolean)
            .slice(0, 4);
          if (forcedMoves.length > 0) {
            poke.moves = forcedMoves.map((m) => ({ ...m, currentPp: m.pp }));
          }
          return poke;
        })
        .filter(Boolean);
      enemyBench = [];
    } else {
      const enemyPool = deterministicShuffle(
        allowedSpecies.filter((s) => !pickedIds.includes(s.id)),
        enemyRng,
      );
      const fullPool =
        enemyPool.length >= activeCount + benchCount
          ? enemyPool
          : deterministicShuffle(
              [...allowedSpecies],
              makeRng(`${enemySeed}:fallback`),
            );

      enemyActive = fullPool
        .slice(0, activeCount)
        .map((sp, i) =>
          buildFreshPokemon(sp, level, `${enemySeed}:active:${i}:${sp.id}`),
        );
      enemyBench = fullPool
        .slice(activeCount, activeCount + benchCount)
        .map((sp, i) =>
          buildFreshPokemon(sp, level, `${enemySeed}:bench:${i}:${sp.id}`),
        );
    }

    const sanitizedPlayer = sanitizeActives(playerActive, playerBench);
    const sanitizedEnemy = sanitizeActives(enemyActive, enemyBench);

    const battleState = {
      player: { active: sanitizedPlayer.active, bench: sanitizedPlayer.bench },
      enemy: {
        active: sanitizedEnemy.active,
        bench: sanitizedEnemy.bench,
        trainerName: gymProfile?.trainerName ?? trainerName,
        trainerType: gymProfile?.trainerType ?? "trainer",
        trainerId: gymProfile?.trainerId ?? null,
        aiTier: gymProfile?.aiTier ?? resolvedTier,
      },
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

    let canonicalPending = {
      nodeId,
      nodeType: nodeType ?? "trainer",
      tier: resolvedTier,
      battleId: battle.id,
      routeId: routeId ?? "route1",
      status: "pending",
      createdAt: new Date().toISOString(),
      ...(gymProfile
        ? {
            trainerType: gymProfile.trainerType,
            trainerId: gymProfile.trainerId,
            trainerName: gymProfile.trainerName,
            roster: gymProfile.roster,
            aiTier: gymProfile.aiTier,
          }
        : {}),
    };

    // Persist partyState + pending encounter for this node.
    const allHydratedForPersist = [
      ...sanitizedPlayer.active,
      ...sanitizedPlayer.bench,
    ].filter(Boolean);
    const updatedPartyState =
      newPartyState ??
      (allHydratedForPersist.length > 0
        ? allHydratedForPersist.map((poke) => ({
            speciesId: poke.speciesId,
            name: poke.name,
            level: poke.level ?? 5,
            exp: poke.exp ?? 0,
            gender: poke.gender ?? "Male",
            types: poke.types ?? [],
            nature: poke.nature ?? "Hardy",
            abilityId: poke.abilityId ?? null,
            shiny: poke.shiny ?? false,
            ivs: poke.ivs ?? {
              hp: 0,
              atk: 0,
              def: 0,
              spa: 0,
              spd: 0,
              spe: 0,
            },
            evs: poke.evs ?? {
              hp: 0,
              atk: 0,
              def: 0,
              spa: 0,
              spd: 0,
              spe: 0,
            },
            baseStats: poke.baseStats ?? null,
            stats: poke.stats ?? null,
            currentHP: poke.currentHp ?? 0,
            maxHP: poke.maxHp ?? 1,
            fainted: poke.fainted ?? false,
            status: poke.status ?? null,
            heldItem: poke.heldItem ?? null,
            pendingEvolution: poke.pendingEvolution ?? null,
            lastSkippedEvolutionLevel:
              poke.lastSkippedEvolutionLevel === undefined
                ? null
                : poke.lastSkippedEvolutionLevel,
            moves: (poke.moves ?? []).map((m) => ({
              id: m.id,
              pp: m.currentPp ?? m.pp,
              ppMax: m.pp,
            })),
          }))
        : (existingProgress.partyState ?? []));

    await base44.asServiceRole.entities.Run.update(runId, {
      results: {
        ...(run.results ?? {}),
        progress: {
          ...existingProgress,
          partyState: updatedPartyState,
          money: existingProgress.money ?? 0,
          inventory: existingProgress.inventory ?? {
            potion: 0,
            revive: 0,
            bait: 0,
            pokeball: 0,
            great_ball: 0,
            burn_heal: 0,
          },
          pendingEncounter: canonicalPending,
        },
      },
    });

    // Log node_enter action
    const currentRun = (
      await base44.asServiceRole.entities.Run.filter({ id: runId })
    )[0];
    const nextIdx = (currentRun?.nextActionIdx ?? 0) + 1;
    await Promise.all([
      base44.asServiceRole.entities.RunAction.create({
        runId,
        idx: nextIdx,
        actionType: "node_enter",
        payload: {
          routeId: routeId ?? "route1",
          nodeId,
          nodeType: nodeType ?? "trainer",
          tier: resolvedTier,
        },
      }),
      base44.asServiceRole.entities.Run.update(runId, {
        nextActionIdx: nextIdx,
      }),
    ]);

    return Response.json({
      battleId: battle.id,
      state: battleState,
      pendingEncounter: canonicalPending,
      gymProfile,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
