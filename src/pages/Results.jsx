import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { runApi } from "../components/api/runApi";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import { ToastContainer, useToast } from "../components/ui/Toast";
import { Trophy, Swords, Star, Home, Gem, Clock, Skull, CheckCircle2, Upload } from "lucide-react";

function msToTime(ms) {
  if (!ms) return "—";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

export default function Results() {
  const navigate = useNavigate();
  const { toasts, toast, dismiss } = useToast();
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId");

  const [run, setRun] = useState(null);
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    if (!runId) { setLoading(false); return; }
    const [r, me] = await Promise.all([
      runApi.getRun(runId),
      base44.auth.me().catch(() => null),
    ]);
    setRun(r);
    if (me?.id) {
      const players = await base44.entities.Player.filter({ id: me.id }).catch(() => []);
      setPlayer(players[0] ?? null);
    }
  }, [runId]);

  useEffect(() => {
    load().catch(e => toast(e.message, "error")).finally(() => setLoading(false));
  }, []);

  const summary = run?.results?.resultsSummary ?? null;
  const isRanked = run?.isRanked ?? false;
  const alreadySubmitted = run?.results?.submitted ?? false;
  const gymDefeated = (summary?.gymsDefeated ?? 0) >= 1;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("submitRunToLeaderboard", { runId });
      if (res.data?.ok) {
        setSubmitted(true);
        toast("Submitted to leaderboard! 🏆", "success");
        // Refresh run to update submitted flag
        const updated = await runApi.getRun(runId).catch(() => null);
        if (updated) setRun(updated);
      } else {
        toast(res.data?.error || "Submission failed", "error");
      }
    } catch (e) {
      toast(e.response?.data?.error || e.message || "Submission failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full" />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );

  if (!run) return (
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
          <div className={`p-4 rounded-2xl ${gymDefeated ? "bg-amber-500/20 border border-amber-500/30" : "bg-white/5 border border-white/10"}`}>
            {gymDefeated
              ? <Trophy className="w-10 h-10 text-amber-400" />
              : <Swords className="w-10 h-10 text-white/40" />
            }
          </div>
        </div>
        <h1 className="text-3xl font-black text-white mb-1">
          {gymDefeated ? "Victory!" : "Run Complete"}
        </h1>
        <p className="text-white/40 text-sm">
          {gymDefeated
            ? "You defeated Gym Leader Brock and earned the Boulder Badge!"
            : "Your run has ended."}
        </p>
        {isRanked && (
          <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs font-semibold">
            <Star className="w-3 h-3" /> Ranked Run
          </span>
        )}
      </div>

      {/* Aether reward */}
      {summary ? (
        <GameCard className="mb-4 py-5">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Gem className="w-5 h-5 text-violet-400" />
            <span className="text-white/50 text-sm font-semibold">Aether Earned</span>
          </div>
          <p className="text-4xl font-black text-violet-300 text-center">{summary.aetherEarned?.toLocaleString() ?? 0}</p>
          {/* Breakdown */}
          <div className="mt-3 pt-3 border-t border-white/6 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/40">
            <span>Base Aether</span>
            <span className="text-right text-white/60 font-mono">{summary.baseAether}</span>
            <span>Modifier Bonus</span>
            <span className={`text-right font-mono font-semibold ${summary.modifierTotalPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {summary.modifierTotalPct >= 0 ? "+" : ""}{summary.modifierTotalPct}%
            </span>
          </div>
          {player && (
            <p className="text-center text-white/30 text-xs mt-2">
              Total Aether: <span className="text-violet-300 font-bold">{player.aether?.toLocaleString()}</span>
            </p>
          )}
        </GameCard>
      ) : (
        <GameCard className="mb-4 text-center py-5">
          <Gem className="w-7 h-7 text-violet-400/40 mx-auto mb-2" />
          <p className="text-white/30 text-sm">Results not yet computed.</p>
        </GameCard>
      )}

      {/* Stats grid */}
      {summary && (
        <GameCard className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-3">Run Summary</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Battles Won",   value: summary.battlesWon,   icon: "⚔️",  color: "text-emerald-400" },
              { label: "Battles Lost",  value: summary.battlesLost,  icon: "💀",  color: "text-red-400" },
              { label: "Gyms Defeated", value: summary.gymsDefeated, icon: "🏅",  color: "text-amber-400" },
              { label: "Team Faints",   value: summary.faints,       icon: "😵",  color: "text-rose-400" },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="p-3 rounded-xl bg-white/4 border border-white/8">
                <p className="text-lg mb-0.5">{icon}</p>
                <p className={`text-xl font-black ${color}`}>{value ?? 0}</p>
                <p className="text-white/30 text-xs">{label}</p>
              </div>
            ))}
            {summary.durationMs && (
              <div className="col-span-2 p-3 rounded-xl bg-white/4 border border-white/8 flex items-center gap-3">
                <Clock className="w-4 h-4 text-violet-400 shrink-0" />
                <div>
                  <p className="text-white font-bold text-sm">{msToTime(summary.durationMs)}</p>
                  <p className="text-white/30 text-xs">Run Duration</p>
                </div>
              </div>
            )}
          </div>
        </GameCard>
      )}

      {/* Gym badge */}
      {gymDefeated && (
        <GameCard className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">Badge Earned</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-lg">🏅</div>
            <div>
              <p className="text-white font-bold text-sm">Boulder Badge</p>
              <p className="text-white/40 text-xs">Defeated Gym Leader Brock</p>
            </div>
          </div>
        </GameCard>
      )}

      {/* Leaderboard submission (ranked only) */}
      {isRanked && summary && (
        <GameCard className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-3">Ranked Submission</p>
          {alreadySubmitted || submitted ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Submitted to leaderboard ✅</span>
            </div>
          ) : (
            <GameButton
              variant="amber"
              size="md"
              className="w-full"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting}
            >
              <Upload className="w-4 h-4" />
              Submit to Leaderboard
            </GameButton>
          )}
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
        <GameButton
          variant="secondary"
          size="md"
          className="w-full"
          onClick={() => navigate(createPageUrl("Leaderboard"))}
        >
          View Leaderboard
        </GameButton>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}