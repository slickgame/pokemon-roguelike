import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { runId, battleId, outcome } = await req.json();
    if (!runId || !battleId || !outcome) {
      return Response.json({ error: 'Missing runId, battleId, or outcome' }, { status: 400 });
    }

    // Load run
    const run = await base44.entities.Run.get(runId);
    if (!run) return Response.json({ error: 'Run not found' }, { status: 404 });
    if (run.playerId !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (run.status !== 'active') {
      return Response.json({ error: 'Run is not active' }, { status: 400 });
    }

    // Load battle
    const battle = await base44.entities.Battle.get(battleId);
    if (!battle) return Response.json({ error: 'Battle not found' }, { status: 404 });
    if (battle.runId !== runId) return Response.json({ error: 'Battle/Run mismatch' }, { status: 400 });

    // Read existing progress (graceful default)
    const existingProgress = run.results?.progress ?? {};
    const pending = existingProgress.pendingEncounter ?? null;

    // If no pending encounter or battleId doesn't match, it may already be resolved — idempotent OK
    if (!pending || pending.battleId !== battleId) {
      return Response.json({ progress: existingProgress, alreadyResolved: true });
    }

    const { nodeId, nodeType } = pending;
    let updatedProgress;

    if (outcome === 'win') {
      const completedNodeIds = existingProgress.completedNodeIds ?? [];
      if (!completedNodeIds.includes(nodeId)) completedNodeIds.push(nodeId);

      updatedProgress = {
        ...existingProgress,
        routeId: existingProgress.routeId ?? 'route1',
        currentNodeId: nodeId,
        completedNodeIds,
        pendingEncounter: null,
      };

      await base44.entities.Run.update(runId, {
        results: { ...(run.results ?? {}), progress: updatedProgress },
      });

      // Log node_completed RunAction
      const nextIdx = (run.nextActionIdx ?? 0) + 1;
      await base44.entities.RunAction.create({
        runId,
        idx: nextIdx,
        actionType: 'node_resolved',
        payload: { nodeId, nodeType, battleId, outcome: 'win' },
      });
      await base44.entities.Run.update(runId, { nextActionIdx: nextIdx });

      // If gym — also log gym_defeated and finish run
      if (nodeType === 'gym') {
        const gymIdx = nextIdx + 1;
        await base44.entities.RunAction.create({
          runId,
          idx: gymIdx,
          actionType: 'gym_defeated',
          payload: { gymId: 'gym1', routeId: updatedProgress.routeId },
        });
        await base44.entities.Run.update(runId, {
          status: 'finished',
          endedAt: new Date().toISOString(),
          nextActionIdx: gymIdx,
          results: {
            ...(run.results ?? {}),
            progress: updatedProgress,
            winner: 'player',
            gymDefeated: true,
          },
        });
      }
    } else {
      // loss
      updatedProgress = {
        ...existingProgress,
        pendingEncounter: null,
      };

      await base44.entities.Run.update(runId, {
        status: 'finished',
        endedAt: new Date().toISOString(),
        results: {
          ...(run.results ?? {}),
          progress: updatedProgress,
          winner: 'enemy',
          reason: 'battle_loss',
        },
      });

      const nextIdx = (run.nextActionIdx ?? 0) + 1;
      await base44.entities.RunAction.create({
        runId,
        idx: nextIdx,
        actionType: 'node_resolved',
        payload: { nodeId, nodeType, battleId, outcome: 'loss' },
      });
      await base44.entities.Run.update(runId, { nextActionIdx: nextIdx });
    }

    return Response.json({ progress: updatedProgress, outcome });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});