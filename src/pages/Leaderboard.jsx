import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import GameCard from "../components/ui/GameCard";
import { Trophy, Zap, Clock, Skull } from "lucide-react";

const CATEGORIES = ["standard", "hardcore", "event"];

function msToMinutes(ms) {
  if (!ms) return "—";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

export default function Leaderboard() {
  const [category, setCategory] = useState("standard");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    base44.functions.invoke("getLeaderboard", { category })
      .then(res => setEntries(res.data.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Trophy className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
          <p className="text-white/40 text-sm">Top runs by Aether earned</p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/4 border border-white/6 mb-6 w-fit">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize
              ${category === cat
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/20"
                : "text-white/40 hover:text-white/70"
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-white/4 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <GameCard className="text-center py-12">
          <p className="text-white/30 text-sm">No entries yet for this category.</p>
        </GameCard>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <GameCard key={i} className={`flex items-center gap-4 py-4 ${i === 0 ? "border-amber-500/20 bg-amber-500/5" : ""}`}>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0
                ${i === 0 ? "bg-amber-500/20 text-amber-300" : "bg-white/6 text-white/40"}`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-sm font-medium truncate">
                  {entry.playerId?.slice(0, 16) || "Unknown"}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-white/40 shrink-0">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  {entry.aetherEarned?.toLocaleString() || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Skull className="w-3 h-3 text-red-400" />
                  {entry.faints ?? 0}
                </span>
                <span className="flex items-center gap-1 hidden sm:flex">
                  <Clock className="w-3 h-3 text-violet-400" />
                  {msToMinutes(entry.durationMs)}
                </span>
              </div>
            </GameCard>
          ))}
        </div>
      )}

      <GameCard className="mt-6 font-mono text-xs text-white/25 break-all">
        <p className="text-white/15 mb-2 uppercase tracking-widest text-[10px]">Debug · category={category}</p>
        <pre>{JSON.stringify({ count: entries.length }, null, 2)}</pre>
      </GameCard>
    </div>
  );
}