import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import RELICS from "../components/engine/relics_mvp.json";
import { Sparkles, ArrowRight } from "lucide-react";

const RELIC_REGISTRY = Object.fromEntries(RELICS.map(r => [r.id, r]));

const RARITY_STYLES = {
  common:    { badge: "bg-white/10 text-white/60 border-white/10",     glow: "border-white/15",    label: "Common" },
  uncommon:  { badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/20", glow: "border-emerald-500/30", label: "Uncommon" },
  rare:      { badge: "bg-violet-500/20 text-violet-300 border-violet-500/20",    glow: "border-violet-500/30",  label: "Rare" },
  legendary: { badge: "bg-amber-500/20 text-amber-300 border-amber-500/20",       glow: "border-amber-500/40",   label: "Legendary" },
};

const TAG_ICONS = {
  battle:  "⚔️",
  map:     "🗺️",
  econ:    "💰",
  shop:    "🛍️",
  targeting: "🎯",
};

export default function RelicReward() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const runId  = params.get("runId");
  const nodeId = params.get("nodeId");
  const source = params.get("source") ?? "gym";

  const [choices, setChoices] = useState(null); // null = loading, [] = cap/empty
  const [reason, setReason]   = useState(null);
  const [selected, setSelected] = useState(null);
  const [taking, setTaking]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId) { setLoading(false); return; }
    base44.functions.invoke("getRelicChoices", { runId, source, nodeId })
      .then(res => {
        const data = res.data;
        setChoices(data.choices ?? []);
        setReason(data.reason ?? null);
      })
      .finally(() => setLoading(false));
  }, [runId]);

  const handleTake = async () => {
    if (!selected) return;
    setTaking(true);
    try {
      await base44.functions.invoke("addRelicToRun", { runId, relicId: selected, source, nodeId });
      navigate(createPageUrl(`NodeComplete?runId=${runId}&nodeId=${nodeId ?? ""}`));
    } finally {
      setTaking(false);
    }
  };

  const handleSkip = () => {
    navigate(createPageUrl(`NodeComplete?runId=${runId}&nodeId=${nodeId ?? ""}`));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full" />
    </div>
  );

  // Cap reached or no choices
  if (!choices || choices.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 space-y-6 text-center">
        <div className="space-y-2">
          <p className="text-5xl">🏅</p>
          <h1 className="text-2xl font-black text-white">Relic Reward</h1>
          {reason === "cap_reached"
            ? <p className="text-white/40 text-sm">Your relic bag is full (cap reached).</p>
            : <p className="text-white/40 text-sm">No relics available right now.</p>
          }
        </div>
        <GameButton variant="primary" size="lg" className="w-full" onClick={handleSkip}>
          Continue <ArrowRight className="w-4 h-4" />
        </GameButton>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <p className="text-xs uppercase tracking-widest text-amber-400/70 font-semibold">
            {source === "gym" ? "Gym Reward" : "Event Find"}
          </p>
          <Sparkles className="w-5 h-5 text-amber-400" />
        </div>
        <h1 className="text-3xl font-black text-white">Choose a Relic</h1>
        <p className="text-white/40 text-sm">Pick one to keep for the rest of this run.</p>
      </div>

      {/* Relic cards */}
      <div className={`grid gap-4 ${choices.length === 3 ? "grid-cols-1 md:grid-cols-3" : choices.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-sm mx-auto"}`}>
        {choices.map(relicId => {
          const relic = RELIC_REGISTRY[relicId];
          if (!relic) return null;
          const style = RARITY_STYLES[relic.rarity] ?? RARITY_STYLES.common;
          const isSelected = selected === relicId;
          return (
            <button
              key={relicId}
              onClick={() => setSelected(relicId)}
              className={`
                text-left rounded-2xl border-2 p-5 transition-all duration-150 focus:outline-none
                ${isSelected
                  ? `bg-white/8 ${style.glow} shadow-lg scale-[1.02]`
                  : `bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15`
                }
              `}
            >
              {/* Rarity badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${style.badge}`}>
                  {style.label}
                </span>
                <div className="flex gap-1">
                  {relic.tags.map(tag => (
                    <span key={tag} className="text-xs" title={tag}>{TAG_ICONS[tag] ?? "🔹"}</span>
                  ))}
                </div>
              </div>

              {/* Name */}
              <h3 className="text-white font-bold text-base mb-1">{relic.name}</h3>

              {/* Description */}
              <p className="text-white/50 text-sm leading-relaxed">{relic.description}</p>

              {/* Selected indicator */}
              {isSelected && (
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-violet-400" />
                  <span className="text-violet-300 text-xs font-semibold">Selected</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        <GameButton
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleTake}
          disabled={!selected || taking}
          loading={taking}
        >
          <Sparkles className="w-4 h-4" />
          Take Relic
        </GameButton>
        <button
          onClick={handleSkip}
          className="text-white/30 text-sm hover:text-white/50 transition-colors"
        >
          Skip (take nothing)
        </button>
      </div>
    </div>
  );
}