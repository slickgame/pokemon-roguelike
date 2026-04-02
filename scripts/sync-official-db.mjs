import { writeFile } from 'node:fs/promises';

const VERSION_GROUP = 'red-blue';
const API = 'https://pokeapi.co/api/v2';
const INCLUDE_HIDDEN_ABILITIES = true;
const SPECIES_LIST_LIMIT = 20000;
const MIN_SPECIES_ID = Number(process.env.MIN_SPECIES_ID ?? 1);
const MAX_SPECIES_ID = Number(process.env.MAX_SPECIES_ID ?? Number.POSITIVE_INFINITY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (attempt === retries) throw new Error(`Failed ${url}: ${res.status}`);
    await sleep(200 * attempt);
  }
}

function toId(name) { return name.replace(/-/g, '_'); }
function toTitle(name) { return name.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join(' '); }

function idFromResourceUrl(url) {
  const m = url.match(/\/(\d+)\/?$/);
  if (!m) return null;
  return Number(m[1]);
}

async function fetchAllSpeciesIds() {
  const list = await fetchJson(`${API}/pokemon-species?limit=${SPECIES_LIST_LIMIT}`);
  const ids = (list.results ?? [])
    .map((entry) => idFromResourceUrl(entry.url))
    .filter((id) => Number.isInteger(id) && id > 0)
    .filter((id) => id >= MIN_SPECIES_ID && id <= MAX_SPECIES_ID)
    .sort((a, b) => a - b);

  if (!ids.length) {
    throw new Error('No species IDs returned from pokemon-species endpoint.');
  }
  return ids;
}

async function fetchAllMoveIdsForVersionGroup() {
  const vg = await fetchJson(`${API}/version-group/${VERSION_GROUP}`);
  const ids = [...new Set((vg.moves ?? []).map((m) => toId(m.name)).filter(Boolean))].sort();
  if (!ids.length) {
    throw new Error(`No moves returned for version group ${VERSION_GROUP}.`);
  }
  return ids;
}

function targetFromApi(name) {
  const map = {
    selected_pokemon: 'single',
    random_opponent: 'single',
    all_other_pokemon: 'all_others',
    all_opponents: 'all_opponents',
    all_pokemon: 'all',
    user: 'self',
    user_and_allies: 'all_allies',
    opponents_field: 'opponents_field',
    users_field: 'users_field',
    entire_field: 'field',
    specific_move: 'single',
    ally: 'ally',
    user_or_ally: 'ally_or_self',
  };
  return map[name] ?? 'single';
}

function mapStatus(ailment) {
  const map = {
    paralysis: 'paralysis', poison: 'poison', burn: 'burn', freeze: 'freeze', sleep: 'sleep', confusion: 'confusion',
    trap: 'trapped', nightmare: 'nightmare', leech_seed: 'seeded', flinch: 'flinch', yawn: 'drowsy',
  };
  return map[ailment] ?? null;
}

function buildMoveEffects(move) {
  const effects = {};
  const secondaryEffects = [];

  if (Array.isArray(move.stat_changes) && move.stat_changes.length) {
    const changes = {};
    for (const sc of move.stat_changes) {
      const stat = sc.stat?.name;
      const change = Number(sc.change ?? 0);
      if (!stat || !change) continue;
      if (['attack', 'defense', 'special-attack', 'special-defense', 'speed', 'accuracy', 'evasion'].includes(stat)) {
        const keyMap = {
          attack: 'atk', defense: 'def', 'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe', accuracy: 'accuracy', evasion: 'evasion',
        };
        changes[keyMap[stat]] = change;
      }
    }
    if (Object.keys(changes).length) {
      const targetName = move.target?.name;
      const target = targetName === 'user' ? 'self' : (targetName === 'all-opponents' ? 'all_opponents' : 'target');
      effects.stageChanges = { target, changes };
    }
  }

  const ailment = move.meta?.ailment?.name;
  const ailmentChance = Number(move.meta?.ailment_chance ?? 0);
  const status = mapStatus(ailment);
  if (status && ailmentChance > 0) {
    secondaryEffects.push({ chance: ailmentChance, status });
  }

  const flinchChance = Number(move.meta?.flinch_chance ?? 0);
  if (flinchChance > 0) secondaryEffects.push({ chance: flinchChance, volatileStatus: 'flinch' });

  const drain = Number(move.meta?.drain ?? 0);
  if (drain !== 0) effects.drain = drain;

  const healing = Number(move.meta?.healing ?? 0);
  if (healing > 0) effects.healPercent = healing;

  if (secondaryEffects.length) return { effects, secondaryEffects };
  return { effects, secondaryEffects: [] };
}

