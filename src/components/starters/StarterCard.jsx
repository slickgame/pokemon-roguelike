import React from "react";

const TYPE_COLORS = {
  grass:    "bg-green-500/20 text-green-300 border-green-500/30",
  fire:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  water:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
  electric: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  bug:      "bg-lime-500/20 text-lime-300 border-lime-500/30",
  poison:   "bg-purple-500/20 text-purple-300 border-purple-500/30",
  normal:   "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

function TypeBadge({ type }) {
  const cls = TYPE_COLORS[type] ?? "bg-white/10 text-white/60 border-white/15";
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${cls}`}>
      {type}
    </span>
  );
}

export default function StarterCard({ candidate, selected, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full text-left rounded-2xl border p-4 transition-all duration-150 relative
        ${selected
          ? "bg-violet-500/20 border-violet-400/60 shadow-lg shadow-violet-500/15"
          : disabled
            ? "bg-white/2 border-white/5 opacity-40 cursor-not-allowed"
            : "bg-white/4 border-white/8 hover:bg-white/8 hover:border-white/20 cursor-pointer"
        }
      `}
    >
      {/* Shiny badge */}
      {candidate.shiny && (
        <span className="absolute top-2 right-2 text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded">
          ✨ Shiny
        </span>
      )}

      {/* Name */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`font-bold text-base ${selected ? "text-white" : "text-white/90"}`}>
          {candidate.name}
        </span>
      </div>

      {/* Types */}
      <div className="flex gap-1 mb-3">
        {candidate.types.map(t => <TypeBadge key={t} type={t} />)}
      </div>

      {/* Nature / Ability */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/35 uppercase tracking-wider">Nature</span>
          <span className="text-[12px] text-white/70 font-medium">{candidate.nature}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/35 uppercase tracking-wider">Ability</span>
          <span className="text-[12px] text-white/70 font-medium capitalize">{candidate.abilityId?.replace(/_/g, " ")}</span>
        </div>
      </div>

      {/* Selected indicator */}
      {selected && (
        <div className="mt-3 pt-2 border-t border-violet-500/30 text-center text-xs text-violet-300 font-semibold">
          ✓ Selected
        </div>
      )}
    </button>
  );
}