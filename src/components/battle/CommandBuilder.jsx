import React from "react";

export default function CommandBuilder({ playerActive, playerBench, commands, onChange, enemyActive }) {
  const aliveActive = playerActive.map((p, i) => ({ p, i })).filter(({ p }) => p && !p.fainted);
  const aliveBench = playerBench.map((p, i) => ({ p, i })).filter(({ p }) => p && !p.fainted);
  const aliveEnemyTargets = enemyActive.map((p, i) => ({ p, i })).filter(({ p }) => p && !p.fainted);

  return (
    <div className="space-y-3">
      {aliveActive.map(({ p: poke, i: slot }) => {
        const cmd = commands[slot] ?? {
          actorSlot: slot, type: "move",
          moveId: poke.moves[0]?.id,
          target: { side: "enemy", slot: aliveEnemyTargets[0]?.i ?? 0 },
        };

        return (
          <div key={slot} className="bg-white/4 border border-white/8 rounded-xl p-3">
            <p className="text-white/70 text-xs font-semibold mb-2 uppercase tracking-wide">
              {poke.name} <span className="text-white/30 normal-case font-normal">({poke.currentHp}/{poke.maxHp} HP)</span>
            </p>

            {/* Action type toggle */}
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => onChange(slot, {
                  actorSlot: slot, type: "move",
                  moveId: poke.moves[0]?.id,
                  target: { side: "enemy", slot: aliveEnemyTargets[0]?.i ?? 0 },
                })}
                className={`text-xs px-2 py-0.5 rounded ${cmd.type === "move" ? "bg-violet-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
              >
                Move
              </button>
              {aliveBench.length > 0 && (
                <button
                  onClick={() => onChange(slot, {
                    actorSlot: slot, type: "switch",
                    target: { slot: aliveBench[0].i },
                  })}
                  className={`text-xs px-2 py-0.5 rounded ${cmd.type === "switch" ? "bg-amber-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
                >
                  Switch
                </button>
              )}
            </div>

            {cmd.type === "move" ? (
              <div className="flex gap-2 flex-wrap">
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
                <select
                  value={cmd.target?.slot ?? aliveEnemyTargets[0]?.i ?? 0}
                  onChange={e => onChange(slot, { ...cmd, target: { side: "enemy", slot: Number(e.target.value) } })}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                >
                  {aliveEnemyTargets.map(({ p, i }) => (
                    <option key={i} value={i} className="bg-gray-900">→ {p.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <select
                value={cmd.target?.slot ?? aliveBench[0]?.i ?? 0}
                onChange={e => onChange(slot, { ...cmd, target: { slot: Number(e.target.value) } })}
                className="w-full bg-white/5 border border-amber-500/30 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
              >
                {aliveBench.map(({ p, i }) => (
                  <option key={i} value={i} className="bg-gray-900">
                    ↩ {p.name} ({p.currentHp}/{p.maxHp} HP)
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