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

    const progress = run.results?.progress ?? {};
    const routeGraph = progress.routeGraph;
    if (!routeGraph || !Array.isArray(routeGraph.nodes) || routeGraph.nodes.length === 0) {
      return Response.json({ error: 'No routeGraph found on run. Open RunMap once to initialize route graph.' }, { status: 400 });
    }

    const gymNode = routeGraph.nodes.find((n) => n?.type === 'gym') ?? null;
    const gymNodeId = gymNode?.id ?? routeGraph.bossNodeId ?? null;
    if (!gymNodeId) return Response.json({ error: 'Gym node not found in route graph' }, { status: 400 });

    const completedNodeIds = routeGraph.nodes.map((n) => n.id).filter((id) => id !== gymNodeId);
    const nextIdx = (run.nextActionIdx ?? 0) + 1;

    const updatedProgress = {
      ...progress,
      currentNodeId: gymNodeId,
      completedNodeIds,
      pendingEncounter: null,
      routeCompleted: false,
    };

    await Promise.all([
      base44.entities.Run.update(runId, {
        results: { ...(run.results ?? {}), progress: updatedProgress },
        nextActionIdx: nextIdx,
      }),
      base44.entities.RunAction.create({
        runId,
        idx: nextIdx,
        actionType: 'dev_jump_to_gym_node',
        payload: { gymNodeId, routeId: progress.routeId ?? routeGraph.routeId ?? 'route1', routeIndex: progress.routeIndex ?? routeGraph.routeIndex ?? 1 },
      }),
    ]);

    return Response.json({ ok: true, gymNodeId, routeId: updatedProgress.routeId ?? routeGraph.routeId ?? 'route1', routeIndex: updatedProgress.routeIndex ?? routeGraph.routeIndex ?? 1 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