const species = [];
const learnsets = {};
const abilityIds = new Set();
const speciesIds = await fetchAllSpeciesIds();
const moveIds = await fetchAllMoveIdsForVersionGroup();

console.log(`Syncing ${moveIds.length} moves for version-group ${VERSION_GROUP}...`);

const moves = [];
for (const moveId of moveIds) {
  const move = await fetchJson(`${API}/move/${moveId.replace(/_/g, '-')}`);
  const { effects, secondaryEffects } = buildMoveEffects(move);
  const entry = {
    id: moveId,
    name: toTitle(move.name),
    type: toId(move.type.name),
    category: move.damage_class.name === 'status' ? 'status' : move.damage_class.name,
    power: move.power,
    accuracy: move.accuracy,
    pp: move.pp,
    priority: move.priority,
    target: targetFromApi(move.target?.name),
  };
  if (Object.keys(effects).length) entry.effects = effects;
  if (secondaryEffects.length) entry.secondaryEffects = secondaryEffects;
  moves.push(entry);
}
const allowedMoveIds = new Set(moves.map((m) => m.id));

console.log(`Syncing ${speciesIds.length} species from PokeAPI...`);

for (const id of speciesIds) {
  const p = await fetchJson(`${API}/pokemon/${id}`);
  const sp = await fetchJson(`${API}/pokemon-species/${id}`);

  const sortedStats = {};
  const statMap = { hp: 'hp', attack: 'atk', defense: 'def', 'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe' };
  for (const s of p.stats) sortedStats[statMap[s.stat.name]] = s.base_stat;

  const candidateAbilities = INCLUDE_HIDDEN_ABILITIES
    ? p.abilities
    : p.abilities.filter((a) => !a.is_hidden);
  const sortedAbilities = candidateAbilities.sort((a, b) => a.slot - b.slot);
  const abilities = [...new Set(sortedAbilities.map((a) => toId(a.ability.name)))];
  for (const a of abilities) abilityIds.add(a);

  const levelUpEntries = [];
  for (const m of p.moves) {
    const vg = m.version_group_details.find((d) => d.version_group.name === VERSION_GROUP && d.move_learn_method.name === 'level-up');
    if (!vg) continue;
    const moveId = toId(m.move.name);
    if (!allowedMoveIds.has(moveId)) continue;
    levelUpEntries.push({ level: vg.level_learned_at, moveId });
  }
  levelUpEntries.sort((a, b) => a.level - b.level || a.moveId.localeCompare(b.moveId));

  const startMoves = levelUpEntries.filter((e) => e.level <= 1).map((e) => e.moveId);
  const dedupStart = [...new Set(startMoves)].slice(-4);
  const levelUp = levelUpEntries.filter((e) => e.level > 1);

  learnsets[id] = {
    startMoves: dedupStart.length ? dedupStart : levelUp.slice(0, 4).map((e) => e.moveId),
    levelUp,
  };

  species.push({
    id,
    name: toTitle(p.name),
    types: p.types.sort((a, b) => a.slot - b.slot).map((t) => toId(t.type.name)),
    baseStats: sortedStats,
    abilities,
    learnset: [...new Set([...learnsets[id].startMoves, ...levelUp.map((e) => e.moveId)])],
    genus: sp.genera.find((g) => g.language.name === 'en')?.genus ?? undefined,
  });
}

const abilities = [];
for (const abilityId of [...abilityIds].sort()) {
  const ability = await fetchJson(`${API}/ability/${abilityId.replace(/_/g, '-')}`);
  const flavor = ability.flavor_text_entries.find((e) => e.language.name === 'en')?.flavor_text?.replace(/\s+/g, ' ').trim();
  abilities.push({ id: abilityId, name: toTitle(ability.name), description: flavor ?? '' });
}

const out = { species, moves, abilities, learnsets };
await writeFile('data/static-db-source.json', JSON.stringify(out, null, 2) + '\n');
console.log('Wrote data/static-db-source.json', {
  species: species.length,
  moves: moves.length,
  abilities: abilities.length,
  learnsets: Object.keys(learnsets).length,
  includeHiddenAbilities: INCLUDE_HIDDEN_ABILITIES,
  firstSpeciesId: speciesIds[0],
  lastSpeciesId: speciesIds[speciesIds.length - 1],
});
