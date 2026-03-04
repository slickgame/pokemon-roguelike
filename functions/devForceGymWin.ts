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
    if (run.playerId !== user.id && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (run.isRanked === true) return Response.json({ error: 'Dev tools disabled on ranked runs' }, { status: 403 });
    if (run.status !== 'active') return Response.json({ error: 'Run is not active' }, { status: 400 });

    const pending = run.results?.progress?.pendingEncounter ?? null;
    if (!pending || pending.nodeType !== 'gym' || !pending.battleId) {
      return Response.json({ error: 'No active gym battle found in pendingEncounter' }, { status: 400 });
    }

    const battle = await base44.entities.Battle.get(pending.battleId);
    if (!battle) return Response.json({ error: 'Battle not found' }, { status: 404 });
    if (battle.status !== 'active') return Response.json({ error: 'Battle is not active' }, { status: 400 });

    const nextState = {
      ...(battle.state ?? {}),
      winner: 'player',
      turnLog: [...(battle.state?.turnLog ?? []), '[DEV] Forced gym win'],
    };

    await base44.entities.Battle.update(battle.id, {
      status: 'finished',
      state: nextState,
      endedAt: new Date().toISOString(),
    });

    const resolved = await base44.functions.invoke('resolveNode', {
      runId,
      resolution: {
        type: 'battle',
        winner: 'player',
        faintCount: 0,
        battleId: battle.id,
      },
    });

    const currentRun = await base44.entities.Run.get(runId);
    const nextIdx = (currentRun?.nextActionIdx ?? run.nextActionIdx ?? 0) + 1;
    await Promise.all([
      base44.entities.Run.update(runId, { nextActionIdx: nextIdx }),
      base44.entities.RunAction.create({ runId, idx: nextIdx, actionType: 'dev_force_gym_win', payload: { battleId: battle.id } }),
    ]);

    return Response.json({ ok: true, battleId: battle.id, resolve: resolved?.data ?? null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
