import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useRequiredRunId } from "@/hooks/useRequiredRunId";
import { base44 } from "@/api/base44Client";
import { runApi } from "../components/api/runApi";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import { ToastContainer, useToast } from "../components/ui/Toast";
import { ShoppingBag, Coins, ArrowLeft } from "lucide-react";
import { SHOP_ITEMS } from "@/lib/shopItems";
import { onShopBuy } from "@/components/engine/relicHooks";


export default function Shop() {
  const navigate = useNavigate();
  const { toasts, toast, dismiss } = useToast();
  const params = new URLSearchParams(window.location.search);
  const { runId, handleInvalidRun } = useRequiredRunId({ page: "Shop", toast });
  const nodeId = params.get("nodeId");
  const shopNodeKey = nodeId || "unknown_shop_node";

  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [selling, setSelling] = useState(null);

  const buildEmptyShopVisitSummary = useCallback(() => ({
    nodeId: shopNodeKey,
    itemsBought: [],
    itemsSold: [],
    moneySpent: 0,
    moneyEarned: 0,
  }), [shopNodeKey]);

  const mergeShopVisitItem = useCallback((items, itemId, valueKey, amount) => {
    const idx = items.findIndex((entry) => entry.itemId === itemId);
    if (idx === -1) {
      return [...items, { itemId, qty: 1, [valueKey]: amount }];
    }
    return items.map((entry, i) => (i === idx
      ? { ...entry, qty: (entry.qty ?? 0) + 1, [valueKey]: (entry[valueKey] ?? 0) + amount }
      : entry));
  }, []);

  const load = useCallback(async () => {
    if (!runId) return;
    const r = await runApi.getRun(runId);
    const baseProgress = r?.results?.progress ?? {};
    const currentSummary = baseProgress.shopVisitSummary;
    const needsSummaryInit = !currentSummary || currentSummary.nodeId !== shopNodeKey;

    if (needsSummaryInit) {
      const nextProgress = {
        ...baseProgress,
        shopVisitSummary: buildEmptyShopVisitSummary(),
      };
      await base44.entities.Run.update(runId, {
        results: { ...(r.results ?? {}), progress: nextProgress },
      });
      const updatedRun = { ...r, results: { ...(r.results ?? {}), progress: nextProgress } };
      setRun(updatedRun);
    } else {
      setRun(r);
    }

  }, [runId, shopNodeKey, buildEmptyShopVisitSummary]);

  useEffect(() => {
    if (!runId) { setLoading(false); return; }
    load().catch(() => handleInvalidRun()).finally(() => setLoading(false));
  }, [runId]);

  const progress = run?.results?.progress ?? {};
  const money = progress.money ?? 0;
  const inventory = progress.inventory ?? { potion: 0, revive: 0 };
  const relics = progress.relics ?? [];
  const shopState = progress.shopState ?? {};
  const currentShopState = shopState[shopNodeKey] ?? { firstPurchaseDiscountUsed: false };
  const shopVisitSummary = progress.shopVisitSummary ?? buildEmptyShopVisitSummary();
  const discountAvailable = onShopBuy({
    relics,
    cost: 100,
    shopFirstPurchaseDone: currentShopState.firstPurchaseDiscountUsed,
  }) < 100;


  const persistProgress = async (updatedProgress) => {
    await base44.entities.Run.update(runId, {
      results: { ...(run.results ?? {}), progress: updatedProgress },
    });

    setRun((r) => ({
      ...r,
      results: { ...(r.results ?? {}), progress: updatedProgress },
    }));
  };

  const handleBuy = async (item) => {
    const originalCost = item.buyPrice;
    const finalCost = onShopBuy({
      relics,
      cost: originalCost,
      shopFirstPurchaseDone: currentShopState.firstPurchaseDiscountUsed,
    });
    const discounted = finalCost < originalCost;

    if (money < finalCost) { toast("Not enough money!", "error"); return; }
    setBuying(item.id);
    try {
      const newMoney = money - finalCost;
      const newInventory = { ...inventory, [item.id]: (inventory[item.id] ?? 0) + 1 };
      const nextShopState = discounted
        ? {
            ...shopState,
            [shopNodeKey]: {
              ...(shopState[shopNodeKey] ?? {}),
              firstPurchaseDiscountUsed: true,
            },
          }
        : shopState;
      const updatedProgress = {
        ...progress,
        money: newMoney,
        inventory: newInventory,
        shopState: nextShopState,
        shopVisitSummary: {
          ...shopVisitSummary,
          itemsBought: mergeShopVisitItem(
            shopVisitSummary.itemsBought ?? [],
            item.id,
            "totalCost",
            finalCost,
          ),
          moneySpent: (shopVisitSummary.moneySpent ?? 0) + finalCost,
        },
      };

      await persistProgress(updatedProgress);
      await runApi.appendAction(runId, "shop_buy", {
        nodeId,
        itemId: item.id,
        qty: 1,
        cost: finalCost,
        discounted,
        originalCost,
        finalCost,
        moneyAfter: newMoney,
      });

      if (discounted) {
        toast(`Bought ${item.name}! Bargain Seal applied: -$${originalCost - finalCost} 💰`, "success");
      } else {
        toast(`Bought ${item.name}! -$${finalCost} 💰`, "success");
      }
    } catch (e) {
      toast(e.message || "Purchase failed", "error");
    } finally {
      setBuying(null);
    }
  };


  const handleSell = async (item) => {
    const currentQty = Math.max(0, inventory[item.id] ?? 0);
    if (currentQty <= 0) {
      toast(`No ${item.name} to sell.`, "error");
      return;
    }

    setSelling(item.id);
    try {
      const newMoney = money + item.sellPrice;
      const newInventory = { ...inventory, [item.id]: Math.max(0, currentQty - 1) };
      const updatedProgress = {
        ...progress,
        money: newMoney,
        inventory: newInventory,
        shopVisitSummary: {
          ...shopVisitSummary,
          itemsSold: mergeShopVisitItem(
            shopVisitSummary.itemsSold ?? [],
            item.id,
            "totalRevenue",
            item.sellPrice,
          ),
          moneyEarned: (shopVisitSummary.moneyEarned ?? 0) + item.sellPrice,
        },
      };

      await persistProgress(updatedProgress);
      await runApi.appendAction(runId, "shop_sell", {
        nodeId,
        itemId: item.id,
        qty: 1,
        revenue: item.sellPrice,
        moneyAfter: newMoney,
      });

      toast(`Sold ${item.name}! +$${item.sellPrice} 💰`, "success");
    } catch (e) {
      toast(e.message || "Sale failed", "error");
    } finally {
      setSelling(null);
    }
  };

  const handleLeave = async () => {
    // Resolve via canonical resolveNode then go to NodeComplete
    if (nodeId && run) {
      try {
        const visitSummary = progress.shopVisitSummary ?? buildEmptyShopVisitSummary();
        const moneySpentValue = visitSummary.moneySpent ?? 0;
        const moneyEarnedValue = visitSummary.moneyEarned ?? 0;
        const nodeSummary = {
          nodeType: "shop",
          itemsBought: visitSummary.itemsBought ?? [],
          itemsSold: visitSummary.itemsSold ?? [],
          moneySpent: moneySpentValue,
          moneyEarned: moneyEarnedValue,
          netMoneyChange: moneyEarnedValue - moneySpentValue,
        };

        await base44.functions.invoke("resolveNode", {
          runId,
          resolution: {
            type: "shop",
            ...nodeSummary,
          },
        });

        const latestRun = await runApi.getRun(runId);
        const latestProgress = latestRun?.results?.progress ?? {};
        await base44.entities.Run.update(runId, {
          results: {
            ...(latestRun?.results ?? {}),
            progress: { ...latestProgress, shopVisitSummary: null },
          },
        });

        navigate(createPageUrl(`NodeComplete?runId=${runId}&nodeId=${nodeId}`));
        return;
      } catch (e) {
        toast(e?.message || "Failed to leave shop", "error");
      }
    }
    navigate(createPageUrl(`RunMap?runId=${runId}`));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full" />
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Poké Mart</h1>
            <p className="text-white/40 text-xs">Stock up before your next battle</p>
            <p className="text-white/30 text-[11px]">Relics equipped: {relics.length}</p>
            {discountAvailable && (
              <p className="text-emerald-300 text-[11px] font-semibold">Bargain Seal: first purchase 50% off</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="text-amber-300 font-bold text-sm">${money}</span>
        </div>
      </div>

      {/* Inventory */}
      <GameCard className="mb-4">
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">Your Bag</p>
        <div className="flex gap-4">
          {SHOP_ITEMS.map(item => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="text-lg">{item.icon}</span>
              <span className="text-white/70 text-sm">{item.name}: <span className="text-white font-bold">{inventory[item.id] ?? 0}</span></span>
            </div>
          ))}
        </div>
      </GameCard>

      {/* Shop items */}
      <GameCard className="mb-6">
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-3">Items for Sale</p>
        <div className="space-y-3">
          {SHOP_ITEMS.map(item => {
            const discountedBuyPrice = onShopBuy({
              relics,
              cost: item.buyPrice,
              shopFirstPurchaseDone: currentShopState.firstPurchaseDiscountUsed,
            });
            const isDiscountedPrice = discountedBuyPrice < item.buyPrice;
            const canAfford = money >= discountedBuyPrice;
            return (
              <div key={item.id} className="flex items-center justify-between bg-white/4 border border-white/8 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="text-white font-semibold text-sm">{item.name}</p>
                    <p className="text-white/40 text-xs">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {isDiscountedPrice ? (
                    <span className="text-xs font-bold text-amber-300">
                      Buy <span className="line-through text-white/40">${item.buyPrice}</span> ${discountedBuyPrice}
                    </span>
                  ) : (
                    <span className={`text-xs font-bold ${canAfford ? "text-amber-400" : "text-white/30"}`}>Buy ${item.buyPrice}</span>
                  )}
                  <span className="text-xs font-bold text-emerald-300/90">Sell ${item.sellPrice}</span>
                  <GameButton
                    variant={canAfford ? "amber" : "secondary"}
                    size="sm"
                    disabled={!canAfford || buying === item.id || selling === item.id}
                    loading={buying === item.id}
                    onClick={() => handleBuy(item)}
                  >
                    Buy
                  </GameButton>
                  <GameButton
                    variant="secondary"
                    size="sm"
                    disabled={(inventory[item.id] ?? 0) <= 0 || selling === item.id || buying === item.id}
                    loading={selling === item.id}
                    onClick={() => handleSell(item)}
                  >
                    Sell
                  </GameButton>
                </div>
              </div>
            );
          })}
        </div>
      </GameCard>

      <GameButton variant="secondary" size="md" className="w-full" onClick={handleLeave}>
        <ArrowLeft className="w-4 h-4" />
        Leave Shop
      </GameButton>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
