import React, { useState } from "react";
import GameCard from "../ui/GameCard";
import GameButton from "../ui/GameButton";
import { runApi } from "../api/runApi";
import { Bug, List, XCircle, Wand2 } from "lucide-react";

export default function RunDebugPanel({ runId, onToast }) {
  const [run, setRun] = useState(null);
  const [actions, setActions] = useState(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [loadingActions, setLoadingActions] = useState(false);
  const [loadingAbandon, setLoadingAbandon] = useState(false);
  const [forcingEvent, setForcingEvent] = useState(null);

  const fetchRun = async () => {
    if (!runId) return onToast("No runId set", "error");
    setLoadingRun(true);
    try {
      const r = await runApi.getRun(runId);
      setRun(r);
    } catch (err) {
      onToast(`Error: ${err.message}`, "error");
    } finally {
      setLoadingRun(false);
    }
  };

  const fetchActions = async () => {
    if (!runId) return onToast("No runId set", "error");
    setLoadingActions(true);
    try {
      const list = await runApi.listRunActions(runId);
      setActions(list);
    } catch (err) {
      onToast(`Error: ${err.message}`, "error");
    } finally {
      setLoadingActions(false);
    }
  };

  const handleAbandon = async () => {
    if (!runId) return onToast("No runId set", "error");
    setLoadingAbandon(true);
    try {
      await runApi.abandonRun(runId, "dev_abandon");
      onToast("Run abandoned!", "success");
      setRun(prev => prev ? { ...prev, status: "abandoned" } : null);
    } catch (err) {
      onToast(`Error: ${err.message}`, "error");
    } finally {
      setLoadingAbandon(false);
    }
  };

  const handleForceNextEvent = async (eventId) => {
    if (!runId) return onToast("No runId set", "error");
    setForcingEvent(eventId);
    try {
      const r = await runApi.getRun(runId);
      const progress = r?.results?.progress ?? {};

      await base44.entities.Run.update(runId, {
        results: {
          ...(r?.results ?? {}),
          progress: {
            ...progress,
            devFlags: {
              ...(progress.devFlags ?? {}),
              forceEventId: eventId,
            },
          },
        },
      });

      onToast(`Next event node will force: ${eventId}`, "success");
    } catch (err) {
      onToast(`Error: ${err.message}`, "error");
    } finally {
      setForcingEvent(null);
    }
  };

  return (
    <GameCard>
      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
        <Bug className="w-4 h-4 text-blue-400" />
        5. Run Debug
      </h3>

      <div className="flex flex-wrap gap-2 mb-4">
        <GameButton onClick={fetchRun} disabled={loadingRun || !runId} loading={loadingRun} variant="secondary" size="sm">
          <Bug className="w-3.5 h-3.5" />
          Get Run
        </GameButton>
        <GameButton onClick={fetchActions} disabled={loadingActions || !runId} loading={loadingActions} variant="secondary" size="sm">
          <List className="w-3.5 h-3.5" />
          List Actions
        </GameButton>
        <GameButton onClick={handleAbandon} disabled={loadingAbandon || !runId} loading={loadingAbandon} variant="danger" size="sm">
          <XCircle className="w-3.5 h-3.5" />
          Abandon Run
        </GameButton>
      </div>

      {run && (
        <div className="mb-3 p-3 rounded-lg bg-white/5 border border-white/10 font-mono text-xs text-white/60 space-y-1">
          <p className="text-white/25 mb-1 uppercase tracking-widest text-[10px]">Run Status</p>
          <div><span className="text-white/40">status:</span> <span className={
            run.status === "active" ? "text-emerald-400" :
            run.status === "finished" ? "text-amber-400" :
            run.status === "abandoned" ? "text-red-400" : "text-white/40"
          }>{run.status}</span></div>
          <div><span className="text-white/40">nextActionIdx:</span> {run.nextActionIdx}</div>
          <div><span className="text-white/40">dbVersion:</span> {run.dbVersionSemantic}</div>
          <div><span className="text-white/40">seed:</span> {run.seed?.slice(0, 12)}…</div>
        </div>
      )}

      {actions && (
        <div className="p-3 rounded-lg bg-white/5 border border-white/10 font-mono text-xs text-white/60">
          <p className="text-white/25 mb-2 uppercase tracking-widest text-[10px]">Actions ({actions.length})</p>
          {actions.length === 0 ? (
            <p className="text-white/30">No actions yet</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {actions.map(a => (
                <div key={a.id} className="flex gap-3">
                  <span className="text-violet-400">#{a.idx}</span>
                  <span className="text-white/50">{a.actionType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </GameCard>
  );
}