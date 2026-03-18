import React, { useState } from "react";
import { X } from "lucide-react";
import GameButton from "../ui/GameButton";

/**
 * BagModal — usable from RunMap (context="map") and Battle (context="battle").
 *
 * Props:
 *  - inventory: { potion: number, revive: number }
 *  - party: array of poke objects from battle state or partyState (must have name, currentHp/currentHP, maxHp/maxHP, fainted)
 *  - onUse: (itemId, partyIndex) => Promise<void>
 *  - onClose: () => void
 *  - context: "map" | "battle"
 */
export default function BagModal({ inventory, party, onUse, onClose, context = "map" }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [using, setUsing] = useState(false);

  const ITEMS = [
    { id: "potion",   name: "Potion",   icon: "💊", desc: "Heals 20 HP",                         count: inventory?.potion ?? 0 },
    { id: "revive",   name: "Revive",   icon: "💫", desc: "Revives to 50% HP",                    count: inventory?.revive ?? 0 },
    { id: "pokeball", name: "Poké Ball", icon: "🔴", desc: "Used in wild capture event encounters", count: inventory?.pokeball ?? 0 },
  ];

  // Normalize poke HP fields (partyState uses currentHP/maxHP, battle uses currentHp/maxHp)
  function normalize(p) {
    return {
      ...p,
      currentHp: p.currentHp ?? p.currentHP ?? 0,
      maxHp:     p.maxHp     ?? p.maxHP     ?? 1,
    };
  }

  function canTarget(item, poke) {
    const p = normalize(poke);
    if (item === "revive")  return p.fainted;
    if (item === "potion")  return !p.fainted && p.currentHp < p.maxHp;
    if (item === "pokeball") return false;
    return false;
  }

  const handleUse = async (partyIndex) => {
    if (!selectedItem || using) return;
    setUsing(true);
    try {
      await onUse(selectedItem, partyIndex);
      onClose();
    } finally {
      setUsing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-[#0d0d1a] border border-white/10 rounded-2xl shadow-2xl p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">🎒 Bag</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {context === "battle" && (
          <p className="text-white/40 text-xs mb-3">Using an item consumes that Pokémon's action for this turn.</p>
        )}

        {/* Item selection */}
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">Select Item</p>
        <div className="flex gap-2 mb-4">
          {ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => item.count > 0 && setSelectedItem(item.id)}
              disabled={item.count === 0}
              className={`flex-1 flex flex-col items-center gap-1 py-2 px-3 rounded-xl border transition-all
                ${selectedItem === item.id
                  ? "border-violet-500/60 bg-violet-500/15"
                  : item.count > 0
                    ? "border-white/10 bg-white/4 hover:bg-white/8 cursor-pointer"
                    : "border-white/5 bg-white/2 opacity-40 cursor-not-allowed"
                }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-white text-xs font-semibold">{item.name}</span>
              <span className="text-white/40 text-[10px]">x{item.count}</span>
            </button>
          ))}
        </div>

        {/* Target selection */}
        {selectedItem && (
          <>
            <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">Choose Target</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {party.filter(Boolean).map((rawPoke, i) => {
                const poke = normalize(rawPoke);
                const eligible = canTarget(selectedItem, poke);
                const hpPct = poke.maxHp > 0 ? poke.currentHp / poke.maxHp : 0;
                return (
                  <button
                    key={i}
                    disabled={!eligible || using}
                    onClick={() => eligible && handleUse(i)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-left
                      ${eligible
                        ? "border-white/10 bg-white/4 hover:bg-violet-500/15 hover:border-violet-500/40 cursor-pointer"
                        : "border-white/5 bg-white/2 opacity-40 cursor-not-allowed"
                      }`}
                  >
                    <div>
                      <span className="text-white text-sm font-semibold">{poke.name}</span>
                      {poke.fainted
                        ? <span className="text-red-400 text-xs ml-2">Fainted</span>
                        : <span className="text-white/40 text-xs ml-2">{poke.currentHp}/{poke.maxHp} HP</span>
                      }
                    </div>
                    {!poke.fainted && (
                      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden ml-3">
                        <div
                          className={`h-full rounded-full transition-all ${hpPct > 0.5 ? "bg-emerald-500" : hpPct > 0.25 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.max(0, hpPct * 100)}%` }}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {!selectedItem && (
          <p className="text-white/25 text-xs text-center py-4">
            Select an item above to choose a target.
          </p>
        )}

        {selectedItem === "pokeball" && (
          <p className="text-white/25 text-xs text-center py-4">
            Poké Balls are used during wild capture event encounters, not as normal bag items.
          </p>
        )}

        <GameButton variant="secondary" size="sm" className="w-full mt-4" onClick={onClose}>
          Close
        </GameButton>
      </div>
    </div>
  );
}