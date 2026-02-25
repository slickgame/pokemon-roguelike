/**
 * dbLoader.js — client-side DB bundle loader
 * Imports from the static JSON files in components/db/.
 * All results are cached after first load.
 */
import manifest  from "./manifest.json";
import species   from "./species.json";
import moves     from "./moves.json";
import abilities from "./abilities.json";
import items     from "./items.json";
import typechart from "./typechart.json";
import mvpConfig from "./mvp151_config.json";

// --- Caches ---
let _speciesMap   = null;
let _movesMap     = null;
let _abilitiesMap = null;

function buildSpeciesMap() {
  if (_speciesMap) return _speciesMap;
  _speciesMap = {};
  for (const s of species) _speciesMap[s.id] = s;
  return _speciesMap;
}

function buildMovesMap() {
  if (_movesMap) return _movesMap;
  _movesMap = {};
  for (const m of moves) _movesMap[m.id] = m;
  return _movesMap;
}

function buildAbilitiesMap() {
  if (_abilitiesMap) return _abilitiesMap;
  _abilitiesMap = {};
  for (const a of abilities) _abilitiesMap[a.id] = a;
  return _abilitiesMap;
}

// --- Public API ---

/** Returns the parsed manifest (semantic version, hash, file list). */
export function getManifest() {
  return manifest;
}

/** Returns the full bundle of all DB data. */
export function loadDbBundle() {
  return {
    manifest,
    species,
    moves,
    abilities,
    items,
    typechart,
    mvpConfig,
  };
}

/** Look up a species by numeric dex id or string id. */
export function getSpeciesById(id) {
  return buildSpeciesMap()[id] ?? null;
}

/** Look up a move by its string id (e.g. "tackle"). */
export function getMoveById(id) {
  return buildMovesMap()[id] ?? null;
}

/** Look up an ability by its string id (e.g. "overgrow"). */
export function getAbilityById(id) {
  return buildAbilitiesMap()[id] ?? null;
}

/** Returns all species as an array. */
export function getAllSpecies() {
  return species;
}