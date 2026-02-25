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

    const existing = await base44.entities.RunAction.filter({ runId });
    const idx = existing.length;

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