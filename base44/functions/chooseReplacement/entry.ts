import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, battleId, slot, benchIndex } = await req.json();
    if (!runId || !battleId || slot === undefined || benchIndex === undefined)
      return Response.json({ error: "runId, battleId, slot, benchIndex required" }, { status: 400 });

    // Load Run and verify ownership
    const runs = await base44.asServiceRole.entities.Run.filter({ id: runId });
    const run = runs[0];
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    if (run.playerId !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });

    // Load Battle via runId (safer than filtering by id directly)
    const allBattles = await base44.asServiceRole.entities.Battle.filter({ runId });
    const battle = allBattles.find(b => b.id === battleId);
    if (!battle) return Response.json({ error: "Battle not found for this run" }, { status: 404 });
    if (battle.status !== "active") return Response.json({ error: "Battle already finished" }, { status: 400 });

    const state = battle.state;

    // Verify pendingReplacement exists and matches
    const pr = state.pendingReplacement;
    if (!pr) return Response.json({ error: "No pending replacement." }, { status: 400 });
    if (pr.side !== "player") return Response.json({ error: "Pending replacement is not for player side." }, { status: 400 });
    if (pr.slot !== slot) return Response.json({ error: `Pending replacement is for slot ${pr.slot}, not ${slot}.` }, { status: 400 });

    // Verify bench mon is valid
    const bench = state.player.bench[benchIndex];
    if (!bench) return Response.json({ error: `No bench Pokémon at index ${benchIndex}.` }, { status: 400 });
    if (bench.fainted) return Response.json({ error: `${bench.name} has fainted and cannot battle.` }, { status: 400 });
    // Ensure not already active
    const alreadyActive = state.player.active.some((p, i) => p && p.name === bench.name && !p.fainted && i !== slot);
    if (alreadyActive) return Response.json({ error: `${bench.name} is already active.` }, { status: 400 });

    // Perform the swap: bench → active slot, fainted mon → bench slot
    const fainted = state.player.active[slot];
    // Mark as just switched in so it cannot act this turn
    bench.justSwitchedIn = true;
    state.player.active[slot] = bench;
    state.player.bench[benchIndex] = fainted;

    // Append log entry
    state.turnLog = [...(state.turnLog ?? []), `Go, ${bench.name}!`];

    // Clear pendingReplacement
    state.pendingReplacement = null;

    // Persist
    await base44.asServiceRole.entities.Battle.update(battleId, { state });

    // Append RunAction
    const nextIdx = (run.nextActionIdx ?? 0) + 1;
    await Promise.all([
      base44.asServiceRole.entities.RunAction.create({
        runId,
        idx: nextIdx,
        actionType: "battle_choose_replacement",
        payload: { battleId, slot, benchIndex, sentOut: bench.name },
      }),
      base44.asServiceRole.entities.Run.update(runId, { nextActionIdx: nextIdx }),
    ]);

    return Response.json({ state, turnNumber: battle.turnNumber });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});