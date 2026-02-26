import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DB_SPECIES = [
  { id: 1,  name: "Bulbasaur",  types: ["grass","poison"],  baseStats: { hp:45, atk:49, def:49, spa:65, spd:65, spe:45 }, abilities: ["overgrow"],    learnset: ["tackle","growl","vine_whip"] },
  { id: 4,  name: "Charmander", types: ["fire"],            baseStats: { hp:39, atk:52, def:43, spa:60, spd:50, spe:65 }, abilities: ["blaze"],       learnset: ["scratch","growl","ember"] },
  { id: 7,  name: "Squirtle",   types: ["water"],           baseStats: { hp:44, atk:48, def:65, spa:50, spd:64, spe:43 }, abilities: ["torrent"],     learnset: ["tackle","tail_whip","water_gun"] },
  { id: 10, name: "Caterpie",   types: ["bug"],             baseStats: { hp:45, atk:30, def:35, spa:20, spd:20, spe:45 }, abilities: ["shield_dust"], learnset: ["tackle","string_shot"] },
  { id: 25, name: "Pikachu",    types: ["electric"],        baseStats: { hp:35, atk:55, def:40, spa:50, spd:50, spe:90 }, abilities: ["static"],     learnset: ["thunder_shock","growl","quick_attack"] },
];
const DB_MOVES = [
  { id: "tackle",        name: "Tackle",       type: "normal",   category: "physical", power: 40,   accuracy: 100, pp: 35 },
  { id: "scratch",       name: "Scratch",      type: "normal",   category: "physical", power: 40,   accuracy: 100, pp: 35 },
  { id: "ember",         name: "Ember",        type: "fire",     category: "special",  power: 40,   accuracy: 100, pp: 25 },
  { id: "growl",         name: "Growl",        type: "normal",   category: "status",   power: null, accuracy: 100, pp: 40 },
  { id: "vine_whip",     name: "Vine Whip",    type: "grass",    category: "physical", power: 45,   accuracy: 100, pp: 25 },
  { id: "water_gun",     name: "Water Gun",    type: "water",    category: "special",  power: 40,   accuracy: 100, pp: 25 },
  { id: "thunder_shock", name: "ThunderShock", type: "electric", category: "special",  power: 40,   accuracy: 100, pp: 30 },
  { id: "quick_attack",  name: "Quick Attack", type: "normal",   category: "physical", power: 40,   accuracy: 100, pp: 30 },
  { id: "string_shot",   name: "String Shot",  type: "bug",      category: "status",   power: null, accuracy: 95,  pp: 40 },
  { id: "tail_whip",     name: "Tail Whip",    type: "normal",   category: "status",   power: null, accuracy: 100, pp: 30 },
];

const _speciesMap = {};
for (const s of DB_SPECIES) _speciesMap[s.id] = s;
const _movesMap = {};
for (const m of DB_MOVES) _movesMap[m.id] = m;

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

function buildMoveset(species) {
  const learnset = species.learnset ?? [];
  const moves = [];
  const normalPhysical = learnset.find(id => {
    const m = _movesMap[id];
    return m && m.type === "normal" && m.category === "physical" && m.power;
  });
  if (normalPhysical) {
    const m = _movesMap[normalPhysical];
    moves.push({ id: m.id, pp: m.pp, ppMax: m.pp });
  }
  const primaryType = species.types[0];
  if (primaryType !== "normal") {
    const stabId = learnset.find(id => {
      const m = _movesMap[id];
      return m && m.type === primaryType && m.power;
    });
    if (stabId) {
      const m = _movesMap[stabId];
      moves.push({ id: m.id, pp: m.pp, ppMax: m.pp });
    }
  }
  if (moves.length < 2) {
    const growl = _movesMap["growl"];
    if (growl && learnset.includes("growl")) moves.push({ id: "growl", pp: growl.pp, ppMax: growl.pp });
  }
  return moves;
}

function calcMaxHp(species, level) {
  return Math.floor((2 * species.baseStats.hp * level) / 100) + level + 10;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, pickedSpeciesIds } = await req.json();
    if (!runId || !Array.isArray(pickedSpeciesIds) || pickedSpeciesIds.length !== 3) {
      return Response.json({ error: "runId and pickedSpeciesIds (3 ids) required" }, { status: 400 });
    }

    const runs = await base44.entities.Run.filter({ id: runId });
    const run = runs[0];
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    if (run.playerId !== user.id && user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (run.status !== "active") {
      return Response.json({ error: "Run is not active" }, { status: 400 });
    }

    const LEVEL = 5;
    const pickedIds = pickedSpeciesIds.map(Number);

    // Build bench pool deterministically (same as startNodeBattle)
    const benchPool = deterministicShuffle(
      DB_SPECIES.filter(s => !pickedIds.includes(s.id)),
      makeRng(`${run.seed}:player:bench_select`)
    ).slice(0, 3);

    // Build party array: indices 0-2 = actives, 3-5 = bench
    const partyEntries = [
      ...pickedIds.map((sid, i) => ({ sid, subSeed: `${run.seed}:player:active:${i}:${sid}` })),
      ...benchPool.map((sp, i) => ({ sid: sp.id, subSeed: `${run.seed}:player:bench:${i}:${sp.id}` })),
    ];

    const party = partyEntries.map(({ sid, subSeed }) => {
      const sp = _speciesMap[sid];
      if (!sp) return null;
      const maxHp = calcMaxHp(sp, LEVEL);
      return {
        speciesId: sp.id,
        name: sp.name,
        level: LEVEL,
        currentHP: maxHp,
        maxHP: maxHp,
        fainted: false,
        status: null,
        moves: buildMoveset(sp),
      };
    }).filter(Boolean);

    const initialProgress = {
      party,             // flat array, 0-2 active, 3-5 bench
      activeIdxs: [0, 1, 2],
      benchIdxs:  [3, 4, 5],
      money: 0,
      inventory: { potion: 0, revive: 0 },
      partyState: party, // alias used by legacy hydration in startNodeBattle
      completedNodeIds: [],
      currentNodeId: null,
      pendingEncounter: null,
    };

    // Write starter_confirm action + initialize progress atomically
    const currentIdx = run.nextActionIdx ?? 0;
    await Promise.all([
      base44.entities.RunAction.create({
        runId,
        idx: currentIdx,
        actionType: "starter_confirm",
        payload: { team: pickedIds.map(sid => ({ speciesId: sid, name: _speciesMap[sid]?.name ?? sid })) },
      }),
      base44.entities.Run.update(runId, {
        nextActionIdx: currentIdx + 1,
        results: { ...(run.results ?? {}), progress: initialProgress },
      }),
    ]);

    return Response.json({ ok: true, progress: initialProgress });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});