import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useRequiredRunId } from "@/hooks/useRequiredRunId";
import { base44 } from "@/api/base44Client";
import { ToastContainer, useToast } from "../components/ui/Toast";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import { Trophy, Frown, Heart, Star, Coins, Package, ArrowRight, Sparkles } from "lucide-react";

const NODE_ICONS = {
  trainer_weak: "⚔️",
  trainer_avg:  "🗡️",
  trainer_ace:  "⭐",
  trainer:      "⚔️",
  gym:          "👑",
  center:       "💊",
  shop:         "🛍️",
  event:        "✨",
  event_item:   "✨",
};

const OUTCOME_CONFIG = {
  win:      { icon: Trophy, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Victory!" },
  loss:     { icon: Frown,  color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",         label: "Defeated..." },
  healed:   { icon: Heart,  color: "text-pink-400",    bg: "bg-pink-500/10 border-pink-500/20",        label: "Healed!" },
  collected:{ icon: Star,   color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",      label: "Items Found!" },
  visited:  { icon: Package,color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20",   label: "Shop Left" },
};

export default function NodeComplete() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const { toasts, toast, dismiss } = useToast();
  const { runId, handleInvalidRun } = useRequiredRunId({ page: "NodeComplete", toast });
  const nodeId = params.get("nodeId");

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId) { setLoading(false); return; }
    base44.entities.Run.filter({ id: runId }).then(rows => {
      const run = rows[0];
      if (!run) { handleInvalidRun(); setLoading(false); return; }
      const pending = run.results?.progress?.pendingEncounter ?? null;
      if (pending?.lastSummary) {
        setSummary(pending.lastSummary);
      } else {
        // Fallback: build minimal summary from progress
        setSummary({
          nodeId: run.results?.progress?.currentNodeId ?? nodeId,
          nodeType: pending?.nodeType ?? "node",
          nodeLabel: "Node",
          outcome: "visited",
          moneyDelta: 0,
          itemsDelta: {},
          faintCount: 0,
        });
      }
    }).catch(() => handleInvalidRun()).finally(() => setLoading(false));
  }, [runId]);

  const [relicCount, setRelicCount] = useState(null);

  useEffect(() => {
    if (!runId) return;
    base44.entities.Run.filter({ id: runId }).then(rows => {
      const r = rows[0];
      if (r) setRelicCount((r.results?.progress?.relics ?? []).length);
      else handleInvalidRun();
    });
  }, [runId]);

  const handleContinue = async () => {
    if (summary?.runFinished || summary?.outcome === "loss") {
      navigate(createPageUrl(`Results?runId=${runId}`));
      return;
    }

    try {
      await base44.functions.invoke("advanceRouteIfPending", { runId });
    } catch (_) {
      // Non-blocking fallback: if this call fails, return to map without advancing.
    }

    navigate(createPageUrl(`RunMap?runId=${runId}`));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full" />
    </div>
  );

  if (!summary) return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center">
      <GameCard><p className="text-red-400">Summary not found.</p></GameCard>
    </div>
  );

  const outcome = summary.outcome ?? "visited";
  const cfg = OUTCOME_CONFIG[outcome] ?? OUTCOME_CONFIG.visited;
  const OutcomeIcon = cfg.icon;
  const nodeIcon = NODE_ICONS[summary.nodeType] ?? "📍";
  const hasItems = summary.itemsDelta && Object.keys(summary.itemsDelta).length > 0;
  const hasMoney = summary.moneyDelta && summary.moneyDelta > 0;
  const isBattleLoss = outcome === "loss";
  const isRunFinished = summary.runFinished;
  const routeAdvancedTo = summary.routeAdvancedTo ?? null;

  return (
    <div className="max-w-md mx-auto px-4 py-12 space-y-4">
      {/* Title */}
      <div className="text-center space-y-1 mb-6">
        <p className="text-4xl mb-2">{nodeIcon}</p>
        <h1 className="text-2xl font-black text-white">{summary.nodeLabel ?? summary.nodeType}</h1>
        <p className="text-white/40 text-sm">Node Complete</p>
      </div>

      {/* Outcome badge */}
      <GameCard className={`text-center py-6 border ${cfg.bg}`}>
        <OutcomeIcon className={`w-10 h-10 mx-auto mb-3 ${cfg.color}`} />
        <p className={`text-xl font-black ${cfg.color}`}>{cfg.label}</p>
        {isBattleLoss && (
          <p className="text-white/40 text-sm mt-1">Your run has ended.</p>
        )}
        {isRunFinished && !isBattleLoss && (
          <p className="text-emerald-300/80 text-sm mt-1">Run complete!</p>
        )}
        {routeAdvancedTo && (
          <p className="text-cyan-300/80 text-sm mt-1">Gym cleared! Proceed to Route {routeAdvancedTo.routeIndex}.</p>
        )}
      </GameCard>

      {/* Rewards */}
      {(hasMoney || hasItems || summary.faintCount > 0) && (
        <GameCard>
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-3">Results</p>
          <div className="space-y-2">
            {hasMoney && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Coins className="w-4 h-4 text-amber-400" />
                  Money gained
                </div>
                <span className="text-amber-400 font-bold text-sm">+${summary.moneyDelta}</span>
              </div>
            )}
            {hasItems && Object.entries(summary.itemsDelta).map(([item, qty]) => (
              <div key={item} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Package className="w-4 h-4 text-violet-400" />
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </div>
                <span className="text-violet-400 font-bold text-sm">+{qty}</span>
              </div>
            ))}
            {summary.faintCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Frown className="w-4 h-4 text-red-400" />
                  Pokémon fainted
                </div>
                <span className="text-red-400 font-bold text-sm">{summary.faintCount}</span>
              </div>
            )}
          </div>
        </GameCard>
      )}

      {/* Relic count footer */}
      {relicCount !== null && relicCount > 0 && (
        <div className="flex items-center justify-center gap-2 text-amber-400/60 text-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{relicCount} relic{relicCount !== 1 ? "s" : ""} active this run</span>
        </div>
      )}

      {/* Continue button */}
      <GameButton
        variant={isBattleLoss || isRunFinished ? "secondary" : "primary"}
        size="lg"
        className="w-full"
        onClick={handleContinue}
      >
        {isBattleLoss || isRunFinished ? "View Results" : routeAdvancedTo ? (
          <>Proceed to Route {routeAdvancedTo.routeIndex} <ArrowRight className="w-4 h-4" /></>
        ) : (
          <>Continue <ArrowRight className="w-4 h-4" /></>
        )}
      </GameButton>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}