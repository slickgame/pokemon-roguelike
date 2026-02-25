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
  let s = hashString(String(seedStr));
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Damage formula (Gen 9 simplified) ────────────────────────────────────────
function calcDamage(attacker, move, defender, rng) {
  if (!move.power) return 0;
  const lvl = attacker.level;
  const atkStat = move.category === "physical" ? attacker.baseStats.atk : attacker.baseStats.spa;
  const defStat = move.category === "physical" ? defender.baseStats.def : defender.baseStats.spd;
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const typeEff = effectiveness(move.type, defender.types);
  const roll = 0.85 + rng() * 0.15; // [0.85, 1.00)
  const dmg = Math.max(1, Math.floor(
    Math.floor(Math.floor(2 * lvl / 5 + 2) * move.power * atkStat / defStat / 50 + 2)
    * stab * typeEff * roll
  ));
  return { dmg, typeEff };
}

// ── Enemy AI (deterministic) ──────────────────────────────────────────────────
function enemyAI(enemyPoke, playerActive, state) {
  const targets = playerActive.filter(i => !state.player.team[i].fainted);
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

// ── Build action list for ordering ───────────────────────────────────────────
function buildActions(playerCommands, state, rng) {
  const actions = [];

  // Player actions
  for (const cmd of playerCommands) {
    const poke = state.player.team[cmd.actorSlot];
    if (!poke || poke.fainted) continue;
    const move = poke.moves.find(m => m.id === cmd.moveId);
    if (!move) continue;
    actions.push({ side: "player", slotIndex: cmd.actorSlot, poke, move, cmd, priority: move.priority, speed: poke.baseStats.spe });
  }

  // Enemy AI actions
  const enemyActive = state.enemy.active.filter(i => !state.enemy.team[i].fainted);
  for (const ei of enemyActive) {
    const poke = state.enemy.team[ei];
    const cmd = enemyAI(poke, state.player.active, state);
    if (!cmd) continue;
    const move = poke.moves.find(m => m.id === cmd.moveId);
    if (!move) continue;
    actions.push({ side: "enemy", slotIndex: ei, poke, move, cmd, priority: move.priority, speed: poke.baseStats.spe });
  }

  // Sort: priority desc, speed desc, rng tie-break (deterministic)
  actions.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.speed !== a.speed) return b.speed - a.speed;
    return rng() - 0.5;
  });

  return actions;
}

// ── Auto-send next available bench mon ───────────────────────────────────────
function autoReplace(sideState, faintedIdx) {
  const bench = sideState.team.findIndex((p, i) => !p.fainted && !sideState.active.includes(i));
  if (bench === -1) return null;
  const activeIdx = sideState.active.indexOf(faintedIdx);
  if (activeIdx === -1) return null;
  sideState.active[activeIdx] = bench;
  return bench;
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
      if (cmd.type === "switch") return Response.json({ error: "Switch not implemented in MVP" }, { status: 400 });
      if (cmd.type !== "move") return Response.json({ error: `Unknown action type: ${cmd.type}` }, { status: 400 });
    }

    const state = battle.state;
    const turnNumber = (battle.turnNumber ?? 0) + 1;
    const rngSeed = `${runId}:turn${turnNumber}:rng${state.rngCallCount ?? 0}`;
    const rng = makeRng(rngSeed);
    const log = [];

    const actions = buildActions(playerCommands, state, rng);

    // Resolve actions
    for (const action of actions) {
      const { side, slotIndex, poke, move } = action;
      if (poke.fainted) continue;

      // Determine target
      const targetSide = action.cmd.target.side === "enemy" ? state.enemy : state.player;
      const targetSlot = action.cmd.target.slot;
      const target = targetSide.team[targetSlot];
      if (!target || target.fainted) {
        // Retarget to first alive
        const alive = targetSide.team.find(p => !p.fainted);
        if (!alive) continue;
      }

      const actualTarget = target?.fainted ? targetSide.team.find(p => !p.fainted) : target;
      if (!actualTarget) continue;

      if (move.power) {
        const { dmg, typeEff } = calcDamage(poke, move, actualTarget, rng);
        actualTarget.currentHp = Math.max(0, actualTarget.currentHp - dmg);

        const effText = typeEff > 1 ? " It's super effective!" : typeEff < 1 ? " It's not very effective..." : "";
        log.push(`${poke.name} used ${move.name}! ${dmg} damage to ${actualTarget.name}.${effText}`);

        // Decrement PP
        const mv = poke.moves.find(m => m.id === move.id);
        if (mv) mv.currentPp = Math.max(0, (mv.currentPp ?? move.pp) - 1);

        if (actualTarget.currentHp === 0) {
          actualTarget.fainted = true;
          log.push(`${actualTarget.name} fainted!`);
          // Auto-replace
          const replaceSide = action.cmd.target.side === "enemy" ? state.enemy : state.player;
          const newSlot = autoReplace(replaceSide, replaceSide.team.indexOf(actualTarget));
          if (newSlot !== null) log.push(`${replaceSide.team[newSlot].name} was sent in!`);
        }
      } else {
        // Status/non-damaging move
        log.push(`${poke.name} used ${move.name}!`);
        const mv = poke.moves.find(m => m.id === move.id);
        if (mv) mv.currentPp = Math.max(0, (mv.currentPp ?? move.pp) - 1);
      }
    }

    // End-of-turn: burn/poison
    for (const side of [state.player, state.enemy]) {
      for (const poke of side.team) {
        if (poke.fainted) continue;
        if (poke.status === "burn" || poke.status === "poison") {
          const dot = Math.max(1, Math.floor(poke.maxHp / 8));
          poke.currentHp = Math.max(0, poke.currentHp - dot);
          log.push(`${poke.name} took ${dot} damage from ${poke.status}!`);
          if (poke.currentHp === 0) {
            poke.fainted = true;
            log.push(`${poke.name} fainted!`);
          }
        }
      }
    }

    // Check victory
    const playerAllFainted = state.player.team.every(p => p.fainted);
    const enemyAllFainted  = state.enemy.team.every(p => p.fainted);
    let winner = null;
    if (playerAllFainted) { winner = "enemy"; log.push("You lost the battle!"); }
    if (enemyAllFainted)  { winner = "player"; log.push("You won the battle!"); }

    state.winner = winner;
    state.turnLog = log;
    state.rngCallCount = (state.rngCallCount ?? 0) + 1;

    const newStatus = winner ? "finished" : "active";
    await base44.entities.Battle.update(battleId, {
      state,
      turnNumber,
      status: newStatus,
      ...(winner ? { endedAt: new Date().toISOString() } : {}),
    });

    // Log to RunAction
    await base44.entities.RunAction.create({
      runId,
      idx: Date.now(), // monotonic enough for MVP
      actionType: "battle_turn_commit",
      payload: { battleId, turnNumber, playerCommands, log },
    });

    return Response.json({ state, turnNumber, winner, log });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});