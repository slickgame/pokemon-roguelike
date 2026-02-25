import React from "react";

const VARIANTS = {
  primary: "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30 border border-violet-400/20",
  secondary: "bg-white/8 hover:bg-white/12 text-white/80 border border-white/10",
  danger: "bg-red-600/80 hover:bg-red-500 text-white border border-red-400/20",
  success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/20",
  amber: "bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-lg shadow-amber-500/30 border border-amber-300/20",
};

const SIZES = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-5 py-2.5 text-sm rounded-xl",
  lg: "px-8 py-3.5 text-base rounded-xl",
  xl: "px-10 py-4 text-lg rounded-2xl",
};

export default function GameButton({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  onClick,
  className = "",
  type = "button",
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`
        inline-flex items-center justify-center gap-2 font-medium
        transition-all duration-150 active:scale-95
        disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
        ${VARIANTS[variant]}
        ${SIZES[size]}
        ${className}
      `}
    >
      {loading && (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}