import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { runApi } from "../components/api/runApi";
import { loadDbBundle } from "../components/db/dbLoader";
import { generatePool, buildEligibleSpecies, getStarterConfig } from "../components/engine/starterGen";
import StarterCard from "../components/starters/StarterCard";
import StepProgress from "../components/starters/StepProgress";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import { ToastContainer, useToast } from "../components/ui/Toast";
import { RefreshCw, ArrowRight } from "lucide-react";

const STEP_LABELS = ["A", "B", "C"];

export default function StarterSelect() {
  const navigate = useNavigate();
  const { toasts, toast, dismiss } = useToast();
  const urlParams = new URLSearchParams(window.location.search);
  const runId = urlParams.get("runId");

  const [run, setRun] = useState(null);
  const [loadingRun, setLoadingRun] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Draft state
  const [currentStep, setCurrentStep] = useState(0);           // 0,1,2
  const [picks, setPicks] = useState([]);                       // array of StarterCandidate (up to 3)
  const [rerollIdx, setRerollIdx] = useState(0);                // per-step reroll counter
  const [remainingRerolls, setRemainingRerolls] = useState(0);
  const [pool, setPool] = useState([]);
  const [poolWarning, setPoolWarning] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null); // currently highlighted card
  const [confirming, setConfirming] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Load run ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!runId) { setLoadError("No runId in URL."); setLoadingRun(false); return; }
    runApi.getRun(runId)
      .then(r => setRun(r))
      .catch(e => setLoadError(e.message))
      .finally(() => setLoadingRun(false));
  }, [runId]);

  // ── Derive config from modifiers ──────────────────────────────────────────
  const { config, eligibleSpecies } = useMemo(() => {
    if (!run) return { config: null, eligibleSpecies: [] };
    const db = loadDbBundle();
    const modifiers = run.modifiers ?? {};
    return {
      config: getStarterConfig(modifiers),
      eligibleSpecies: buildEligibleSpecies({ db, modifiers }),
    };
  }, [run]);

  // ── Initialize: set total rerolls and generate first pool ─────────────────
  useEffect(() => {
    if (!config || !run) return;
    setRemainingRerolls(config.totalRerolls);
    const { candidates, warning } = generatePool({
      seed: run.seed,
      step: 0,
      rerollIdx: 0,
      pickedIds: new Set(),
      eligibleSpecies,
      poolSize: config.poolSize,
      kantoDirectStep: config.kantoDirectStep,
      typeDiversityMode: config.typeDiversityMode,
      pickedTypes: [],
    });
    setPool(candidates);
    setPoolWarning(warning);
    setSelectedCandidate(null);
    setRerollIdx(0);
  }, [config, run, eligibleSpecies]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const pickedIds = useMemo(() => new Set(picks.map(p => p.speciesId)), [picks]);
  const pickedTypes = useMemo(() => picks.map(p => p.types[0]), [picks]);

  const regeneratePool = useCallback((step, rIdx, currentPicks) => {
    if (!config || !run) return;
    const { candidates, warning } = generatePool({
      seed: run.seed,
      step,
      rerollIdx: rIdx,
      pickedIds: new Set(currentPicks.map(p => p.speciesId)),
      eligibleSpecies,
      poolSize: config.poolSize,
      kantoDirectStep: config.kantoDirectStep,
      typeDiversityMode: config.typeDiversityMode,
      pickedTypes: currentPicks.map(p => p.types[0]),
    });
    setPool(candidates);
    setPoolWarning(warning);
    setSelectedCandidate(null);
  }, [config, run, eligibleSpecies]);

  // ── Pick a candidate ──────────────────────────────────────────────────────
  const handlePick = async () => {
    if (!selectedCandidate) return;
    setActionLoading(true);

    try {
      await runApi.appendAction(runId, "starter_pick", {
        step: STEP_LABELS[currentStep],
        speciesId: selectedCandidate.speciesId,
        name: selectedCandidate.name,
      });

      const newPicks = [...picks, selectedCandidate];
      setPicks(newPicks);
      const nextStep = currentStep + 1;

      if (nextStep < 3) {
        setCurrentStep(nextStep);
        setRerollIdx(0);
        regeneratePool(nextStep, 0, newPicks);
      } else {
        // All 3 picked — show confirm
        setCurrentStep(3);
        setPool([]);
      }
    } catch (e) {
      toast(e.message || "Failed to save pick", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Reroll ────────────────────────────────────────────────────────────────
  const handleReroll = async () => {
    if (remainingRerolls <= 0) return;
    setActionLoading(true);
    const nextRerollIdx = rerollIdx + 1;

    try {
      await runApi.appendAction(runId, "starter_reroll", {
        step: STEP_LABELS[currentStep],
        rerollIndex: nextRerollIdx,
      });
      setRemainingRerolls(r => r - 1);
      setRerollIdx(nextRerollIdx);
      regeneratePool(currentStep, nextRerollIdx, picks);
    } catch (e) {
      toast(e.message || "Failed to reroll", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Confirm team ──────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    setConfirming(true);
    try {
      // Call confirmStarters — writes starter_confirm action + initializes partyState/economy
      await base44.functions.invoke("confirmStarters", {
        runId,
        pickedSpeciesIds: picks.map(p => p.speciesId),
      });
      navigate(createPageUrl(`RunMap?runId=${runId}`));
    } catch (e) {
      toast(e.message || "Failed to confirm team", "error");
      setConfirming(false);
    }
  };

  // ── Render guards ─────────────────────────────────────────────────────────
  if (loadingRun) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full" />
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  if (loadError || !run) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <GameCard>
          <p className="text-red-400 mb-4">{loadError || "Run not found."}</p>
          <GameButton onClick={() => navigate(createPageUrl("Home"))} variant="secondary" size="sm">
            Back to Home
          </GameButton>
        </GameCard>
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  const isDoneSelecting = currentStep >= 3;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white mb-1">Choose Your Starters</h1>
        <p className="text-white/40 text-sm">
          {isDoneSelecting
            ? "Your team is ready. Confirm to begin!"
            : `Step ${STEP_LABELS[currentStep]}: Pick a Pokémon for your team.`}
        </p>
      </div>

      {/* Step progress */}
      <div className="mb-6">
        <StepProgress currentStep={isDoneSelecting ? 3 : currentStep} picks={picks} />
      </div>

      {/* Pool warning */}
      {poolWarning && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          ⚠ {poolWarning}
        </div>
      )}

      {/* Candidate pool */}
      {!isDoneSelecting && (
        <>
          <div className={`grid gap-3 mb-4 ${pool.length > 3 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
            {pool.map(candidate => (
              <StarterCard
                key={candidate.speciesId}
                candidate={candidate}
                selected={selectedCandidate?.speciesId === candidate.speciesId}
                onClick={() => setSelectedCandidate(
                  selectedCandidate?.speciesId === candidate.speciesId ? null : candidate
                )}
              />
            ))}
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-3">
            <GameButton
              variant="primary"
              size="md"
              disabled={!selectedCandidate || actionLoading}
              loading={actionLoading}
              onClick={handlePick}
            >
              Pick {STEP_LABELS[currentStep]}
              <ArrowRight className="w-4 h-4" />
            </GameButton>

            {config?.totalRerolls > 0 && (
              <GameButton
                variant="secondary"
                size="md"
                disabled={remainingRerolls <= 0 || actionLoading}
                loading={actionLoading}
                onClick={handleReroll}
              >
                <RefreshCw className="w-4 h-4" />
                Reroll ({remainingRerolls} left)
              </GameButton>
            )}
          </div>
        </>
      )}

      {/* Confirm team screen */}
      {isDoneSelecting && (
        <GameCard className="text-center py-8">
          <h2 className="text-xl font-bold text-white mb-4">Your Team</h2>
          <div className="flex justify-center gap-4 flex-wrap mb-6">
            {picks.map(p => (
              <div key={p.speciesId} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-1 mx-auto">
                  <span className="text-2xl">🔴</span>
                </div>
                <p className="text-white font-semibold text-sm">{p.name}</p>
                <p className="text-white/40 text-xs">{p.nature}</p>
              </div>
            ))}
          </div>
          <GameButton
            variant="primary"
            size="lg"
            onClick={handleConfirm}
            loading={confirming}
            className="mx-auto"
          >
            Confirm Team
            <ArrowRight className="w-4 h-4" />
          </GameButton>
        </GameCard>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}