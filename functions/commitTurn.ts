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

// ── Target validation ─────────────────────────────────────────────────────────
function isValidTarget(state, side, slot) {
  const sideState = side === "player" ? state.player : state.enemy;
  const poke = sideState.active[slot];
  return !!(poke && !poke.fainted && poke.currentHp > 0);
}

// ── Damage estimate (fixed roll = 0.925, no RNG consumed) ────────────────────
function estimateDamage(attacker, move, defender) {
  if (!move.power) return 0;
  const lvl = attacker.level;
  const atkStat = move.category === "physical" ? attacker.baseStats.atk : attacker.baseStats.spa;
  const defStat = move.category === "physical" ? defender.baseStats.def : defender.baseStats.spd;
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const typeEff = effectiveness(move.type, defender.types);
  const FIXED_ROLL = 0.925;
  return Math.max(1, Math.floor(
    Math.floor(Math.floor(2 * lvl / 5 + 2) * move.power * atkStat / defStat / 50 + 2)
    * stab * typeEff * FIXED_ROLL
  ));
}

// ── Smart retarget (deterministic, no RNG) ────────────────────────────────────
// Returns { slot } for the best valid enemy target, or null if none.
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
    // Score: KO bonus + damage weight + low-HP preference
    const score = canKO + est * 100 + typeEff * 10 + (1 - hpPct) * 500;
    candidates.push({ slot, score, hpPct });
  }
  if (candidates.length === 0) return null;
  // Sort: score desc, hpPct asc (lower HP wins tie), slot asc (leftmost wins)
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.hpPct !== b.hpPct) return a.hpPct - b.hpPct;
    return a.slot - b.slot;
  });
  return { slot: candidates[0].slot };
}

// ── Auto-replace fainted active slot from bench ───────────────────────────────
// sideState: { active: [...], bench: [...] }
// activeIdx: index into active array that just fainted
// Returns the bench pokemon that was sent in, or null
function autoReplace(sideState, activeIdx, label, log) {
  const benchIdx = sideState.bench.findIndex(p => !p.fainted);
  if (benchIdx === -1) return null;
  const incoming = sideState.bench[benchIdx];
  // Swap: move bench mon into active, put fainted mon into bench
  const fainted = sideState.active[activeIdx];
  sideState.active[activeIdx] = incoming;
  sideState.bench[benchIdx] = fainted;
  log.push(`${label} sent out ${incoming.name}.`);
  return incoming;
}

