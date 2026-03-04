import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useRequiredRunId } from "@/hooks/useRequiredRunId";
import { base44 } from "@/api/base44Client";
import { ToastContainer, useToast } from "../components/ui/Toast";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import { Heart } from "lucide-react";

export default function Center() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const { toasts, toast, dismiss } = useToast();
  const { runId, handleInvalidRun } = useRequiredRunId({ page: "Center", toast });
  const nodeId = params.get("nodeId");

  const [resolving, setResolving] = useState(false);
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId) { setLoading(false); return; }
    base44.entities.Run.filter({ id: runId })
      .then(rows => { if (rows[0]) setRun(rows[0]); else handleInvalidRun(); })
      .catch(() => handleInvalidRun()).finally(() => setLoading(false));
  }, [runId]);

  const handleHeal = async () => {
    setResolving(true);
    try {
      await base44.functions.invoke("resolveNode", {
        runId,
        resolution: { type: "center" },
      });
      navigate(createPageUrl(`NodeComplete?runId=${runId}&nodeId=${nodeId ?? ""}`));
    } finally {
      setResolving(false);
    }
  };

  const party = run?.results?.progress?.partyState ?? [];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full" />
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6 text-center">
      <div className="space-y-2">
        <p className="text-5xl">💊</p>
        <h1 className="text-2xl font-black text-white">Pokémon Center</h1>
        <p className="text-white/40 text-sm">Welcome! We restore your Pokémon to full health.</p>
      </div>

      {party.length > 0 && (
        <GameCard>
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-3">Your Party</p>
          <div className="space-y-2">
            {party.map((p, i) => {
              const hpPct = Math.round((p.currentHP / p.maxHP) * 100);
              const hpColor = hpPct > 50 ? "bg-emerald-500" : hpPct > 25 ? "bg-amber-500" : "bg-red-500";
              return (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.fainted ? "bg-red-500" : "bg-emerald-500"}`} />
                    <span className="text-white/80 text-sm truncate">{p.name}</span>
                    <span className="text-white/30 text-xs">Lv.{p.level}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${hpColor}`} style={{ width: `${hpPct}%` }} />
                    </div>
                    <span className="text-white/40 text-xs w-14 text-right">{p.currentHP}/{p.maxHP}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </GameCard>
      )}

      <GameCard className="py-6 border border-emerald-500/20 bg-emerald-500/5">
        <Heart className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
        <p className="text-white/70 text-sm">All Pokémon will be fully restored.</p>
        <p className="text-white/30 text-xs mt-1">HP, PP, and status conditions.</p>
      </GameCard>

      <GameButton
        variant="success"
        size="lg"
        className="w-full"
        onClick={handleHeal}
        loading={resolving}
        disabled={resolving}
      >
        <Heart className="w-4 h-4" />
        Heal Party
      </GameButton>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}