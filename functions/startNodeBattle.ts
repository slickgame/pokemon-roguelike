import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── DB Bundle (mirrors components/db/dbLoader) ────────────────────────────────
const DB_SPECIES = [
  { id: 1,  name: "Bulbasaur",  types: ["grass","poison"],  baseStats: { hp:45, atk:49, def:49, spa:65, spd:65, spe:45 }, abilities: ["overgrow"] },
  { id: 4,  name: "Charmander", types: ["fire"],            baseStats: { hp:39, atk:52, def:43, spa:60, spd:50, spe:65 }, abilities: ["blaze"] },
  { id: 7,  name: "Squirtle",   types: ["water"],           baseStats: { hp:44, atk:48, def:65, spa:50, spd:64, spe:43 }, abilities: ["torrent"] },
  { id: 10, name: "Caterpie",   types: ["bug"],             baseStats: { hp:45, atk:30, def:35, spa:20, spd:20, spe:45 }, abilities: ["shield_dust"] },
  { id: 25, name: "Pikachu",    types: ["electric"],        baseStats: { hp:35, atk:55, def:40, spa:50, spd:50, spe:90 }, abilities: ["static"] },
];

// ── Learnset registry (authoritative source for starter + level-up moves) ─────
const LEARNSETS = {
  1:  { startMoves: ["tackle","growl"],          levelUp: [{ level: 7, moveId: "vine_whip" }] },
  4:  { startMoves: ["scratch","growl"],         levelUp: [{ level: 7, moveId: "ember" }] },
  7:  { startMoves: ["tackle","tail_whip"],      levelUp: [{ level: 7, moveId: "water_gun" }] },
  10: { startMoves: ["tackle","string_shot"],    levelUp: [] },
  25: { startMoves: ["thunder_shock","growl"],   levelUp: [{ level: 9, moveId: "quick_attack" }] },
};
const DB_MOVES = [
  { id: "tackle",        name: "Tackle",       type: "normal",   category: "physical", power: 40,   accuracy: 100, pp: 35, priority: 0, target: "single" },
  { id: "scratch",       name: "Scratch",      type: "normal",   category: "physical", power: 40,   accuracy: 100, pp: 35, priority: 0, target: "single" },
  { id: "ember",         name: "Ember",        type: "fire",     category: "special",  power: 40,   accuracy: 100, pp: 25, priority: 0, target: "single" },
  { id: "growl",         name: "Growl",        type: "normal",   category: "status",   power: null, accuracy: 100, pp: 40, priority: 0, target: "all_opponents" },
  { id: "vine_whip",     name: "Vine Whip",    type: "grass",    category: "physical", power: 45,   accuracy: 100, pp: 25, priority: 0, target: "single" },
  { id: "water_gun",     name: "Water Gun",    type: "water",    category: "special",  power: 40,   accuracy: 100, pp: 25, priority: 0, target: "single" },
  { id: "thunder_shock", name: "ThunderShock", type: "electric", category: "special",  power: 40,   accuracy: 100, pp: 30, priority: 0, target: "single" },
  { id: "quick_attack",  name: "Quick Attack", type: "normal",   category: "physical", power: 40,   accuracy: 100, pp: 30, priority: 1, target: "single" },
  { id: "string_shot",   name: "String Shot",  type: "bug",      category: "status",   power: null, accuracy: 95,  pp: 40, priority: 0, target: "all_opponents" },
  { id: "tail_whip",     name: "Tail Whip",    type: "normal",   category: "status",   power: null, accuracy: 100, pp: 30, priority: 0, target: "all_opponents" },
];
const MVP_CONFIG = { allowedSpeciesIds: [1, 4, 7, 10, 25] };

const NATURES = ["Hardy","Lonely","Brave","Adamant","Naughty","Bold","Docile","Relaxed","Impish","Lax","Timid","Hasty","Serious","Jolly","Naive","Modest","Mild","Quiet","Bashful","Rash","Calm","Gentle","Sassy","Careful","Quirky"];

