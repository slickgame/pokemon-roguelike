import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, battleId, slot, benchIndex } = await req.json();
    if (!runId || !battleId || slot === undefined || benchIndex === undefined)
      return Response.json({ error: "runId, battleId, slot, benchIndex required" }, { status: 400 });

    // Load battle
    const battles = await base44.entities.Battle.filter({ id: battleId });
    const battle = battles[0];
    if (!battle) return Response.json({ error: "Battle not found" }, { status: 404 });
    if (battle.status !== "active") return Response.json({ error: "Battle already finished" }, { status: 400 });

    const state = battle.state;

    // Verify pendingReplacement exists and matches
    const pr = state.pendingReplacement;
    if (!pr || pr.side !== "player" || pr.slot !== slot)
      return Response.json({ error: "No pending replacement for that slot." }, { status: 400 });

    // Verify bench mon is valid
    const bench = state.player.bench[benchIndex];
    if (!bench) return Response.json({ error: `No bench Pokémon at index ${benchIndex}.` }, { status: 400 });
    if (bench.fainted) return Response.json({ error: `${bench.name} has fainted.` }, { status: 400 });
    // Check not already active
    if (state.player.active.some(p => p === bench))
      return Response.json({ error: `${bench.name} is already active.` }, { status: 400 });

    // Perform the swap: bench mon → active slot, fainted mon → bench slot
    const fainted = state.player.active[slot];
    state.player.active[slot] = bench;
    state.player.bench[benchIndex] = fainted;

    // Append log entry
    state.turnLog = [...(state.turnLog ?? []), `Go, ${bench.name}!`];

    // Clear pendingReplacement
    state.pendingReplacement = null;

    await base44.entities.Battle.update(battleId, { state });

    // Append RunAction
    const runs = await base44.asServiceRole.entities.Run.filter({ id: runId });
    const run = runs[0];
    const nextIdx = (run?.nextActionIdx ?? 0) + 1;
    await Promise.all([
      base44.asServiceRole.entities.RunAction.create({
        runId, idx: nextIdx,
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