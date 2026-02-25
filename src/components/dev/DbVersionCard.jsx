import React from "react";
import GameCard from "../ui/GameCard";
import { Database } from "lucide-react";
import { getManifest, getAllSpecies } from "../db/dbLoader";

export default function DbVersionCard() {
  const manifest = getManifest();
  const speciesCount = getAllSpecies().length;

  return (
    <GameCard>
      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
        <Database className="w-4 h-4 text-cyan-400" />
        DB Version
      </h3>
      <div className="font-mono text-xs space-y-2">
        <div className="flex justify-between items-center py-1.5 border-b border-white/5">
          <span className="text-white/40">dbVersionSemantic</span>
          <span className="text-cyan-300">{manifest.dbVersionSemantic}</span>
        </div>
        <div className="flex justify-between items-center py-1.5 border-b border-white/5">
          <span className="text-white/40">dbVersionHash</span>
          <span className="text-cyan-300 text-[10px]">{manifest.dbVersionHash}</span>
        </div>
        <div className="flex justify-between items-center py-1.5 border-b border-white/5">
          <span className="text-white/40">species loaded</span>
          <span className="text-emerald-400 font-bold">{speciesCount}</span>
        </div>
        <div className="flex justify-between items-center py-1.5">
          <span className="text-white/40">files</span>
          <span className="text-white/30">{manifest.files.length} bundled</span>
        </div>
      </div>
    </GameCard>
  );
}