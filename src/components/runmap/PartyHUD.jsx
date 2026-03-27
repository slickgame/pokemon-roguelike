import React, { useState } from "react";

function getSpriteUrl(speciesId) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${speciesId}.png`;
}

function getHpPct(mon) {
  const cur = mon.currentHP ?? mon.currentHp ?? 0;
  const max = mon.maxHP ?? mon.maxHp ?? 1;
  return Math.max(0, Math.min(100, (cur / max) * 100));
}

function getHpColor(pct) {
  if (pct <= 25) return "bg-red-500";
  if (pct <= 50) return "bg-yellow-400";
  return "bg-emerald-500";
}

function getStatusIcon(status, fainted) {
  if (fainted) return { icon: "✕", cls: "text-red-400", title: "Fainted" };
  if (!status) return null;
  const map = {
    burn: { icon: "🔥", cls: "text-orange-400", title: "Burned" },
    poison: { icon: "☠", cls: "text-purple-400", title: "Poisoned" },
    paralysis: { icon: "⚡", cls: "text-yellow-400", title: "Paralyzed" },
    sleep: { icon: "💤", cls: "text-blue-300", title: "Asleep" },
    freeze: { icon: "❄", cls: "text-cyan-300", title: "Frozen" },
  };
  return map[status] ?? { icon: "?", cls: "text-white/40", title: status };
}

export function PartyHUDMini({ mon, bench = false }) {
  return <PokeMini mon={mon} label={bench ? "Bench" : "Active"} />;
}

function PokeMini({ mon, label }) {
  const [imgErr, setImgErr] = React.useState(false);
  const hpPct = getHpPct(mon);
  const statusInfo = getStatusIcon(mon.status, mon.fainted);

  return (
    <div
      className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all
        ${mon.fainted
          ? "bg-red-950/30 border-red-900/30 opacity-60"
          : "bg-white/4 border-white/8"}
        ${mon.shiny ? "border-yellow-500/30 shadow-[0_0_8px_rgba(234,179,8,0.12)]" : ""}
      `}
      title={`${mon.name} — ${mon.currentHP ?? mon.currentHp ?? 0}/${mon.maxHP ?? mon.maxHp ?? 0} HP`}
    >
      {/* Sprite */}
      <div className="relative w-8 h-8 flex items-center justify-center">
        {!imgErr ? (
          <img
            src={getSpriteUrl(mon.speciesId)}
            alt={mon.name}
            className={`w-8 h-8 object-contain pixelated ${mon.fainted ? "grayscale opacity-40" : ""}`}
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-white/30">
            {mon.name?.[0] ?? "?"}
          </div>
        )}
        {/* Status icon overlay */}
        {statusInfo && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 text-[9px] leading-none ${statusInfo.cls}`}
            title={statusInfo.title}
          >
            {statusInfo.icon}
          </span>
        )}
      </div>

      {/* Name */}
      <span className="text-[9px] text-white/50 leading-none truncate max-w-[36px] text-center">
        {mon.name}
      </span>

      {/* HP bar */}
      <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getHpColor(hpPct)}`}
          style={{ width: `${hpPct}%` }}
        />
      </div>

      {/* HP text */}
      <span className="text-[8px] text-white/30 leading-none">
        {Math.round(hpPct)}%
      </span>

      {/* Label (Active/Bench) */}
      <span className={`text-[7px] uppercase tracking-wider font-semibold leading-none ${label === "Active" ? "text-emerald-400/70" : "text-white/20"}`}>
        {label}
      </span>
    </div>
  );
}

export default function PartyHUD({ partyState = [] }) {
  const active = partyState.slice(0, 3);
  const bench = partyState.slice(3, 6).filter(Boolean);

  if (partyState.length === 0) return null;

  return (
    <div className="flex gap-3 justify-between">
      {/* Active Pokémon — left */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[8px] uppercase tracking-widest text-white/20 font-semibold text-center">Active</p>
        <div className="flex flex-col gap-1">
          {active.map((mon, i) => mon ? (
            <PokeMini key={i} mon={mon} label="Active" />
          ) : (
            <div key={i} className="w-[52px] h-[84px] rounded-xl border border-white/5 bg-white/2" />
          ))}
        </div>
      </div>

      {/* Route overview slot — this is a spacer, the actual GameCard goes here in RunMap */}
      <div className="flex-1" />

      {/* Bench Pokémon — right */}
      {bench.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[8px] uppercase tracking-widest text-white/20 font-semibold text-center">Bench</p>
          <div className="flex flex-col gap-1">
            {bench.map((mon, i) => (
              <PokeMini key={i} mon={mon} label="Bench" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}