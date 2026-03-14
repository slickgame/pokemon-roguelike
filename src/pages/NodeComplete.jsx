import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useRequiredRunId } from "@/hooks/useRequiredRunId";
import { base44 } from "@/api/base44Client";
import { ToastContainer, useToast } from "../components/ui/Toast";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import { Trophy, Frown, Heart, Star, Coins, Package, ArrowRight, Sparkles, Wand2, Dumbbell } from "lucide-react";
import { SHOP_ITEM_BY_ID } from "@/lib/shopItems";

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
  win:       { icon: Trophy,  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Victory!" },
  loss:      { icon: Frown,   color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",         label: "Defeated..." },
  healed:    { icon: Heart,   color: "text-pink-400",    bg: "bg-pink-500/10 border-pink-500/20",       label: "Healed!" },
  collected: { icon: Star,    color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",     label: "Items Found!" },
  recruited: { icon: Wand2,   color: "text-cyan-300",    bg: "bg-cyan-500/10 border-cyan-500/20",       label: "Pokémon Recruited!" },
  trained:   { icon: Dumbbell,color: "text-sky-300",     bg: "bg-sky-500/10 border-sky-500/20",         label: "Training Complete!" },
  visited:   { icon: Package, color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20",   label: "Shop Left" },
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
    if (!runId) {
      setLoading(false);
      return;
    }

    const cacheKey = `nodeCompleteSummary:${runId}:${nodeId ?? "unknown"}`;

    const normalizeResolvedSummary = (payload, fallbackNodeId) => {
      if (!payload || typeof payload !== "object") return null;

      const summaryPayload =
        payload.summary && typeof payload.summary === "object"
          ? payload.summary
          : payload;

      const resolvedNodeType = summaryPayload.nodeType ?? payload.nodeType;
      const resolvedNodeId = summaryPayload.nodeId ?? payload.nodeId ?? fallbackNodeId;

      if (!resolvedNodeType && !resolvedNodeId) return null;

      return {
        ...summaryPayload,
        nodeId: resolvedNodeId,
        nodeType: resolvedNodeType ?? "node",
      };
    };

    const loadSummary = async () => {
      try {
        // 1) Prefer cached summary from the previous page
        const cachedRaw = sessionStorage.getItem(cacheKey);
        if (cachedRaw) {
          try {
            const cachedSummary = JSON.parse(cachedRaw);
            if (cachedSummary && typeof cachedSummary === "object") {
              setSummary(cachedSummary);
              setLoading(false);
              return;
            }
          } catch (_) {
            sessionStorage.removeItem(cacheKey);
          }
        }

        // 2) Fallback to backend lookup
        const rows = await base44.entities.Run.filter({ id: runId });
        const run = rows[0];

        if (!run) {
          setSummary({
            nodeId: nodeId ?? null,
            nodeType: "node",
            nodeLabel: "Node",
            outcome: "visited",
            moneyDelta: 0,
            itemsDelta: {},
            faintCount: 0,
          });
          setLoading(false);
          return;
        }

        const progress = run.results?.progress ?? {};
        const pending = progress.pendingEncounter ?? null;
        const fallbackNodeId = progress.currentNodeId ?? nodeId;

        const resolvedFromPending = normalizeResolvedSummary(
          pending?.lastSummary,
          fallbackNodeId
        );

        const resolvedFromProgress = normalizeResolvedSummary(
          progress.lastNodeSummary,
          fallbackNodeId
        );

        const resolveFromActionLog = async () => {
          try {
            const actions = await runApi.listRunActions(runId);
            const nodeResolvedAction = [...(actions ?? [])]
              .reverse()
              .find(
                (action) =>
                  action.actionType === "node_resolved" &&
                  (!nodeId || action.payload?.nodeId === nodeId)
              );

            return normalizeResolvedSummary(
              nodeResolvedAction?.payload,
              fallbackNodeId
            );
          } catch (_) {
            return null;
          }
        };

        const isLikelyShopNode =
          pending?.nodeType === "shop" ||
          resolvedFromPending?.nodeType === "shop" ||
          resolvedFromProgress?.nodeType === "shop";

        const shouldPreferActionLog = Boolean(nodeId) || isLikelyShopNode;

        let resolvedSummary = null;

        if (shouldPreferActionLog) {
          const resolvedFromAction = await resolveFromActionLog();
          resolvedSummary =
            resolvedFromAction ?? resolvedFromPending ?? resolvedFromProgress;
        } else {
          resolvedSummary = resolvedFromPending ?? resolvedFromProgress;
          if (!resolvedSummary) {
            resolvedSummary = await resolveFromActionLog();
          }
        }

        if (resolvedSummary) {
          setSummary(resolvedSummary);
        } else {
          setSummary({
            nodeId: fallbackNodeId,
            nodeType: pending?.nodeType ?? "node",
            nodeLabel: "Node",
            outcome: "visited",
            moneyDelta: 0,
            itemsDelta: {},
            faintCount: 0,
          });
        }
      } catch (_) {
        // Do NOT kick player to Home here. Show a safe fallback instead.
        setSummary({
          nodeId: nodeId ?? null,
          nodeType: "node",
          nodeLabel: "Node",
          outcome: "visited",
          moneyDelta: 0,
          itemsDelta: {},
          faintCount: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [runId, nodeId]);

  const [relicCount, setRelicCount] = useState(null);

  useEffect(() => {
    if (!runId) return;

    base44.entities.Run.filter({ id: runId })
      .then(rows => {
        const r = rows[0];
        if (r) {
          setRelicCount((r.results?.progress?.relics ?? []).length);
        } else {
          // Do not redirect away from NodeComplete here.
          // Just hide relic count if the run can't be fetched.
          setRelicCount(null);
        }
      })
      .catch(() => {
        setRelicCount(null);
      });
  }, [runId]);

  const handleContinue = async () => {
    const cacheKey = `nodeCompleteSummary:${runId}:${nodeId ?? "unknown"}`;
    sessionStorage.removeItem(cacheKey);

    if (summary?.runFinished || summary?.outcome === "loss") {
      navigate(createPageUrl(`Results?runId=${runId}`));
      return;
    }

    try {
      await base44.functions.invoke("advanceRouteIfPending", { runId });
    } catch (_) {
      // Non-blocking fallback
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
  const config = OUTCOME_CONFIG[summary.outcome] ?? OUTCOME_CONFIG.visited;
  const Icon = config.icon;
  const outcomeLabel = summary.outcomeLabel ?? config.label;
  const nodeIcon = NODE_ICONS[summary.nodeType] ?? "📍";
  const hasItems = summary.itemsDelta && Object.keys(summary.itemsDelta).length > 0;
  const hasMoney = summary.moneyDelta && summary.moneyDelta > 0;
  const hasRecruitRoll = typeof summary.roll === "number" && typeof summary.target === "number";
  const hasEvDelta = summary.evDelta && Object.keys(summary.evDelta).length > 0;
  const isBattleLoss = outcome === "loss";
  const isRunFinished = summary.runFinished;
  const routeAdvancedTo = summary.routeAdvancedTo ?? null;

  const isShopSummary = summary.nodeType === "shop";
  const boughtItems = summary.itemsBought ?? [];
  const soldItems = summary.itemsSold ?? [];
  const shopMoneySpent = summary.moneySpent ?? 0;
  const shopMoneyEarned = summary.moneyEarned ?? 0;
  const netMoneyChange = summary.netMoneyChange ?? (shopMoneyEarned - shopMoneySpent);
  const hadShopTransactions = boughtItems.length > 0 || soldItems.length > 0 || shopMoneySpent > 0 || shopMoneyEarned > 0;

  const getShopItemName = (itemId) => SHOP_ITEM_BY_ID[itemId]?.name ?? itemId;

  return (
    <div className="max-w-md mx-auto px-4 py-12 space-y-4">
      {/* Title */}
      <div className="text-center space-y-1 mb-6">
        <p className="text-4xl mb-2">{nodeIcon}</p>
        <h1 className="text-2xl font-black text-white">{summary.nodeLabel ?? summary.nodeType}</h1>
        <p className="text-white/40 text-sm">Node Complete</p>
      </div>

      {/* Outcome badge */}
      <GameCard className={`text-center py-6 border ${config.bg}`}>
        <Icon className={`w-10 h-10 mx-auto mb-3 ${config.color}`} />
        <p className={`text-xl font-black ${config.color}`}>{outcomeLabel}</p>
        {isBattleLoss && (
          <p className="text-white/40 text-sm mt-1">Your run has ended.</p>
        )}
        {isRunFinished && !isBattleLoss && (
          <p className="text-emerald-300/80 text-sm mt-1">Run complete!</p>
        )}
        {routeAdvancedTo && (
          <p className="text-cyan-300/80 text-sm mt-1">
            Gym cleared! Proceed to Route {routeAdvancedTo.routeIndex}.
          </p>
        )}
      </GameCard>

      {hasRecruitRoll && (
  <>
    {summary.consumedItemId ? (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Package className="w-4 h-4 text-amber-300" />
          {summary.consumedItemId}
        </div>
        <span className="text-amber-300 font-bold text-sm">
          -{summary.consumedItemQty ?? 1}
        </span>
      </div>
    ) : null}

    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-white/70">
        <Sparkles className="w-4 h-4 text-cyan-300" />
        Roll
      </div>
      <span className="text-cyan-300 font-bold text-sm">
        {summary.roll} {summary.modifier ? `${summary.modifier >= 0 ? "+" : ""}${summary.modifier}` : ""} = {summary.total}
      </span>
    </div>

    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-white/70">
        <ArrowRight className="w-4 h-4 text-white/50" />
        Target
      </div>
      <span className="text-white font-bold text-sm">{summary.target}+</span>
    </div>
  </>
)}

{summary.recruitedPokemonName ? (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 text-sm text-white/70">
      <Wand2 className="w-4 h-4 text-cyan-300" />
      Pokémon
    </div>
    <span className="text-cyan-300 font-bold text-sm">
      {summary.recruitedPokemonName}
      {summary.recruitedTo ? ` → ${summary.recruitedTo === "storage" ? "Storage" : "Party"}` : ""}
    </span>
  </div>
) : null}

      {/* Rewards */}
      {(hasMoney || hasItems || hasRecruitRoll || hasEvDelta || summary.faintCount > 0 || summary.recruitedPokemonName) && (
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


      {isShopSummary && (
        <GameCard>
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-3">Shop Summary</p>
          {!hadShopTransactions ? (
            <p className="text-sm text-white/50">You left without making any transactions.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-white/70 font-semibold mb-1">Items Bought</p>
                {boughtItems.length === 0 ? (
                  <p className="text-white/40">None</p>
                ) : (
                  <ul className="space-y-1 text-white/80">
                    {boughtItems.map((entry) => (
                      <li key={`buy-${entry.itemId}`} className="flex items-center justify-between">
                        <span>• {getShopItemName(entry.itemId)} x{entry.qty}</span>
                        <span className="text-red-300">(-${entry.totalCost ?? 0})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-white/70 font-semibold mb-1">Items Sold</p>
                {soldItems.length === 0 ? (
                  <p className="text-white/40">None</p>
                ) : (
                  <ul className="space-y-1 text-white/80">
                    {soldItems.map((entry) => (
                      <li key={`sell-${entry.itemId}`} className="flex items-center justify-between">
                        <span>• {getShopItemName(entry.itemId)} x{entry.qty}</span>
                        <span className="text-emerald-300">(+$${entry.totalRevenue ?? 0})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-2 border-t border-white/10 space-y-1">
                <div className="flex items-center justify-between text-white/70">
                  <span>Money Spent</span>
                  <span className="text-red-300">-${shopMoneySpent}</span>
                </div>
                <div className="flex items-center justify-between text-white/70">
                  <span>Money Earned</span>
                  <span className="text-emerald-300">+${shopMoneyEarned}</span>
                </div>
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-white">Net Change</span>
                  <span className={netMoneyChange >= 0 ? "text-emerald-300" : "text-red-300"}>
                    {netMoneyChange >= 0 ? `+$${netMoneyChange}` : `-$${Math.abs(netMoneyChange)}`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </GameCard>
      )}

      {hasEvDelta &&
  Object.entries(summary.evDelta).map(([stat, qty]) => (
    <div key={`ev-${stat}`} className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-white/70">
        <Dumbbell className="w-4 h-4 text-sky-300" />
        {summary.evTargetName
          ? `${summary.evTargetName} ${summary.evLabel ?? stat.toUpperCase()} EV`
          : `${summary.evLabel ?? stat.toUpperCase()} EV`}
      </div>
      <span className="text-sky-300 font-bold text-sm">+{qty}</span>
    </div>
  ))}

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