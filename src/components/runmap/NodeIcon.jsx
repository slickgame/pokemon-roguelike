import React from "react";
import { Swords, Heart, ShoppingBag, Star, Crown, Sparkles, MapPin } from "lucide-react";

// Returns icon + color config for a node
export function getNodeConfig(type, tier) {
  if (type === "gym") return {
    icon: Crown,
    color: "text-amber-400",
    bg: "bg-amber-500/20 border-amber-500/40",
    label: "Gym Leader",
    glow: "shadow-amber-500/30",
  };
  if (type === "center") return {
    icon: Heart,
    color: "text-rose-400",
    bg: "bg-rose-500/20 border-rose-500/40",
    label: "Pokémon Center",
    glow: "shadow-rose-500/20",
  };
  if (type === "shop") return {
    icon: ShoppingBag,
    color: "text-emerald-400",
    bg: "bg-emerald-500/20 border-emerald-500/40",
    label: "Poké Mart",
    glow: "shadow-emerald-500/20",
  };
  if (type === "event") return {
    icon: Sparkles,
    color: "text-sky-400",
    bg: "bg-sky-500/20 border-sky-500/40",
    label: "Event",
    glow: "shadow-sky-500/20",
  };
  // trainer
  const tierConfig = {
    weak:    { icon: Swords, color: "text-white/60", bg: "bg-white/8 border-white/15", label: "Youngster", glow: "" },
    avg:     { icon: Swords, color: "text-violet-300", bg: "bg-violet-500/20 border-violet-500/30", label: "Hiker", glow: "shadow-violet-500/20" },
    skilled: { icon: Star,   color: "text-amber-300", bg: "bg-amber-500/20 border-amber-400/40",   label: "Ace Trainer", glow: "shadow-amber-400/20" },
  };
  return tierConfig[tier] ?? tierConfig.weak;
}

export default function NodeIcon({ type, tier, size = "md", completed = false, active = false, available = false }) {
  const cfg = getNodeConfig(type, tier);
  const Icon = cfg.icon;

  const sizes = {
    sm:  { outer: "w-7 h-7",  icon: "w-3.5 h-3.5" },
    md:  { outer: "w-10 h-10", icon: "w-5 h-5" },
    lg:  { outer: "w-14 h-14", icon: "w-7 h-7" },
  };
  const sz = sizes[size] ?? sizes.md;

  let ringClass = "";
  if (active)     ringClass = "ring-2 ring-violet-400 ring-offset-1 ring-offset-transparent";
  else if (available) ringClass = "ring-2 ring-white/30";

  return (
    <div className={`
      relative flex items-center justify-center rounded-xl border transition-all
      ${sz.outer} ${cfg.bg} ${ringClass}
      ${completed ? "opacity-40 grayscale" : ""}
      ${available && !completed ? `shadow-lg ${cfg.glow}` : ""}
    `}>
      <Icon className={`${sz.icon} ${completed ? "text-white/30" : cfg.color}`} />
      {completed && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
          <span className="text-white/50 text-[10px] font-bold">✓</span>
        </div>
      )}
    </div>
  );
}