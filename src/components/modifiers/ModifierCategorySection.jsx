import React from "react";
import ModifierCard from "./ModifierCard";

export default function ModifierCategorySection({ category, modifiers, selectedIds, disabledMap, onToggle }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-1.5 px-0.5">{category}</p>
      <div className="space-y-1">
        {modifiers.map(mod => (
          <ModifierCard
            key={mod.id}
            modifier={mod}
            selected={selectedIds.has(mod.id)}
            disabled={disabledMap[mod.id]?.disabled}
            disabledReason={disabledMap[mod.id]?.reason}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}