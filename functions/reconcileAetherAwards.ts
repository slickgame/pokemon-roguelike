import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function awardAetherToPlayer(base44, authUserId, delta) {
  const d = Number(delta ?? 0);
  if (Number.isNaN(d) || d <= 0) return { ok: false, reason: "invalid_delta" };

  const players = await base44.asServiceRole.entities.Player.filter({ authUserId });
  const player = players?.[0];
  if (!player) return { ok: false, reason: "player_not_found" };

  const current = Number.isNaN(Number(player.aether)) ? 0 : Number(player.aether ?? 0);
  const newValue = current + d;

  await base44.asServiceRole.entities.Player.update(player.id, { aether: newValue });

  // Confirm persisted
  const confirm = await base44.asServiceRole.entities.Player.get(player.id);
  const confirmedValue = Number.isNaN(Number(confirm?.aether)) ? newValue : Number(confirm?.aether ?? newValue);

  return { ok: true, playerEntityId: player.id, after: confirmedValue };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const limit = Number(body.limit ?? 50);

    // Find all finished runs
    const runs = await base44.asServiceRole.entities.Run.filter({ status: "finished" }, "-created_date", limit);

    const candidates = runs.filter(r => {
      const res = r.results ?? {};
      return (
        res.aetherAwarded === true &&
        Number(res.aetherDelta ?? 0) > 0 &&
        res.reconciled !== true &&
        Number(res.playerAetherAfter ?? 0) === 0
      );
    });

    const results = [];

    for (const run of candidates) {
      const delta = Number(run.results.aetherDelta ?? 0);
      const award = await awardAetherToPlayer(base44, run.playerId, delta);

      if (award.ok) {
        const nextIdx = (run.nextActionIdx ?? 0) + 1;
        await Promise.all([
          base44.asServiceRole.entities.Run.update(run.id, {
            nextActionIdx: nextIdx,
            results: {
              ...run.results,
              playerAetherAfter: award.after,
              reconciled: true,
            },
          }),
          base44.asServiceRole.entities.RunAction.create({
            runId: run.id,
            idx: nextIdx,
            actionType: "aether_reconciled",
            payload: { delta, after: award.after, playerEntityId: award.playerEntityId },
          }),
        ]);
        results.push({ runId: run.id, delta, after: award.after, ok: true });
      } else {
        results.push({ runId: run.id, delta, ok: false, reason: award.reason });
      }
    }

    return Response.json({ fixed: results.filter(r => r.ok).length, total: candidates.length, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});