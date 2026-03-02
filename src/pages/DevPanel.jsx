import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import RunDebugPanel from "../components/dev/RunDebugPanel";
import DbVersionCard from "../components/dev/DbVersionCard";
import RELICS from "../components/engine/relicsData";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Beaker, PlayCircle, Plus, CheckCircle, Swords, Search, Zap, ExternalLink, RefreshCw, Sparkles, Trash2, AlertTriangle } from "lucide-react";

export default function DevPanel() {
  const navigate = useNavigate();
  const [runId, setRunId] = useState("");
  const [runData, setRunData] = useState(null);
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingAppend, setLoadingAppend] = useState(false);
  const [loadingFinish, setLoadingFinish] = useState(false);
  const [loadingBattle, setLoadingBattle] = useState(false);
  const [loadingInspect, setLoadingInspect] = useState(false);
  const [loadingAutoConfirm, setLoadingAutoConfirm] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [loadingReconcile, setLoadingReconcile] = useState(false);
  const [runSummary, setRunSummary] = useState(null);
  const [toast, setToast] = useState(null);
  const [battleError, setBattleError] = useState(null);

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const loadRunSummary = async (id) => {
    const rid = id ?? runId;
    if (!rid) { showToast("Enter a runId first", "error"); return; }
    setLoadingInspect(true);
    setRunSummary(null);
    try {
      const [runRes, actionsRes] = await Promise.all([
        base44.functions.invoke("getRun", { runId: rid }),
        base44.functions.invoke("listRunActions", { runId: rid }),
      ]);
      const run = runRes.data?.run ?? runRes.data;
      const actions = actionsRes.data?.actions ?? actionsRes.data ?? [];
      const picks = actions.filter(a => a.actionType === "starter_pick");
      const hasConfirm = actions.some(a => a.actionType === "starter_confirm");
      setRunSummary({
        status: run?.status,
        modifierCount: Object.keys(run?.modifiers ?? {}).filter(k => run.modifiers[k]).length,
        actionCount: actions.length,
        hasConfirm,
        pickedSpeciesIds: picks.map(a => a.payload?.speciesId).filter(Boolean),
      });
    } catch (err) {
      showToast(`Inspector error: ${err.message}`, "error");
    } finally {
      setLoadingInspect(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStartRun = async () => {
    setLoadingStart(true);
    try {
      const res = await base44.functions.invoke("startRun", { isRanked: false, modifierIds: [] });
      setRunData(res.data);
      setRunId(res.data.runId);
      showToast("Run started!", "success");
    } catch (err) {
      showToast(`Error: ${err.message}`, "error");
    } finally {
      setLoadingStart(false);
    }
  };

  const handleUseRecentRun = async () => {
    setLoadingRecent(true);
    try {
      const user = await base44.auth.me();
      const runs = await base44.entities.Run.filter({ playerId: user.id, status: "active" }, "-created_date", 1);
      if (!runs || runs.length === 0) { showToast("No active runs found", "error"); return; }
      const rid = runs[0].id;
      setRunId(rid);
      showToast(`Loaded run ${rid}`, "success");
      await loadRunSummary(rid);
    } catch (err) {
      showToast(`Error: ${err.message}`, "error");
    } finally {
      setLoadingRecent(false);
    }
  };

  const handleAutoConfirm = async () => {
    if (!runId) { showToast("Enter a runId first", "error"); return; }
    setLoadingAutoConfirm(true);
    try {
      const res = await base44.functions.invoke("devAutoConfirmStarters", { runId });
      const d = res.data;
      if (d.alreadyConfirmed) showToast("Starters already confirmed!", "info");
      else showToast(`Auto-confirmed! Species: ${d.picks.join(", ")}`, "success");
      await loadRunSummary(runId);
    } catch (err) {
      showToast(`Error: ${err.response?.data?.error || err.message}`, "error");
    } finally {
      setLoadingAutoConfirm(false);
    }
  };

  const handleStartBattle = async () => {
    if (!runId) { showToast("Enter a runId first", "error"); return; }
    setBattleError(null);
    setLoadingBattle(true);
    try {
      const res = await base44.functions.invoke("buildBattleFromRun", { runId });
      const { battleId } = res.data;
      showToast(`Battle created!`, "success");
      setTimeout(() => navigate(createPageUrl(`Battle?runId=${runId}&battleId=${battleId}`)), 600);
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.errorCode === "STARTERS_NOT_CONFIRMED") {
        setBattleError("Starters not confirmed. Click \"Open Starter Select\" or \"DEV: Auto-Confirm Starters\" first.");
      } else {
        showToast(`Error: ${errData?.error || err.message}`, "error");
      }
    } finally {
      setLoadingBattle(false);
    }
  };

  const handleAppendAction = async () => {
    if (!runId) { showToast("Enter a runId first", "error"); return; }
    setLoadingAppend(true);
    try {
      const res = await base44.functions.invoke("appendRunAction", { runId, actionType: "dev_test", payload: { note: "hello", t: Date.now() } });
      showToast(`Action appended! idx=${res.data.idx}`, "success");
    } catch (err) {
      showToast(`Error: ${err.response?.data?.error || err.message}`, "error");
    } finally {
      setLoadingAppend(false);
    }
  };

  const handleReconcileAether = async () => {
    setLoadingReconcile(true);
    try {
      const res = await base44.functions.invoke("reconcileAetherAwards", { limit: 50 });
      const d = res.data;
      showToast(`Reconciled: ${d.fixed} fixed, ${d.skipped} skipped${d.errors?.length ? `, ${d.errors.length} errors` : ""}`, d.fixed > 0 ? "success" : "info");
    } catch (err) {
      showToast(`Error: ${err.response?.data?.error || err.message}`, "error");
    } finally {
      setLoadingReconcile(false);
    }
  };

  const handleFinishRun = async () => {
    if (!runId) { showToast("Enter a runId first", "error"); return; }
    setLoadingFinish(true);
    try {
      await base44.functions.invoke("finishRun", { runId, summary: { reason: "dev_test_finish" } });
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
          <p className="text-white/40 text-sm">Test backend functions end-to-end</p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-6 p-4 rounded-xl border text-sm font-medium
          ${toast.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : ""}
          ${toast.type === "error"   ? "bg-red-500/10 border-red-500/20 text-red-300" : ""}
          ${toast.type === "info"    ? "bg-violet-500/10 border-violet-500/20 text-violet-300" : ""}
        `}>
          {toast.message}
        </div>
      )}

      <div className="space-y-4">
        {/* DB Version */}
        <DbVersionCard />

        {/* 1. Start Run */}
        <GameCard>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-violet-400" />
            1. Start Run
          </h3>
          <GameButton onClick={handleStartRun} disabled={loadingStart} loading={loadingStart} variant="primary">
            Start Run
          </GameButton>
          {runData && (
            <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10 font-mono text-xs text-white/60 space-y-1">
              <div><span className="text-white/40">runId:</span> {runData.runId}</div>
              <div><span className="text-white/40">seed:</span> {runData.seed}</div>
            </div>
          )}
        </GameCard>

        {/* 2. Set Run ID */}
        <GameCard>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <span className="text-violet-400 text-xs">✏️</span>
            2. Set Run ID
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={runId}
              onChange={(e) => { setRunId(e.target.value); setRunSummary(null); setBattleError(null); }}
              placeholder="Paste runId or use button →"
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-violet-500/50"
            />
            <GameButton onClick={handleUseRecentRun} loading={loadingRecent} disabled={loadingRecent} variant="secondary" size="sm">
              Most Recent Active
            </GameButton>
          </div>
        </GameCard>

        {/* 3. Run Inspector */}
        <GameCard>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-400" />
            3. Run Inspector
          </h3>
          <GameButton onClick={() => loadRunSummary()} loading={loadingInspect} disabled={loadingInspect || !runId} variant="success">
            Load Run Summary
          </GameButton>

          {runSummary && (
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-white/40">Status</span>
                  <p className="text-white font-mono mt-0.5">{runSummary.status}</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-white/40">Modifiers</span>
                  <p className="text-white font-mono mt-0.5">{runSummary.modifierCount}</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-white/40">Actions</span>
                  <p className="text-white font-mono mt-0.5">{runSummary.actionCount}</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-white/40">starter_confirm</span>
                  <p className={`font-mono mt-0.5 ${runSummary.hasConfirm ? "text-emerald-400" : "text-red-400"}`}>
                    {runSummary.hasConfirm ? "✓ true" : "✗ false"}
                  </p>
                </div>
              </div>
              {runSummary.hasConfirm && runSummary.pickedSpeciesIds.length > 0 && (
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-xs">
                  <span className="text-white/40">Picked species IDs:</span>
                  <p className="text-white font-mono mt-0.5">{runSummary.pickedSpeciesIds.join(", ")}</p>
                </div>
              )}
              {!runSummary.hasConfirm && (
                <div className="flex gap-2 flex-wrap mt-1">
                  <GameButton
                    onClick={() => navigate(createPageUrl(`StarterSelect?runId=${runId}`))}
                    variant="secondary" size="sm"
                  >
                    <ExternalLink className="w-3 h-3" /> Open Starter Select
                  </GameButton>
                  <GameButton onClick={handleAutoConfirm} loading={loadingAutoConfirm} disabled={loadingAutoConfirm} variant="amber" size="sm">
                    <Zap className="w-3 h-3" /> DEV: Auto-Confirm Starters
                  </GameButton>
                </div>
              )}
            </div>
          )}
        </GameCard>

        {/* 4. Start Test Battle */}
        <GameCard>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Swords className="w-4 h-4 text-violet-400" />
            4. Start Test Battle
          </h3>
          <GameButton onClick={handleStartBattle} disabled={loadingBattle || !runId} loading={loadingBattle} variant="primary">
            Start Test Battle
          </GameButton>
          {battleError && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
              {battleError}
              <div className="flex gap-2 mt-2">
                <GameButton onClick={() => navigate(createPageUrl(`StarterSelect?runId=${runId}`))} variant="secondary" size="sm">
                  <ExternalLink className="w-3 h-3" /> Open Starter Select
                </GameButton>
                <GameButton onClick={handleAutoConfirm} loading={loadingAutoConfirm} disabled={loadingAutoConfirm} variant="amber" size="sm">
                  <Zap className="w-3 h-3" /> DEV: Auto-Confirm
                </GameButton>
              </div>
            </div>
          )}
        </GameCard>

        {/* 5. Append Test Action */}
        <GameCard>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            5. Append Test Action
          </h3>
          <GameButton onClick={handleAppendAction} disabled={loadingAppend || !runId} loading={loadingAppend} variant="success">
            Append Test Action
          </GameButton>
        </GameCard>

        {/* 6. Finish Run */}
        <GameCard>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-amber-400" />
            6. Finish Run
          </h3>
          <GameButton onClick={handleFinishRun} disabled={loadingFinish || !runId} loading={loadingFinish} variant="amber">
            Finish Run
          </GameButton>
        </GameCard>

        {/* 7. Reconcile Aether Awards */}
        <GameCard>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-violet-400" />
            7. Reconcile Aether Awards
          </h3>
          <p className="text-white/40 text-xs mb-3">Fixes runs where aetherAwarded=true but Player.aether was not updated (playerAetherAfter=0).</p>
          <GameButton onClick={handleReconcileAether} disabled={loadingReconcile} loading={loadingReconcile} variant="primary">
            Reconcile Aether Awards
          </GameButton>
        </GameCard>

        {/* Run Debug */}
        <RunDebugPanel runId={runId} onToast={showToast} />
      </div>
    </div>
  );
}