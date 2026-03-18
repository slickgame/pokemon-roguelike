import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const runs = await base44.entities.Run.filter({ playerId: user.id, status: 'active' });
    if (!runs?.length) return Response.json({ run: null });

    const sorted = [...runs].sort((a, b) => {
      const at = new Date(a.startedAt ?? a.created_date ?? 0).getTime();
      const bt = new Date(b.startedAt ?? b.created_date ?? 0).getTime();
      return bt - at;
    });

    const newest = sorted[0];
    if (sorted.length > 1) {
      const older = sorted.slice(1);
      await Promise.all(older.map((r) => base44.entities.Run.update(r.id, {
        status: 'abandoned',
        endedAt: new Date().toISOString(),
        results: {
          ...(r.results ?? {}),
          reason: 'auto_abandoned_duplicate_active_run',
        },
      })));
    }

    return Response.json({ run: newest });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
