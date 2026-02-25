import React, { useEffect } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

const ICONS = {
  success: { icon: CheckCircle, color: "text-emerald-400", bg: "border-emerald-500/20 bg-emerald-500/10" },
  error: { icon: AlertCircle, color: "text-red-400", bg: "border-red-500/20 bg-red-500/10" },
  info: { icon: Info, color: "text-violet-400", bg: "border-violet-500/20 bg-violet-500/10" },
};

export function Toast({ id, message, type = "info", onDismiss }) {
  const { icon: Icon, color, bg } = ICONS[type] || ICONS.info;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), 4000);
    return () => clearTimeout(t);
  }, [id, onDismiss]);

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm ${bg} shadow-lg min-w-72 max-w-sm`}>
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${color}`} />
      <p className="text-sm text-white/80 flex-1">{message}</p>
      <button onClick={() => onDismiss(id)} className="text-white/30 hover:text-white/70 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map(t => (
        <Toast key={t.id} {...t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// Hook
let _setToasts = null;

export function useToast() {
  const [toasts, setToasts] = React.useState([]);
  _setToasts = setToasts;

  const dismiss = React.useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = React.useCallback((message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  return { toasts, toast, dismiss };
}