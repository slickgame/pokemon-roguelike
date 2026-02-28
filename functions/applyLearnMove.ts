/**
 * applyLearnMove — Called when player resolves a learn-move prompt mid-battle.
 * Payload: { battleId, runId, slotRef, newMoveId, newMoveName, replaceIndex }
 *   slotRef: "active_0" | "bench_2" etc.
 *   replaceIndex: 0-3 to replace that slot, null/undefined to skip
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { battleId, runId, slotRef, newMoveId, newMoveName, replaceIndex } = await req.json();
    if (!battleId || !slotRef || !newMoveId) {
      return Response.json({ error: "battleId, slotRef, newMoveId required" }, { status: 400 });
    }

    const battles = await base44.entities.Battle.filter({ id: battleId });
    const battle = battles[0];
    if (!battle) return Response.json({ error: "Battle not found" }, { status: 404 });

    const state = battle.state;

    // Resolve the Pokémon by slotRef
    const [zone, idxStr] = slotRef.split("_");
    const idx = parseInt(idxStr, 10);
    const poke = zone === "active"
      ? state.player.active[idx]
      : state.player.bench[idx];

    if (!poke) return Response.json({ error: `No Pokémon at ${slotRef}` }, { status: 400 });

    // Apply or skip
    if (replaceIndex !== null && replaceIndex !== undefined && replaceIndex >= 0) {
      const newMove = {
        id: newMoveId,
        name: newMoveName,
        type: "normal",
        category: "physical",
        power: null,
        pp: 20,
        currentPp: 20,
        priority: 0,
      };
      poke.moves[replaceIndex] = newMove;
    }
    // else: skip — do nothing to moves

    // Remove this prompt from pendingLearnPrompts
    if (Array.isArray(state.pendingLearnPrompts)) {
      const idx2 = state.pendingLearnPrompts.findIndex(
        p => p.slotRef === slotRef && p.newMoveId === newMoveId
      );
      if (idx2 >= 0) state.pendingLearnPrompts.splice(idx2, 1);
    }

    // Persist updated battle state + partyState in run
    await base44.entities.Battle.update(battleId, { state });

    if (runId) {
      const runs = await base44.asServiceRole.entities.Run.filter({ id: runId });
      const run = runs[0];
      if (run) {
        const existingProgress = run.results?.progress ?? {};
        const allPokes = [...state.player.active, ...state.player.bench];
        const partyState = allPokes.filter(p => !!p).map(p => ({
          speciesId: p.speciesId, name: p.name, level: p.level, exp: p.exp ?? 0,
          nature: p.nature ?? "Hardy", ivs: p.ivs ?? {}, baseStats: p.baseStats ?? {},
          currentHP: p.currentHp, maxHP: p.maxHp, fainted: p.fainted,
          status: p.status ?? null,
          moves: (p.moves ?? []).map(m => ({ id: m.id, name: m.name, pp: m.currentPp ?? m.pp, ppMax: m.pp })),
        }));
        await base44.asServiceRole.entities.Run.update(runId, {
          results: { ...(run.results ?? {}), progress: { ...existingProgress, partyState } },
        });
      }
    }

    return Response.json({ ok: true, state, pendingLearnPrompts: state.pendingLearnPrompts ?? [] });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});