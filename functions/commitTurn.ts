import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Type chart ────────────────────────────────────────────────────────────────
const TYPECHART = {
  normal:   { normal:1, fire:1,   water:1,   grass:1,   electric:1,   bug:1,   poison:1   },
  fire:     { normal:1, fire:0.5, water:0.5, grass:2,   electric:1,   bug:2,   poison:1   },
  water:    { normal:1, fire:2,   water:0.5, grass:0.5, electric:1,   bug:1,   poison:1   },
  grass:    { normal:1, fire:0.5, water:2,   grass:0.5, electric:1,   bug:0.5, poison:0.5 },
  electric: { normal:1, fire:1,   water:2,   grass:0.5, electric:0.5, bug:1,   poison:1   },
  bug:      { normal:1, fire:0.5, water:1,   grass:2,   electric:1,   bug:1,   poison:0.5 },
  poison:   { normal:1, fire:1,   water:1,   grass:2,   electric:1,   bug:1,   poison:0.5 },
};
function effectiveness(moveType, defenderTypes) {
  let mult = 1;
  for (const dt of defenderTypes) mult *= (TYPECHART[moveType]?.[dt] ?? 1);
  return mult;
}

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

// ── Damage formula ────────────────────────────────────────────────────────────
function calcDamage(attacker, move, defender, rng) {
  if (!move.power) return { dmg: 0, typeEff: 1 };
  const lvl = attacker.level;
  const atkStat = move.category === "physical" ? attacker.baseStats.atk : attacker.baseStats.spa;
  const defStat = move.category === "physical" ? defender.baseStats.def : defender.baseStats.spd;
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const typeEff = effectiveness(move.type, defender.types);
  const roll = 0.85 + rng.next() * 0.15;
  const dmg = Math.max(1, Math.floor(
    Math.floor(Math.floor(2 * lvl / 5 + 2) * move.power * atkStat / defStat / 50 + 2)
    * stab * typeEff * roll
  ));
  return { dmg, typeEff };
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
  const atkStat = move.category === "physical" ? attacker.baseStats.atk : attacker.baseStats.spa;
  const defStat = move.category === "physical" ? defender.baseStats.def : defender.baseStats.spd;
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
  const benchIdx = sideState.bench.findIndex(p => !p.fainted);
  if (benchIdx === -1) return null;
  const incoming = sideState.bench[benchIdx];
  const fainted = sideState.active[activeIdx];
  sideState.active[activeIdx] = incoming;
  sideState.bench[benchIdx] = fainted;
  log.push(`${label} sent out ${incoming.name}.`);
  return incoming;
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

// Official XP gain: floor((a * b * L) / 7)
function calcXpYield(enemyLevel, enemySpeciesId, isTrainerOwned = true) {
  const b = getBaseExpYield(enemySpeciesId);
  const a = isTrainerOwned ? 1.5 : 1.0;
  return Math.max(1, Math.floor((a * b * enemyLevel) / 7));
}

function computeStatValue(statName, base, level, iv, ev, nature) {
  const evContrib = Math.floor((ev ?? 0) / 4);
  const inner = Math.floor((2 * base + (iv ?? 0) + evContrib) * level / 100);
  if (statName === "hp") return inner + level + 10;
  return Math.floor((inner + 5) * 1); // neutral nature MVP
}

function recomputeStats(poke) {
  const base = poke.baseStats;
  const level = poke.level;
  const ivs = poke.ivs ?? {};
  return {
    hp:  computeStatValue("hp",  base.hp,  level, ivs.hp  ?? 0, 0),
    atk: computeStatValue("atk", base.atk, level, ivs.atk ?? 0, 0),
    def: computeStatValue("def", base.def, level, ivs.def ?? 0, 0),
    spa: computeStatValue("spa", base.spa, level, ivs.spa ?? 0, 0),
    spd: computeStatValue("spd", base.spd, level, ivs.spd ?? 0, 0),
    spe: computeStatValue("spe", base.spe, level, ivs.spe ?? 0, 0),
  };
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
    const newStats = recomputeStats(poke);
    const hpGain = newStats.hp - oldMaxHp;
    poke.maxHp = newStats.hp;
    poke.baseStats = { ...poke.baseStats, ...newStats };
    // Gen-like: gain HP from level up
    poke.currentHp = Math.max(0, poke.currentHp + Math.max(0, hpGain));
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
function buildActions(playerCommands, state, rng, allowEnemySwitch) {
  const SWITCH_PRIORITY = 7;
  const actions = [];

  for (const cmd of playerCommands) {
    const poke = state.player.active[cmd.actorSlot];
    if (!poke || poke.fainted) continue;
    if (cmd.type === "switch") {
      actions.push({ side: "player", activeIdx: cmd.actorSlot, poke, cmd, priority: SWITCH_PRIORITY, speed: poke.baseStats.spe, isSwitch: true });
    } else if (cmd.type === "item") {
      actions.push({ side: "player", activeIdx: cmd.actorSlot, poke, cmd, priority: 6, speed: poke.baseStats.spe, isItem: true });
    } else {
      const move = poke.moves.find(m => m.id === cmd.moveId);
      if (!move) continue;
      const enemyTargetIdx = cmd.target?.slot ?? 0;
      actions.push({ side: "player", activeIdx: cmd.actorSlot, poke, move, cmd, priority: move.priority ?? 0, speed: poke.baseStats.spe, isSwitch: false, isItem: false, enemyTargetIdx });
    }
  }

  for (let ei = 0; ei < state.enemy.active.length; ei++) {
    const poke = state.enemy.active[ei];
    if (!poke || poke.fainted) continue;
    if (allowEnemySwitch) {
      const switchBenchIdx = enemyPickSwitch(ei, state.enemy, state.player.active);
      if (switchBenchIdx >= 0) {
        actions.push({ side: "enemy", activeIdx: ei, poke, cmd: { type: "switch", benchIdx: switchBenchIdx }, priority: SWITCH_PRIORITY, speed: poke.baseStats.spe, isSwitch: true, benchIdx: switchBenchIdx });
        continue;
      }
    }
    const movePick = enemyPickMove(poke, state.player.active);
    if (!movePick) continue;
    const move = poke.moves.find(m => m.id === movePick.moveId);
    if (!move) continue;
    actions.push({ side: "enemy", activeIdx: ei, poke, move, priority: move.priority ?? 0, speed: poke.baseStats.spe, isSwitch: false, isItem: false, playerTargetIdx: movePick.targetIdx });
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
  return allPokes.filter(p => !!p).map(p => ({
    speciesId: p.speciesId,
    name: p.name,
    level: p.level,
    exp: p.exp ?? 0,
    ivs: p.ivs ?? {},
    nature: p.nature ?? "hardy",
    currentHP: p.currentHp,
    maxHP: p.maxHp,
    fainted: p.fainted,
    status: p.status ?? null,
    moves: p.moves.map(m => ({ id: m.id, pp: m.currentPp ?? m.pp, ppMax: m.pp })),
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
    const inventory = run.results?.progress?.inventory ?? { potion: 0, revive: 0 };

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

    const allowEnemySwitch = !state.enemySwitchUsed;
    const actions = buildActions(playerCommands_, state, rng, allowEnemySwitch);

    for (const a of actions) {
      actionOrder.push(`${a.side}:${a.isSwitch ? "switch" : a.isItem ? `item:${a.cmd?.itemId}` : a.move?.id ?? "?"} (activeIdx ${a.activeIdx}, pri ${a.priority}, spd ${a.speed})`);
    }

    // ── Resolve actions ────────────────────────────────────────────────────────
    for (const action of actions) {
      const { side, activeIdx, isSwitch, isItem } = action;
      const sideState = side === "player" ? state.player : state.enemy;
      const poke = sideState.active[activeIdx];
      if (!poke || poke.fainted) continue;

      // ── Switch ──────────────────────────────────────────────────────────────
      if (isSwitch) {
        if (side === "player") {
          const benchIdx = action.cmd.target.slot;
          const bench = state.player.bench[benchIdx];
          if (bench && !bench.fainted) {
            state.player.active[activeIdx] = bench;
            state.player.bench[benchIdx] = poke;
            log.push(`${poke.name} was recalled. Go, ${bench.name}!`);
          }
        } else {
          const benchIdx = action.benchIdx;
          const bench = state.enemy.bench[benchIdx];
          if (bench && !bench.fainted) {
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

        const allPlayer = [...state.player.active, ...state.player.bench];
        const targetPoke = allPlayer[target?.partyIndex];
        if (!targetPoke) { log.push(`No Pokémon at party index ${target?.partyIndex}!`); continue; }

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

      if (move.power) {
        const { dmg, typeEff } = calcDamage(poke, move, target, rng);
        target.currentHp = Math.max(0, target.currentHp - dmg);
        const effText = typeEff >= 2 ? " It's super effective!" : typeEff <= 0.5 ? " It's not very effective..." : "";
        const attackerLabel = side === "player" ? `Your ${poke.name}` : `Rival's ${poke.name}`;
        const defenderLabel = side === "player" ? `Rival's ${target.name}` : `your ${target.name}`;
        log.push(`${attackerLabel} used ${move.name}! Dealt ${dmg} damage to ${defenderLabel}.${effText}`);

        const mv = poke.moves.find(m => m.id === move.id);
        if (mv) mv.currentPp = Math.max(0, (mv.currentPp ?? move.pp) - 1);

        if (target.currentHp === 0) {
          target.fainted = true;
          const faintLabel = side === "player" ? `Rival's ${target.name}` : `Your ${target.name}`;
          log.push(`${faintLabel} fainted!`);

          if (side === "player") {
            autoReplace(state.enemy, effectiveTargetSlot, "Rival", log);

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
              }
            }
          } else {
            const validBench = state.player.bench.filter(p => p && !p.fainted && p.currentHp > 0);
            if (validBench.length > 0 && !state.pendingReplacement) {
              state.pendingReplacement = { side: "player", slot: effectiveTargetSlot, faintedName: target.name, reason: "fainted" };
            }
          }
        }
      } else {
        const attackerLabel = side === "player" ? `Your ${poke.name}` : `Rival's ${poke.name}`;
        log.push(`${attackerLabel} used ${move.name}!`);
        const mv = poke.moves.find(m => m.id === move.id);
        if (mv) mv.currentPp = Math.max(0, (mv.currentPp ?? move.pp) - 1);
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
    const updatePayload = { state, turnNumber, status: newStatus };
    if (winner) updatePayload.endedAt = new Date().toISOString();

    // ── Extract partyState for persistence (now includes exp/level) ───────────
    const partyState = extractPartyState(state.player);

    // ── Persist battle + run (inventory + partyState) ─────────────────────────
    const existingProgress = run.results?.progress ?? {};
    const updatedProgress = {
      ...existingProgress,
      inventory: { ...(existingProgress.inventory ?? {}), ...inventory },
      partyState,
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