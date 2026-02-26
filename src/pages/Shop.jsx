import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { runApi } from "../components/api/runApi";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import { ToastContainer, useToast } from "../components/ui/Toast";
import { ShoppingBag, Coins, ArrowLeft } from "lucide-react";

const SHOP_ITEMS = [
  { id: "potion",  name: "Potion",  cost: 50,  description: "Restores 20 HP to one Pokémon.", icon: "💊" },
  { id: "revive",  name: "Revive",  cost: 200, description: "Revives a fainted Pokémon to 50% HP.", icon: "💫" },
];

export default function Shop() {
  const navigate = useNavigate();
  const { toasts, toast, dismiss } = useToast();
  const params = new URLSearchParams(window.location.search);
  const runId  = params.get("runId");
  const nodeId = params.get("nodeId");

  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);

  const load = useCallback(async () => {
    if (!runId) return;
    const r = await runApi.getRun(runId);
    setRun(r);
  }, [runId]);

  useEffect(() => {
    if (!runId) { setLoading(false); return; }
    load().finally(() => setLoading(false));
  }, [runId]);

  const progress   = run?.results?.progress ?? {};
  const money      = progress.money ?? 0;
  const inventory  = progress.inventory ?? { potion: 0, revive: 0 };

  const handleBuy = async (item) => {
    if (money < item.cost) { toast("Not enough money!", "error"); return; }
    setBuying(item.id);
    try {
      const newMoney = money - item.cost;
      const newInventory = { ...inventory, [item.id]: (inventory[item.id] ?? 0) + 1 };
      const updatedProgress = { ...progress, money: newMoney, inventory: newInventory };

      await base44.entities.Run.update(runId, {
        results: { ...(run.results ?? {}), progress: updatedProgress },
      });
      await runApi.appendAction(runId, "shop_buy", {
        nodeId, itemId: item.id, qty: 1, cost: item.cost,
      });

      setRun(r => ({
        ...r,
        results: { ...(r.results ?? {}), progress: updatedProgress },
      }));
      toast(`Bought ${item.name}! -$${item.cost} 💰`, "success");
    } catch (e) {
      toast(e.message || "Purchase failed", "error");
    } finally {
      setBuying(null);
    }
  };

  const handleLeave = async () => {
    // Mark node complete and return to RunMap
    if (nodeId) {
      const existing = progress.completedNodeIds ?? [];
      const updatedIds = existing.includes(nodeId) ? existing : [...existing, nodeId];
      await base44.entities.Run.update(runId, {
        results: {
          ...(run?.results ?? {}),
          progress: { ...progress, currentNodeId: nodeId, completedNodeIds: updatedIds, pendingEncounter: null },
        },
      });
      await runApi.appendAction(runId, "node_completed", { nodeId, nodeType: "shop" });
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
            const canAfford = money >= item.cost;
            return (
              <div key={item.id} className="flex items-center justify-between bg-white/4 border border-white/8 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="text-white font-semibold text-sm">{item.name}</p>
                    <p className="text-white/40 text-xs">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className={`text-sm font-bold ${canAfford ? "text-amber-400" : "text-white/30"}`}>${item.cost}</span>
                  <GameButton
                    variant={canAfford ? "amber" : "secondary"}
                    size="sm"
                    disabled={!canAfford || buying === item.id}
                    loading={buying === item.id}
                    onClick={() => handleBuy(item)}
                  >
                    Buy
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