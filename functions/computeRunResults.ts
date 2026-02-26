import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Modifier registry (server-side source of truth) ───────────────────────────
const MODIFIER_REGISTRY = [
  { id: "xp_share_on",             aetherPct: 0,   tags: [] },
  { id: "xp_share_off",            aetherPct: 10,  tags: ["difficulty"] },
  { id: "starter_pool_expand_5",   aetherPct: -5,  tags: ["economy"] },
  { id: "starter_rerolls_3",       aetherPct: -5,  tags: ["economy"] },
  { id: "kanto_starter_direct",    aetherPct: -10, tags: ["economy"] },
  { id: "type_diversity_soft",     aetherPct: -5,  tags: ["ruleset"] },
  { id: "type_diversity_hard",     aetherPct: -10, tags: ["ruleset"] },
  { id: "cull_rank_1",             aetherPct: -10, tags: ["ruleset"] },
  { id: "cull_rank_1_2",           aetherPct: -20, tags: ["ruleset"] },
  { id: "start_money_300",         aetherPct: -5,  tags: ["economy"] },
  { id: "start_money_600",         aetherPct: -10, tags: ["economy"] },
  { id: "enemy_iv_floor_10",       aetherPct: 10,  tags: ["difficulty"] },
  { id: "permadeath",              aetherPct: 25,  tags: ["difficulty", "hardcore", "permadeath"] },
];

const MODIFIER_MAP = {};
for (const m of MODIFIER_REGISTRY) MODIFIER_MAP[m.id] = m;

export function computeResults(run, actions) {
  // Derive stats from actions
  const battlesWon  = actions.filter(a => a.actionType === "battle_end" && a.payload?.winner === "player").length;
  const battlesLost = actions.filter(a => a.actionType === "battle_end" && a.payload?.winner === "enemy").length;
  const gymsDefeated = actions.filter(a => a.actionType === "gym_defeated").length;

  // Count faints: prefer explicit faint actions, fall back to aggregating from battle_end summaries
  const faintActions = actions.filter(a => a.actionType === "pokemon_fainted");
  let faints = faintActions.length;
  if (faints === 0) {
    // Aggregate from battle_end summaries if available
    for (const a of actions) {
      if (a.actionType === "battle_end" && a.payload?.playerFaints) {
        faints += a.payload.playerFaints;
      }
    }
  }

  const startedAt = run.startedAt ? new Date(run.startedAt).getTime() : null;
  const endedAt   = run.endedAt   ? new Date(run.endedAt).getTime()   : Date.now();
  const durationMs = startedAt ? endedAt - startedAt : null;

  // Base Aether
  const baseAether = gymsDefeated >= 1 ? 100 : battlesWon * 10;

  // Modifier pct
  const activeModifierIds = Object.keys(run.modifiers ?? {}).filter(id => run.modifiers[id]);
  let rawPct = 0;
  for (const id of activeModifierIds) {
    const entry = MODIFIER_MAP[id];
    if (entry) rawPct += entry.aetherPct;
  }
  const modifierTotalPct = Math.max(-90, Math.min(200, rawPct));

  const aetherEarned = Math.max(0, Math.floor(baseAether * (1 + modifierTotalPct / 100)));

  return {
    baseAether,
    modifierTotalPct,
    aetherEarned,
    battlesWon,
    battlesLost,
    faints,
    durationMs,
    gymsDefeated,
    scoreVersion: "m9_v1",
  };
}

export function getModifierTags(run) {
  const ids = Object.keys(run.modifiers ?? {}).filter(id => run.modifiers[id]);
  const tags = new Set();
  for (const id of ids) {
    const entry = MODIFIER_MAP[id];
    if (entry) for (const t of entry.tags) tags.add(t);
  }
  return tags;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { runId } = await req.json();
    if (!runId) return Response.json({ error: "runId required" }, { status: 400 });

    const run = await base44.entities.Run.get(runId);
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    if (run.playerId !== user.id && user.role !== "admin")
      return Response.json({ error: "Forbidden" }, { status: 403 });

    const actions = await base44.asServiceRole.entities.RunAction.filter({ runId });
    actions.sort((a, b) => a.idx - b.idx);

    const results = computeResults(run, actions);
    return Response.json({ results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});