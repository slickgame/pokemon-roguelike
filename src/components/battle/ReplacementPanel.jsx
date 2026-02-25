import React from "react";
import GameCard from "../ui/GameCard";

export default function ReplacementPanel({ pendingReplacement, playerBench, onChoose, choosing }) {
  const { faintedName } = pendingReplacement;

  const availableBench = playerBench
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p && !p.fainted);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
      <GameCard className="w-full max-w-sm border-red-500/30 shadow-2xl shadow-red-500/10">
        <div className="text-center mb-5">
          <p className="text-red-400 font-black text-lg">
            {faintedName ? `${faintedName} fainted!` : "Pokémon Fainted!"}
          </p>
          <p className="text-white/50 text-sm mt-1">
            {faintedName
              ? `Choose a replacement for ${faintedName}.`
              : "Choose a replacement Pokémon."}
          </p>
        </div>

        {availableBench.length === 0 ? (
          <p className="text-red-400 text-sm text-center py-2">
            No healthy Pokémon left on your bench.
          </p>
        ) : (
          <div className="space-y-2">
            {availableBench.map(({ p, i }) => {
              const hpPct = p.currentHp / p.maxHp;
              const barColor = hpPct > 0.5 ? "bg-emerald-400" : hpPct > 0.2 ? "bg-amber-400" : "bg-red-400";
              return (
                <div
                  key={i}
                  className="p-3 rounded-xl border border-white/10 bg-white/4"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-white font-semibold text-sm">{p.name}</span>
                      {p.shiny && <span className="text-amber-300 text-[10px] ml-1">✨</span>}
                      <span className="text-white/35 text-[11px] ml-2">Lv.{p.level}</span>
                    </div>
                    <span className="text-white/40 text-xs">{p.currentHp}/{p.maxHp} HP</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                    <div
                      className={`h-1.5 rounded-full transition-all ${barColor}`}
                      style={{ width: `${hpPct * 100}%` }}
                    />
                  </div>
                  <button
                    onClick={() => onChoose(i)}
                    disabled={choosing}
                    className="w-full py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 active:scale-[0.98] text-white text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {choosing ? "Sending out…" : `Send Out ${p.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </GameCard>
    </div>
  );
}