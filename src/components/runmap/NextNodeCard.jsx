import React from "react";
import NodeIcon, { getNodeConfig } from "./NodeIcon";
import { ArrowRight } from "lucide-react";

const TIER_LABEL = { weak: "Lv.5 Trainer", avg: "Lv.6 Trainer", skilled: "Lv.7 Ace Trainer", boss: "Gym Leader" };

export default function NextNodeCard({ node, onClick, disabled }) {
  const cfg = getNodeConfig(node.type, node.tier);

  const typeLabel = {
    trainer: TIER_LABEL[node.tier] ?? "Trainer",
    center: "Pokémon Center",
    shop: "Poké Mart",
    event: "Item Event",
    gym: "Gym Leader Battle",
  }[node.type] ?? node.type;

  const description = {
    trainer: node.meta?.trainerName ?? "A trainer challenges you!",
    center: "Heal your party fully.",
    shop: "Buy items.",
    event: "Find an item on the road.",
    gym: `Face ${node.meta?.leaderName ?? "the Gym Leader"}! Win the ${node.meta?.badge ?? "badge"}.`,
  }[node.type] ?? "";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        group w-full text-left p-3 rounded-xl border transition-all
        ${cfg.bg} hover:opacity-90 active:scale-[0.98]
        disabled:opacity-40 disabled:cursor-not-allowed
        ${node.type === "gym" ? "ring-1 ring-amber-500/30" : ""}
      `}
    >
      <div className="flex items-center gap-3">
        <NodeIcon type={node.type} tier={node.tier} size="md" available={true} />
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${cfg.color}`}>{typeLabel}</p>
          <p className="text-white/50 text-xs truncate">{description}</p>
        </div>
        <ArrowRight className={`w-4 h-4 ${cfg.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
      </div>
    </button>
  );
}