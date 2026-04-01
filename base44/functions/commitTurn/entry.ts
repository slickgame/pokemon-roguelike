import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { effectiveness } from '../../../src/shared/typeChart.js';

// ── Deterministic RNG ─────────────────────────────────────────────────────────
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function makeRng(seedStr) {
  let callCount = 0;
  let s = hashString(String(seedStr));
  const next = () => {
    callCount++;
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  return { next, getCallCount: () => callCount };
}

const NATURE_EFFECTS = {
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

function getNatureModifier(nature, statKey) {
  const effect = NATURE_EFFECTS[nature] ?? { up: null, down: null };
  if (effect.up === statKey) return 1.1;
  if (effect.down === statKey) return 0.9;
  return 1.0;
}

// ── Stat helpers ──────────────────────────────────────────────────────────────
function computeStatValue(base, level, iv = 0, ev = 0, natureMod = 1, isHP = false) {
  const inner = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (isHP) return inner + level + 10;
  return Math.floor((inner + 5) * natureMod);
}

function computeAllStats(mon) {
  const b = mon.baseStats;
  const lv = mon.level;
  const ivs = mon.ivs ?? {};
  // Always normalize EVs before stat computation to prevent any corrupted
  // or over-granted values from inflating stats.
  const evs = normalizeEvs(mon.evs ?? {});
  const nature = mon.nature ?? "Hardy";

  return {
    hp:  computeStatValue(b.hp,  lv, ivs.hp ?? 0,  evs.hp,  1, true),
    atk: computeStatValue(b.atk, lv, ivs.atk ?? 0, evs.atk, getNatureModifier(nature, "atk")),
    def: computeStatValue(b.def, lv, ivs.def ?? 0, evs.def, getNatureModifier(nature, "def")),
    spa: computeStatValue(b.spa, lv, ivs.spa ?? 0, evs.spa, getNatureModifier(nature, "spa")),
    spd: computeStatValue(b.spd, lv, ivs.spd ?? 0, evs.spd, getNatureModifier(nature, "spd")),
    spe: computeStatValue(b.spe, lv, ivs.spe ?? 0, evs.spe, getNatureModifier(nature, "spe")),
  };
}

function getStat(mon, key) {
  const val = mon.stats?.[key];
  if (typeof val === "number" && isFinite(val) && val > 0) return val;
  // Emergency recompute fallback — normalize EVs to prevent inflation
  if (!mon.stats) mon.stats = {};
  const ivs = mon.ivs ?? {};
  const evs = normalizeEvs(mon.evs ?? {});
  const nature = mon.nature ?? "Hardy";
  const computed = computeStatValue(
    mon.baseStats[key],
    mon.level,
    ivs[key] ?? 0,
    evs[key] ?? 0,
    key === "hp" ? 1 : getNatureModifier(nature, key),
    key === "hp"
  );
  mon.stats[key] = computed;
  return computed;
}

// ── Damage formula ────────────────────────────────────────────────────────────
function calcDamage(attacker, move, defender, rng, log) {
  // NOTE: Accuracy/evasion checks are resolved in the move-action block before
  // this function is called, so calcDamage assumes the move has already hit.
  if (!move.power) return { dmg: 0, typeEff: 1 };
  const lvl = attacker.level;
  const isSpecial = move.category === "special";
  const atkStat = getStat(attacker, isSpecial ? "spa" : "atk");
  const defStat = getStat(defender, isSpecial ? "spd" : "def");
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const typeEff = effectiveness(move.type, defender.types);
  const roll = 0.85 + rng.next() * 0.15;

  // Base damage
  let dmg = Math.floor(Math.floor(2 * lvl / 5 + 2) * move.power * atkStat / defStat / 50 + 2);

  // Burn modifier (halves physical damage)
  if (attacker.status === "burn" && move.category === "physical") dmg = Math.floor(dmg * 0.5);

  // Spread modifier (AoE moves deal 75% per target)
  if (move.target && move.target !== "single") dmg = Math.floor(dmg * 0.75);

  // Crit (1/24 chance, 1.5x)
  const isCrit = rng.next() < (1 / 24);
  if (isCrit) {
    dmg = Math.floor(dmg * 1.5);
    if (log) log.push("A critical hit!");
  }

  // Random roll + STAB + type
  dmg = Math.max(1, Math.floor(dmg * stab * typeEff * roll));

  return { dmg, typeEff, isCrit };
}

function abilityNameFromId(abilityId) {
  if (!abilityId) return "its Ability";
  return String(abilityId)
    .split("_")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

function isLowHp(mon) {
  return (mon.currentHp ?? 0) <= Math.floor((mon.maxHp ?? 1) / 3);
}

function moveMakesContact(move) {
  return Boolean(
    move?.makesContact === true
    || move?.contact === true
    || move?.flags?.contact === true
  );
}

function canApplyStatus(target, statusId) {
  if (!target || target.fainted || (target.currentHp ?? 0) <= 0) return false;
  if (target.status) return false;
  if (statusId === "paralysis" && (target.types ?? []).includes("electric")) return false;
  return true;
}

const ABILITY_HOOKS = {
  overgrow: {
    preDamage: ({ owner, move, log }) => {
      if (move?.type !== "grass" || !isLowHp(owner)) return null;
      const name = abilityNameFromId(owner.abilityId);
      log.push(`${owner.name}'s ${name} boosted ${move.name}!`);
      return { damageMultiplier: 1.5 };
    },
  },
  blaze: {
    preDamage: ({ owner, move, log }) => {
      if (move?.type !== "fire" || !isLowHp(owner)) return null;
      const name = abilityNameFromId(owner.abilityId);
      log.push(`${owner.name}'s ${name} boosted ${move.name}!`);
      return { damageMultiplier: 1.5 };
    },
  },
  torrent: {
    preDamage: ({ owner, move, log }) => {
      if (move?.type !== "water" || !isLowHp(owner)) return null;
      const name = abilityNameFromId(owner.abilityId);
      log.push(`${owner.name}'s ${name} boosted ${move.name}!`);
      return { damageMultiplier: 1.5 };
    },
  },
  static: {
    onContact: ({ owner, source, move, rng, log }) => {
      if (!moveMakesContact(move)) return null;
      if (!canApplyStatus(source, "paralysis")) return null;
      const procChance = 0.3;
      if (rng.next() >= procChance) return null;
      source.status = "paralysis";
      const name = abilityNameFromId(owner.abilityId);
      log.push(`${owner.name}'s ${name} paralyzed ${source.name} on contact!`);
      return { statusApplied: "paralysis" };
    },
  },
  shield_dust: {
    onReceiveSecondary: ({ owner, log }) => {
      const name = abilityNameFromId(owner.abilityId);
      log.push(`${owner.name}'s ${name} blocked the secondary effect!`);
      return { ignoreSecondary: true };
    },
  },
};

function callAbilityHook(mon, hookName, context) {
  const abilityId = mon?.abilityId;
  if (!abilityId) return null;
  const ability = ABILITY_HOOKS[abilityId];
  const hook = ability?.[hookName];
  if (typeof hook !== "function") return null;
  return hook({ owner: mon, ...context }) ?? null;
}

function getMoveSecondaryEffects(move) {
  if (!move) return [];
  if (Array.isArray(move.secondaryEffects)) return move.secondaryEffects;
  if (Array.isArray(move.secondaries)) return move.secondaries;
  if (move.secondary && typeof move.secondary === "object") return [move.secondary];
  return [];
}

function applyMoveSecondaryEffects({
  attacker,
  defender,
  move,
  rng,
  log,
}) {
  const receiveSecondaryResult = callAbilityHook(defender, "onReceiveSecondary", {
    source: attacker,
    move,
    rng,
    log,
  });
  if (receiveSecondaryResult?.ignoreSecondary) return;

  const effects = getMoveSecondaryEffects(move);
  for (const effect of effects) {
    const chance = effect.chance ?? effect.rate ?? 100;
    if (rng.next() * 100 >= chance) continue;
    const statusId = effect.status ?? effect.statusId ?? null;
    if (statusId && canApplyStatus(defender, statusId)) {
      defender.status = statusId;
      log.push(`${defender.name} was afflicted with ${statusId}!`);
    }
  }
}

// ── Null-safe alive check ─────────────────────────────────────────────────────
function isAlive(mon) {
  return !!mon && mon.currentHp > 0 && !mon.fainted;
}

// ── Target validation ─────────────────────────────────────────────────────────
function isValidTarget(state, side, slot) {
  const sideState = side === "player" ? state.player : state.enemy;
  const poke = sideState.active[slot];
  return isAlive(poke);
}

// ── Damage estimate ────────────────────────────────────────────────────────────
function estimateDamage(attacker, move, defender) {
  if (!move.power) return 0;
  const lvl = attacker.level;
  const isSpecial = move.category === "special";
  const atkStat = getStat(attacker, isSpecial ? "spa" : "atk");
  const defStat = getStat(defender, isSpecial ? "spd" : "def");
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const typeEff = effectiveness(move.type, defender.types);
  return Math.max(1, Math.floor(
    Math.floor(Math.floor(2 * lvl / 5 + 2) * move.power * atkStat / defStat / 50 + 2)
    * stab * typeEff * 0.925
  ));
}

// ── Smart retarget ────────────────────────────────────────────────────────────
function chooseSmartTarget(state, attacker, move, originalTargetSide) {
  const enemySideState = originalTargetSide === "enemy" ? state.enemy : state.player;
  const candidates = [];
  for (let slot = 0; slot < enemySideState.active.length; slot++) {
    const poke = enemySideState.active[slot];
    if (!poke || poke.fainted || poke.currentHp <= 0) continue;
    const est = estimateDamage(attacker, move, poke);
    const typeEff = effectiveness(move.type, poke.types);
    const canKO = est >= poke.currentHp ? 100000 : 0;
    const hpPct = poke.currentHp / poke.maxHp;
    const score = canKO + est * 100 + typeEff * 10 + (1 - hpPct) * 500;
    candidates.push({ slot, score, hpPct });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.hpPct !== b.hpPct) return a.hpPct - b.hpPct;
    return a.slot - b.slot;
  });
  return { slot: candidates[0].slot };
}

// ── Auto-replace fainted slot from bench ─────────────────────────────────────
function autoReplace(sideState, activeIdx, label, log) {
  const benchIdx = sideState.bench.findIndex(p => p && !p.fainted && (p.currentHp ?? 0) > 0);
  if (benchIdx === -1) return null;
  const incoming = sideState.bench[benchIdx];
  const fainted = sideState.active[activeIdx];
  sideState.active[activeIdx] = incoming;
  sideState.bench[benchIdx] = fainted;
  log.push(`${label} sent out ${incoming.name}.`);
  return incoming;
}


function normalizeTeam(sideState) {
  if (!sideState?.active || !sideState?.bench) return;
  for (let i = 0; i < sideState.active.length; i++) {
    const p = sideState.active[i];
    if (p && !p.fainted && (p.currentHp ?? 0) > 0) continue;
    const benchIdx = sideState.bench.findIndex((b) => b && !b.fainted && (b.currentHp ?? 0) > 0);
    if (benchIdx === -1) {
      sideState.active[i] = null;
      continue;
    }
    const incoming = sideState.bench[benchIdx];
    sideState.bench[benchIdx] = sideState.active[i] ?? null;
    sideState.active[i] = { ...incoming, justSwitchedIn: true };
  }
}
// ── Enemy AI ──────────────────────────────────────────────────────────────────
function enemyPickMove(poke, playerActive) {
  const targets = playerActive.filter(p => isAlive(p));
  if (targets.length === 0) return null;
  const target = targets[0];
  let bestMove = poke.moves[0];
  let bestScore = -1;
  for (const mv of poke.moves) {
    if (!mv.power) continue;
    const eff = effectiveness(mv.type, target.types);
    const stab = poke.types.includes(mv.type) ? 1.5 : 1;
    const score = mv.power * eff * stab;
    if (score > bestScore) { bestScore = score; bestMove = mv; }
  }
  return { type: "move", moveId: bestMove.id, targetIdx: 0 };
}

function enemyPickSwitch(activeIdx, sideState, playerActive) {
  const poke = sideState.active[activeIdx];
  if (!poke || poke.fainted) return -1;
  if (poke.currentHp / poke.maxHp >= 0.25) return -1;
  const healthyBench = sideState.bench.map((p, i) => ({ p, i })).filter(({ p }) => isAlive(p));
  if (healthyBench.length === 0) return -1;
  const playerTarget = [...playerActive].filter(p => isAlive(p)).sort((a, b) => b.currentHp - a.currentHp)[0];
  if (!playerTarget) return -1;
  let best = healthyBench[0];
  let bestScore = -1;
  for (const { p, i } of healthyBench) {
    let score = 0;
    for (const mv of p.moves) {
      if (!mv.power) continue;
      score = Math.max(score, effectiveness(mv.type, playerTarget.types) * mv.power);
    }
    if (score > bestScore) { bestScore = score; best = { p, i }; }
  }
  return best.i;
}

// ── Relic helpers (inlined — no local imports) ────────────────────────────────
const UNEVOLVED_SPECIES_SET = new Set([
  1,4,7,10,13,16,19,21,23,25,27,29,32,35,37,39,41,43,46,48,50,52,54,56,58,
  60,63,66,69,72,74,77,79,81,83,84,86,88,90,92,96,98,100,102,104,106,107,108,
  109,111,113,114,115,116,118,120,122,123,124,125,126,127,128,129,131,132,
  133,138,140,143,144,145,146,147,150,151
]);
function hasRelic(relics, id) {
  return Array.isArray(relics) && relics.some(r => r.id === id);
}
function relicDamageMultiplier(relics, attacker, isFirstActionThisBattle) {
  let mult = 1.0;
  if (hasRelic(relics, "cracked_everstone") && attacker && UNEVOLVED_SPECIES_SET.has(attacker.speciesId)) mult *= 1.15;
  if (hasRelic(relics, "ether_lens")) mult *= 1.05;
  if (hasRelic(relics, "surge_battery") && isFirstActionThisBattle) mult *= 1.20;
  return mult;
}
function relicDefenseMultiplier(relics, defender) {
  let mult = 1.0;
  if (hasRelic(relics, "cracked_everstone") && defender && UNEVOLVED_SPECIES_SET.has(defender.speciesId)) mult *= 0.90;
  return mult;
}

// ── Item config ───────────────────────────────────────────────────────────────
const ITEM_CONFIG = {
  potion: { healAmount: 20, canTargetFainted: false },
  revive: { healPercent: 0.5, canTargetFainted: true, revives: true },
};

// ── XP / Level-up Engine ─────────────────────────────────────────────────────

// Official growth curve formulas (inlined — Deno cannot import frontend modules)
function getExpForLevel(level, curve) {
  if (level <= 1) return 0;
  const n = level;
  switch (curve) {
    case "Fast":        return Math.floor(4 * n * n * n / 5);
    case "Medium Fast": return n * n * n;
    case "Medium Slow": return Math.floor(6 / 5 * n * n * n - 15 * n * n + 100 * n - 140);
    case "Slow":        return Math.floor(5 * n * n * n / 4);
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
    default:            return n * n * n; // Medium Fast fallback
  }
}

function getLevelFromExp(exp, curve) {
  if (exp <= 0) return 1;
  let lo = 1, hi = 100;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (getExpForLevel(mid, curve) <= exp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// Official base exp yields for Kanto 1-151 (Gen 1 / FRLG)
const BASE_EXP_YIELDS = {
  1:64,2:142,3:263,4:62,5:142,6:267,7:63,8:142,9:265,10:39,11:72,12:198,
  13:39,14:72,15:220,16:50,17:122,18:239,19:51,20:145,21:52,22:162,23:58,
  24:177,25:112,26:218,27:64,28:177,29:55,30:128,31:227,32:55,33:128,34:227,
  35:68,36:188,37:60,38:197,39:76,40:197,41:54,42:171,43:78,44:132,45:184,
  46:74,47:141,48:128,49:202,50:45,51:157,52:69,53:163,54:80,55:175,56:74,
  57:176,58:91,59:213,60:77,61:145,62:230,63:75,64:145,65:250,66:75,67:145,
  68:250,69:60,70:138,71:191,72:71,73:205,74:73,75:148,76:218,77:82,78:175,
  79:99,80:199,81:65,82:165,83:94,84:65,85:166,86:65,87:166,88:90,89:218,
  90:75,91:199,92:95,93:180,94:261,95:78,96:64,97:176,98:65,99:173,100:66,
  101:172,102:98,103:207,104:78,105:173,106:114,107:114,108:165,109:95,110:175,
  111:111,112:234,113:255,114:166,115:218,116:66,117:170,118:83,119:198,120:83,
  121:207,122:136,123:187,124:137,125:172,126:172,127:200,128:172,129:40,130:239,
  131:207,132:101,133:65,134:197,135:197,136:197,137:130,138:71,139:164,140:71,
  141:170,142:215,143:189,144:216,145:216,146:216,147:60,148:147,149:270,150:340,151:270,
};

// Official growth rates for Kanto 1-151
const GROWTH_RATES = {
  1:"Medium Slow",2:"Medium Slow",3:"Medium Slow",4:"Medium Slow",5:"Medium Slow",
  6:"Medium Slow",7:"Medium Slow",8:"Medium Slow",9:"Medium Slow",10:"Fast",11:"Fast",
  12:"Fast",13:"Fast",14:"Fast",15:"Fast",16:"Medium Fast",17:"Medium Fast",18:"Medium Fast",
  19:"Medium Fast",20:"Medium Fast",21:"Medium Fast",22:"Medium Fast",23:"Medium Fast",
  24:"Medium Fast",25:"Medium Fast",26:"Medium Fast",27:"Medium Fast",28:"Medium Fast",
  29:"Medium Slow",30:"Medium Slow",31:"Medium Slow",32:"Medium Slow",33:"Medium Slow",
  34:"Medium Slow",35:"Fast",36:"Fast",37:"Medium Fast",38:"Medium Fast",39:"Fast",40:"Fast",
  41:"Medium Fast",42:"Medium Fast",43:"Medium Slow",44:"Medium Slow",45:"Medium Slow",
  46:"Medium Fast",47:"Medium Fast",48:"Medium Fast",49:"Medium Fast",50:"Medium Fast",
  51:"Medium Fast",52:"Medium Fast",53:"Medium Fast",54:"Medium Fast",55:"Medium Fast",
  56:"Medium Fast",57:"Medium Fast",58:"Medium Slow",59:"Medium Slow",60:"Medium Slow",
  61:"Medium Slow",62:"Medium Slow",63:"Medium Slow",64:"Medium Slow",65:"Medium Slow",
  66:"Medium Fast",67:"Medium Fast",68:"Medium Fast",69:"Medium Slow",70:"Medium Slow",
  71:"Medium Slow",72:"Slow",73:"Slow",74:"Medium Slow",75:"Medium Slow",76:"Medium Slow",
  77:"Medium Fast",78:"Medium Fast",79:"Slow",80:"Slow",81:"Medium Fast",82:"Medium Fast",
  83:"Medium Fast",84:"Medium Fast",85:"Medium Fast",86:"Medium Fast",87:"Medium Fast",
  88:"Medium Fast",89:"Medium Fast",90:"Fast",91:"Slow",92:"Medium Fast",93:"Medium Fast",
  94:"Medium Slow",95:"Medium Fast",96:"Fast",97:"Fast",98:"Medium Fast",99:"Medium Fast",
  100:"Medium Fast",101:"Medium Fast",102:"Medium Slow",103:"Medium Slow",104:"Medium Slow",
  105:"Medium Slow",106:"Medium Fast",107:"Medium Fast",108:"Medium Slow",109:"Medium Fast",
  110:"Medium Fast",111:"Slow",112:"Slow",113:"Fast",114:"Medium Slow",115:"Slow",
  116:"Medium Fast",117:"Medium Fast",118:"Medium Fast",119:"Slow",120:"Slow",121:"Slow",
  122:"Medium Fast",123:"Medium Slow",124:"Medium Slow",125:"Medium Slow",126:"Medium Slow",
  127:"Slow",128:"Slow",129:"Slow",130:"Slow",131:"Slow",132:"Medium Fast",
  133:"Medium Fast",134:"Medium Fast",135:"Medium Fast",136:"Medium Fast",137:"Medium Fast",
  138:"Medium Fast",139:"Medium Fast",140:"Medium Fast",141:"Medium Fast",142:"Slow",
  143:"Slow",144:"Slow",145:"Slow",146:"Slow",147:"Slow",148:"Slow",149:"Slow",150:"Slow",
  151:"Medium Slow",
};

function getGrowthRateForSpecies(speciesId) {
  return GROWTH_RATES[speciesId] ?? "Medium Fast";
}

function getBaseExpYield(speciesId) {
  return BASE_EXP_YIELDS[speciesId] ?? 50;
}

// XP pacing multiplier for 3v3 format — reduce XP gain to prevent hyper-fast levelling
const XP_MULT_3V3 = 0.7;

// Official XP gain: floor((a * b * L) / 7) * XP_MULT_3V3
function calcXpYield(enemyLevel, enemySpeciesId, isTrainerOwned = true) {
  const b = getBaseExpYield(enemySpeciesId);
  const a = isTrainerOwned ? 1.5 : 1.0;
  return Math.max(1, Math.floor(Math.floor((a * b * enemyLevel) / 7) * XP_MULT_3V3));
}

function recomputeStats(poke) {
  return computeAllStats(poke);
}

// ── EV Architecture ───────────────────────────────────────────────────────────
// Official caps: 252 per stat, 510 total.
// No EVs are awarded from battle — this is the hook for future sources
// (events, relics, camp training, shops).

const EV_STAT_CAP  = 252;
const EV_TOTAL_CAP = 510;
const EV_STAT_ORDER = ["hp","atk","def","spa","spd","spe"];

/**
 * Ensure an EVs object has all six stats, each clamped to [0, 252],
 * and total ≤ 510. Overflow is trimmed in EV_STAT_ORDER order.
 * Safe to call on any raw/partial EV object.
 */
function normalizeEvs(evs) {
  let total = 0;
  const out = {};
  for (const stat of EV_STAT_ORDER) {
    const raw = Math.max(0, Math.floor(evs?.[stat] ?? 0));
    const capped = Math.min(raw, EV_STAT_CAP);
    const allowed = Math.min(capped, Math.max(0, EV_TOTAL_CAP - total));
    out[stat] = allowed;
    total += allowed;
  }
  return out;
}

/**
 * Merge EV gains into existing EVs, enforcing all caps.
 * Returns a new normalized EV object — does not mutate inputs.
 *
 * Example future usage:
 *   poke.evs = applyEvGain(poke.evs, { atk: 16 });
 */
function applyEvGain(currentEvs, gains) {
  const merged = {};
  for (const stat of EV_STAT_ORDER) {
    merged[stat] = (currentEvs?.[stat] ?? 0) + (gains?.[stat] ?? 0);
  }
  return normalizeEvs(merged);
}

/**
 * Grant EVs to a Pokémon in-battle object and immediately recompute stats.
 * - Enforces all caps via normalizeEvs.
 * - Recalculates full stat block.
 * - Adjusts maxHp and preserves currentHp correctly if HP changes.
 * - Pushes a readable log message when log is provided and EVs actually changed.
 *
 * Example future usage:
 *   grantEvsToPoke(pokemon, { atk: 16 }, log, "training");
 *   grantEvsToPoke(pokemon, { spe: 12 }, log, "wind shrine");
 *
 * Currently NOT called from battle flow — zero EVs awarded from battle.
 */
function grantEvsToPoke(poke, evGains, log, sourceLabel) {
  if (!poke || !evGains) return;

  const before = normalizeEvs(poke.evs ?? {});
  const after  = applyEvGain(before, evGains);

  // Check if anything actually changed
  const changed = EV_STAT_ORDER.filter(s => after[s] !== before[s]);
  if (changed.length === 0) return;

  poke.evs = after;

  // Recompute all stats with new EVs
  const newStats = computeAllStats(poke);
  if (!poke.stats) poke.stats = {};

  for (const stat of EV_STAT_ORDER) {
    if (stat === "hp") {
      const hpDelta = newStats.hp - (poke.maxHp ?? newStats.hp);
      poke.maxHp = newStats.hp;
      // Preserve current HP ratio; add HP bonus from new EVs proportionally
      if (hpDelta > 0) {
        poke.currentHp = Math.min((poke.currentHp ?? 0) + hpDelta, poke.maxHp);
      }
      poke.currentHp = Math.max(0, Math.min(poke.currentHp ?? 0, poke.maxHp));
    } else {
      poke.stats[stat] = newStats[stat];
    }
  }

  if (Array.isArray(log)) {
    const parts = changed
      .filter(s => after[s] > before[s])
      .map(s => `+${after[s] - before[s]} ${s}`);
    if (parts.length > 0) {
      const label = sourceLabel ? ` (${sourceLabel})` : "";
      log.push(`[EV] ${poke.name} gained EVs${label}: ${parts.join(", ")}`);
    }
  }
}

// Learnsets — must mirror components/db/learnsets.js (keyed by speciesId integer)
const LEVEL_UP_LEARNSETS = {
  1:  [{ level: 7, moveId: "vine_whip" }],
  4:  [{ level: 7, moveId: "ember" }],
  7:  [{ level: 7, moveId: "water_gun" }],
  10: [],
  16: [{ level: 9, moveId: "quick_attack" }],
  17: [],
  18: [],
  19: [{ level: 7, moveId: "quick_attack" }],
  20: [],
  21: [{ level: 9, moveId: "quick_attack" }],
  22: [],
  25: [{ level: 9, moveId: "quick_attack" }],
  26: [],
  33: [{ level: 9, moveId: "quick_attack" }],
  52: [{ level: 9, moveId: "quick_attack" }],
  133:[{ level: 9, moveId: "quick_attack" }],
};

// Minimal move data for level-up moves (just enough to add to movesets)
const MOVE_DATA = {
  vine_whip:    { id: "vine_whip",    name: "Vine Whip",    type: "grass",    category: "physical", power: 45,  pp: 25, priority: 0 },
  ember:        { id: "ember",        name: "Ember",        type: "fire",     category: "special",  power: 40,  pp: 25, priority: 0 },
  water_gun:    { id: "water_gun",    name: "Water Gun",    type: "water",    category: "special",  power: 40,  pp: 25, priority: 0 },
  quick_attack: { id: "quick_attack", name: "Quick Attack", type: "normal",   category: "physical", power: 40,  pp: 30, priority: 1 },
  tackle:       { id: "tackle",       name: "Tackle",       type: "normal",   category: "physical", power: 40,  pp: 35, priority: 0 },
  scratch:      { id: "scratch",      name: "Scratch",      type: "normal",   category: "physical", power: 40,  pp: 35, priority: 0 },
  growl:        { id: "growl",        name: "Growl",        type: "normal",   category: "status",   power: null,pp: 40, priority: 0 },
  thunder_shock:{ id: "thunder_shock",name: "ThunderShock", type: "electric", category: "special",  power: 40,  pp: 30, priority: 0 },
  string_shot:  { id: "string_shot",  name: "String Shot",  type: "bug",      category: "status",   power: null,pp: 40, priority: 0 },
  tail_whip:    { id: "tail_whip",    name: "Tail Whip",    type: "normal",   category: "status",   power: null,pp: 30, priority: 0 },
};

// Apply XP to a Pokémon and handle level-ups. Returns queued learn prompts.
function applyXpToPoke(poke, xpAmount, log) {
  if (!poke || xpAmount <= 0) return [];
  const beforeExp = poke.exp ?? 0;
  poke.exp = beforeExp + xpAmount;
  log.push(`${poke.name} gained ${xpAmount} Exp. Points! [DEV: ${beforeExp} → ${poke.exp}]`);

  const curve = getGrowthRateForSpecies(poke.speciesId);
  const learnQueue = [];
  let newLevel = getLevelFromExp(poke.exp, curve);
  while (newLevel > poke.level) {
    poke.level++;
    const oldMaxHp = poke.maxHp;
    // PATCH 1: Recompute FULL stats after level-up — never partial, never merged into baseStats
    const newStats = recomputeStats(poke);
    poke.stats = {
      hp: newStats.hp,
      atk: newStats.atk,
      def: newStats.def,
      spa: newStats.spa,
      spd: newStats.spd,
      spe: newStats.spe,
    };
    poke.maxHp = newStats.hp;
    // Gen-like: gain HP from level up
    poke.currentHp = Math.max(0, poke.currentHp + Math.max(0, newStats.hp - oldMaxHp));
    poke.currentHp = Math.min(poke.currentHp, poke.maxHp);
    log.push(`${poke.name} grew to Lv.${poke.level}!`);

    // Check for learned moves at this level
    const learnEntries = LEVEL_UP_LEARNSETS[poke.speciesId] ?? [];
    for (const entry of learnEntries) {
      if (entry.level === poke.level) {
        const moveData = MOVE_DATA[entry.moveId];
        if (!moveData) continue;
        const alreadyHas = poke.moves.some(m => m.id === entry.moveId);
        if (alreadyHas) continue;

        if (poke.moves.length < 4) {
          // Auto-learn
          poke.moves.push({ ...moveData, currentPp: moveData.pp });
          log.push(`${poke.name} learned ${moveData.name}!`);
        } else {
          // Queue learn prompt for UI
          learnQueue.push({ pokeName: poke.name, pokeRef: poke, moveData, level: poke.level });
        }
      }
    }
    newLevel = getLevelFromExp(poke.exp, curve);
  }
  return learnQueue;
}

// ── Build action list ─────────────────────────────────────────────────────────
function buildActions(playerCommands, state, rng, allowEnemySwitch, log) {
  const SWITCH_PRIORITY = 7;
  const actions = [];

  for (const cmd of playerCommands) {
    const poke = state.player.active[cmd.actorSlot];
    if (!poke || poke.fainted || poke.justSwitchedIn) continue;
    if (cmd.type === "switch") {
      actions.push({ side: "player", activeIdx: cmd.actorSlot, poke, cmd, priority: SWITCH_PRIORITY, speed: getStat(poke, "spe"), isSwitch: true });
    } else if (cmd.type === "item") {
      actions.push({ side: "player", activeIdx: cmd.actorSlot, poke, cmd, priority: 6, speed: getStat(poke, "spe"), isItem: true });
    } else {
      const move = poke.moves.find(m => m.id === cmd.moveId);
      if (!move) continue;
      const remainingPp = move.currentPp ?? move.pp;
      if (remainingPp <= 0) {
        log.push(`${poke.name} has no PP left for ${move.name}!`);
        continue;
      }
      const enemyTargetIdx = cmd.target?.slot ?? 0;
      actions.push({ side: "player", activeIdx: cmd.actorSlot, poke, move, cmd, priority: move.priority ?? 0, speed: getStat(poke, "spe"), isSwitch: false, isItem: false, enemyTargetIdx });
    }
  }

  for (let ei = 0; ei < state.enemy.active.length; ei++) {
    const poke = state.enemy.active[ei];
    if (!poke || poke.fainted || poke.justSwitchedIn) continue;
    if (allowEnemySwitch) {
      const switchBenchIdx = enemyPickSwitch(ei, state.enemy, state.player.active);
      if (switchBenchIdx >= 0) {
        actions.push({ side: "enemy", activeIdx: ei, poke, cmd: { type: "switch", benchIdx: switchBenchIdx }, priority: SWITCH_PRIORITY, speed: getStat(poke, "spe"), isSwitch: true, benchIdx: switchBenchIdx });
        continue;
      }
    }
    const movePick = enemyPickMove(poke, state.player.active);
    if (!movePick) continue;
    const move = poke.moves.find(m => m.id === movePick.moveId);
    if (!move) continue;
    const remainingPp = move.currentPp ?? move.pp;
    if (remainingPp <= 0) {
      log.push(`${poke.name} has no PP left for ${move.name}!`);
      continue;
    }
    actions.push({ side: "enemy", activeIdx: ei, poke, move, priority: move.priority ?? 0, speed: getStat(poke, "spe"), isSwitch: false, isItem: false, playerTargetIdx: movePick.targetIdx });
  }

  actions.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.speed !== a.speed) return b.speed - a.speed;
    if (a.side !== b.side) return a.side === "player" ? -1 : 1;
    return (a.activeIdx ?? 0) - (b.activeIdx ?? 0);
  });

  return actions;
}

