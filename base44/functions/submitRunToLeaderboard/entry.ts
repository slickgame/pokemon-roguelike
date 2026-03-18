import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Modifier tag lookup (mirrors finishRun registry)
const MODIFIER_TAGS = {
  permadeath:            ["difficulty", "hardcore", "permadeath"],
  xp_share_off:          ["difficulty"],
  enemy_iv_floor_10:     ["difficulty"],
  type_diversity_soft:   ["ruleset"],
  type_diversity_hard:   ["ruleset"],
  cull_rank_1:           ["ruleset"],
  cull_rank_1_2:         ["ruleset"],
  starter_pool_expand_5: ["economy"],
  starter_rerolls_3:     ["economy"],
  kanto_starter_direct:  ["economy"],
  start_money_300:       ["economy"],
  start_money_600:       ["economy"],
  xp_share_on:           [],
};

function getModifierTags(modifiers) {
  const tags = new Set();
  for (const id of Object.keys(modifiers ?? {})) {
    if (!modifiers[id]) continue;
    for (const t of (MODIFIER_TAGS[id] ?? [])) tags.add(t);
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

    if (run.status !== "finished")
      return Response.json({ error: "Run must be finished before submitting" }, { status: 400 });

    if (!run.isRanked)
      return Response.json({ error: "Run is not ranked" }, { status: 400 });

    if (run.results?.submitted)
      return Response.json({ error: "Already submitted", alreadySubmitted: true }, { status: 409 });

    const summary = run.results?.resultsSummary;
    if (!summary)
      return Response.json({ error: "Run results not computed. Finish the run first." }, { status: 400 });

    // Determine category
    const tags = getModifierTags(run.modifiers ?? {});
    const category = (tags.has("hardcore") || tags.has("permadeath")) ? "hardcore" : "standard";

    // Load current season
    const seasonRes = await base44.functions.invoke("getCurrentSeason", {});
    const season = seasonRes?.data ?? { seasonId: "S1", dbVersionHash: "unknown" };

    // Fetch player by authUserId (Run.playerId = authUserId)
    let playerNameSnapshot = "Unknown Trainer";
    try {
      const players = await base44.asServiceRole.entities.Player.filter({ authUserId: run.playerId });
      if (players[0]?.displayName) playerNameSnapshot = players[0].displayName;
    } catch (_) { /* ignore */ }

    // Create leaderboard entry
    await base44.asServiceRole.entities.LeaderboardEntry.create({
      seasonId: season.seasonId,
      category,
      playerId: run.playerId,
      playerNameSnapshot,
      runId,
      aetherEarned: summary.aetherEarned ?? 0,
      faints: summary.faints ?? 0,
      durationMs: summary.durationMs ?? null,
      modifiers: run.modifiers ?? {},
      dbVersionHash: season.dbVersionHash ?? run.dbVersionHash ?? "unknown",
    });

    // Mark as submitted
    await base44.asServiceRole.entities.Run.update(runId, {
      results: {
        ...(run.results ?? {}),
        submitted: true,
        submittedAt: new Date().toISOString(),
      },
    });

    return Response.json({ ok: true, category });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});