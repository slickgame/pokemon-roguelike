import React from "react";

export default function CommandBuilder({ playerTeam, activeSlots, commands, onChange, enemyActiveSlots, enemyTeam }) {
  const aliveSlots = activeSlots.filter(i => !playerTeam[i]?.fainted);

  return (
    <div className="space-y-3">
      {aliveSlots.map(slot => {
        const poke = playerTeam[slot];
        if (!poke || poke.fainted) return null;
        const cmd = commands[slot] ?? { actorSlot: slot, type: "move", moveId: poke.moves[0]?.id, target: { side: "enemy", slot: enemyActiveSlots.filter(i => !enemyTeam[i]?.fainted)[0] ?? 0 } };

        return (
          <div key={slot} className="bg-white/4 border border-white/8 rounded-xl p-3">
            <p className="text-white/70 text-xs font-semibold mb-2 uppercase tracking-wide">{poke.name}</p>
            <div className="flex gap-2 flex-wrap">
              {/* Move select */}
              <select
                value={cmd.moveId}
                onChange={e => onChange(slot, { ...cmd, moveId: e.target.value })}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500/50 min-w-0"
              >
                {poke.moves.map(m => (
                  <option key={m.id} value={m.id} className="bg-gray-900">
                    {m.name} {m.power ? `(${m.power} BP)` : "(Status)"} — PP:{m.currentPp ?? m.pp}
                  </option>
                ))}
              </select>

              {/* Target select */}
              <select
                value={`${cmd.target.side}:${cmd.target.slot}`}
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
          </div>
        );
      })}
    </div>
  );
}