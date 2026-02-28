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
function getLevelFromExp(exp) {
  if (exp <= 0) return 1;
  return Math.max(1, Math.min(100, Math.floor(Math.cbrt(exp))));
}

function computeStatValue(statName, base, level, iv, ev, nature) {
  const evContrib = Math.floor((ev ?? 0) / 4);
  const inner = Math.floor((2 * base + (iv ?? 0) + evContrib) * level / 100);
  if (statName === "hp") return inner + level + 10;
  return Math.floor((inner + 5) * 1); // neutral nature for MVP
}

function recomputeStats(poke) {
  const base = poke.baseStats;
  const level = poke.level;
  const ivs = poke.ivs ?? {};
  const evs = {};
  const nature = poke.nature ?? "hardy";
  return {
    hp:  computeStatValue("hp",  base.hp,  level, ivs.hp  ?? 0, 0, nature),
    atk: computeStatValue("atk", base.atk, level, ivs.atk ?? 0, 0, nature),
    def: computeStatValue("def", base.def, level, ivs.def ?? 0, 0, nature),
    spa: computeStatValue("spa", base.spa, level, ivs.spa ?? 0, 0, nature),
    spd: computeStatValue("spd", base.spd, level, ivs.spd ?? 0, 0, nature),
    spe: computeStatValue("spe", base.spe, level, ivs.spe ?? 0, 0, nature),
  };
}

// Minimal learnsets (level-up moves only — must mirror components/db/learnsets.js)
const LEVEL_UP_LEARNSETS = {
  1:  [{ level: 7,  moveId: "vine_whip" }],
  4:  [{ level: 7,  moveId: "ember" }],
  7:  [{ level: 7,  moveId: "water_gun" }],
  16: [{ level: 9,  moveId: "quick_attack" }],
  19: [{ level: 7,  moveId: "quick_attack" }],
  21: [{ level: 9,  moveId: "quick_attack" }],
  25: [{ level: 9,  moveId: "quick_attack" }],
  33: [{ level: 9,  moveId: "quick_attack" }], // Nidoran-M-like
  52: [{ level: 9,  moveId: "quick_attack" }],
  133:[{ level: 9,  moveId: "quick_attack" }],
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
  poke.exp = (poke.exp ?? 0) + xpAmount;
  log.push(`${poke.name} gained ${xpAmount} XP!`);

  const learnQueue = [];
  let newLevel = getLevelFromExp(poke.exp);
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
    newLevel = getLevelFromExp(poke.exp);
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
              const xpYield = Math.floor((20 + (target.level ?? 5) * 5) * 1.2); // trainer battle
              log.push(`Your team earned ${xpYield} XP!`);

              // Award to active (alive or fainted-this-battle)
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