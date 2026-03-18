import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { runId, reason } = await req.json();
    if (!runId) return Response.json({ error: 'runId is required' }, { status: 400 });

    const run = await base44.entities.Run.get(runId);
    if (!run) return Response.json({ error: 'Run not found' }, { status: 404 });
    if (run.playerId !== user.id && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (run.status !== 'active') return Response.json({ error: `Run is already ${run.status}` }, { status: 400 });

    const nowIso = new Date().toISOString();
    const nextIdx = (run.nextActionIdx ?? 0) + 1;

    await Promise.all([
      base44.entities.Run.update(runId, {
        status: 'finished',
        endedAt: nowIso,
        nextActionIdx: nextIdx,
        results: {
          ...(run.results ?? {}),
          reason: 'surrender',
          surrenderedAt: nowIso,
          surrenderReason: reason ?? 'user_surrender',
        },
      }),
      base44.entities.RunAction.create({
        runId,
        idx: nextIdx,
        actionType: 'run_surrendered',
        payload: { reason: reason ?? 'user_surrender', at: nowIso },
      }),
    ]);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
