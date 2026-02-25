import React from "react";

const TYPE_COLORS = {
  grass: "bg-green-500/20 text-green-300", fire: "bg-orange-500/20 text-orange-300",
  water: "bg-blue-500/20 text-blue-300", electric: "bg-yellow-500/20 text-yellow-300",
  bug: "bg-lime-500/20 text-lime-300", poison: "bg-purple-500/20 text-purple-300",
  normal: "bg-gray-500/20 text-gray-300",
};

function HpBar({ current, max }) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  const color = pct > 50 ? "bg-emerald-400" : pct > 20 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="w-full bg-white/10 rounded-full h-2 mt-1">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function PokemonBattleCard({ poke, slot, side, selected, onClick }) {
  if (!poke) return null;
  const fainted = poke.fainted;
  return (
    <button
      onClick={onClick}
      disabled={!onClick || fainted}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        fainted ? "opacity-30 bg-white/2 border-white/5 cursor-default" :
        selected ? "bg-violet-500/20 border-violet-400/50 shadow shadow-violet-500/10" :
        onClick ? "bg-white/4 border-white/8 hover:bg-white/8 hover:border-white/15 cursor-pointer" :
        "bg-white/4 border-white/8"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-white font-semibold text-sm truncate">{poke.name}</span>
        {poke.shiny && <span className="text-amber-300 text-[10px]">✨</span>}
        {poke.status && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 uppercase font-bold">{poke.status}</span>}
      </div>
      <div className="flex gap-1 mb-2">
        {poke.types.map(t => (
          <span key={t} className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${TYPE_COLORS[t] ?? "bg-white/10 text-white/50"}`}>{t}</span>
        ))}
      </div>
      <div className="text-[11px] text-white/50 mb-0.5">{fainted ? "Fainted" : `${poke.currentHp} / ${poke.maxHp} HP`}</div>
      <HpBar current={poke.currentHp} max={poke.maxHp} />
      <div className="text-[10px] text-white/25 mt-1">Lv.{poke.level} · {poke.nature}</div>
    </button>
  );
}