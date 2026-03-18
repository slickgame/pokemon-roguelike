import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const seasons = await base44.asServiceRole.entities.Season.filter({ state: "ACTIVE_EVENT" });

    if (seasons.length > 0) {
      return Response.json(seasons[0]);
    }

    // Stub: return mock season if none exists
    return Response.json({
      seasonId: "S1",
      state: "ACTIVE_EVENT",
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      dbVersionHash: "abc123def456",
      eventId: null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});