const GENDER_RATIOS: Record<number, { male: number; female: number; genderless?: boolean }> = {
  1:  { male: 0.875, female: 0.125 }, // Bulbasaur
  4:  { male: 0.875, female: 0.125 }, // Charmander
  7:  { male: 0.875, female: 0.125 }, // Squirtle
  10: { male: 0.5,   female: 0.5   }, // Caterpie
  25: { male: 0.5,   female: 0.5   }, // Pikachu
};

function rollGender(speciesId: number, rng: () => number) {
  const ratio = GENDER_RATIOS[speciesId];
  if (!ratio) return rng() < 0.5 ? "Male" : "Female";
  if (ratio.genderless) return "Genderless";
  return rng() < ratio.male ? "Male" : "Female";
}

const _speciesMap = {};
for (const s of DB_SPECIES) _speciesMap[s.id] = s;
const _movesMap = {};
for (const m of DB_MOVES) _movesMap[m.id] = m;
function getSpeciesById(id) { return _speciesMap[id] ?? null; }
function getMoveById(id)    { return _movesMap[id] ?? null; }

// ── RNG ───────────────────────────────────────────────────────────────────────
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

// ── Move selection from learnset registry ────────────────────────────────────
function buildMoveset(species) {
  const learnset = LEARNSETS[species.id] ?? { startMoves: ["tackle"], levelUp: [] };
  const moves = learnset.startMoves
    .map(id => getMoveById(id))
    .filter(Boolean)
    .slice(0, 4)
    .map(m => ({ ...m, currentPp: m.pp }));
  if (moves.length === 0) {
    const tackle = getMoveById("tackle");
    moves.push({ ...tackle, currentPp: tackle.pp });
  }
  return moves;
}

// ── Sanitize player actives: replace fainted active slots with healthy bench ──
// Works on the battle-ready active/bench arrays (not partyState snapshots).
// Returns { active, bench } with fainted slots filled from bench if possible.
function sanitizeActives(active, bench) {
  const newActive = [...active];
  const newBench  = [...bench];

  for (let i = 0; i < newActive.length; i++) {
    const p = newActive[i];
    const needsSwap = !p || p.fainted || (p.currentHp ?? 0) <= 0;
    if (!needsSwap) continue;

    // Find first healthy bench candidate
    const benchIdx = newBench.findIndex(b => b && !b.fainted && (b.currentHp ?? 0) > 0);
    if (benchIdx !== -1) {
      // Swap: put bench mon into active slot, put fainted (or null) into bench
      const incoming = newBench[benchIdx];
      newBench[benchIdx] = newActive[i]; // fainted goes to bench
      newActive[i] = incoming;
    } else {
      newActive[i] = null; // no healthy bench mon — empty slot
    }
  }

  return { active: newActive, bench: newBench };
}

// ── Stat computation ──────────────────────────────────────────────────────────
function computeStats(baseStats, level) {
  const cs = (b) => Math.floor((2 * b * level) / 100 + 5);
  const chp = (b) => Math.floor((2 * b * level) / 100) + level + 10;
  return {
    hp:  chp(baseStats.hp),
    atk: cs(baseStats.atk),
    def: cs(baseStats.def),
    spa: cs(baseStats.spa),
    spd: cs(baseStats.spd),
    spe: cs(baseStats.spe),
  };
}

// ── Build Pokémon from species + level (fresh, used for enemies) ──────────────
function buildFreshPokemon(species, level, subSeed) {
  const rng = makeRng(subSeed);
  const nature = NATURES[rngInt(rng, NATURES.length)];
  const abilityId = species.abilities[rngInt(rng, species.abilities.length)];
  const shiny = rngInt(rng, 1024) === 0;
  const gender = rollGender(species.id, rng);
  const moves = buildMoveset(species);

  const ivs = {
    hp: 0,
    atk: 0,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 0,
  };

  const evs = {
    hp: 0,
    atk: 0,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 0,
  };

  const stats = computeStats(species.baseStats, level);

  return {
    speciesId: species.id,
    name: species.name,
    types: species.types,
    level,
    exp: 0,
    nature,
    abilityId,
    gender,
    shiny,
    ivs,
    evs,
    baseStats: species.baseStats,
    stats: {
      hp: stats.hp,
      atk: stats.atk,
      def: stats.def,
      spa: stats.spa,
      spd: stats.spd,
      spe: stats.spe,
    },
    maxHp: stats.hp,
    currentHp: stats.hp,
    status: null,
    statusTurns: 0,
    heldItem: null,
    moves,
    fainted: false,
  };
}

