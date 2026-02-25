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

// ── Damage formula (Gen 9 simplified) ────────────────────────────────────────
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

// ── Enemy AI (deterministic) ──────────────────────────────────────────────────
function enemyAI(enemyPoke, playerActiveSlots, state) {
  const targets = playerActiveSlots.filter(i => !state.player.team[i]?.fainted);
  if (targets.length === 0) return null;
  const targetSlot = targets[0];
  const target = state.player.team[targetSlot];

  let bestMove = enemyPoke.moves[0];
  let bestScore = -1;
  for (const mv of enemyPoke.moves) {
    if (!mv.power) continue;
    const eff = effectiveness(mv.type, target.types);
    const stab = enemyPoke.types.includes(mv.type) ? 1.5 : 1;
    const score = mv.power * eff * stab;
    if (score > bestScore) { bestScore = score; bestMove = mv; }
  }
  return { actorSlot: -1, type: "move", moveId: bestMove.id, target: { side: "player", slot: targetSlot } };
}

// ── Auto-send first available bench Pokémon ───────────────────────────────────
function autoReplace(sideState, faintedSlotIdx) {
  const bench = sideState.team.findIndex((p, i) => !p.fainted && !sideState.active.includes(i));
  if (bench === -1) return null;
  const activeIdx = sideState.active.indexOf(faintedSlotIdx);
  if (activeIdx === -1) return null;
  sideState.active[activeIdx] = bench;
  return bench;
}

// ── Build ordered action list ─────────────────────────────────────────────────
function buildActions(playerCommands, state, rng) {
  const actions = [];

  // Switches go first (priority +7 effectively)
  const SWITCH_PRIORITY = 7;

  for (const cmd of playerCommands) {
    const poke = state.player.team[cmd.actorSlot];
    if (!poke || poke.fainted) continue;

    if (cmd.type === "switch") {
      actions.push({ side: "player", slotIndex: cmd.actorSlot, poke, cmd, priority: SWITCH_PRIORITY, speed: poke.baseStats.spe, isSwitch: true });
    } else {
      const move = poke.moves.find(m => m.id === cmd.moveId);
      if (!move) continue;
      actions.push({ side: "player", slotIndex: cmd.actorSlot, poke, move, cmd, priority: move.priority, speed: poke.baseStats.spe, isSwitch: false });
    }
  }

  // Enemy AI (moves only for now)
  const enemyActiveSlots = state.enemy.active.filter(i => !state.enemy.team[i]?.fainted);
  for (const ei of enemyActiveSlots) {
    const poke = state.enemy.team[ei];
    const cmd = enemyAI(poke, state.player.active, state);
    if (!cmd) continue;
    const move = poke.moves.find(m => m.id === cmd.moveId);
    if (!move) continue;
    actions.push({ side: "enemy", slotIndex: ei, poke, move, cmd, priority: move.priority, speed: poke.baseStats.spe, isSwitch: false });
  }

  // Sort: priority desc, speed desc, rng tie-break
  actions.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.speed !== a.speed) return b.speed - a.speed;
    return rng.next() - 0.5;
  });

  return actions;
}

