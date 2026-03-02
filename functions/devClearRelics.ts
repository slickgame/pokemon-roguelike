import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { runId } = await req.json();
    if (!runId) return Response.json({ error: 'runId required' }, { status: 400 });

    const run = await base44.entities.Run.get(runId);
    if (!run) return Response.json({ error: 'Run not found' }, { status: 404 });
    if (run.playerId !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (run.isRanked === true) return Response.json({ error: 'Dev tools disabled on ranked runs' }, { status: 403 });

    const progress = run.results?.progress ?? {};
    const devFlags = { ...(progress.devFlags ?? {}), forceNextEventRelic: false };
    const nextIdx = (run.nextActionIdx ?? 0) + 1;

    await Promise.all([
      base44.entities.Run.update(runId, {
        results: { ...(run.results ?? {}), progress: { ...progress, relics: [], devFlags } },
        nextActionIdx: nextIdx,
      }),
      base44.entities.RunAction.create({ runId, idx: nextIdx, actionType: 'dev_relic_cleared', payload: {} }),
    ]);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});