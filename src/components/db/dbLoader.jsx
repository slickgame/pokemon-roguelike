/**
 * dbLoader.js — client-side DB bundle backed by generated static DB artifact.
 * All results are cached after first access.
 */
import {
  SPECIES,
  MOVES,
  ABILITIES,
  STATIC_DB_SUMMARY,
} from "../../shared/staticDb.generated.js";

// ── Manifest ──────────────────────────────────────────────────────────────────
const MANIFEST = {
  dbVersionSemantic: "0.0.1",
  dbVersionHash: STATIC_DB_SUMMARY.hashes.species,
  files: ["species.json", "moves.json", "abilities.json", "items.json", "typechart.json", "mvp151_config.json", "learnsets.json"],
  staticDbSummary: STATIC_DB_SUMMARY,
};

// ── Items ─────────────────────────────────────────────────────────────────────
const ITEMS = [
  { id: "potion", name: "Potion", description: "Restores HP by 20.", effect: { type: "heal", amount: 20 } },
  { id: "pokeball", name: "Poké Ball", description: "Catches wild Pokémon.", effect: { type: "catch", rate: 1.0 } },
];

// ── Type Chart ────────────────────────────────────────────────────────────────
const TYPECHART = {
  normal: { normal: 1, fire: 1, water: 1, grass: 1, electric: 1, bug: 1, poison: 1 },
  fire: { normal: 1, fire: 0.5, water: 0.5, grass: 2, electric: 1, bug: 2, poison: 1 },
  water: { normal: 1, fire: 2, water: 0.5, grass: 0.5, electric: 1, bug: 1, poison: 1 },
  grass: { normal: 1, fire: 0.5, water: 2, grass: 0.5, electric: 1, bug: 0.5, poison: 0.5 },
  electric: { normal: 1, fire: 1, water: 2, grass: 0.5, electric: 0.5, bug: 1, poison: 1 },
  bug: { normal: 1, fire: 0.5, water: 1, grass: 2, electric: 1, bug: 1, poison: 0.5 },
  poison: { normal: 1, fire: 1, water: 1, grass: 2, electric: 1, bug: 1, poison: 0.5 },
};

// ── MVP Config ────────────────────────────────────────────────────────────────
const MVP151_CONFIG = {
  allowedSpeciesIds: [1, 4, 7, 10, 13, 16, 21, 25, 43, 69],
  starterRank: { 1: 1, 4: 1, 7: 1, 25: 2, 16: 3, 21: 3, 43: 4, 69: 4, 10: 5, 13: 5 },
  starterRarity: {
    1: "rare", 4: "rare", 7: "rare", 10: "common", 13: "common", 16: "common", 21: "uncommon", 25: "rare", 43: "uncommon", 69: "uncommon",
  },
};

let _speciesMap = null;
let _movesMap = null;
let _abilitiesMap = null;

function speciesMap() { if (!_speciesMap) { _speciesMap = {}; for (const s of SPECIES) _speciesMap[s.id] = s; } return _speciesMap; }
function movesMap() { if (!_movesMap) { _movesMap = {}; for (const m of MOVES) _movesMap[m.id] = m; } return _movesMap; }
function abilitiesMap() { if (!_abilitiesMap) { _abilitiesMap = {}; for (const a of ABILITIES) _abilitiesMap[a.id] = a; } return _abilitiesMap; }

export const getManifest = () => MANIFEST;
export const loadDbBundle = () => ({ manifest: MANIFEST, species: SPECIES, moves: MOVES, abilities: ABILITIES, items: ITEMS, typechart: TYPECHART, mvpConfig: MVP151_CONFIG });
export const getAllSpecies = () => SPECIES;
export const getSpeciesById = (id) => speciesMap()[id] ?? null;
export const getMoveById = (id) => movesMap()[id] ?? null;
export const getAbilityById = (id) => abilitiesMap()[id] ?? null;
