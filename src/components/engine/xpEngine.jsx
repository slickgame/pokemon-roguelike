// XP Engine — Official growth curves + stat formulas
// Growth curve formulas match official games (Bulbapedia).

import { getGrowthRateForSpecies } from "../db/growthRates.js";
import { getBaseExpYield } from "../db/baseExpYields.js";

// ── Official growth curve total-exp thresholds ────────────────────────────────

export function getExpForLevel(level, curve = "Medium Fast") {
  if (level <= 1) return 0;
  const n = level;
  switch (curve) {
    case "Fast":
      return Math.floor(4 * n * n * n / 5);
    case "Medium Fast":
      return n * n * n;
    case "Medium Slow":
      return Math.floor(6 / 5 * n * n * n - 15 * n * n + 100 * n - 140);
    case "Slow":
      return Math.floor(5 * n * n * n / 4);
    case "Erratic": {
      if (n <= 50)  return Math.floor(n * n * n * (100 - n) / 50);
      if (n <= 68)  return Math.floor(n * n * n * (150 - n) / 100);
      if (n <= 98)  return Math.floor(n * n * n * Math.floor((1911 - 10 * n) / 3) / 500);
      return Math.floor(n * n * n * (160 - n) / 100);
    }
    case "Fluctuating": {
      if (n <= 15)  return Math.floor(n * n * n * (Math.floor((n + 1) / 3) + 24) / 50);
      if (n <= 35)  return Math.floor(n * n * n * (n + 14) / 50);
      return Math.floor(n * n * n * (Math.floor(n / 2) + 32) / 50);
    }
    default:
      return n * n * n; // fallback: Medium Fast
  }
}

export function getLevelFromExp(exp, curve = "Medium Fast") {
  if (exp <= 0) return 1;
  // Binary search for correct level
  let lo = 1, hi = 100;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (getExpForLevel(mid, curve) <= exp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function getExpToNextLevel(currentLevel, curve = "Medium Fast") {
  if (currentLevel >= 100) return 0;
  return getExpForLevel(currentLevel + 1, curve) - getExpForLevel(currentLevel, curve);
}

// ── Official XP gain formula ───────────────────────────────────────────────────
// xp = floor((a * b * L) / 7)
// a = 1.5 trainer, 1.0 wild
// b = base exp yield of fainted enemy
// L = enemy level
export function calcXpYield(enemyLevel, enemySpeciesId, isTrainerOwned = true) {
  const b = getBaseExpYield(enemySpeciesId);
  const a = isTrainerOwned ? 1.5 : 1.0;
  return Math.max(1, Math.floor((a * b * enemyLevel) / 7));
}

// ── Helpers re-exported for convenience ───────────────────────────────────────
export { getGrowthRateForSpecies, getBaseExpYield };

// ── Nature multiplier (MVP: neutral) ──────────────────────────────────────────
function natureMultiplier(_nature, _stat) { return 1; }

// ── Stat formula (Gen 9) ──────────────────────────────────────────────────────
export function computeStat(stat, base, level, iv = 0, ev = 0, nature = "hardy") {
  const evContrib = Math.floor(ev / 4);
  const inner = Math.floor((2 * base + iv + evContrib) * level / 100);
  if (stat === "hp") return inner + level + 10;
  return Math.floor((inner + 5) * natureMultiplier(nature, stat));
}

export function computeStats(speciesBaseStats, level, ivs = {}, evs = {}, nature = "hardy") {
  const stats = {};
  for (const stat of ["hp", "atk", "def", "spa", "spd", "spe"]) {
    stats[stat] = computeStat(stat, speciesBaseStats[stat] ?? 45, level, ivs[stat] ?? 0, evs[stat] ?? 0, nature);
  }
  return stats;
}