// ── Validate switch command ───────────────────────────────────────────────────
function validateSwitch(cmd, state) {
  const { actorSlot, target } = cmd;
  const benchSlot = target?.slot;
  if (benchSlot === undefined || benchSlot === null) return "Switch missing target.slot (bench index).";
  const bench = state.player.team[benchSlot];
  if (!bench) return `No Pokémon at bench slot ${benchSlot}.`;
  if (bench.fainted) return `${bench.name} has fainted and cannot be switched in.`;
  if (state.player.active.includes(benchSlot)) return `${bench.name} is already active.`;
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

    // Load battle
    const battles = await base44.entities.Battle.filter({ id: battleId });
    const battle = battles[0];
    if (!battle) return Response.json({ error: "Battle not found" }, { status: 404 });
    if (battle.status !== "active") return Response.json({ error: "Battle already finished" }, { status: 400 });

    // Validate commands
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

    const actions = buildActions(playerCommands, state, rng);

    // Record action order for debug
    for (const a of actions) {
      actionOrder.push(`${a.side}:${a.isSwitch ? "switch" : a.move?.id ?? "?"} (slot ${a.slotIndex}, pri ${a.priority}, spd ${a.speed})`);
    }

    // ── Resolve actions ───────────────────────────────────────────────────────
    for (const action of actions) {
      const { side, slotIndex, poke, isSwitch } = action;
      if (poke.fainted) continue;

      if (isSwitch) {
        // Resolve switch
        const sideState = state.player;
        const benchSlot = action.cmd.target.slot;
        const benchPoke = sideState.team[benchSlot];
        const activeIdx = sideState.active.indexOf(slotIndex);
        if (activeIdx !== -1 && benchPoke && !benchPoke.fainted && !sideState.active.includes(benchSlot)) {
          sideState.active[activeIdx] = benchSlot;
          log.push(`${poke.name} was recalled. ${benchPoke.name} was sent out!`);
        }
        continue;
      }

      // Resolve move
      const { move } = action;
      const targetSide = action.cmd.target.side === "enemy" ? state.enemy : state.player;
      const targetSlot = action.cmd.target.slot;
      let target = targetSide.team[targetSlot];

      // Retarget if fainted
      if (!target || target.fainted) {
        target = targetSide.team.find(p => !p.fainted) ?? null;
      }
      if (!target) continue;

      if (move.power) {
        const { dmg, typeEff } = calcDamage(poke, move, target, rng);
        target.currentHp = Math.max(0, target.currentHp - dmg);

        const effText = typeEff > 1 ? " It's super effective!" : typeEff < 1 ? " It's not very effective..." : "";
        log.push(`${poke.name} used ${move.name}! ${dmg} damage to ${target.name}.${effText}`);

        const mv = poke.moves.find(m => m.id === move.id);
        if (mv) mv.currentPp = Math.max(0, (mv.currentPp ?? move.pp) - 1);

        if (target.currentHp === 0) {
          target.fainted = true;
          log.push(`${target.name} fainted!`);

          // Auto-replace fainted Pokémon
          const faintedSide = action.cmd.target.side === "enemy" ? state.enemy : state.player;
          const faintedSlotIdx = faintedSide.team.indexOf(target);
          const newSlot = autoReplace(faintedSide, faintedSlotIdx);
          if (newSlot !== null) {
            log.push(`${faintedSide.team[newSlot].name} was sent in!`);
          }
        }
      } else {
        log.push(`${poke.name} used ${move.name}!`);
        const mv = poke.moves.find(m => m.id === move.id);
        if (mv) mv.currentPp = Math.max(0, (mv.currentPp ?? move.pp) - 1);
      }
    }

    // ── End-of-turn: burn/poison DOT ─────────────────────────────────────────
    for (const sideState of [state.player, state.enemy]) {
      for (const poke of sideState.team) {
        if (poke.fainted) continue;
        if (poke.status === "burn" || poke.status === "poison") {
          const dot = Math.max(1, Math.floor(poke.maxHp / 8));
          poke.currentHp = Math.max(0, poke.currentHp - dot);
          log.push(`${poke.name} took ${dot} damage from ${poke.status}!`);
          if (poke.currentHp === 0) {
            poke.fainted = true;
            log.push(`${poke.name} fainted!`);
            // Auto-replace after DOT faint
            const sIdx = sideState.team.indexOf(poke);
            const newSlot = autoReplace(sideState, sIdx);
            if (newSlot !== null) log.push(`${sideState.team[newSlot].name} was sent in!`);
          }
        }
      }
    }

    // ── Check victory ─────────────────────────────────────────────────────────
    const playerAllFainted = state.player.team.every(p => p.fainted);
    const enemyAllFainted  = state.enemy.team.every(p => p.fainted);
    let winner = null;
    if (playerAllFainted) { winner = "enemy";  log.push("All your Pokémon have fainted! You lost the battle!"); }
    if (enemyAllFainted)  { winner = "player"; log.push("All enemy Pokémon have fainted! You won the battle!"); }

    const rngUsed = rng.getCallCount();
    state.winner = winner;
    state.turnLog = log;
    state.rngCallCount = (state.rngCallCount ?? 0) + rngUsed;
    state.lastActionOrder = actionOrder;
    state.lastRngUsed = rngUsed;

    const newStatus = winner ? "finished" : "active";
    const updatePayload = {
      state,
      turnNumber,
      status: newStatus,
    };
    if (winner) updatePayload.endedAt = new Date().toISOString();

    await base44.entities.Battle.update(battleId, updatePayload);

    // ── Log battle_turn_commit RunAction ──────────────────────────────────────
    const runs = await base44.asServiceRole.entities.Run.filter({ id: runId });
    const run = runs[0];
    const nextIdx = (run?.nextActionIdx ?? 0) + 1;
    await Promise.all([
      base44.asServiceRole.entities.RunAction.create({
        runId,
        idx: nextIdx,
        actionType: "battle_turn_commit",
        payload: { battleId, turnNumber, log, rngUsed, actionOrder },
      }),
      base44.asServiceRole.entities.Run.update(runId, { nextActionIdx: nextIdx }),
    ]);

    // ── If battle ended, write battle_end RunAction and summary ───────────────
    if (winner) {
      const playerFaints = state.player.team.filter(p => p.fainted).length;
      const enemyFaints  = state.enemy.team.filter(p => p.fainted).length;
      const summary = { winner, turns: turnNumber, playerFaints, enemyFaints };

      const endIdx = nextIdx + 1;
      await Promise.all([
        base44.asServiceRole.entities.RunAction.create({
          runId,
          idx: endIdx,
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