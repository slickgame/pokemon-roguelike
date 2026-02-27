import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { category = "standard" } = body;

    const entries = await base44.asServiceRole.entities.LeaderboardEntry.filter(
      { category },
      "-aetherEarned",
      20
    );

    if (entries.length > 0) {
      // Enrich: use playerNameSnapshot first, then look up by authUserId
      const enriched = await Promise.all(entries.map(async (e) => {
        let playerName = e.playerNameSnapshot || null;
        if (!playerName && e.playerId) {
          try {
            // e.playerId = authUserId (Run.playerId semantics)
            const players = await base44.asServiceRole.entities.Player.filter({ authUserId: e.playerId });
            if (players[0]?.displayName) playerName = players[0].displayName;
          } catch (_) { /* ignore */ }
        }
        return { ...e, playerName: playerName || "Unknown Trainer" };
      }));
      return Response.json({ entries: enriched });
    }

    // Stub: return mock leaderboard entries
    return Response.json({
      entries: [
        { rank: 1, playerId: "stub-player-1", aetherEarned: 1200, faints: 0, durationMs: 1800000, category },
        { rank: 2, playerId: "stub-player-2", aetherEarned: 950, faints: 1, durationMs: 2100000, category },
        { rank: 3, playerId: "stub-player-3", aetherEarned: 700, faints: 2, durationMs: 2400000, category },
      ],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});