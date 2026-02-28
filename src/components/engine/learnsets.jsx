/**
 * learnsets.js — Minimal Kanto learnset registry (v0.00001).
 * Format: { [speciesId]: { startMoves: string[], levelUp: {level,moveId}[] } }
 *
 * Rules:
 * - startMoves: assigned at starter selection (up to 4 slots).
 * - levelUp: moves offered as the Pokémon levels up mid-run.
 */

const LEARNSETS = {
  // ── Bulbasaur (1) ─────────────────────────────────────────────────────────
  1: {
    startMoves: ["tackle", "growl"],
    levelUp: [
      { level: 7,  moveId: "vine_whip" },
      { level: 13, moveId: "poison_powder" },
      { level: 20, moveId: "razor_leaf" },
    ],
  },
  // ── Charmander (4) ────────────────────────────────────────────────────────
  4: {
    startMoves: ["scratch", "growl"],
    levelUp: [
      { level: 7,  moveId: "ember" },
      { level: 13, moveId: "smokescreen" },
      { level: 19, moveId: "slash" },
    ],
  },
  // ── Squirtle (7) ──────────────────────────────────────────────────────────
  7: {
    startMoves: ["tackle", "tail_whip"],
    levelUp: [
      { level: 7,  moveId: "water_gun" },
      { level: 13, moveId: "withdraw" },
      { level: 20, moveId: "bubble_beam" },
    ],
  },
  // ── Caterpie (10) ─────────────────────────────────────────────────────────
  10: {
    startMoves: ["tackle", "string_shot"],
    levelUp: [
      { level: 6,  moveId: "bug_bite" },
    ],
  },
  // ── Pikachu (25) ──────────────────────────────────────────────────────────
  25: {
    startMoves: ["thunder_shock", "growl"],
    levelUp: [
      { level: 9,  moveId: "quick_attack" },
      { level: 16, moveId: "thunder_wave" },
      { level: 26, moveId: "thunderbolt" },
    ],
  },
};

/**
 * Get the learnset for a species.
 * Returns { startMoves, levelUp } or a safe default if unknown.
 */
export function getLearnset(speciesId) {
  return LEARNSETS[speciesId] ?? { startMoves: ["tackle"], levelUp: [] };
}

/**
 * Get moves that should be learned at exactly `level` for a species.
 * Returns array of moveIds.
 */
export function getMovesLearnedAtLevel(speciesId, level) {
  const learnset = LEARNSETS[speciesId];
  if (!learnset) return [];
  return learnset.levelUp
    .filter(entry => entry.level === level)
    .map(entry => entry.moveId);
}

/**
 * Build starting moveset from learnset startMoves (up to 4).
 */
export function buildStartMoves(speciesId) {
  const learnset = LEARNSETS[speciesId];
  if (!learnset) return ["tackle"];
  return learnset.startMoves.slice(0, 4);
}

export default LEARNSETS;