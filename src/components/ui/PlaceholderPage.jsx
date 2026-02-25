import React from "react";
import { Construction } from "lucide-react";
import GameCard from "./GameCard";

export default function PlaceholderPage({ title, description, debugInfo }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-5">
          <Construction className="w-8 h-8 text-violet-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
        {description && <p className="text-white/40 text-sm">{description}</p>}
      </div>

      <GameCard className="text-center py-10 mb-6">
        <p className="text-white/30 text-sm font-mono tracking-widest uppercase mb-1">Coming Soon</p>
        <p className="text-white/50 text-sm">This feature is under active development.</p>
      </GameCard>

      {debugInfo && (
        <GameCard className="font-mono text-xs text-white/40 break-all">
          <p className="text-white/20 mb-2 uppercase tracking-widest text-[10px]">Debug</p>
          <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
        </GameCard>
      )}
    </div>
  );
}