// ── Hydrate player Pokémon from partyState snapshot ───────────────────────────
function hydrateFromPartyState(partySnap, speciesMap) {
  const sp = speciesMap[partySnap.speciesId];
  if (!sp) return null;

  const moves = (partySnap.moves ?? [])
    .map((m) => {
      const dbMove = getMoveById(m.id);
      if (!dbMove) return null;
      return {
        ...dbMove,
        currentPp: m.pp,
        pp: m.ppMax ?? dbMove.pp,
      };
    })
    .filter(Boolean);

  if (moves.length === 0) {
    moves.push(...buildMoveset(sp));
  }

  const level = partySnap.level ?? 5;
  const exp = partySnap.exp ?? 0;
  const ivs = partySnap.ivs ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const evs = partySnap.evs ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const baseStats = partySnap.baseStats ?? sp.baseStats;
  const freshStats = computeStats(baseStats, level);

  const storedStats = partySnap.stats ?? null;
  const resolvedStats = {
    hp: storedStats?.hp ?? freshStats.hp,
    atk: storedStats?.atk ?? freshStats.atk,
    def: storedStats?.def ?? freshStats.def,
    spa: storedStats?.spa ?? freshStats.spa,
    spd: storedStats?.spd ?? freshStats.spd,
    spe: storedStats?.spe ?? freshStats.spe,
  };

  const maxHp = resolvedStats.hp;
  const currentHp = partySnap.fainted
    ? 0
    : Math.max(0, Math.min(partySnap.currentHP ?? maxHp, maxHp));

  return {
    speciesId: sp.id,
    name: partySnap.name ?? sp.name,
    types: partySnap.types ?? sp.types,
    level,
    exp,
    nature: partySnap.nature ?? "Hardy",
    abilityId: partySnap.abilityId ?? sp.abilities[0],
    gender: partySnap.gender ?? "Male",
    shiny: partySnap.shiny ?? false,
    ivs,
    evs,
    baseStats,
    stats: resolvedStats,
    maxHp,
    currentHp,
    status: partySnap.status ?? null,
    statusTurns: 0,
    heldItem: partySnap.heldItem ?? null,
    moves,
    fainted: partySnap.fainted ?? false,
  };
}

// ── Initialize partyState for a fresh run ─────────────────────────────────────
function initPartyState(pickedIds, benchSpecies, seed) {
  const allSpecies = [
    ...pickedIds.map((sid, i) => ({
      sid,
      seed: `${seed}:player:active:${i}:${sid}`,
      level: 5,
    })),
    ...benchSpecies.map((sp, i) => ({
      sid: sp.id,
      seed: `${seed}:player:bench:${i}:${sp.id}`,
      level: 5,
    })),
  ];

  return allSpecies
    .map(({ sid, seed: subSeed, level }) => {
      const sp = _speciesMap[sid];
      if (!sp) return null;

      const poke = buildFreshPokemon(sp, level, subSeed);

      return {
        speciesId: poke.speciesId,
        name: poke.name,
        level: poke.level,
        exp: poke.exp ?? 0,
        gender: poke.gender ?? "Male",
        types: poke.types ?? [],
        nature: poke.nature ?? "Hardy",
        abilityId: poke.abilityId ?? null,
        shiny: poke.shiny ?? false,
        ivs: poke.ivs ?? {
          hp: 0,
          atk: 0,
          def: 0,
          spa: 0,
          spd: 0,
          spe: 0,
        },
        evs: poke.evs ?? {
          hp: 0,
          atk: 0,
          def: 0,
          spa: 0,
          spd: 0,
          spe: 0,
        },
        baseStats: poke.baseStats ?? sp.baseStats,
        stats: poke.stats ?? null,
        currentHP: poke.maxHp,
        maxHP: poke.maxHp,
        fainted: false,
        status: null,
        heldItem: null,
        moves: poke.moves.map((m) => ({
          id: m.id,
          pp: m.pp,
          ppMax: m.pp,
        })),
      };
    })
    .filter(Boolean);
}

