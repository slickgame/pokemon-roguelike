import React, { useState } from "react";
import GameButton from "../ui/GameButton";

export default function EvolveModal({ prompt, onConfirm, onSkip }) {
  const [submitting, setSubmitting] = useState(false);

  const handle = async (fn) => {
    setSubmitting(true);
    try {
      await fn();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
        <div className="text-center">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Level {prompt.level}</p>
          <h2 className="text-white font-bold text-lg">{prompt.pokeName} is evolving!</h2>
          <p className="text-white/40 text-xs mt-1">
            {prompt.fromSpeciesName} → <span className="text-emerald-400">{prompt.targetSpeciesName}</span>
          </p>
        </div>

        <div className="text-xs text-white/50 bg-white/5 border border-white/10 rounded-xl p-3">
          New type(s): {Array.isArray(prompt.targetTypes) ? prompt.targetTypes.join(" / ") : "Unknown"}
        </div>

        <GameButton
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() => handle(onConfirm)}
          disabled={submitting}
        >
          Evolve into {prompt.targetSpeciesName}
        </GameButton>

        <GameButton
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => handle(onSkip)}
          disabled={submitting}
        >
          Stop evolution
        </GameButton>
      </div>
    </div>
  );
}
