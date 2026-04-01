import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

import { SPECIES as DB_SPECIES, MOVES as DB_MOVES, LEARNSETS } from "../../../src/shared/staticDb.generated.js";

const NATURE_EFFECTS: Record<
  string,
  { up: string | null; down: string | null }
> = {
  Hardy: { up: null, down: null },
  Lonely: { up: "atk", down: "def" },
  Brave: { up: "atk", down: "spe" },
  Adamant: { up: "atk", down: "spa" },
  Naughty: { up: "atk", down: "spd" },

  Bold: { up: "def", down: "atk" },
  Docile: { up: null, down: null },
  Relaxed: { up: "def", down: "spe" },
  Impish: { up: "def", down: "spa" },
  Lax: { up: "def", down: "spd" },

  Timid: { up: "spe", down: "atk" },
  Hasty: { up: "spe", down: "def" },
  Serious: { up: null, down: null },
  Jolly: { up: "spe", down: "spa" },
  Naive: { up: "spe", down: "spd" },

  Modest: { up: "spa", down: "atk" },
  Mild: { up: "spa", down: "def" },
  Quiet: { up: "spa", down: "spe" },
  Bashful: { up: null, down: null },
  Rash: { up: "spa", down: "spd" },

  Calm: { up: "spd", down: "atk" },
  Gentle: { up: "spd", down: "def" },
  Sassy: { up: "spd", down: "spe" },
  Careful: { up: "spd", down: "spa" },
  Quirky: { up: null, down: null },
};

const speciesMap: Record<number, any> = {};
for (const s of DB_SPECIES) speciesMap[s.id] = s;

const movesMap: Record<string, any> = {};
for (const m of DB_MOVES) movesMap[m.id] = m;

function getMoveById(id: string) {
  return movesMap[id] ?? null;
}

function hashString(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++)
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function makeRng(seedStr: string) {
  let s = hashString(String(seedStr));
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngInt(rng: () => number, max: number) {
  return Math.floor(rng() * max);
}

function rollGender(speciesId: number, rng: () => number) {
  const ratio = GENDER_RATIOS[speciesId];
  if (!ratio) return rng() < 0.5 ? "Male" : "Female";
  if (ratio.genderless) return "Genderless";
  return rng() < ratio.male ? "Male" : "Female";
}

function getNatureModifier(nature: string, statKey: string) {
  const effect = NATURE_EFFECTS[nature] ?? { up: null, down: null };
  if (effect.up === statKey) return 1.1;
  if (effect.down === statKey) return 0.9;
  return 1.0;
}

function computeStats(
  baseStats: any,
  level: number,
  ivs: any = {},
  evs: any = {},
  nature: string = "Hardy",
) {
  function hpStat(base: number, iv = 0, ev = 0) {
    return (
      Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) +
      level +
      10
    );
  }

  function otherStat(statKey: string, base: number, iv = 0, ev = 0) {
    const raw =
      Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
    return Math.floor(raw * getNatureModifier(nature, statKey));
  }

  return {
    hp: hpStat(baseStats.hp, ivs.hp ?? 0, evs.hp ?? 0),
    atk: otherStat("atk", baseStats.atk, ivs.atk ?? 0, evs.atk ?? 0),
    def: otherStat("def", baseStats.def, ivs.def ?? 0, evs.def ?? 0),
    spa: otherStat("spa", baseStats.spa, ivs.spa ?? 0, evs.spa ?? 0),
    spd: otherStat("spd", baseStats.spd, ivs.spd ?? 0, evs.spd ?? 0),
    spe: otherStat("spe", baseStats.spe, ivs.spe ?? 0, evs.spe ?? 0),
  };
}

function buildMoveset(species: any) {
  const learnset = LEARNSETS[species.id] ?? { startMoves: ["tackle"] };
  const moves = learnset.startMoves
    .map((id: string) => getMoveById(id))
    .filter(Boolean)
    .slice(0, 4)
    .map((m: any) => ({
      id: m.id,
      pp: m.pp,
      ppMax: m.pp,
    }));

  if (moves.length === 0) {
    const tackle = getMoveById("tackle");
    moves.push({
      id: tackle.id,
      pp: tackle.pp,
      ppMax: tackle.pp,
    });
  }

  return moves;
}