const TIER_LEVEL        = { weak: 5, avg: 6, skilled: 7, boss: 9 };
const TIER_ACTIVE_COUNT = { weak: 1, avg: 2, skilled: 3, boss: 3 };
const TIER_TRAINER_NAME = { weak: "Youngster", avg: "Camper", skilled: "Ace Trainer", boss: "Gym Leader" };


const GYM_LEADERS = {
  gym1: {
    trainerType: "gym",
    trainerId: "gym1",
    trainerName: "Leader Brock",
    aiTier: "boss",
    roster: [
      { speciesId: 7, level: 9, moves: ["tackle", "tail_whip", "water_gun"] },
      { speciesId: 1, level: 9, moves: ["tackle", "growl", "vine_whip"] },
      { speciesId: 4, level: 9, moves: ["scratch", "growl", "ember"] },
    ],
  },
  gym2: {
    trainerType: "gym",
    trainerId: "gym2",
    trainerName: "Leader Misty",
    aiTier: "boss",
    roster: [
      { speciesId: 7, level: 10, moves: ["tackle", "tail_whip", "water_gun"] },
      { speciesId: 25, level: 10, moves: ["thunder_shock", "growl", "quick_attack"] },
      { speciesId: 1, level: 10, moves: ["tackle", "growl", "vine_whip"] },
    ],
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, nodeId, nodeType, tier, routeId, pendingEncounter } = await req.json();
    if (!runId || !nodeId) return Response.json({ error: "runId and nodeId required" }, { status: 400 });

    const runs = await base44.entities.Run.filter({ id: runId });
    const run = runs[0];
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    if (run.playerId !== user.id && user.role !== "admin")
      return Response.json({ error: "Forbidden" }, { status: 403 });

    const actions = await base44.asServiceRole.entities.RunAction.filter({ runId });
    actions.sort((a, b) => a.idx - b.idx);

    const pickedIds = [];
    for (const a of actions) {
      if (a.actionType === "starter_pick" && a.payload?.speciesId) {
        pickedIds.push(Number(a.payload.speciesId));
      }
    }
    const hasConfirm = actions.some(a => a.actionType === "starter_confirm");
    if (!hasConfirm || pickedIds.length < 3) {
      return Response.json({ error: "Starters not confirmed" }, { status: 400 });
    }

    const allowedSpecies = MVP_CONFIG.allowedSpeciesIds.map(id => getSpeciesById(id)).filter(Boolean);
    const isGym = nodeType === "gym" || tier === "boss";
    const resolvedTier = tier ?? (isGym ? "boss" : "weak");
    const level = TIER_LEVEL[resolvedTier] ?? TIER_LEVEL.weak;
    const activeCount = TIER_ACTIVE_COUNT[resolvedTier] ?? 1;
    const benchCount = Math.min(activeCount, 2);
    const trainerName = TIER_TRAINER_NAME[resolvedTier] ?? "Trainer";
    const routeIndex = Number((run.results?.progress?.routeIndex ?? 1));
    const defaultGymId = routeIndex >= 2 ? "gym2" : "gym1";
    const gymProfile = isGym
      ? (pendingEncounter?.trainerType === "gym" && pendingEncounter?.trainerId
        ? {
            trainerType: "gym",
            trainerId: pendingEncounter.trainerId,
            trainerName: pendingEncounter.trainerName ?? GYM_LEADERS[pendingEncounter.trainerId]?.trainerName ?? "Gym Leader",
            aiTier: pendingEncounter.aiTier ?? "boss",
            roster: Array.isArray(pendingEncounter.roster) && pendingEncounter.roster.length > 0
              ? pendingEncounter.roster
              : (GYM_LEADERS[pendingEncounter.trainerId]?.roster ?? GYM_LEADERS[defaultGymId].roster),
          }
        : GYM_LEADERS[defaultGymId])
      : null;

    // ── Player team: hydrate from partyState or init fresh ──────────────────
    const existingProgress = run.results?.progress ?? {};
    const existingPartyState = existingProgress.partyState ?? null;

    const playerBenchPool = deterministicShuffle(
      allowedSpecies.filter(s => !pickedIds.includes(s.id)),
      makeRng(`${run.seed}:player:bench_select`)
    );

    let playerActive;
    let playerBench;
    let newPartyState = null;

    if (existingPartyState && existingPartyState.length >= 3) {
      // Hydrate from persisted state (respects HP/PP/fainted)
      const allHydrated = existingPartyState.map(snap => hydrateFromPartyState(snap, _speciesMap)).filter(Boolean);
      const rawActive = allHydrated.slice(0, 3);
      const rawBench  = allHydrated.slice(3, 6);
      // Auto-fill fainted active slots with healthy bench mons
      const sanitized = sanitizeActives(rawActive, rawBench);
      playerActive = sanitized.active;
      playerBench  = sanitized.bench;
      // Pad if needed
      while (playerActive.filter(Boolean).length < 3) {
        const extra = playerBenchPool[playerActive.length];
        if (!extra) break;
        playerActive.push(buildFreshPokemon(extra, 5, `${run.seed}:player:extra:${playerActive.length}`));
      }
    } else {
      // Init fresh
      playerActive = pickedIds.slice(0, 3).map((sid, i) => {
        const sp = getSpeciesById(sid);
        if (!sp) return null;
        return buildFreshPokemon(sp, 5, `${run.seed}:player:active:${i}:${sid}`);
      }).filter(Boolean);
      playerBench = playerBenchPool.slice(0, 3).map((sp, i) =>
        buildFreshPokemon(sp, 5, `${run.seed}:player:bench:${i}:${sp.id}`)
      );
      // Save initialized party state so future battles can persist it
      newPartyState = initPartyState(pickedIds, playerBenchPool.slice(0, 3), run.seed);
    }

    // ── Enemy team ───────────────────────────────────────────────────────────
    const enemySeed = `${run.seed}:${routeId ?? "route1"}:${nodeId}:enemy`;
    const enemyRng  = makeRng(enemySeed);

    let enemyActive;
    let enemyBench;
    if (gymProfile) {
      const roster = gymProfile.roster.slice(0, 3);
      enemyActive = roster.map((slot, i) => {
        const sp = getSpeciesById(Number(slot.speciesId));
        if (!sp) return null;
        const poke = buildFreshPokemon(sp, slot.level ?? level, `${enemySeed}:gym:${i}:${sp.id}`);
        const forcedMoves = (slot.moves ?? []).map(id => getMoveById(id)).filter(Boolean).slice(0, 4);
        if (forcedMoves.length > 0) {
          poke.moves = forcedMoves.map(m => ({ ...m, currentPp: m.pp }));
        }
        return poke;
      }).filter(Boolean);
      enemyBench = [];
    } else {
      const enemyPool = deterministicShuffle(
        allowedSpecies.filter(s => !pickedIds.includes(s.id)),
        enemyRng
      );
      const fullPool = enemyPool.length >= activeCount + benchCount
        ? enemyPool
        : deterministicShuffle([...allowedSpecies], makeRng(`${enemySeed}:fallback`));

      enemyActive = fullPool.slice(0, activeCount).map((sp, i) =>
        buildFreshPokemon(sp, level, `${enemySeed}:active:${i}:${sp.id}`)
      );
      enemyBench = fullPool.slice(activeCount, activeCount + benchCount).map((sp, i) =>
        buildFreshPokemon(sp, level, `${enemySeed}:bench:${i}:${sp.id}`)
      );
    }

    const sanitizedPlayer = sanitizeActives(playerActive, playerBench);
    const sanitizedEnemy = sanitizeActives(enemyActive, enemyBench);

    const battleState = {
      player: { active: sanitizedPlayer.active, bench: sanitizedPlayer.bench },
      enemy:  { active: sanitizedEnemy.active,  bench: sanitizedEnemy.bench, trainerName: gymProfile?.trainerName ?? trainerName, trainerType: gymProfile?.trainerType ?? "trainer", trainerId: gymProfile?.trainerId ?? null, aiTier: gymProfile?.aiTier ?? resolvedTier },
      turnLog: [], rngCallCount: 0, winner: null, enemySwitchUsed: false,
      nodeId, routeId: routeId ?? "route1",
    };

    const battle = await base44.entities.Battle.create({
      runId, status: "active", turnNumber: 0,
      state: battleState, startedAt: new Date().toISOString(),
    });

    let canonicalPending = {
      nodeId,
      nodeType: nodeType ?? "trainer",
      tier: resolvedTier,
      battleId: battle.id,
      routeId: routeId ?? "route1",
      status: "pending",
      createdAt: new Date().toISOString(),
      ...(gymProfile ? {
        trainerType: gymProfile.trainerType,
        trainerId: gymProfile.trainerId,
        trainerName: gymProfile.trainerName,
        roster: gymProfile.roster,
        aiTier: gymProfile.aiTier,
      } : {}),
    };

    // Persist partyState + pending encounter for this node.
  const allHydratedForPersist = [...sanitizedPlayer.active, ...sanitizedPlayer.bench].filter(Boolean);
  const updatedPartyState = newPartyState ?? (allHydratedForPersist.length > 0
    ? allHydratedForPersist.map((poke) => ({
        speciesId: poke.speciesId,
        name: poke.name,
        level: poke.level ?? 5,
        exp: poke.exp ?? 0,
        gender: poke.gender ?? "Male",
        types: poke.types ?? [],
        nature: poke.nature ?? "Hardy",
        abilityId: poke.abilityId ?? null,
        shiny: poke.shiny ?? false,
        ivs: poke.ivs ?? {
          hp: 0,
          atk: 0,
          def: 0,
          spa: 0,
          spd: 0,
          spe: 0,
        },
        evs: poke.evs ?? {
          hp: 0,
          atk: 0,
          def: 0,
          spa: 0,
          spd: 0,
          spe: 0,
        },
        baseStats: poke.baseStats ?? null,
        stats: poke.stats ?? null,
        currentHP: poke.currentHp ?? 0,
        maxHP: poke.maxHp ?? 1,
        fainted: poke.fainted ?? false,
        status: poke.status ?? null,
        heldItem: poke.heldItem ?? null,
        moves: (poke.moves ?? []).map((m) => ({
          id: m.id,
          pp: m.currentPp ?? m.pp,
          ppMax: m.pp,
        })),
      }))
    : (existingProgress.partyState ?? []));

    await base44.asServiceRole.entities.Run.update(runId, {
      results: {
        ...(run.results ?? {}),
        progress: {
          ...existingProgress,
          partyState: updatedPartyState,
          money: existingProgress.money ?? 0,
          inventory: existingProgress.inventory ?? { potion: 0, revive: 0 },
          pendingEncounter: canonicalPending,
        },
      },
    });

    // Log node_enter action
    const currentRun = (await base44.asServiceRole.entities.Run.filter({ id: runId }))[0];
    const nextIdx = (currentRun?.nextActionIdx ?? 0) + 1;
    await Promise.all([
      base44.asServiceRole.entities.RunAction.create({
        runId, idx: nextIdx,
        actionType: "node_enter",
        payload: { routeId: routeId ?? "route1", nodeId, nodeType: nodeType ?? "trainer", tier: resolvedTier },
      }),
      base44.asServiceRole.entities.Run.update(runId, { nextActionIdx: nextIdx }),
    ]);

    return Response.json({ battleId: battle.id, state: battleState, pendingEncounter: canonicalPending, gymProfile });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});