import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { runApi } from "../components/api/runApi";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import { ToastContainer, useToast } from "../components/ui/Toast";
import { Trophy, Swords, X, Star, Home, Gem } from "lucide-react";

export default function Results() {
  const navigate = useNavigate();
  const { toasts, toast, dismiss } = useToast();
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId");

  const [run, setRun] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId) { setLoading(false); return; }
    Promise.all([
      runApi.getRun(runId),
      runApi.listRunActions(runId),
    ]).then(([r, acts]) => {
      acts.sort((a, b) => a.idx - b.idx);
      setRun(r);
      setActions(acts);
    }).catch(e => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [runId]);

  // Derive stats from actions
  const stats = useMemo(() => {
    if (!actions.length) return null;
    const battlesWon  = actions.filter(a => a.actionType === "battle_end" && a.payload?.summary?.winner === "player").length;
    const battlesLost = actions.filter(a => a.actionType === "battle_end" && a.payload?.summary?.winner === "enemy").length;
    const gymDefeated = actions.some(a => a.actionType === "gym_defeated");
    const centerUses  = actions.filter(a => a.actionType === "center_used").length;
    const potions     = actions.filter(a => ["shop_visited","event_resolved"].includes(a.actionType)).length;
    const nodesCompleted = actions.filter(a => a.actionType === "node_completed").length;
    const turns       = actions.filter(a => a.actionType === "battle_turn_commit").length;
    const starterConfirm = actions.find(a => a.actionType === "starter_confirm");
    const starters    = starterConfirm?.payload?.team?.map(t => t.name) ?? [];
    // Aether: simple formula for v0.00001
    const aether = battlesWon * 50 + (gymDefeated ? 200 : 0) + nodesCompleted * 10;
    return { battlesWon, battlesLost, gymDefeated, centerUses, potions, nodesCompleted, turns, starters, aether };
  }, [actions]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full" />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );

  if (!run || !stats) return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center">
      <GameCard><p className="text-red-400">Run not found.</p></GameCard>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className={`p-4 rounded-2xl ${stats.gymDefeated ? "bg-amber-500/20 border border-amber-500/30" : "bg-white/5 border border-white/10"}`}>
            {stats.gymDefeated
              ? <Trophy className="w-10 h-10 text-amber-400" />
              : <Swords className="w-10 h-10 text-white/40" />
            }
          </div>
        </div>
        <h1 className="text-3xl font-black text-white mb-1">
          {stats.gymDefeated ? "Victory!" : "Run Complete"}
        </h1>
        <p className="text-white/40 text-sm">
          {stats.gymDefeated
            ? "You defeated Gym Leader Brock and earned the Boulder Badge!"
            : "Your run has ended. Better luck next time!"}
        </p>
      </div>

      {/* Aether reward */}
      <GameCard className="mb-4 text-center py-5">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Gem className="w-5 h-5 text-violet-400" />
          <span className="text-white/50 text-sm font-semibold">Aether Earned</span>
        </div>
        <p className="text-4xl font-black text-violet-300">{stats.aether.toLocaleString()}</p>
        <p className="text-white/25 text-xs mt-1">Placeholder — full economy in future update</p>
      </GameCard>

      {/* Stats grid */}
      <GameCard className="mb-4">
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-3">Run Summary</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Battles Won",    value: stats.battlesWon,      icon: "⚔️",  color: "text-emerald-400" },
            { label: "Battles Lost",   value: stats.battlesLost,     icon: "💀",  color: "text-red-400" },
            { label: "Nodes Visited",  value: stats.nodesCompleted,  icon: "🗺️",  color: "text-sky-400" },
            { label: "Turns Fought",   value: stats.turns,           icon: "🔄",  color: "text-white/60" },
            { label: "Center Heals",   value: stats.centerUses,      icon: "💊",  color: "text-rose-400" },
            { label: "Potions Found",  value: stats.potions,         icon: "🧪",  color: "text-amber-400" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="p-3 rounded-xl bg-white/4 border border-white/8">
              <p className="text-lg mb-0.5">{icon}</p>
              <p className={`text-xl font-black ${color}`}>{value}</p>
              <p className="text-white/30 text-xs">{label}</p>
            </div>
          ))}
        </div>
      </GameCard>

      {/* Gym badge */}
      {stats.gymDefeated && (
        <GameCard className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">Badge Earned</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-lg">
              🏅
            </div>
            <div>
              <p className="text-white font-bold text-sm">Boulder Badge</p>
              <p className="text-white/40 text-xs">Defeated Gym Leader Brock</p>
            </div>
          </div>
        </GameCard>
      )}

      {/* Starter team */}
      {stats.starters.length > 0 && (
        <GameCard className="mb-6">
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">Your Team</p>
          <div className="flex gap-2 flex-wrap">
            {stats.starters.map((name, i) => (
              <span key={i} className="px-2 py-1 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs font-semibold">
                {name}
              </span>
            ))}
          </div>
        </GameCard>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <GameButton
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => navigate(createPageUrl("Home"))}
        >
          <Home className="w-4 h-4" />
          Return Home
        </GameButton>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}