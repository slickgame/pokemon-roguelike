import React from "react";

export default function CommandBuilder({ playerTeam, activeSlots, commands, onChange, enemyActiveSlots, enemyTeam }) {
  const aliveSlots = activeSlots.filter(i => !playerTeam[i]?.fainted);

  return (
    <div className="space-y-3">
      {aliveSlots.map(slot => {
        const poke = playerTeam[slot];
        if (!poke || poke.fainted) return null;

        const aliveEnemySlot = enemyActiveSlots.filter(i => !enemyTeam[i]?.fainted)[0] ?? 0;
        const cmd = commands[slot] ?? {
          actorSlot: slot, type: "move",
          moveId: poke.moves[0]?.id,
          target: { side: "enemy", slot: aliveEnemySlot },
        };

        // Bench: not active, not fainted
        const benchSlots = playerTeam
          .map((p, i) => ({ p, i }))
          .filter(({ p, i }) => p && !p.fainted && !activeSlots.includes(i));

        return (
          <div key={slot} className="bg-white/4 border border-white/8 rounded-xl p-3">
            <p className="text-white/70 text-xs font-semibold mb-2 uppercase tracking-wide">{poke.name}</p>

            {/* Action type toggle */}
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => onChange(slot, { actorSlot: slot, type: "move", moveId: poke.moves[0]?.id, target: { side: "enemy", slot: aliveEnemySlot } })}
                className={`text-xs px-2 py-0.5 rounded ${cmd.type === "move" ? "bg-violet-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
              >
                Move
              </button>
              {benchSlots.length > 0 && (
                <button
                  onClick={() => onChange(slot, { actorSlot: slot, type: "switch", target: { slot: benchSlots[0].i } })}
                  className={`text-xs px-2 py-0.5 rounded ${cmd.type === "switch" ? "bg-amber-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
                >
                  Switch
                </button>
              )}
            </div>

            {cmd.type === "move" ? (
              <div className="flex gap-2 flex-wrap">
                {/* Move select */}
                <select
                  value={cmd.moveId}
                  onChange={e => onChange(slot, { ...cmd, moveId: e.target.value })}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500/50 min-w-0"
                >
                  {poke.moves.map(m => (
                    <option key={m.id} value={m.id} className="bg-gray-900">
                      {m.name} {m.power ? `(${m.power}BP)` : "(Status)"} PP:{m.currentPp ?? m.pp}
                    </option>
                  ))}
                </select>

                {/* Target select */}
                <select
                  value={`${cmd.target?.side}:${cmd.target?.slot}`}
                  onChange={e => {
                    const [side, slotStr] = e.target.value.split(":");
                    onChange(slot, { ...cmd, target: { side, slot: Number(slotStr) } });
                  }}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                >
                  {enemyActiveSlots.filter(i => !enemyTeam[i]?.fainted).map(i => (
                    <option key={i} value={`enemy:${i}`} className="bg-gray-900">→ {enemyTeam[i]?.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              /* Switch target: bench select */
              <select
                value={cmd.target?.slot ?? ""}
                onChange={e => onChange(slot, { ...cmd, target: { slot: Number(e.target.value) } })}
                className="w-full bg-white/5 border border-amber-500/30 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
              >
                {benchSlots.map(({ p, i }) => (
                  <option key={i} value={i} className="bg-gray-900">
                    ↩ {p.name} (HP {p.currentHp}/{p.maxHp})
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}