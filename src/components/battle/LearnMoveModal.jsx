import React, { useState } from "react";
import GameButton from "../ui/GameButton";

export default function LearnMoveModal({ prompt, currentMoves, onConfirm, onSkip }) {
  const [replacing, setReplacing] = useState(null);

  const handleReplace = (slotIndex) => {
    setReplacing(slotIndex);
    const newMoves = currentMoves.map((m, i) =>
      i === slotIndex
        ? { id: prompt.moveData.id, pp: prompt.moveData.pp, ppMax: prompt.moveData.pp, currentPp: prompt.moveData.pp }
        : m
    );
    onConfirm(newMoves, slotIndex);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
        <div className="text-center">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Level {prompt.level}</p>
          <h2 className="text-white font-bold text-lg">{prompt.pokeName} wants to</h2>
          <h2 className="text-white font-bold text-lg">learn <span className="text-violet-400">{prompt.moveData.name}</span>!</h2>
          <p className="text-white/40 text-xs mt-1">
            {prompt.moveData.type} · {prompt.moveData.category} · {prompt.moveData.power ? `${prompt.moveData.power} BP` : "Status"}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-white/50 text-xs uppercase tracking-widest">Replace a move?</p>
          {currentMoves.map((m, i) => (
            <button
              key={i}
              onClick={() => handleReplace(i)}
              disabled={replacing !== null}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/8 hover:bg-violet-500/10 hover:border-violet-500/30 transition-all text-sm text-white/80 disabled:opacity-40"
            >
              <span className="font-medium">{m.name || m.id}</span>
              <span className="text-white/30 text-xs">PP {m.pp ?? m.ppMax ?? "?"}</span>
            </button>
          ))}
        </div>

        <GameButton
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={onSkip}
          disabled={replacing !== null}
        >
          Skip — Don't learn {prompt.moveData.name}
        </GameButton>
      </div>
    </div>
  );
}