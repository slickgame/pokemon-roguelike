/**
 * xpEngine.js — XP curve, stat formula, and level-up helpers.
 * Growth curve: Medium Fast  →  totalExp = level³
 */

/** Total EXP threshold to REACH a given level (Medium Fast). */
export function getExpToReachLevel(level) {
  if (level <= 1) return 0;
  return level * level * level;
}

/** Derive current level from total accumulated EXP. Max level = 100. */
export function getLevelFromExp(exp) {
  const e = Math.max(0, exp);
  let level = 1;
  while (level < 100 && getExpToReachLevel(level + 1) <= e) level++;
  return level;
}

/** EXP needed to advance from current level to next. */
export function getExpToNextLevel(exp) {
  const currentLevel = getLevelFromExp(exp);
  if (currentLevel >= 100) return 0;
  return getExpToReachLevel(currentLevel + 1) - exp;
}

// ── Nature modifier table ─────────────────────────────────────────────────────
const NATURE_TABLE = {
  Hardy:   { up: null, down: null },
  Lonely:  { up: "atk", down: "def" },
  Brave:   { up: "atk", down: "spe" },
  Adamant: { up: "atk", down: "spa" },
  Naughty: { up: "atk", down: "spd" },
  Bold:    { up: "def", down: "atk" },
  Docile:  { up: null, down: null },
  Relaxed: { up: "def", down: "spe" },
  Impish:  { up: "def", down: "spa" },
  Lax:     { up: "def", down: "spd" },
  Timid:   { up: "spe", down: "atk" },
  Hasty:   { up: "spe", down: "def" },
  Serious: { up: null, down: null },
  Jolly:   { up: "spe", down: "spa" },
  Naive:   { up: "spe", down: "spd" },
  Modest:  { up: "spa", down: "atk" },
  Mild:    { up: "spa", down: "def" },
  Quiet:   { up: "spa", down: "spe" },
  Bashful: { up: null, down: null },
  Rash:    { up: "spa", down: "spd" },
  Calm:    { up: "spd", down: "atk" },
  Gentle:  { up: "spd", down: "def" },
  Sassy:   { up: "spd", down: "spe" },
  Careful: { up: "spd", down: "spa" },
  Quirky:  { up: null, down: null },
};

/**
 * Official Gen 9 stat formula.
 *  HP : floor((2*base + iv + floor(ev/4)) * level / 100 + level + 10)
 *  Other: floor((floor((2*base + iv + floor(ev/4)) * level / 100) + 5) * natureMod)
 */
export function computeStats(baseStats, level, ivs = {}, evs = {}, nature = "Hardy") {
  const natureMods = NATURE_TABLE[nature] ?? { up: null, down: null };
  const stats = {};
  for (const stat of ["hp", "atk", "def", "spa", "spd", "spe"]) {
    const base = baseStats[stat] ?? 0;
    const iv   = ivs[stat]  ?? 0;
    const ev   = evs[stat]  ?? 0;
    if (stat === "hp") {
      stats[stat] = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100 + level + 10);
    } else {
      let val = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5;
      if (natureMods.up === stat)   val = Math.floor(val * 1.1);
      if (natureMods.down === stat) val = Math.floor(val * 0.9);
      stats[stat] = val;
    }
  }
  return stats;
}

/**
 * Compute XP awarded when a single enemy faints.
 * baseXP = 20 + enemyLevel * 5  (MVP tuning)
 * trainerMultiplier = 1.2 if enemy is trainer-owned.
 */
export function computeEnemyXp(enemyLevel, isTrainerOwned = false) {
  const base = 20 + (enemyLevel ?? 5) * 5;
  return Math.floor(base * (isTrainerOwned ? 1.2 : 1));
}