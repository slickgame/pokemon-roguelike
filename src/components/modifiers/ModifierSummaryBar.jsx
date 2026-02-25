import React from "react";
import { MAX_MODIFIERS } from "./modifiersConfig";

export default function ModifierSummaryBar({ selectedCount, totalPct, validationError }) {
  const multiplier = (1 + totalPct / 100).toFixed(2);
  const multColor = totalPct > 0 ? "text-emerald-400" : totalPct < 0 ? "text-red-400" : "text-white/50";

  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">Selected</span>
        <span className={`font-bold ${selectedCount >= MAX_MODIFIERS ? "text-amber-400" : "text-white"}`}>
          {selectedCount} / {MAX_MODIFIERS}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">Aether Modifier</span>
        <span className={`font-mono font-bold ${multColor}`}>
          ×{multiplier} ({totalPct >= 0 ? "+" : ""}{totalPct}%)
        </span>
      </div>
      {validationError && (
        <p className="text-xs text-red-400 pt-1 border-t border-red-500/20">{validationError}</p>
      )}
    </div>
  );
}