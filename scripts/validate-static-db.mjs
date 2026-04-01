import { readFile } from 'node:fs/promises';

const source = JSON.parse(await readFile('data/static-db-source.json', 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

const REQUIRED_BASE_STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

assert(source && typeof source === 'object', 'DB source must be an object');
assert(Array.isArray(source.species), 'species must be an array');
assert(Array.isArray(source.moves), 'moves must be an array');
assert(Array.isArray(source.abilities), 'abilities must be an array');
assert(source.learnsets && typeof source.learnsets === 'object' && !Array.isArray(source.learnsets), 'learnsets must be an object map');

const speciesById = new Map();
const moveIds = new Set();
const abilityIds = new Set();

for (const [idx, move] of source.moves.entries()) {
  assert(move && typeof move === 'object', `moves[${idx}] must be an object`);
  assert(isNonEmptyString(move.id), `moves[${idx}].id must be a non-empty string`);
  assert(!moveIds.has(move.id), `Duplicate move id: ${move.id}`);
  moveIds.add(move.id);
}

for (const [idx, ability] of source.abilities.entries()) {
  assert(ability && typeof ability === 'object', `abilities[${idx}] must be an object`);
  assert(isNonEmptyString(ability.id), `abilities[${idx}].id must be a non-empty string`);
  assert(!abilityIds.has(ability.id), `Duplicate ability id: ${ability.id}`);
  abilityIds.add(ability.id);
}

for (const [idx, species] of source.species.entries()) {
  assert(species && typeof species === 'object', `species[${idx}] must be an object`);
  assert(isPositiveInt(species.id), `species[${idx}].id must be a positive integer`);
  assert(!speciesById.has(species.id), `Duplicate species id: ${species.id}`);
  speciesById.set(species.id, species);

  assert(isNonEmptyString(species.name), `species[${idx}].name must be a non-empty string`);

  assert(Array.isArray(species.types), `species[${idx}].types must be an array`);
  assert(species.types.length >= 1 && species.types.length <= 2, `species[${idx}].types must contain 1-2 entries`);
  for (const [typeIdx, type] of species.types.entries()) {
    assert(isNonEmptyString(type), `species[${idx}].types[${typeIdx}] must be a non-empty string`);
  }

  assert(species.baseStats && typeof species.baseStats === 'object', `species[${idx}].baseStats must be an object`);
  for (const key of REQUIRED_BASE_STAT_KEYS) {
    assert(isPositiveInt(species.baseStats[key]), `species[${idx}].baseStats.${key} must be a positive integer`);
  }

  assert(Array.isArray(species.abilities), `species[${idx}].abilities must be an array`);
  assert(species.abilities.length >= 1, `species[${idx}].abilities must contain at least one ability`);
  for (const [abilityIdx, abilityId] of species.abilities.entries()) {
    assert(isNonEmptyString(abilityId), `species[${idx}].abilities[${abilityIdx}] must be a non-empty string`);
  }

  assert(Array.isArray(species.learnset), `species[${idx}].learnset must be an array`);
  for (const [learnsetIdx, moveId] of species.learnset.entries()) {
    assert(isNonEmptyString(moveId), `species[${idx}].learnset[${learnsetIdx}] must be a non-empty string`);
  }

  if (species.genus !== undefined) {
    assert(typeof species.genus === 'string', `species[${idx}].genus must be a string when present`);
  }
}

for (const [speciesIdStr, learnset] of Object.entries(source.learnsets)) {
  assert(/^\d+$/.test(speciesIdStr), `learnsets key must be numeric species id: ${speciesIdStr}`);
  const speciesId = Number(speciesIdStr);

  assert(learnset && typeof learnset === 'object', `learnsets[${speciesId}] must be an object`);
  assert(Array.isArray(learnset.startMoves), `learnsets[${speciesId}].startMoves must be an array`);
  assert(learnset.startMoves.length >= 1, `learnsets[${speciesId}].startMoves must include at least 1 move`);
  assert(learnset.startMoves.length <= 4, `learnsets[${speciesId}].startMoves must include at most 4 moves`);

  for (const [idx, moveId] of learnset.startMoves.entries()) {
    assert(isNonEmptyString(moveId), `learnsets[${speciesId}].startMoves[${idx}] must be a non-empty string`);
    assert(moveIds.has(moveId), `learnsets[${speciesId}].startMoves[${idx}] references missing move: ${moveId}`);
  }

  assert(Array.isArray(learnset.levelUp), `learnsets[${speciesId}].levelUp must be an array`);
  let prevLevel = -1;
  let prevMoveId = '';

  for (const [idx, entry] of learnset.levelUp.entries()) {
    assert(entry && typeof entry === 'object', `learnsets[${speciesId}].levelUp[${idx}] must be an object`);
    assert(Number.isInteger(entry.level) && entry.level >= 2, `learnsets[${speciesId}].levelUp[${idx}].level must be an integer >= 2`);
    assert(isNonEmptyString(entry.moveId), `learnsets[${speciesId}].levelUp[${idx}].moveId must be a non-empty string`);
    assert(moveIds.has(entry.moveId), `learnsets[${speciesId}].levelUp[${idx}] references missing move: ${entry.moveId}`);

    const isSorted = entry.level > prevLevel || (entry.level === prevLevel && entry.moveId >= prevMoveId);
    assert(isSorted, `learnsets[${speciesId}].levelUp must be sorted by level then moveId`);
    prevLevel = entry.level;
    prevMoveId = entry.moveId;
  }
}

console.log('validate-static-db passed', {
  species: source.species.length,
  moves: source.moves.length,
  abilities: source.abilities.length,
  learnsets: Object.keys(source.learnsets).length,
});
