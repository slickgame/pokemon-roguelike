import React from "react";
import GameCard from "../ui/GameCard";
import { RELIC_REGISTRY } from "../engine/relicsData";
import { Sparkles, X } from "lucide-react";

const RARITY_BADGE = {
  common:    "bg-white/10 text-white/50 border-white/10",
  uncommon:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  rare:      "bg-violet-500/15 text-violet-300 border-violet-500/20",
  legendary: "bg-amber-500/15 text-amber-300 border-amber-500/20",
};

export default function RelicPanel({ relics, onClose }) {
  if (!relics || relics.length === 0) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/60 backdrop-blur-sm">
      <GameCard className="w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <p className="text-white font-bold text-sm">Your Relics ({relics.length})</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {relics.map(r => {
            const def = RELIC_REGISTRY[r.id];
            if (!def) return null;
            const badgeStyle = RARITY_BADGE[def.rarity] ?? RARITY_BADGE.common;
            return (
              <div key={r.id} className="flex items-start gap-3 bg-white/4 border border-white/8 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-semibold text-sm">{def.name}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${badgeStyle}`}>
                      {def.rarity}
                    </span>
                  </div>
                  <p className="text-white/40 text-xs leading-relaxed">{def.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </GameCard>
    </div>
  );
}