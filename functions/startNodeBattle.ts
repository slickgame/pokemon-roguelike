import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { loadDbBundle, getSpeciesById, getMoveById } from './db.js';

const { species: SPECIES, mvpConfig: MVP_CONFIG } = loadDbBundle();

const NATURES = ["Hardy","Lonely","Brave","Adamant","Naughty","Bold","Docile","Relaxed","Impish","Lax","Timid","Hasty","Serious","Jolly","Naive","Modest","Mild","Quiet","Bashful","Rash","Calm","Gentle","Sassy","Careful","Quirky"];

// ── RNG helpers ───────────────────────────────────────────────────────────────
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
function rngInt(rng, max) { return Math.floor(rng() * max); }
function deterministicShuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rngInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Move list builder (from db learnset) ──────────────────────────────────────
function buildMovesForSpecies(species) {
  const learnset = species.learnset ?? [];
  const result = [];

  // 1. Normal attacking move (tackle or scratch)
  const normal = learnset.find(id => id === "tackle" || id === "scratch");
  if (normal) {
    const m = getMoveById(normal);
    if (m) result.push({ ...m, currentPp: m.pp });
  }

  // 2. STAB move (matches primary type, has power, not already added)
  const primaryType = species.types[0];
  const stabId = learnset.find(id => {
    const m = getMoveById(id);
    return m && m.type === primaryType && m.power && !result.some(r => r.id === id);
  });
  if (stabId) {
    const m = getMoveById(stabId);
    if (m) result.push({ ...m, currentPp: m.pp });
  } else {
    // fallback: growl
    const growlId = learnset.find(id => id === "growl" && !result.some(r => r.id === id));
    if (growlId) {
      const m = getMoveById(growlId);
      if (m) result.push({ ...m, currentPp: m.pp });
    }
  }

  return result;
}

// ── Pokémon builder ───────────────────────────────────────────────────────────
function buildPokemon(species, level, subSeed) {
  const rng = makeRng(subSeed);
  const nature = NATURES[rngInt(rng, NATURES.length)];
  const abilityId = species.abilities[rngInt(rng, species.abilities.length)];
  const shiny = rngInt(rng, 1024) === 0;
  const moves = buildMovesForSpecies(species);
  const hp = Math.floor((2 * species.baseStats.hp * level) / 100) + level + 10;
  return {
    speciesId: species.id,
    name: species.name,
    types: species.types,
    level,
    nature,
    abilityId,
    shiny,
    ivs: { hp:0, atk:0, def:0, spa:0, spd:0, spe:0 },
    baseStats: species.baseStats,
    maxHp: hp,
    currentHp: hp,
    status: null,
    statusTurns: 0,
    moves,
    fainted: false,
  };
}

