import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function GameModal({ open, onClose, title, children, size = "md" }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const sizeClass = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size] || "max-w-lg";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative w-full ${sizeClass} rounded-2xl border border-white/10 bg-[#13131f] shadow-2xl shadow-black/60`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}