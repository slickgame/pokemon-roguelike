import React from "react";

export default function GameCard({ children, className = "", glow = false }) {
  return (
    <div
      className={`
        rounded-2xl border border-white/8 bg-white/4 backdrop-blur-sm p-6
        ${glow ? "shadow-lg shadow-violet-500/10 border-violet-500/20" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}