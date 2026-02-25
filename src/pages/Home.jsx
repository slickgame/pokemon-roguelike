import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import { ToastContainer, useToast } from "../components/ui/Toast";
import { Swords, Zap, Shield, Star, ArrowRight, AlertCircle } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [season, setSeason] = useState(null);
  const { toasts, toast, dismiss } = useToast();

  useEffect(() => {
    base44.functions.invoke("getCurrentSeason", {})
      .then(res => setSeason(res.data))
      .catch(() => {});
  }, []);

  const handleStartRun = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("startRun", {
        isRanked: false,
        modifierIds: [],
      });
      const { runId, seed } = res.data;
      toast(`Run created! Seed: ${seed.slice(0, 8)}…`, "success");
      setTimeout(() => {
        navigate(createPageUrl(`StarterSelect?runId=${runId}`));
      }, 600);
    } catch (err) {
      toast(err.message || "Failed to start run", "error");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-6">
          <Zap className="w-3 h-3" />
          v0.0.1 · M0 Skeleton
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-4">
          Poké<span className="text-violet-400">Rogue</span>
        </h1>
        <p className="text-white/40 text-lg max-w-md mx-auto leading-relaxed">
          A browser-based Pokémon roguelike. Build your team. Conquer the run. Claim the Aether.
        </p>
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-4 mb-14">
        <GameButton
          size="xl"
          onClick={handleStartRun}
          loading={loading}
          className="w-full max-w-xs"
        >
          <Swords className="w-5 h-5" />
          Start Run
          <ArrowRight className="w-4 h-4 ml-1" />
        </GameButton>
        <p className="text-white/25 text-xs">Unranked · No modifiers</p>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {[
          {
            icon: Swords,
            color: "text-violet-400",
            bg: "bg-violet-500/10 border-violet-500/15",
            title: "Roguelike Runs",
            desc: "Every run is unique with seeded generation, modifiers, and escalating difficulty.",
          },
          {
            icon: Star,
            color: "text-amber-400",
            bg: "bg-amber-500/10 border-amber-500/15",
            title: "Seasons & Leaderboard",
            desc: "Compete each season for the top Aether score across categories.",
          },
          {
            icon: Shield,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/15",
            title: "Carryover Roster",
            desc: "Your best Pokémon persist across seasons with inherited talents.",
          },
        ].map(({ icon: Icon, color, bg, title, desc }) => (
          <GameCard key={title} className="group hover:border-white/12 transition-all">
            <div className={`inline-flex p-2.5 rounded-xl border ${bg} mb-4`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <h3 className="font-semibold text-white mb-1.5">{title}</h3>
            <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
          </GameCard>
        ))}
      </div>

      {/* Season Status */}
      {season && (
        <GameCard className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/60 text-sm">Season {season.seasonId}</span>
          </div>
          <span className="text-white/20">·</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
            season.state === "ACTIVE_EVENT"
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-amber-500/15 text-amber-300"
          }`}>
            {season.state}
          </span>
          <span className="ml-auto text-white/25 text-xs font-mono">{season.dbVersionHash}</span>
        </GameCard>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}