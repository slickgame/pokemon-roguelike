import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import RunDebugPanel from "../components/dev/RunDebugPanel";
import DbVersionCard from "../components/dev/DbVersionCard";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Beaker, PlayCircle, Plus, CheckCircle, Swords } from "lucide-react";

export default function DevPanel() {
  const [runId, setRunId] = useState("");
  const [runData, setRunData] = useState(null);
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingAppend, setLoadingAppend] = useState(false);
  const [loadingFinish, setLoadingFinish] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleStartRun = async () => {
    setLoadingStart(true);
    try {
      const res = await base44.functions.invoke("startRun", {
        isRanked: false,
        modifierIds: []
      });
      setRunData(res.data);
      setRunId(res.data.runId);
      showToast("Run started successfully!", "success");
    } catch (err) {
      showToast(`Error: ${err.message}`, "error");
    } finally {
      setLoadingStart(false);
    }
  };

  const handleAppendAction = async () => {
    if (!runId) {
      showToast("Please enter a runId first", "error");
      return;
    }
    setLoadingAppend(true);
    try {
      const res = await base44.functions.invoke("appendRunAction", {
        runId,
        actionType: "dev_test",
        payload: { note: "hello", t: Date.now() }
      });
      showToast(`Action appended! idx=${res.data.idx}`, "success");
    } catch (err) {
      showToast(`Error: ${err.response?.data?.error || err.message}`, "error");
    } finally {
      setLoadingAppend(false);
    }
  };

  const handleFinishRun = async () => {
    if (!runId) {
      showToast("Please enter a runId first", "error");
      return;
    }
    setLoadingFinish(true);
    try {
      await base44.functions.invoke("finishRun", {
        runId,
        summary: { reason: "dev_test_finish" }
      });
      showToast("Run finished!", "success");
    } catch (err) {
      showToast(`Error: ${err.response?.data?.error || err.message}`, "error");
    } finally {
      setLoadingFinish(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <Beaker className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Dev Test Panel</h1>
          <p className="text-white/40 text-sm">Test M0 backend functions</p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-6 p-4 rounded-xl border text-sm font-medium
          ${toast.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : ""}
          ${toast.type === "error" ? "bg-red-500/10 border-red-500/20 text-red-300" : ""}
          ${toast.type === "info" ? "bg-violet-500/10 border-violet-500/20 text-violet-300" : ""}
        `}>
          {toast.message}
        </div>
      )}

      <div className="space-y-4">
        {/* DB Version */}
        <DbVersionCard />

        {/* Start Run */}
        <GameCard>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-violet-400" />
            1. Start Run
          </h3>
          <GameButton
            onClick={handleStartRun}
            disabled={loadingStart}
            loading={loadingStart}
            variant="primary"
          >
            Start Run
          </GameButton>

          {runData && (
            <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10 font-mono text-xs text-white/60 space-y-1">
              <div><span className="text-white/40">runId:</span> {runData.runId}</div>
              <div><span className="text-white/40">seed:</span> {runData.seed}</div>
              <div><span className="text-white/40">dbVersionSemantic:</span> {runData.dbVersionSemantic}</div>
              <div><span className="text-white/40">dbVersionHash:</span> {runData.dbVersionHash}</div>
            </div>
          )}
        </GameCard>

        {/* Run ID Input */}
        <GameCard>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <span className="w-4 h-4 flex items-center justify-center text-xs text-violet-400">✏️</span>
            2. Set Run ID
          </h3>
          <input
            type="text"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            placeholder="Paste or auto-filled from Start Run"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-violet-500/50"
          />
        </GameCard>

        {/* Append Action */}
        <GameCard>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            3. Append Test Action
          </h3>
          <GameButton
            onClick={handleAppendAction}
            disabled={loadingAppend || !runId}
            loading={loadingAppend}
            variant="success"
          >
            Append Test Action
          </GameButton>
        </GameCard>

        {/* Finish Run */}
        <GameCard>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-amber-400" />
            4. Finish Run
          </h3>
          <GameButton
            onClick={handleFinishRun}
            disabled={loadingFinish || !runId}
            loading={loadingFinish}
            variant="amber"
          >
            Finish Run
          </GameButton>
        </GameCard>

        {/* Run Debug */}
        <RunDebugPanel runId={runId} onToast={showToast} />
      </div>

      {/* Debug info */}
      <GameCard className="mt-6 font-mono text-xs text-white/25 break-all">
        <p className="text-white/15 mb-2 uppercase tracking-widest text-[10px]">Debug Info</p>
        <pre>{JSON.stringify({ runId, hasRunData: !!runData }, null, 2)}</pre>
      </GameCard>
    </div>
  );
}