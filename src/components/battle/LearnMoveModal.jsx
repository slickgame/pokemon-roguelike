import React, { useState } from "react";
import GameCard from "../ui/GameCard";
import GameButton from "../ui/GameButton";
import { Sparkles, X } from "lucide-react";

/**
 * LearnMoveModal — shown when a Pokémon levels up and wants to learn a new move.
 * Props:
 *   prompt: { pokemonName, newMoveId, newMoveName, currentMoves: [{id,name,...}] }
 *   onLearn(replaceIndex | null) — null = skip, number = replace that slot
 */
export default function LearnMoveModal({ prompt, onLearn }) {
  const [hovered, setHovered] = useState(null);
  if (!prompt) return null;

  const { pokemonName, newMoveName, newMoveId, currentMoves } = prompt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <GameCard className="max-w-sm w-full" glow>
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">{pokemonName} wants to learn</p>
            <p className="text-amber-300 font-black text-lg leading-tight">{newMoveName}</p>
          </div>
        </div>

        {currentMoves.length < 4 ? (
          /* Auto-learn — shouldn't normally show this modal, but just in case */
          <div className="space-y-3">
            <p className="text-white/50 text-xs">{pokemonName} has room — it will learn {newMoveName} automatically.</p>
            <GameButton variant="success" size="md" className="w-full" onClick={() => onLearn(-1)}>
              Learn {newMoveName}
            </GameButton>
          </div>
        ) : (
          /* Replace prompt */
          <div className="space-y-2">
            <p className="text-white/50 text-xs mb-3">
              {pokemonName} already knows 4 moves. Choose one to replace, or skip.
            </p>
            {currentMoves.map((mv, idx) => (
              <button
                key={idx}
                onClick={() => onLearn(idx)}
                onMouseEnter={() => setHovered(idx)}
                onMouseLeave={() => setHovered(null)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all
                  ${hovered === idx
                    ? "border-amber-500/60 bg-amber-500/10 text-white"
                    : "border-white/10 bg-white/4 text-white/70 hover:border-white/20"
                  }`}
              >
                <span className="font-semibold">{mv.name ?? mv.id}</span>
                {hovered === idx && (
                  <span className="text-amber-400 text-xs font-medium">Replace →</span>
                )}
              </button>
            ))}

            <button
              onClick={() => onLearn(null)}
              className="w-full flex items-center justify-center gap-1.5 mt-1 px-3 py-2 rounded-xl border border-white/8 text-white/35 text-xs hover:text-white/55 hover:border-white/15 transition-all"
            >
              <X className="w-3 h-3" />
              Don't learn {newMoveName}
            </button>
          </div>
        )}
      </GameCard>
    </div>
  );
}