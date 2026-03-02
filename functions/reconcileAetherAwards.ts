import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Shared helper: award aether to player by authUserId, returns { ok, playerEntityId, after } or { ok:false, reason }
async function awardAetherToPlayer(base44, authUserId, delta) {
  const d = Number(delta ?? 0);
  if (Number.isNaN(d) || d <= 0) return { ok: false, reason: 'invalid_delta' };

  const players = await base44.asServiceRole.entities.Player.filter({ authUserId });
  const player = players?.[0];
  if (!player) return { ok: false, reason: `player_not_found:${authUserId}` };

  const rawCurrent = Number(player.aether);
  const current = Number.isNaN(rawCurrent) ? 0 : rawCurrent;
  const newValue = current + d;

  await base44.asServiceRole.entities.Player.update(player.id, { aether: newValue });

  // Confirm persisted by re-fetching with service role
  const confirmList = await base44.asServiceRole.entities.Player.filter({ authUserId });
  const confirm = confirmList?.[0];
  const rawAfter = Number(confirm?.aether);
  const after = Number.isNaN(rawAfter) ? newValue : rawAfter;

  if (after <= current) {
    return { ok: false, reason: `update_not_persisted: current=${current} after=${after}` };
  }

  return { ok: true, playerEntityId: player.id, after };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const limit = Number(body.limit ?? 50);

    // Fetch finished runs
    const runs = await base44.asServiceRole.entities.Run.filter({ status: 'finished' }, '-created_date', limit);

    let fixed = 0;
    let skipped = 0;
    const errors = [];

    for (const run of runs) {
      const results = run.results ?? {};
      const delta = Number(results.aetherDelta ?? 0);
      const afterStored = Number(results.playerAetherAfter ?? 0);

      // Only reconcile if: aetherAwarded=true, delta>0, playerAetherAfter is 0 (i.e. award was recorded but player wasn't updated)
      if (results.reconciled === true) { skipped++; continue; }
      if (!results.aetherAwarded) { skipped++; continue; }
      if (delta <= 0) { skipped++; continue; }
      if (afterStored > 0) { skipped++; continue; } // looks like it worked

      // Attempt to award
      const award = await awardAetherToPlayer(base44, run.playerId, delta);
      if (!award.ok) {
        errors.push({ runId: run.id, reason: award.reason });
        continue;
      }

      const nextIdx = (run.nextActionIdx ?? 0) + 1;
      await Promise.all([
        base44.asServiceRole.entities.Run.update(run.id, {
          nextActionIdx: nextIdx,
          results: {
            ...results,
            playerAetherAfter: award.after,
            reconciled: true,
          },
        }),
        base44.asServiceRole.entities.RunAction.create({
          runId: run.id,
          idx: nextIdx,
          actionType: 'aether_reconciled',
          payload: { delta, after: award.after },
        }),
      ]);

      fixed++;
    }

    return Response.json({ ok: true, fixed, skipped, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});