function buildInitialPartyPokemon(species: any, level: number, seed: string) {
  const rng = makeRng(seed);
  const nature = NATURES[rngInt(rng, NATURES.length)];
  const abilityId = species.abilities[rngInt(rng, species.abilities.length)];
  const shiny = rngInt(rng, 1024) === 0;
  const gender = rollGender(species.id, rng);

  const ivs = {
    hp: rngInt(rng, 32),
    atk: rngInt(rng, 32),
    def: rngInt(rng, 32),
    spa: rngInt(rng, 32),
    spd: rngInt(rng, 32),
    spe: rngInt(rng, 32),
  };

  const evs = {
    hp: 0,
    atk: 0,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 0,
  };

  const stats = computeStats(species.baseStats, level, ivs, evs, nature);

  return {
    speciesId: species.id,
    name: species.name,
    level,
    exp: 0,
    gender,
    types: species.types,
    nature,
    abilityId,
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
    currentHP: stats.hp,
    maxHP: stats.hp,
    fainted: false,
    status: null,
    heldItem: null,
    moves: buildMoveset(species),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { runId, actionType, payload = {} } = body;

    if (!runId || !actionType) {
      return Response.json(
        { error: "runId and actionType are required" },
        { status: 400 },
      );
    }

    const run = await base44.entities.Run.get(runId);
    if (!run) {
      return Response.json({ error: "Run not found" }, { status: 404 });
    }

    if (run.playerId !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (run.status !== "active") {
      return Response.json({ error: "Run is not active" }, { status: 400 });
    }

    const currentIdx = run.nextActionIdx ?? 0;
    await base44.entities.Run.update(runId, { nextActionIdx: currentIdx + 1 });

    await base44.entities.RunAction.create({
      runId,
      idx: currentIdx,
      actionType,
      payload,
    });

    if (actionType === "starter_confirm") {
      const team = Array.isArray(payload?.team) ? payload.team : [];
      const initialPartyState = team
        .map((entry: any, index: number) => {
          const speciesId = Number(entry?.speciesId);
          const species = speciesMap[speciesId];
          if (!species) return null;
          return buildInitialPartyPokemon(
            species,
            5,
            `${run.seed}:starter_confirm:${index}:${speciesId}`,
          );
        })
        .filter(Boolean);

      const existingProgress = run.results?.progress ?? {};

      await base44.entities.Run.update(runId, {
        results: {
          ...(run.results ?? {}),
          progress: {
            ...existingProgress,
            partyState: initialPartyState,
            boxState: existingProgress.boxState ?? [],
            money: 100,
            inventory: {
              potion: 3,
              revive: 0,
              bait: 0,
              pokeball: 3,
              great_ball: 1,
              burn_heal: 0,
            },
          },
        },
      });
    }

    if (actionType === "party_reorder") {
      const nextPartyState = Array.isArray(payload?.partyState)
        ? payload.partyState
        : null;

      if (!nextPartyState) {
        return Response.json(
          { error: "party_reorder requires payload.partyState" },
          { status: 400 },
        );
      }

      const existingProgress = run.results?.progress ?? {};

      await base44.entities.Run.update(runId, {
        results: {
          ...(run.results ?? {}),
          progress: {
            ...existingProgress,
            partyState: nextPartyState,
            boxState: existingProgress.boxState ?? [],
            money: existingProgress.money ?? 100,
            inventory: existingProgress.inventory ?? {
              potion: 3,
              revive: 0,
              bait: 0,
              pokeball: 3,
              great_ball: 1,
              burn_heal: 0,
            },
          },
        },
      });
    }

    if (actionType === "party_box_update") {
      const nextPartyState = Array.isArray(payload?.partyState)
        ? payload.partyState
        : null;
      const nextBoxState = Array.isArray(payload?.boxState)
        ? payload.boxState
        : null;

      if (!nextPartyState || !nextBoxState) {
        return Response.json(
          {
            error:
              "party_box_update requires payload.partyState and payload.boxState",
          },
          { status: 400 },
        );
      }

      const existingProgress = run.results?.progress ?? {};

      await base44.entities.Run.update(runId, {
        results: {
          ...(run.results ?? {}),
          progress: {
            ...existingProgress,
            partyState: nextPartyState,
            boxState: nextBoxState,
            money: existingProgress.money ?? 100,
            inventory: existingProgress.inventory ?? {
              potion: 3,
              revive: 0,
              bait: 0,
              pokeball: 3,
              great_ball: 1,
              burn_heal: 0,
            },
          },
        },
      });
    }

    return Response.json({ ok: true, idx: currentIdx });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
