// XP Engine — Medium Fast growth curve + stat formulas
// Medium Fast: totalExp = level^3
// Inverse: level = floor(cbrt(totalExp))

export function getExpToReachLevel(level) {
  if (level <= 1) return 0;
  return Math.pow(level, 3);
}

export function getLevelFromExp(exp) {
  if (exp <= 0) return 1;
  // floor(cbrt(exp)), clamped to [1, 100]
  const lvl = Math.floor(Math.cbrt(exp));
  return Math.max(1, Math.min(100, lvl));
}

// MVP base XP yield when an enemy faints
// baseXP = 20 + (enemyLevel * 5), trainer multiplier 1.2
export function calcXpYield(enemyLevel, isTrainerOwned = true) {
  const base = 20 + (enemyLevel * 5);
  return Math.floor(base * (isTrainerOwned ? 1.2 : 1));
}

// Nature multiplier — neutral for MVP (all natures = 1x for now)
function natureMultiplier(nature, stat) {
  // MVP: all neutral
  return 1;
}

// Official Gen 9 stat formula
// HP: floor((2*base + iv + floor(ev/4)) * level / 100) + level + 10
// Other: floor((floor((2*base + iv + floor(ev/4)) * level / 100) + 5) * natureMult)
export function computeStat(stat, base, level, iv = 0, ev = 0, nature = "hardy") {
  const evContrib = Math.floor(ev / 4);
  const inner = Math.floor((2 * base + iv + evContrib) * level / 100);
  if (stat === "hp") {
    return inner + level + 10;
  }
  return Math.floor((inner + 5) * natureMultiplier(nature, stat));
}

export function computeStats(speciesBaseStats, level, ivs = {}, evs = {}, nature = "hardy") {
  const stats = {};
  for (const stat of ["hp", "atk", "def", "spa", "spd", "spe"]) {
    stats[stat] = computeStat(stat, speciesBaseStats[stat] ?? 45, level, ivs[stat] ?? 0, evs[stat] ?? 0, nature);
  }
  return stats;
}