// ── Enemy AI move selection ───────────────────────────────────────────────────
function enemyPickMove(poke, playerActive) {
  const targets = playerActive.filter(p => !p.fainted);
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

// ── Enemy AI switch decision ──────────────────────────────────────────────────
// Returns benchIdx to switch to, or -1 if no switch
function enemyPickSwitch(activeIdx, sideState, playerActive, rng) {
  const poke = sideState.active[activeIdx];
  if (!poke || poke.fainted) return -1;
  // Only switch if HP < 25%
  if (poke.currentHp / poke.maxHp >= 0.25) return -1;
  // Find healthy bench options
  const healthyBench = sideState.bench
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.fainted);
  if (healthyBench.length === 0) return -1;
  // Pick best type matchup vs healthiest player active
  const playerTarget = [...playerActive].filter(p => !p.fainted)
    .sort((a, b) => b.currentHp - a.currentHp)[0];
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

// ── Build action list for the turn ───────────────────────────────────────────
function buildActions(playerCommands, state, rng, allowEnemySwitch) {
  const SWITCH_PRIORITY = 7;
  const actions = [];

  // Player actions
  for (const cmd of playerCommands) {
    const poke = state.player.active[cmd.actorSlot];
    if (!poke || poke.fainted) continue;
    if (cmd.type === "switch") {
      actions.push({ side: "player", activeIdx: cmd.actorSlot, poke, cmd, priority: SWITCH_PRIORITY, speed: poke.baseStats.spe, isSwitch: true });
    } else {
      const move = poke.moves.find(m => m.id === cmd.moveId);
      if (!move) continue;
      const enemyTargetIdx = cmd.target?.slot ?? 0;
      actions.push({ side: "player", activeIdx: cmd.actorSlot, poke, move, cmd, priority: move.priority ?? 0, speed: poke.baseStats.spe, isSwitch: false, enemyTargetIdx });
    }
  }

  // Enemy actions
  for (let ei = 0; ei < state.enemy.active.length; ei++) {
    const poke = state.enemy.active[ei];
    if (!poke || poke.fainted) continue;

    // Consider AI switch (only if not used this battle)
    if (allowEnemySwitch) {
      const switchBenchIdx = enemyPickSwitch(ei, state.enemy, state.player.active, rng);
      if (switchBenchIdx >= 0) {
        actions.push({ side: "enemy", activeIdx: ei, poke, cmd: { type: "switch", benchIdx: switchBenchIdx }, priority: SWITCH_PRIORITY, speed: poke.baseStats.spe, isSwitch: true, benchIdx: switchBenchIdx });
        continue;
      }
    }

    const movePick = enemyPickMove(poke, state.player.active);
    if (!movePick) continue;
    const move = poke.moves.find(m => m.id === movePick.moveId);
    if (!move) continue;
    actions.push({ side: "enemy", activeIdx: ei, poke, move, priority: move.priority ?? 0, speed: poke.baseStats.spe, isSwitch: false, playerTargetIdx: movePick.targetIdx });
  }

  // Sort: priority desc, speed desc, rng tie-break
  actions.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.speed !== a.speed) return b.speed - a.speed;
    return rng.next() - 0.5;
  });

  return actions;
}

