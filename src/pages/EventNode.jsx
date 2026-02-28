import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import { Star, Package } from "lucide-react";

export default function EventNode() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId");
  const nodeId = params.get("nodeId");

  const [resolving, setResolving] = useState(false);
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId) { setLoading(false); return; }
    base44.entities.Run.filter({ id: runId })
      .then(rows => { if (rows[0]) setRun(rows[0]); })
      .finally(() => setLoading(false));
  }, [runId]);

  const handleCollect = async () => {
    setResolving(true);
    try {
      await base44.functions.invoke("resolveNode", {
        runId,
        resolution: { type: "event_item", itemsDelta: { potion: 1 } },
      });
      navigate(createPageUrl(`NodeComplete?runId=${runId}&nodeId=${nodeId ?? ""}`));
    } finally {
      setResolving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full" />
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6 text-center">
      <div className="space-y-2">
        <p className="text-5xl">✨</p>
        <h1 className="text-2xl font-black text-white">Supply Cache</h1>
        <p className="text-white/40 text-sm">You found an abandoned bag on the road.</p>
      </div>

      <GameCard className="py-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Package className="w-8 h-8 text-violet-400" />
          <div className="text-left">
            <p className="text-white font-bold">Potion ×1</p>
            <p className="text-white/40 text-xs">Restores 20 HP to one Pokémon</p>
          </div>
        </div>
        <p className="text-white/50 text-sm">Take the items?</p>
      </GameCard>

      <GameButton
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleCollect}
        loading={resolving}
        disabled={resolving}
      >
        <Star className="w-4 h-4" />
        Take Items
      </GameButton>
    </div>
  );
}