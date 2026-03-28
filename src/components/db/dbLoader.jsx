/**
 * dbLoader.js — client-side DB bundle (data inlined for Vite compatibility)
 * All results are cached after first access.
 */

// ── Manifest ──────────────────────────────────────────────────────────────────
const MANIFEST = {
  dbVersionSemantic: "0.0.1",
  dbVersionHash: "4a2b7f3e8c1d9a5b6f0e2c4d7a1b3e5f",
  files: ["species.json","moves.json","abilities.json","items.json","typechart.json","mvp151_config.json"],
};

// ── Species ───────────────────────────────────────────────────────────────────
const SPECIES = [
  { id: 1,  name: "Bulbasaur",  types: ["grass","poison"],   baseStats: { hp:45, atk:49, def:49, spa:65, spd:65, spe:45 }, abilities: ["overgrow"],    learnset: ["tackle","growl","vine_whip"] },
  { id: 4,  name: "Charmander", types: ["fire"],             baseStats: { hp:39, atk:52, def:43, spa:60, spd:50, spe:65 }, abilities: ["blaze"],       learnset: ["scratch","growl","ember"] },
  { id: 7,  name: "Squirtle",   types: ["water"],            baseStats: { hp:44, atk:48, def:65, spa:50, spd:64, spe:43 }, abilities: ["torrent"],     learnset: ["tackle","tail_whip","water_gun"] },
  { id: 10, name: "Caterpie",   types: ["bug"],              baseStats: { hp:45, atk:30, def:35, spa:20, spd:20, spe:45 }, abilities: ["shield_dust"], learnset: ["tackle","string_shot"] },
  { id: 13, name: "Weedle",     types: ["bug","poison"],     baseStats: { hp:40, atk:35, def:30, spa:20, spd:20, spe:50 }, abilities: ["shield_dust"], learnset: ["poison_sting","string_shot"] },
  { id: 16, name: "Pidgey",     types: ["normal","flying"],  baseStats: { hp:40, atk:45, def:40, spa:35, spd:35, spe:56 }, abilities: ["keen_eye"],    learnset: ["tackle","gust"] },
  { id: 21, name: "Spearow",    types: ["normal","flying"],  baseStats: { hp:40, atk:60, def:30, spa:31, spd:31, spe:70 }, abilities: ["keen_eye"],    learnset: ["peck","growl"] },
  { id: 25, name: "Pikachu",    types: ["electric"],         baseStats: { hp:35, atk:55, def:40, spa:50, spd:50, spe:90 }, abilities: ["static"],     learnset: ["thunder_shock","growl","quick_attack"] },
  { id: 43, name: "Oddish",     types: ["grass","poison"],   baseStats: { hp:45, atk:50, def:55, spa:75, spd:65, spe:30 }, abilities: ["chlorophyll"], learnset: ["absorb","growth"] },
  { id: 69, name: "Bellsprout", types: ["grass","poison"],   baseStats: { hp:50, atk:75, def:35, spa:70, spd:30, spe:40 }, abilities: ["chlorophyll"], learnset: ["vine_whip","growth"] },
];


// ── Moves ─────────────────────────────────────────────────────────────────────
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
  { id: "poison_sting",  name: "Poison Sting", type: "poison",   category: "physical", power: 15,   accuracy: 100, pp: 35, priority: 0, target: "single" },
  { id: "gust",          name: "Gust",         type: "flying",   category: "special",  power: 40,   accuracy: 100, pp: 35, priority: 0, target: "single" },
  { id: "peck",          name: "Peck",         type: "flying",   category: "physical", power: 35,   accuracy: 100, pp: 35, priority: 0, target: "single" },
  { id: "absorb",        name: "Absorb",       type: "grass",    category: "special",  power: 20,   accuracy: 100, pp: 25, priority: 0, target: "single" },
  { id: "growth",        name: "Growth",       type: "normal",   category: "status",   power: null, accuracy: null, pp: 20, priority: 0, target: "self" },
];

