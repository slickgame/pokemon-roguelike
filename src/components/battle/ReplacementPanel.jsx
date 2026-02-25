import React from "react";
import GameCard from "../ui/GameCard";

export default function ReplacementPanel({ pendingReplacement, playerBench, onChoose, choosing }) {
  const { slot } = pendingReplacement;
  const availableBench = playerBench
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p && !p.fainted);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <GameCard className="w-full max-w-sm border-amber-500/30 shadow-2xl shadow-amber-500/10">
        <div className="text-center mb-4">
          <p className="text-amber-400 font-black text-lg">Pokémon Fainted!</p>
          <p className="text-white/60 text-sm mt-1">
            Choose a replacement for active slot {slot}
          </p>
        </div>

        {availableBench.length === 0 ? (
          <p className="text-red-400 text-sm text-center">No healthy bench Pokémon available.</p>
        ) : (
          <div className="space-y-2">
            {availableBench.map(({ p, i }) => (
              <button
                key={i}
                onClick={() => onChoose(i)}
                disabled={choosing}
                className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/4 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold text-sm">{p.name}</span>
                  {p.shiny && <span className="text-amber-300 text-[10px]">✨</span>}
                </div>
                <div className="text-white/40 text-xs mt-0.5">
                  {p.currentHp}/{p.maxHp} HP · Lv.{p.level} · {p.nature}
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 mt-1.5">
                  <div
                    className={`h-1.5 rounded-full ${
                      p.currentHp / p.maxHp > 0.5 ? "bg-emerald-400" :
                      p.currentHp / p.maxHp > 0.2 ? "bg-amber-400" : "bg-red-400"
                    }`}
                    style={{ width: `${(p.currentHp / p.maxHp) * 100}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}

        {choosing && (
          <div className="flex justify-center mt-3">
            <div className="animate-spin w-5 h-5 border-2 border-amber-500/20 border-t-amber-500 rounded-full" />
          </div>
        )}
      </GameCard>
    </div>
  );
}