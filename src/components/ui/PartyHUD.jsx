import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users } from "lucide-react";
import { getActiveRunId } from "@/lib/activeRun";

const STATUS_ICONS = {
  burn:     { icon: "🔥", label: "BRN" },
  poison:   { icon: "☠️", label: "PSN" },
  paralysis:{ icon: "⚡", label: "PAR" },
  sleep:    { icon: "💤", label: "SLP" },
  freeze:   { icon: "🧊", label: "FRZ" },
  confused: { icon: "😵", label: "CNF" },
};

function HpBar({ current, max, fainted }) {
  const pct = fainted ? 0 : Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
  const color = pct > 60 ? "bg-emerald-400" : pct > 25 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-0.5">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function PokemonChip({ mon }) {
  const hpPct = mon.fainted ? 0 : Math.max(0, Math.min(100, ((mon.currentHP ?? 0) / Math.max(1, mon.maxHP ?? 1)) * 100));
  const status = mon.status ? STATUS_ICONS[mon.status] : null;

  return (
    <div
      className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg min-w-[40px] ${mon.fainted ? "opacity-35" : "opacity-100"}`}
      title={`${mon.name} — ${mon.fainted ? "Fainted" : `${mon.currentHP ?? 0}/${mon.maxHP ?? 0} HP`}${mon.status ? ` · ${mon.status}` : ""}`}
    >
      <div className="relative">
        <img
          src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${mon.speciesId}.png`}
          alt={mon.name}
          className="w-7 h-7 object-contain pixelated"
          style={{ imageRendering: "pixelated" }}
        />
        {status && (
          <span className="absolute -top-1 -right-1 text-[8px] leading-none">{status.icon}</span>
        )}
        {mon.fainted && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-black text-red-400 leading-none">FNT</span>
          </div>
        )}
      </div>
      <HpBar current={mon.currentHP ?? 0} max={mon.maxHP ?? 1} fainted={mon.fainted} />
      <span className="text-[8px] text-white/40 leading-none truncate max-w-[36px]">{mon.name}</span>
    </div>
  );
}

export default function PartyHUD({ party = [], runId }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const resolvedRunId = runId ?? getActiveRunId();

  const activeParty = party.slice(0, 6);
  if (activeParty.length === 0) return null;

  const faintedCount = activeParty.filter(m => m.fainted).length;
  const aliveCount = activeParty.length - faintedCount;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/5 border border-white/8 transition-all"
        title="Party status"
      >
        <Users className="w-3.5 h-3.5" />
        <span className="text-emerald-400 font-bold">{aliveCount}</span>
        <span className="text-white/30">/</span>
        <span className="text-white/40">{activeParty.length}</span>
        {faintedCount > 0 && <span className="text-red-400 text-[10px] font-bold ml-0.5">⚠</span>}
      </button>

      {expanded && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 z-50 bg-[#0d0d1a]/95 backdrop-blur-md border border-white/10 rounded-2xl p-3 shadow-2xl shadow-black/50 min-w-[240px]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/50 text-[10px] uppercase tracking-widest font-semibold">Active Party</span>
              {resolvedRunId && (
                <button
                  onClick={() => { setExpanded(false); navigate(createPageUrl(`Party?runId=${resolvedRunId}`)); }}
                  className="text-violet-400 text-[10px] hover:text-violet-300 transition-colors"
                >
                  Full view →
                </button>
              )}
            </div>
            <div className="flex gap-1 flex-wrap">
              {activeParty.map((mon, i) => (
                <PokemonChip key={i} mon={mon} />
              ))}
            </div>
            {faintedCount > 0 && (
              <p className="text-red-400/70 text-[10px] mt-2 text-center">
                {faintedCount} Pokémon fainted
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}