// ── Abilities ─────────────────────────────────────────────────────────────────
const ABILITIES = [
  { id: "overgrow",    name: "Overgrow",    description: "Powers up Grass-type moves when HP is low." },
  { id: "blaze",       name: "Blaze",       description: "Powers up Fire-type moves when HP is low." },
  { id: "torrent",     name: "Torrent",     description: "Powers up Water-type moves when HP is low." },
  { id: "shield_dust", name: "Shield Dust", description: "Blocks the added effects of attacks taken." },
  { id: "static",      name: "Static",      description: "May paralyze an attacker that makes contact." },
  { id: "keen_eye",    name: "Keen Eye",    description: "Prevents other Pokémon from lowering accuracy." },
  { id: "chlorophyll", name: "Chlorophyll", description: "Boosts Speed in sunshine." },
];

// ── Items ─────────────────────────────────────────────────────────────────────
const ITEMS = [
  { id: "potion",   name: "Potion",     description: "Restores HP by 20.", effect: { type: "heal", amount: 20 } },
  { id: "pokeball", name: "Poké Ball",  description: "Catches wild Pokémon.", effect: { type: "catch", rate: 1.0 } },
];

// ── Type Chart ────────────────────────────────────────────────────────────────
const TYPECHART = {
  normal:   { normal:1, fire:1,   water:1,   grass:1,   electric:1,   bug:1,   poison:1   },
  fire:     { normal:1, fire:0.5, water:0.5, grass:2,   electric:1,   bug:2,   poison:1   },
  water:    { normal:1, fire:2,   water:0.5, grass:0.5, electric:1,   bug:1,   poison:1   },
  grass:    { normal:1, fire:0.5, water:2,   grass:0.5, electric:1,   bug:0.5, poison:0.5 },
  electric: { normal:1, fire:1,   water:2,   grass:0.5, electric:0.5, bug:1,   poison:1   },
  bug:      { normal:1, fire:0.5, water:1,   grass:2,   electric:1,   bug:1,   poison:0.5 },
  poison:   { normal:1, fire:1,   water:1,   grass:2,   electric:1,   bug:1,   poison:0.5 },
};

// ── MVP Config ────────────────────────────────────────────────────────────────
const MVP151_CONFIG = {
  allowedSpeciesIds: [1, 4, 7, 10, 13, 16, 21, 25, 43, 69],
  starterRank: { 1: 1, 4: 1, 7: 1, 25: 2, 16: 3, 21: 3, 43: 4, 69: 4, 10: 5, 13: 5 },
  starterRarity: {
    1: "rare",
    4: "rare",
    7: "rare",
    10: "common",
    13: "common",
    16: "common",
    21: "uncommon",
    25: "rare",
    43: "uncommon",
    69: "uncommon",
  }
};



// ── Caches ────────────────────────────────────────────────────────────────────
let _speciesMap   = null;
let _movesMap     = null;
let _abilitiesMap = null;

function speciesMap() {
  if (!_speciesMap) { _speciesMap = {}; for (const s of SPECIES) _speciesMap[s.id] = s; }
  return _speciesMap;
}
function movesMap() {
  if (!_movesMap) { _movesMap = {}; for (const m of MOVES) _movesMap[m.id] = m; }
  return _movesMap;
}
function abilitiesMap() {
  if (!_abilitiesMap) { _abilitiesMap = {}; for (const a of ABILITIES) _abilitiesMap[a.id] = a; }
  return _abilitiesMap;
}

// ── Public API ────────────────────────────────────────────────────────────────
export const getManifest    = () => MANIFEST;
export const loadDbBundle   = () => ({ manifest: MANIFEST, species: SPECIES, moves: MOVES, abilities: ABILITIES, items: ITEMS, typechart: TYPECHART, mvpConfig: MVP151_CONFIG });
export const getAllSpecies   = () => SPECIES;
export const getSpeciesById = (id) => speciesMap()[id] ?? null;
export const getMoveById    = (id) => movesMap()[id] ?? null;
export const getAbilityById = (id) => abilitiesMap()[id] ?? null;