// ── Validate player switch command ────────────────────────────────────────────
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
  // Cannot switch to a mon already active
  const activeNames = state.player.active.map(p => p?.name);
  if (activeNames.includes(bench.name) && state.player.active.some(p => p === bench)) return `${bench.name} is already active.`;
  return null;
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

    // Validate player commands
    for (const cmd of playerCommands) {
      if (cmd.type === "switch") {
        const err = validateSwitch(cmd, battle.state);
        if (err) return Response.json({ error: err }, { status: 400 });
      } else if (cmd.type !== "move") {
        return Response.json({ error: `Unknown action type: ${cmd.type}` }, { status: 400 });
      }
    }

    const state = battle.state;
    const turnNumber = (battle.turnNumber ?? 0) + 1;
    const rngSeed = `${runId}:turn${turnNumber}:rng${state.rngCallCount ?? 0}`;
    const rng = makeRng(rngSeed);
    const log = [];
    const actionOrder = [];

    const allowEnemySwitch = !state.enemySwitchUsed;
    const actions = buildActions(playerCommands, state, rng, allowEnemySwitch);

    for (const a of actions) {
      actionOrder.push(`${a.side}:${a.isSwitch ? "switch" : a.move?.id ?? "?"} (activeIdx ${a.activeIdx}, pri ${a.priority}, spd ${a.speed})`);
    }

    // ── Resolve actions ────────────────────────────────────────────────────────
    for (const action of actions) {
      const { side, activeIdx, isSwitch } = action;
      const sideState = side === "player" ? state.player : state.enemy;
      const poke = sideState.active[activeIdx];
      if (!poke || poke.fainted) continue;

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
          // Enemy switch
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

      // ── Move ────────────────────────────────────────────────────────────────
      const { move } = action;
      const targetSide = side === "player" ? "enemy" : "player";
      const originalTargetSlot = side === "player" ? (action.enemyTargetIdx ?? 0) : (action.playerTargetIdx ?? 0);
      let effectiveTargetSlot = originalTargetSlot;
      let retargeted = false;

      if (!isValidTarget(state, targetSide, originalTargetSlot)) {
        const smart = chooseSmartTarget(state, poke, move, targetSide);
        if (!smart) continue; // no valid targets at all
        effectiveTargetSlot = smart.slot;
        retargeted = true;
        const targetSideState = targetSide === "enemy" ? state.enemy : state.player;
        const newTargetName = targetSideState.active[effectiveTargetSlot]?.name ?? "???";
        const attackerLabel = side === "player" ? `Your ${poke.name}` : `Rival's ${poke.name}`;
        log.push(`Target fainted — ${attackerLabel} retargeted to ${newTargetName}!`);
      }

      const targetSideState = targetSide === "enemy" ? state.enemy : state.player;
      const target = targetSideState.active[effectiveTargetSlot];
      if (!target || target.fainted) continue;

      // Store retarget info for replay/debug
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
            // Player KO'd an enemy — auto-replace enemy from bench
            autoReplace(state.enemy, effectiveTargetSlot, "Rival", log);
          } else {
            // Enemy KO'd a player mon — set pendingReplacement, do NOT auto-replace
            if (!state.pendingReplacement) {
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

    // ── End-of-turn: burn/poison DOT ──────────────────────────────────────────
    for (let ai = 0; ai < state.enemy.active.length; ai++) {
      const poke = state.enemy.active[ai];
      if (!poke || poke.fainted) continue;
      if (poke.status === "burn" || poke.status === "poison") {
        const dot = Math.max(1, Math.floor(poke.maxHp / 8));
        poke.currentHp = Math.max(0, poke.currentHp - dot);
        log.push(`Rival's ${poke.name} took ${dot} damage from ${poke.status}!`);
        if (poke.currentHp === 0) {
          poke.fainted = true;
          log.push(`Rival's ${poke.name} fainted!`);
          autoReplace(state.enemy, ai, "Rival", log);
        }
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
          if (!state.pendingReplacement) {
            state.pendingReplacement = { side: "player", slot: ai, faintedName: poke.name, reason: "status" };
          }
        }
      }
    }

    // ── Check victory ──────────────────────────────────────────────────────────
    const playerAllFainted = state.player.active.every(p => !p || p.fainted) && state.player.bench.every(p => !p || p.fainted);
    const enemyAllFainted  = state.enemy.active.every(p => !p || p.fainted) && state.enemy.bench.every(p => !p || p.fainted);
    let winner = null;
    if (playerAllFainted) { winner = "enemy";  log.push("All your Pokémon fainted! You lost!"); }
    if (enemyAllFainted)  { winner = "player"; log.push("All enemy Pokémon fainted! You won!"); }

    const rngUsed = rng.getCallCount();
    state.winner = winner;
    state.turnLog = log;
    state.rngCallCount = (state.rngCallCount ?? 0) + rngUsed;
    state.lastActionOrder = actionOrder;
    state.lastRngUsed = rngUsed;

    const newStatus = winner ? "finished" : "active";
    const updatePayload = { state, turnNumber, status: newStatus };
    if (winner) updatePayload.endedAt = new Date().toISOString();

    await base44.entities.Battle.update(battleId, updatePayload);

    // ── Log battle_turn_commit RunAction ───────────────────────────────────────
    const runs = await base44.asServiceRole.entities.Run.filter({ id: runId });
    const run = runs[0];
    const nextIdx = (run?.nextActionIdx ?? 0) + 1;
    await Promise.all([
      base44.asServiceRole.entities.RunAction.create({
        runId, idx: nextIdx,
        actionType: "battle_turn_commit",
        payload: { battleId, turnNumber, playerCommands, log, rngUsed, actionOrder, retargets: actions.filter(a => a.wasRetargeted).map(a => ({ side: a.side, activeIdx: a.activeIdx, originalTargetSlot: a.originalTargetSlot, finalTargetSlot: a.finalTargetSlot })) },
      }),
      base44.asServiceRole.entities.Run.update(runId, { nextActionIdx: nextIdx }),
    ]);

    // ── If battle ended, write battle_end summary ──────────────────────────────
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

    return Response.json({ state, turnNumber, winner, log, rngUsed, actionOrder });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});