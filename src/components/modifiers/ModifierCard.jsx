import React from "react";
import { Lock } from "lucide-react";

export default function ModifierCard({ modifier, selected, disabled, disabledReason, onToggle }) {
  const isLocked = modifier.locked;
  const isDisabled = isLocked || (disabled && !selected);
  const pct = modifier.aetherPct;

  const pctLabel = pct === 0 ? "±0%" : pct > 0 ? `+${pct}%` : `${pct}%`;
  const pctColor = pct > 0 ? "text-emerald-400" : pct < 0 ? "text-red-400" : "text-white/30";

  return (
    <button
      onClick={() => !isLocked && onToggle(modifier.id)}
      disabled={isDisabled}
      title={disabledReason || (isLocked ? "Coming soon" : undefined)}
      className={`
        w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm
        ${selected
          ? "bg-violet-500/15 border-violet-500/40 text-white"
          : isDisabled
            ? "bg-white/2 border-white/5 text-white/25 cursor-not-allowed"
            : "bg-white/4 border-white/8 text-white/70 hover:bg-white/8 hover:border-white/15 hover:text-white cursor-pointer"
        }
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium leading-snug">{modifier.name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isLocked && <Lock className="w-3 h-3 text-white/20" />}
          <span className={`font-mono text-xs font-bold ${selected ? (pct > 0 ? "text-emerald-400" : pct < 0 ? "text-red-400" : "text-white/30") : pctColor}`}>
            {pctLabel}
          </span>
        </div>
      </div>
      <p className="text-xs text-white/35 mt-0.5 leading-snug">{modifier.description}</p>
    </button>
  );
}