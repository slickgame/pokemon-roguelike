/**
 * starterGen.js — Deterministic starter pool generation.
 * No Math.random(). All randomness via createRng().
 */
import { createRng } from "./rng";

const NATURES = [
  "Hardy","Lonely","Brave","Adamant","Naughty",
  "Bold","Docile","Relaxed","Impish","Lax",
  "Timid","Hasty","Serious","Jolly","Naive",
  "Modest","Mild","Quiet","Bashful","Rash",
  "Calm","Gentle","Sassy","Careful","Quirky",
];

const KANTO_STARTER_IDS = new Set([1, 4, 7]);

const STARTER_RARITY_WEIGHTS = {
  common: 60,
  uncommon: 30,
  rare: 10,
};

/**
 * Build a StarterCandidate from a species + seeded rng.
 * rng state is consumed here; caller must use a stable sub-seed per candidate.
 */
function buildCandidate(species, stepRng) {
  const nature = NATURES[stepRng.nextInt(NATURES.length)];
  const abilityId = species.abilities[stepRng.nextInt(species.abilities.length)];
  const shinyRoll = stepRng.nextInt(1024) === 0;
  return {
    speciesId: species.id,
    name: species.name,
    types: species.types,
    nature,
    abilityId,
    shiny: shinyRoll,
  };
}

/**
 * generatePool(params) — returns an array of StarterCandidate.
 * @param {object} params
 * @param {string} params.seed       — run seed string
 * @param {number} params.step       — 0 | 1 | 2
 * @param {number} params.rerollIdx  — 0 for initial, 1+ for rerolls
 * @param {Set<number>} params.pickedIds — already chosen species ids (excluded)
 * @param {Array} params.eligibleSpecies — species after cull + allowed filter
 * @param {number} params.poolSize
 * @param {boolean} params.kantoDirectStep — if true AND step===0, offer kanto starters
 * @param {string} params.typeDiversityMode — "none"|"soft"|"hard"
 * @param {Array<string>} params.pickedTypes — primary types already picked
 * @returns {{ candidates: StarterCandidate[], warning: string|null }}
 */
export function generatePool({
  seed, step, rerollIdx, pickedIds,
  eligibleSpecies, poolSize,
  kantoDirectStep, typeDiversityMode, pickedTypes,
}) {
  // Sub-seed: deterministic per (seed, step, rerollIdx)
  const subSeed = `${seed}:step${step}:reroll${rerollIdx}`;
  const rng = createRng(subSeed);

  // Step 0 Kanto direct override
  if (kantoDirectStep && step === 0) {
    const kantoPool = eligibleSpecies.filter(s => KANTO_STARTER_IDS.has(s.id));
    if (kantoPool.length >= 3) {
      const candidates = kantoPool.slice(0, 3).map((s, i) => {
        const cr = createRng(`${subSeed}:cand${i}`);
        return buildCandidate(s, cr);
      });
      return { candidates, warning: null };
    }
    // Fallback: not enough kanto starters in db — continue to normal gen
  }

  // Exclude already-picked species
  let pool = eligibleSpecies.filter(s => !pickedIds.has(s.id));

  let warning = null;

  // Type diversity filtering
  if (typeDiversityMode === "hard" && pickedTypes.length > 0) {
    const filtered = pool.filter(s => !pickedTypes.includes(s.types[0]));
    if (filtered.length >= poolSize) {
      pool = filtered;
    } else if (filtered.length > 0) {
      pool = filtered; // partial enforcement
      warning = "Type diversity relaxed — not enough diverse candidates.";
    } else {
      warning = "Type diversity hard: impossible to enforce, using full pool.";
    }
  } else if (typeDiversityMode === "soft" && pickedTypes.length > 0) {
    // Prefer non-duplicate types; soft = sort preferred first
    const preferred = pool.filter(s => !pickedTypes.includes(s.types[0]));
    const rest = pool.filter(s => pickedTypes.includes(s.types[0]));
    pool = [...rng.shuffle(preferred), ...rng.shuffle(rest)];
  }

  if (typeDiversityMode !== "soft") {
    pool = rng.shuffle(pool);
  }

  // Pick poolSize from shuffled pool
  const chosen = pool.slice(0, poolSize);

  if (chosen.length === 0) {
    return { candidates: [], warning: "No eligible species for this step." };
  }

  const candidates = chosen.map((s, i) => {
    const cr = createRng(`${subSeed}:cand${i}`);
    return buildCandidate(s, cr);
  });

  return { candidates, warning };
}

/**
 * buildEligibleSpecies({ db, modifiers }) — applies cull rules, returns filtered species array.
 */
export function buildEligibleSpecies({ db, modifiers }) {
  const { species, mvpConfig } = db;
  const allowed = new Set(mvpConfig.allowedSpeciesIds);
  const rankMap = mvpConfig.starterRank;

  let eligible = species.filter(s => allowed.has(s.id));

  const cullRank = modifiers.cull_rank_1_2 ? 2 : modifiers.cull_rank_1 ? 1 : 0;
  if (cullRank > 0) {
    const culled = eligible.filter(s => (rankMap[s.id] ?? 99) > cullRank);
    if (culled.length >= 3) {
      eligible = culled;
    }
    // else: silently relax cull (not enough candidates)
  }

  return eligible;
}

/**
 * getStarterConfig({ modifiers }) — derive pool config from active modifiers.
 */
export function getStarterConfig(modifiers) {
  return {
    poolSize: modifiers.starter_pool_expand_5 ? 5 : 3,
    totalRerolls: modifiers.starter_rerolls_3 ? 3 : 0,
    kantoDirectStep: !!modifiers.kanto_starter_direct,
    typeDiversityMode: modifiers.type_diversity_hard ? "hard"
      : modifiers.type_diversity_soft ? "soft"
      : "none",
  };
}