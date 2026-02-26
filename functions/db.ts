/**
 * db.js — Server-side DB bundle for Deno backend functions.
 * Single source of truth for species, moves, abilities, typechart, config.
 * Mirrors the shape of components/db/dbLoader.js
 */

export const MANIFEST = {
  dbVersionSemantic: "0.0.1",
  dbVersionHash: "4a2b7f3e8c1d9a5b6f0e2c4d7a1b3e5f",
  files: ["species.json","moves.json","abilities.json","items.json","typechart.json","mvp151_config.json"],
};

export const SPECIES = [
  { id: 1,  name: "Bulbasaur",  types: ["grass","poison"],  baseStats: { hp:45, atk:49, def:49, spa:65, spd:65, spe:45 }, abilities: ["overgrow"],    learnset: ["tackle","growl","vine_whip"] },
  { id: 4,  name: "Charmander", types: ["fire"],            baseStats: { hp:39, atk:52, def:43, spa:60, spd:50, spe:65 }, abilities: ["blaze"],       learnset: ["scratch","growl","ember"] },
  { id: 7,  name: "Squirtle",   types: ["water"],           baseStats: { hp:44, atk:48, def:65, spa:50, spd:64, spe:43 }, abilities: ["torrent"],     learnset: ["tackle","tail_whip","water_gun"] },
  { id: 10, name: "Caterpie",   types: ["bug"],             baseStats: { hp:45, atk:30, def:35, spa:20, spd:20, spe:45 }, abilities: ["shield_dust"], learnset: ["tackle","string_shot"] },
  { id: 25, name: "Pikachu",    types: ["electric"],        baseStats: { hp:35, atk:55, def:40, spa:50, spd:50, spe:90 }, abilities: ["static"],     learnset: ["thunder_shock","growl","quick_attack"] },
];

export const MOVES = [
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

export const ABILITIES = [
  { id: "overgrow",    name: "Overgrow",    description: "Powers up Grass-type moves when HP is low." },
  { id: "blaze",       name: "Blaze",       description: "Powers up Fire-type moves when HP is low." },
  { id: "torrent",     name: "Torrent",     description: "Powers up Water-type moves when HP is low." },
  { id: "shield_dust", name: "Shield Dust", description: "Blocks the added effects of attacks taken." },
  { id: "static",      name: "Static",      description: "May paralyze an attacker that makes contact." },
];

export const TYPECHART = {
  normal:   { normal:1, fire:1,   water:1,   grass:1,   electric:1,   bug:1,   poison:1   },
  fire:     { normal:1, fire:0.5, water:0.5, grass:2,   electric:1,   bug:2,   poison:1   },
  water:    { normal:1, fire:2,   water:0.5, grass:0.5, electric:1,   bug:1,   poison:1   },
  grass:    { normal:1, fire:0.5, water:2,   grass:0.5, electric:1,   bug:0.5, poison:0.5 },
  electric: { normal:1, fire:1,   water:2,   grass:0.5, electric:0.5, bug:1,   poison:1   },
  bug:      { normal:1, fire:0.5, water:1,   grass:2,   electric:1,   bug:1,   poison:0.5 },
  poison:   { normal:1, fire:1,   water:1,   grass:2,   electric:1,   bug:1,   poison:0.5 },
};

export const MVP_CONFIG = {
  allowedSpeciesIds: [1, 4, 7, 10, 25],
};

// ── Cached lookup maps ────────────────────────────────────────────────────────
const _speciesMap = {};
for (const s of SPECIES) _speciesMap[s.id] = s;

const _movesMap = {};
for (const m of MOVES) _movesMap[m.id] = m;

export const loadDbBundle   = () => ({ manifest: MANIFEST, species: SPECIES, moves: MOVES, abilities: ABILITIES, typechart: TYPECHART, mvpConfig: MVP_CONFIG });
export const getSpeciesById = (id) => _speciesMap[id] ?? null;
export const getMoveById    = (id) => _movesMap[id] ?? null;