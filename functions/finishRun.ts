import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { runId, summary = {} } = body;

    if (!runId) {
      return Response.json({ error: "runId is required" }, { status: 400 });
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

    await base44.entities.Run.update(runId, {
      status: "finished",
      endedAt: new Date().toISOString(),
      results: summary,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});