// ── Validate player commands ───────────────────────────────────────────────────
function validateSwitch(cmd, state) {
  const { actorSlot } = cmd;
  const benchIdx = cmd.target?.slot;
  if (actorSlot === undefined || actorSlot === null) return "Switch missing actorSlot.";
  if (benchIdx === undefined || benchIdx === null) return "Switch missing target.slot (bench index).";
  const actor = state.player.active[actorSlot];
  if (!actor) return `No active Pokémon at slot ${actorSlot}.`;
  const bench = state.player.bench[benchIdx];
  if (!bench) return `No bench Pokémon at index ${benchIdx}.`;
  if (bench.fainted) return `${bench.name} has fainted and cannot be switched in.`;
  if (state.player.active.some(p => p === bench)) return `${bench.name} is already active.`;
  return null;
}

function validateItem(cmd, state, inventory) {
  const { itemId, target } = cmd;
  const cfg = ITEM_CONFIG[itemId];
  if (!cfg) return `Unknown item: ${itemId}`;
  if ((inventory[itemId] ?? 0) < 1) return `No ${itemId}s left!`;
  const allPlayer = [...state.player.active, ...state.player.bench];
  const targetPoke = allPlayer[target?.partyIndex];
  if (!targetPoke) return `No Pokémon at party index ${target?.partyIndex}`;
  if (cfg.revives && !targetPoke.fainted) return `${targetPoke.name} hasn't fainted — can't use Revive.`;
  if (!cfg.canTargetFainted && targetPoke.fainted) return `${targetPoke.name} has fainted — can't use ${itemId}.`;
  if (!cfg.canTargetFainted && targetPoke.currentHp >= targetPoke.maxHp) return `${targetPoke.name}'s HP is already full!`;
  return null;
}

