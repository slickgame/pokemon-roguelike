import React from "react";

export default function StepProgress({ currentStep, picks }) {
  const labels = ["Pick A", "Pick B", "Pick C"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <React.Fragment key={label}>
            <div className={`flex flex-col items-center gap-1`}>
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all
                ${done ? "bg-violet-500 border-violet-400 text-white" :
                  active ? "bg-violet-500/20 border-violet-400/60 text-violet-300" :
                  "bg-white/5 border-white/10 text-white/25"}
              `}>
                {done ? "✓" : String.fromCharCode(65 + i)}
              </div>
              <span className={`text-[10px] font-medium ${active ? "text-violet-300" : done ? "text-white/50" : "text-white/20"}`}>
                {done && picks[i] ? picks[i].name : label}
              </span>
            </div>
            {i < 2 && (
              <div className={`flex-1 h-px mt-[-10px] ${done ? "bg-violet-500/50" : "bg-white/10"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}