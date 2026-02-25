import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
      return Response.json({ error: "runId and actionType are required" }, { status: 400 });
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

    const existing = await base44.entities.RunAction.filter({ runId });
    const maxIdx = existing.length > 0 ? Math.max(...existing.map(a => a.idx)) : -1;
    const idx = maxIdx + 1;

    await base44.entities.RunAction.create({
      runId,
      idx,
      actionType,
      payload,
    });

    return Response.json({ ok: true, idx });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});