// ── Convert battle state → partyState snapshot ───────────────────────────────
function extractPartyState(playerSide) {
  const allPokes = [...playerSide.active, ...playerSide.bench];

  return allPokes
    .filter((p) => !!p)
    .map((p) => ({
      speciesId: p.speciesId,
      name: p.name,
      level: p.level,
      exp: p.exp ?? 0,
      gender: p.gender ?? "Male",
      types: p.types ?? [],
      nature: p.nature ?? "Hardy",
      abilityId: p.abilityId ?? null,
      shiny: p.shiny ?? false,
      ivs: p.ivs ?? {},
      evs: p.evs ?? {
        hp: 0,
        atk: 0,
        def: 0,
        spa: 0,
        spd: 0,
        spe: 0,
      },
      baseStats: p.baseStats ?? null,
      stats: p.stats ?? null,
      currentHP: p.currentHp,
      maxHP: p.maxHp,
      fainted: p.fainted,
      status: p.status ?? null,
      heldItem: p.heldItem ?? null,
      moves: (p.moves ?? []).map((m) => ({
        id: m.id,
        pp: m.currentPp ?? m.pp,
        ppMax: m.pp,
      })),
    }));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, battleId, playerCommands } = await req.json();
    if (!runId || !battleId || !playerCommands)
      return Response.json({ error: "runId, battleId, playerCommands required" }, { status: 400 });

    const battles = await base44.entities.Battle.filter({ id: battleId });
    const battle = battles[0];
    if (!battle) return Response.json({ error: "Battle not found" }, { status: 404 });
    if (battle.status !== "active") return Response.json({ error: "Battle already finished" }, { status: 400 });

    // Load run for inventory + modifiers (xp share)
    const runs = await base44.asServiceRole.entities.Run.filter({ id: runId });
    const run = runs[0];
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    const inventory = run.results?.progress?.inventory ?? { potion: 0, revive: 0, bait: 0 };
    const runRelics = run.results?.progress?.relics ?? [];

    // XP share: xp_share_on is default; bench gets XP unless xp_share_off is explicitly set
    const modifiers = run.modifiers ?? {};
    const xpShareBench = !modifiers.xp_share_off;

    // Validate player commands — skip commands for empty/null active slots
    const validatedCommands = [];
    for (const cmd of playerCommands) {
      const actorPoke = battle.state.player.active[cmd.actorSlot];
      if (!actorPoke) {
        console.warn(`[commitTurn] Ignoring command for empty active slot ${cmd.actorSlot}`);
        continue;
      }
      if (cmd.type === "switch") {
        const err = validateSwitch(cmd, battle.state);
        if (err) return Response.json({ error: err }, { status: 400 });
      } else if (cmd.type === "item") {
        const err = validateItem(cmd, battle.state, inventory);
        if (err) return Response.json({ error: err }, { status: 400 });
      } else if (cmd.type !== "move") {
        return Response.json({ error: `Unknown action type: ${cmd.type}` }, { status: 400 });
      }
      validatedCommands.push(cmd);
    }
    const playerCommands_ = validatedCommands;

    const state = battle.state;
    const turnNumber = (battle.turnNumber ?? 0) + 1;
    const rngSeed = `${runId}:turn${turnNumber}:rng${state.rngCallCount ?? 0}`;
    const rng = makeRng(rngSeed);
    const log = [];
    const actionOrder = [];
    const inventoryDelta = {};
    const pendingLearnPrompts = []; // learn prompts to send to frontend

    // Track which enemy slots already awarded XP this turn (persisted in state)
    if (!state.xpAwardedEnemyIds) state.xpAwardedEnemyIds = {};

    normalizeTeam(state.player);
    normalizeTeam(state.enemy);

    // Clear justSwitchedIn flags from previous turn
    for (const p of [...state.player.active, ...state.player.bench, ...state.enemy.active, ...state.enemy.bench]) {
      if (p) p.justSwitchedIn = false;
    }

    const allowEnemySwitch = !state.enemySwitchUsed;
    const actions = buildActions(playerCommands_, state, rng, allowEnemySwitch, log);

    for (const a of actions) {
      actionOrder.push(`${a.side}:${a.isSwitch ? "switch" : a.isItem ? `item:${a.cmd?.itemId}` : a.move?.id ?? "?"} (activeIdx ${a.activeIdx}, pri ${a.priority}, spd ${a.speed})`);
    }

    // ── Resolve actions ────────────────────────────────────────────────────────
    for (const action of actions) {
      const { side, activeIdx, isSwitch, isItem } = action;
      const sideState = side === "player" ? state.player : state.enemy;
      const poke = sideState.active[activeIdx];
      if (!poke || poke.fainted) continue;
      // Skip if poke entered this turn (KO replacement) — identified by reference to snapshot
      if (poke !== action.poke) continue;

      // ── Switch ──────────────────────────────────────────────────────────────
      if (isSwitch) {
        if (side === "player") {
          const benchIdx = action.cmd.target.slot;
          const bench = state.player.bench[benchIdx];
          if (bench && !bench.fainted && (bench.currentHp ?? 0) > 0) {
            state.player.active[activeIdx] = bench;
            state.player.bench[benchIdx] = poke;
            log.push(`${poke.name} was recalled. Go, ${bench.name}!`);
          }
        } else {
          const benchIdx = action.benchIdx;
          const bench = state.enemy.bench[benchIdx];
          if (bench && !bench.fainted && (bench.currentHp ?? 0) > 0) {
            state.enemy.active[activeIdx] = bench;
            state.enemy.bench[benchIdx] = poke;
            log.push(`Rival recalled ${poke.name} and sent out ${bench.name}!`);
            state.enemySwitchUsed = true;
          }
        }
        continue;
      }

      // ── Item ────────────────────────────────────────────────────────────────
      if (isItem) {
        const { itemId, target } = action.cmd;
        const cfg = ITEM_CONFIG[itemId];
        if (!cfg) { log.push(`Unknown item: ${itemId}!`); continue; }

        // partyIndex is stable: 0-2 = active slots, 3-5 = bench slots
        const allPlayer = [...state.player.active, ...state.player.bench];
        const partyIdx = target?.partyIndex;
        const targetPoke = partyIdx !== undefined && partyIdx !== null ? allPlayer[partyIdx] : null;
        if (!targetPoke) { log.push(`No Pokémon at party index ${partyIdx}!`); continue; }
        console.log(`[commitTurn] Item target partyIndex=${partyIdx} name=${targetPoke.name}`);

        inventory[itemId] = Math.max(0, (inventory[itemId] ?? 0) - 1);
        inventoryDelta[itemId] = (inventoryDelta[itemId] ?? 0) - 1;

        if (itemId === "potion") {
          if (!targetPoke.fainted && targetPoke.currentHp < targetPoke.maxHp) {
            const healed = Math.min(cfg.healAmount, targetPoke.maxHp - targetPoke.currentHp);
            targetPoke.currentHp += healed;
            log.push(`You used a Potion on ${targetPoke.name}! +${healed} HP.`);
          } else {
            log.push(`Potion had no effect on ${targetPoke.name}.`);
          }
        } else if (itemId === "revive") {
          if (targetPoke.fainted) {
            const halfHp = Math.floor(targetPoke.maxHp * 0.5);
            targetPoke.currentHp = halfHp;
            targetPoke.fainted = false;
            targetPoke.status = null;
            log.push(`You used a Revive on ${targetPoke.name}! It recovered to half HP.`);
          } else {
            log.push(`Revive had no effect on ${targetPoke.name}.`);
          }
        }
        continue;
      }

      // ── Move ────────────────────────────────────────────────────────────────
      const { move } = action;
      const targetSide = side === "player" ? "enemy" : "player";
      const originalTargetSlot = side === "player" ? (action.enemyTargetIdx ?? 0) : (action.playerTargetIdx ?? 0);
      let effectiveTargetSlot = originalTargetSlot;
      let retargeted = false;

      if (!isValidTarget(state, targetSide, originalTargetSlot)) {
        const smart = chooseSmartTarget(state, poke, move, targetSide);
        if (!smart) continue;
        effectiveTargetSlot = smart.slot;
        retargeted = true;
        const targetSideState2 = targetSide === "enemy" ? state.enemy : state.player;
        const newTargetName = targetSideState2.active[effectiveTargetSlot]?.name ?? "???";
        const attackerLabel = side === "player" ? `Your ${poke.name}` : `Rival's ${poke.name}`;
        log.push(`Target fainted — ${attackerLabel} retargeted to ${newTargetName}!`);
      }

      const targetSideState = targetSide === "enemy" ? state.enemy : state.player;
      const target = targetSideState.active[effectiveTargetSlot];
      if (!target || target.fainted) continue;

      action.originalTargetSlot = originalTargetSlot;
      action.finalTargetSlot = effectiveTargetSlot;
      action.wasRetargeted = retargeted;

      // Hit-check ordering:
      // 1) Consume PP for the selected move.
      // 2) Roll accuracy once using the turn RNG.
      // 3) On miss, log and skip all damage/effects for this action.
      // 4) On hit, continue into damage/effect resolution.
      const mv = poke.moves.find(m => m.id === move.id);
      const remainingPp = mv ? (mv.currentPp ?? mv.pp) : 0;
      if (!mv || remainingPp <= 0) {
        log.push(`${poke.name} has no PP left for ${move.name}!`);
        continue;
      }
      mv.currentPp = Math.max(0, remainingPp - 1);

      const baseAccuracy = move.accuracy ?? 100;
      // Future hooks: fold stat stages/abilities/items into these multipliers.
      const accuracyStageMultiplier = 1;
      const evasionStageMultiplier = 1;
      const effectiveAccuracy = Math.max(
        0,
        Math.min(100, baseAccuracy * accuracyStageMultiplier / evasionStageMultiplier)
      );
      const hitRoll = rng.next() * 100;
      if (hitRoll >= effectiveAccuracy) {
        const attackerLabel = side === "player" ? `Your ${poke.name}` : `Rival's ${poke.name}`;
        log.push(`${attackerLabel} used ${move.name}, but it missed!`);
        continue;
      }

      if (move.power) {
        // Accuracy was already resolved above; this block is hit-only resolution.
        let { dmg, typeEff } = calcDamage(poke, move, target, rng, log);
        const preDamageHookResult = callAbilityHook(poke, "preDamage", {
          source: poke,
          target,
          move,
          side,
          targetSide,
          rng,
          log,
        });
        if (preDamageHookResult?.damageMultiplier) {
          dmg = Math.max(1, Math.floor(dmg * preDamageHookResult.damageMultiplier));
        }
        // ── Relic damage modifiers (player attacker only) ─────────────────
        if (side === "player") {
          const isFirstAction = !state.surgeBatteryFired;
          const offMult = relicDamageMultiplier(runRelics, poke, isFirstAction);
          const defMult = relicDefenseMultiplier(runRelics, target);
          dmg = Math.max(1, Math.floor(dmg * offMult * defMult));
          if (isFirstAction && hasRelic(runRelics, "surge_battery")) state.surgeBatteryFired = true;
        }
        target.currentHp = Math.max(0, target.currentHp - dmg);
        const effText = typeEff >= 2 ? " It's super effective!" : typeEff <= 0.5 ? " It's not very effective..." : "";
        const attackerLabel = side === "player" ? `Your ${poke.name}` : `Rival's ${poke.name}`;
        const defenderLabel = side === "player" ? `Rival's ${target.name}` : `your ${target.name}`;
        log.push(`${attackerLabel} used ${move.name}! Dealt ${dmg} damage to ${defenderLabel}.${effText}`);

        callAbilityHook(poke, "postHit", {
          source: poke,
          target,
          move,
          side,
          targetSide,
          damage: dmg,
          rng,
          log,
        });
        callAbilityHook(target, "onContact", {
          source: poke,
          target,
          move,
          side: targetSide,
          targetSide: side,
          damage: dmg,
          rng,
          log,
        });
        applyMoveSecondaryEffects({
          attacker: poke,
          defender: target,
          move,
          rng,
          log,
        });

        if (target.currentHp === 0) {
          // ── focus_charm: survive at 1 HP once per battle ─────────────────
          if (side === "enemy" && hasRelic(runRelics, "focus_charm") && !state.focusCharmUsed) {
            target.currentHp = 1;
            state.focusCharmUsed = true;
            log.push(`${target.name} held on with Focus Charm!`);
          } else {
          target.fainted = true;
          const faintLabel = side === "player" ? `Rival's ${target.name}` : `Your ${target.name}`;
          log.push(`${faintLabel} fainted!`);

          } // end focus_charm else
          if (side === "player") {
            const replacement = autoReplace(state.enemy, effectiveTargetSlot, "Rival", log);
            if (replacement) replacement.justSwitchedIn = true;

            // ── XP Award on enemy faint ────────────────────────────────────
            const enemyKey = `${effectiveTargetSlot}_${target.speciesId}_${target.level}`;
            if (!state.xpAwardedEnemyIds[enemyKey]) {
              state.xpAwardedEnemyIds[enemyKey] = true;
              // Official formula: floor((a * b * L) / 7), a=1.5 trainer, b=baseExpYield, L=level
              const xpYield = calcXpYield(target.level ?? 5, target.speciesId, true);

              // Award to each eligible recipient (full XP each — no splitting)
              const allPlayerPokes = [...state.player.active, ...(xpShareBench ? state.player.bench : [])];
              for (const recipient of allPlayerPokes) {
                if (!recipient) continue;
                const prompts = applyXpToPoke(recipient, xpYield, log);
                for (const prompt of prompts) {
                  pendingLearnPrompts.push({
                    pokeName: prompt.pokeName,
                    moveData: prompt.moveData,
                    level: prompt.level,
                  });
                }
                // EV hook: no EVs awarded from battle.
                // Future sources call: grantEvsToPoke(poke, { atk: 2 }, log, "source")
              }
            }
          } else {
            const validBench = state.player.bench.filter(p => p && !p.fainted && p.currentHp > 0);
            if (validBench.length > 0 && !state.pendingReplacement) {
              state.pendingReplacement = { side: "player", slot: effectiveTargetSlot, faintedName: target.name, reason: "fainted" };
            }
            // Player's active that was KO'd — any auto-fill will be marked justSwitchedIn in chooseReplacement
          }
        }
      } else {
        const attackerLabel = side === "player" ? `Your ${poke.name}` : `Rival's ${poke.name}`;
        log.push(`${attackerLabel} used ${move.name}!`);
      }
    }

    // ── End-of-turn DOT ────────────────────────────────────────────────────────
    for (let ai = 0; ai < state.enemy.active.length; ai++) {
      const poke = state.enemy.active[ai];
      if (!poke || poke.fainted) continue;
      if (poke.status === "burn" || poke.status === "poison") {
        const dot = Math.max(1, Math.floor(poke.maxHp / 8));
        poke.currentHp = Math.max(0, poke.currentHp - dot);
        log.push(`Rival's ${poke.name} took ${dot} damage from ${poke.status}!`);
        if (poke.currentHp === 0) { poke.fainted = true; log.push(`Rival's ${poke.name} fainted!`); autoReplace(state.enemy, ai, "Rival", log); }
      }
    }
    for (let ai = 0; ai < state.player.active.length; ai++) {
      const poke = state.player.active[ai];
      if (!poke || poke.fainted) continue;
      if (poke.status === "burn" || poke.status === "poison") {
        const dot = Math.max(1, Math.floor(poke.maxHp / 8));
        poke.currentHp = Math.max(0, poke.currentHp - dot);
        log.push(`Your ${poke.name} took ${dot} damage from ${poke.status}!`);
        if (poke.currentHp === 0) {
          poke.fainted = true;
          log.push(`Your ${poke.name} fainted!`);
          const validBenchStatus = state.player.bench.filter(p => p && !p.fainted && p.currentHp > 0);
          if (validBenchStatus.length > 0 && !state.pendingReplacement) {
            state.pendingReplacement = { side: "player", slot: ai, faintedName: poke.name, reason: "status" };
          }
        }
      }
    }

    // ── Victory check ──────────────────────────────────────────────────────────
    const playerAllFainted = state.player.active.every(p => !p || p.fainted) && state.player.bench.every(p => !p || p.fainted);
    const enemyAllFainted  = state.enemy.active.every(p => !p || p.fainted)  && state.enemy.bench.every(p => !p || p.fainted);
    let winner = null;
    if (playerAllFainted) { winner = "enemy";  log.push("All your Pokémon fainted! You lost!"); }
    if (enemyAllFainted)  { winner = "player"; log.push("All enemy Pokémon fainted! You won!"); }

    if (winner) {
      state.pendingReplacement = null;
    }

    const rngUsed = rng.getCallCount();
    state.winner = winner;
    state.turnLog = log;
    state.rngCallCount = (state.rngCallCount ?? 0) + rngUsed;
    state.lastActionOrder = actionOrder;
    state.lastRngUsed = rngUsed;
    // Store pending learn prompts in state so UI can show them
    state.pendingLearnPrompts = pendingLearnPrompts;

    const newStatus = winner ? "finished" : "active";
    const updatePayload: Record<string, unknown> = { state, turnNumber, status: newStatus };
    if (winner) updatePayload.endedAt = new Date().toISOString();

    // ── Extract partyState for persistence (now includes exp/level) ───────────
    const partyState = extractPartyState(state.player);

    // ── Persist battle + run (inventory + partyState) ─────────────────────────
    const existingProgress = run.results?.progress ?? {};
    const pendingEncounter = existingProgress.pendingEncounter ?? null;
    const updatedProgress = {
      ...existingProgress,
      inventory: { ...(existingProgress.inventory ?? {}), ...inventory },
      money: existingProgress.money ?? 0,
      partyState,
      // Keep encounter pending during battle; resolution happens in resolveNode/resolveEncounterFromBattle.
      pendingEncounter: winner
        ? pendingEncounter
        : (pendingEncounter ? { ...pendingEncounter, status: "pending" } : pendingEncounter),
    };

    await Promise.all([
      base44.entities.Battle.update(battleId, updatePayload),
      base44.asServiceRole.entities.Run.update(runId, {
        results: { ...(run.results ?? {}), progress: updatedProgress },
      }),
    ]);

    // ── Log battle_turn_commit RunAction ───────────────────────────────────────
    const nextIdx = (run?.nextActionIdx ?? 0) + 1;
    await Promise.all([
      base44.asServiceRole.entities.RunAction.create({
        runId, idx: nextIdx,
        actionType: "battle_turn_commit",
        payload: { battleId, turnNumber, playerCommands, log, rngUsed, actionOrder, inventoryDelta,
          retargets: actions.filter(a => a.wasRetargeted).map(a => ({ side: a.side, activeIdx: a.activeIdx, originalTargetSlot: a.originalTargetSlot, finalTargetSlot: a.finalTargetSlot })) },
      }),
      base44.asServiceRole.entities.Run.update(runId, { nextActionIdx: nextIdx }),
    ]);

    if (winner) {
      const allPlayer = [...state.player.active, ...state.player.bench];
      const allEnemy  = [...state.enemy.active,  ...state.enemy.bench];
      const playerFaints = allPlayer.filter(p => p?.fainted).length;
      const enemyFaints  = allEnemy.filter(p => p?.fainted).length;
      const summary = { winner, turns: turnNumber, playerFaints, enemyFaints };
      const endIdx = nextIdx + 1;
      await Promise.all([
        base44.asServiceRole.entities.RunAction.create({
          runId, idx: endIdx,
          actionType: "battle_end",
          payload: { battleId, summary },
        }),
        base44.asServiceRole.entities.Run.update(runId, { nextActionIdx: endIdx }),
      ]);
    }

    return Response.json({ state, turnNumber, winner, log, rngUsed, actionOrder, updatedInventory: inventory, pendingLearnPrompts });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
