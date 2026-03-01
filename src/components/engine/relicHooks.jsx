/**
 * Relic Hook Engine (frontend + shared logic)
 * All hooks are deterministic. Randomness uses seeded RNG passed in context.
 */

import RELICS, { RELIC_REGISTRY } from "./relicsData";
export { RELIC_REGISTRY };

// Unevolved species IDs (Gen 1 first-stage or non-evolving solo mons)
const UNEVOLVED_SPECIES = new Set([
  1,4,7,10,13,16,19,21,23,25,27,29,32,35,37,39,41,43,46,48,50,52,54,56,58,
  60,63,66,69,72,74,77,79,81,83,84,86,88,90,92,96,98,100,102,104,106,107,108,
  109,111,113,114,115,116,118,120,122,123,124,125,126,127,128,129,131,132,
  133,138,140,143,144,145,146,147,150,151
]);

function hasRelic(relics, id) {
  return Array.isArray(relics) && relics.some(r => r.id === id);
}

/**
 * onDamageCalc
 * Returns a multiplier to apply to outgoing damage for attacker.
 * @param {Object[]} relics - run progress relics
 * @param {Object} attacker - the attacking pokemon
 * @param {Object} move - move being used
 * @param {boolean} isFirstAction - is this the first move action in this battle
 * @returns {number} multiplier (1.0 = no change)
 */
export function onDamageCalc({ relics, attacker, move, isFirstAction = false }) {
  if (!relics || relics.length === 0) return 1.0;
  let mult = 1.0;

  // cracked_everstone: unevolved deal +15%
  if (hasRelic(relics, "cracked_everstone") && attacker && UNEVOLVED_SPECIES.has(attacker.speciesId)) {
    mult *= 1.15;
  }

  // ether_lens: +5% damage for all your Pokémon
  if (hasRelic(relics, "ether_lens")) {
    mult *= 1.05;
  }

  // surge_battery: +20% on first action this battle (tracked in state)
  if (hasRelic(relics, "surge_battery") && isFirstAction) {
    mult *= 1.20;
  }

  return mult;
}

/**
 * onDefenseDamageCalc
 * Returns a multiplier to reduce incoming damage for defender.
 */
export function onDefenseDamageCalc({ relics, defender }) {
  if (!relics || relics.length === 0) return 1.0;
  let mult = 1.0;

  // cracked_everstone: unevolved take -10% damage
  if (hasRelic(relics, "cracked_everstone") && defender && UNEVOLVED_SPECIES.has(defender.speciesId)) {
    mult *= 0.90;
  }

  return mult;
}

/**
 * onFaintCheck
 * Returns { blocked: boolean } — if true, the Pokémon survives at 1 HP.
 * Uses state.focusCharmUsed to track once-per-battle.
 */
export function onFaintCheck({ relics, battleState }) {
  if (!hasRelic(relics, "focus_charm")) return { blocked: false };
  if (battleState?.focusCharmUsed) return { blocked: false };
  return { blocked: true };
}

/**
 * onAfterBattle
 * Returns mutations to apply to partyState after a battle win.
 * { healAmount: number } per Pokémon
 */
export function onAfterBattle({ relics }) {
  if (!hasRelic(relics, "field_medic_patch")) return { healAmount: 0 };
  return { healAmount: 5 };
}

/**
 * onMoneyGain
 * Returns adjusted money delta for trainer battles.
 */
export function onMoneyGain({ relics, baseMoney, nodeType }) {
  if (!relics || !baseMoney) return baseMoney ?? 0;
  const isTrainer = nodeType && nodeType.startsWith("trainer");
  if (isTrainer && hasRelic(relics, "lucky_coin")) {
    return Math.floor(baseMoney * 1.20);
  }
  return baseMoney;
}

/**
 * onNodeResolved (event)
 * Returns extra items to add on event node resolution.
 * Uses seeded RNG.
 */
export function onEventNodeResolved({ relics, rng }) {
  if (!hasRelic(relics, "ration_pack") || !rng) return {};
  const roll = rng();
  if (roll < 0.25) return { potion: 1 };
  return {};
}

/**
 * onShopBuy
 * Returns adjusted cost for first shop purchase.
 */
export function onShopBuy({ relics, cost, shopFirstPurchaseDone }) {
  if (!hasRelic(relics, "bargain_seal")) return cost;
  if (shopFirstPurchaseDone) return cost;
  return Math.floor(cost * 0.50);
}

/**
 * onRunFinalized
 * Returns extra aether multiplier percentage for run scoring.
 */
export function onRunFinalizedModifier({ relics }) {
  if (!hasRelic(relics, "relic_of_mastery")) return 0;
  return 10; // +10% aether
}

/**
 * getRelicCap
 * Returns the relic cap for this run (8, or 9 with relic_of_mastery).
 */
export function getRelicCap(relics) {
  const base = 8;
  if (hasRelic(relics, "relic_of_mastery")) return base + 1;
  return base;
}

/**
 * getRevealNextN
 * Returns how many upcoming nodes to reveal (scout_compass / gym_scout_contract).
 */
export function getRevealNextN(relics) {
  const hasScout = hasRelic(relics, "scout_compass");
  const hasContract = hasRelic(relics, "gym_scout_contract");
  if (hasScout || hasContract) return 3;
  return 0;
}