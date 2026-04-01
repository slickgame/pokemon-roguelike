import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { STATIC_DB, STATIC_DB_SUMMARY } from '../src/shared/staticDb.generated.js';

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

const expected = {
  species: STATIC_DB.species.length,
  moves: STATIC_DB.moves.length,
  abilities: STATIC_DB.abilities.length,
  learnsets: Object.keys(STATIC_DB.learnsets).length,
};

for (const [k, v] of Object.entries(expected)) {
  if (STATIC_DB_SUMMARY.counts[k] !== v) throw new Error(`Count mismatch for ${k}: ${STATIC_DB_SUMMARY.counts[k]} !== ${v}`);
}

const hashActual = {
  species: digest(STATIC_DB.species),
  moves: digest(STATIC_DB.moves),
  abilities: digest(STATIC_DB.abilities),
  learnsets: digest(STATIC_DB.learnsets),
};
for (const key of Object.keys(hashActual)) {
  if (hashActual[key] !== STATIC_DB_SUMMARY.hashes[key]) {
    throw new Error(`Hash mismatch for ${key}`);
  }
}

const targetFiles = [
  'src/components/db/dbLoader.jsx',
  'base44/functions/startNodeBattle/entry.ts',
  'base44/functions/appendRunAction/entry.ts',
  'base44/functions/resolveNode/entry.ts',
  'base44/functions/commitTurn/entry.ts',
];

for (const file of targetFiles) {
  const text = await readFile(file, 'utf8');
  if (/const\s+DB_SPECIES\s*=\s*\[/.test(text) || /const\s+DB_MOVES\s*=\s*\[/.test(text) || /const\s+LEVEL_UP_LEARNSETS\s*=\s*\{\s*\d+\s*:/.test(text)) {
    throw new Error(`Found duplicated static DB fragment in ${file}`);
  }
}

console.log('static DB check passed', { expected, hashActual });