// ── Tier config ───────────────────────────────────────────────────────────────
const TIER_LEVEL        = { weak: 5, avg: 6, skilled: 7, boss: 9 };
const TIER_ACTIVE_COUNT = { weak: 1, avg: 2, skilled: 3, boss: 3 };
const TIER_TRAINER_NAME = { weak: "Youngster", avg: "Lass", skilled: "Ace Trainer", boss: "Gym Leader Brock" };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, nodeId, nodeType, tier, routeId } = await req.json();
    if (!runId || !nodeId) return Response.json({ error: "runId and nodeId required" }, { status: 400 });

    const runs = await base44.entities.Run.filter({ id: runId });
    const run = runs[0];
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    if (run.playerId !== user.id && user.role !== "admin")
      return Response.json({ error: "Forbidden" }, { status: 403 });

    // Confirmed starters
    const actions = await base44.asServiceRole.entities.RunAction.filter({ runId });
    actions.sort((a, b) => a.idx - b.idx);

    const pickedIds = actions
      .filter(a => a.actionType === "starter_pick" && a.payload?.speciesId)
      .map(a => Number(a.payload.speciesId));
    const hasConfirm = actions.some(a => a.actionType === "starter_confirm");
    if (!hasConfirm || pickedIds.length < 3) {
      return Response.json({ error: "Starters not confirmed" }, { status: 400 });
    }

    const isGym = nodeType === "gym" || tier === "boss";
    const level = TIER_LEVEL[tier] ?? TIER_LEVEL.weak;
    const activeCount = TIER_ACTIVE_COUNT[tier] ?? 1;
    const benchCount = Math.min(activeCount, 2);
    const trainerName = TIER_TRAINER_NAME[tier] ?? "Trainer";

    // ── Player team ──────────────────────────────────────────────────────────
    const playerActive = pickedIds.slice(0, 3).map((sid, i) => {
      const sp = getSpeciesById(sid);
      return sp ? buildPokemon(sp, 5, `${run.seed}:player:active:${i}:${sid}`) : null;
    }).filter(Boolean);

    const playerBenchPool = deterministicShuffle(
      SPECIES.filter(s => !pickedIds.includes(s.id)),
      makeRng(`${run.seed}:player:bench_select`)
    );
    const playerBench = playerBenchPool.slice(0, 3).map((sp, i) =>
      buildPokemon(sp, 5, `${run.seed}:player:bench:${i}:${sp.id}`)
    );
    while (playerActive.length < 3) {
      const extra = playerBenchPool[playerActive.length];
      if (!extra) break;
      playerActive.push(buildPokemon(extra, 5, `${run.seed}:player:extra:${playerActive.length}`));
    }

    // ── Enemy team: from allowedSpeciesIds ───────────────────────────────────
    const enemySeed = `${run.seed}:${routeId ?? "route1"}:${nodeId}:enemy`;
    const enemyRng = makeRng(enemySeed);

    const allowedSpecies = MVP_CONFIG.allowedSpeciesIds.map(id => getSpeciesById(id)).filter(Boolean);
    const candidatePool = isGym
      ? allowedSpecies
      : allowedSpecies.filter(s => !pickedIds.includes(s.id));

    let enemyPool = deterministicShuffle(candidatePool, enemyRng);
    if (enemyPool.length < activeCount + benchCount) {
      // pad with full allowed pool if needed
      enemyPool = deterministicShuffle(allowedSpecies, makeRng(enemySeed + ":pad"));
    }

    const enemyActive = enemyPool.slice(0, activeCount).map((sp, i) =>
      buildPokemon(sp, level, `${enemySeed}:active:${i}:${sp.id}`)
    );
    const enemyBench = enemyPool.slice(activeCount, activeCount + benchCount).map((sp, i) =>
      buildPokemon(sp, level, `${enemySeed}:bench:${i}:${sp.id}`)
    );

    const battleState = {
      player: { active: playerActive, bench: playerBench },
      enemy:  { active: enemyActive,  bench: enemyBench  },
      enemyTrainerName: trainerName,
      turnLog: [],
      rngCallCount: 0,
      winner: null,
      enemySwitchUsed: false,
      nodeId,
      routeId: routeId ?? "route1",
    };

    const battle = await base44.entities.Battle.create({
      runId,
      status: "active",
      turnNumber: 0,
      state: battleState,
      startedAt: new Date().toISOString(),
    });

    // Log node_enter
    const currentRun = (await base44.asServiceRole.entities.Run.filter({ id: runId }))[0];
    const nextIdx = (currentRun?.nextActionIdx ?? 0) + 1;
    await Promise.all([
      base44.asServiceRole.entities.RunAction.create({
        runId, idx: nextIdx,
        actionType: "node_enter",
        payload: { routeId: routeId ?? "route1", nodeId, nodeType: nodeType ?? "trainer", tier },
      }),
      base44.asServiceRole.entities.Run.update(runId, { nextActionIdx: nextIdx }),
    ]);

    return Response.json({ battleId: battle.id, state: battleState });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});