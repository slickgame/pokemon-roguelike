import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useRequiredRunId } from "@/hooks/useRequiredRunId";
import { base44 } from "@/api/base44Client";
import { ToastContainer, useToast } from "../components/ui/Toast";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import { Star, Package, Wand2, Dumbbell, Heart, CircleDot } from "lucide-react";
import { EMPTY_INVENTORY, withInventoryDefaults } from "@/lib/inventory";
import { selectEventForNode } from "@/lib/eventPool";

export default function EventNode() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const { toasts, toast, dismiss } = useToast();
  const { runId, handleInvalidRun } = useRequiredRunId({ page: "EventNode", toast });
  const nodeId = params.get("nodeId");

  const [resolving, setResolving] = useState(false);
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eventView, setEventView] = useState(null);
  const [showOverflowChoice, setShowOverflowChoice] = useState(false);
  const [selectedTrainingIndex, setSelectedTrainingIndex] = useState(0);
  const [selectedBallId, setSelectedBallId] = useState("pokeball");


  useEffect(() => {
    if (!runId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function load() {
      try {
        const rows = await base44.entities.Run.filter({ id: runId });
        const nextRun = rows[0];
        if (!nextRun) {
          handleInvalidRun();
          return;
        }
        if (!isMounted) return;

        setRun(nextRun);

        const progress = nextRun.results?.progress ?? {};
        const pending = progress.pendingEncounter ?? {};
        const inventory = withInventoryDefaults(progress.inventory ?? EMPTY_INVENTORY);
        const routeId = pending.routeId ?? progress.routeId ?? "route1";
        const forceEventId = progress.devFlags?.forceEventId ?? null;

        let selected = null;
        if (
          pending?.nodeId === nodeId &&
          pending?.eventId &&
          pending?.eventState
        ) {
          selected = {
            eventId: pending.eventId,
            title: pending.eventTitle ?? "Event",
            description: pending.eventDescription ?? "",
            kind: pending.eventKind ?? "event",
            eventState: pending.eventState,
          };
        } else {
          selected = selectEventForNode({
            runSeed: nextRun.seed,
            nodeId,
            routeId,
            inventory,
            forceEventId,
          });

          await base44.entities.Run.update(runId, {
            results: {
              ...(nextRun.results ?? {}),
              progress: {
                ...progress,
                pendingEncounter: {
                  ...(pending ?? {}),
                  nodeId,
                  nodeType: pending?.nodeType ?? "event",
                  status: pending?.status ?? "pending",
                  routeId,
                  eventId: selected.eventId,
                  eventTitle: selected.title,
                  eventDescription: selected.description,
                  eventKind: selected.kind,
                  eventState: selected.eventState,
                },
              },
            },
          });

          const refreshedRows = await base44.entities.Run.filter({ id: runId });
          if (refreshedRows[0] && isMounted) {
            setRun(refreshedRows[0]);
          }
        }

        if (isMounted) setEventView(selected);
      } catch (_) {
        handleInvalidRun();
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [runId, nodeId, handleInvalidRun]);

  const progress = run?.results?.progress ?? {};
  const inventory = withInventoryDefaults(progress.inventory ?? EMPTY_INVENTORY);
  const party = progress.partyState ?? [];
  const hasPartySpace = party.length < 6;

  const eventId = eventView?.eventId ?? null;
  const eventState = eventView?.eventState ?? null;

  const handleResolveResult = (res) => {
    const data = res?.data ?? {};
    const cacheKey = `nodeCompleteSummary:${runId}:${nodeId ?? "unknown"}`;

    if (data?.nodeCompleteSummary) {
      sessionStorage.setItem(cacheKey, JSON.stringify(data.nodeCompleteSummary));
    }

    if (data.nextScreen === "relic_reward" && data.relicSource) {
      navigate(
        createPageUrl(
          `RelicReward?runId=${runId}&nodeId=${nodeId ?? ""}&source=${data.relicSource}`
        )
      );
      return;
    }

    navigate(createPageUrl(`NodeComplete?runId=${runId}&nodeId=${nodeId ?? ""}`));
  };

  const handleCollect = async () => {
    if (!eventState?.reward) return;

    setResolving(true);
    try {
      const res = await base44.functions.invoke("resolveNode", {
        runId,
        resolution: {
          type: "event_item",
          itemsDelta: { [eventState.reward.itemId]: eventState.reward.qty },
        },
      });
      handleResolveResult(res);
    } finally {
      setResolving(false);
    }
  };

  const handleTraining = async () => {
    if (!eventState?.evStat) return;
    if (!party[selectedTrainingIndex]) return;

    setResolving(true);
    try {
      const res = await base44.functions.invoke("resolveNode", {
        runId,
        resolution: {
          type: "event_ev",
          evDelta: { [eventState.evStat]: eventState.evAmount ?? 16 },
          evLabel: eventState.evLabel,
          targetMode: "party_index",
          targetIndex: selectedTrainingIndex,
        },
      });
      handleResolveResult(res);
    } finally {
      setResolving(false);
    }
  };



  const finalizeRecruitEvent = async (overflowChoice = null) => {
    if (!eventState) return;

    setResolving(true);
    try {
      const res = await base44.functions.invoke("resolveNode", {
        runId,
        resolution: {
          type: "event_recruit",
          eventId,
          itemCost: eventState.itemCost ?? { bait: 1 },
          speciesId: eventState.speciesId,
          speciesName: eventState.speciesName,
          level: eventState.level ?? 4,
          target: eventState.target,
          roll: eventState.roll,
          modifier: eventState.modifier ?? 0,
          total: eventState.total ?? eventState.roll,
          success: Boolean(eventState.success),
          overflowChoice,
        },
      });
      handleResolveResult(res);
    } finally {
      setResolving(false);
    }
  };


  const handleUseBait = async () => {
    if (!eventState) return;
    if ((inventory.bait ?? 0) < 1) return;

    if (eventState.success && !hasPartySpace) {
      setShowOverflowChoice(true);
      return;
    }

    await finalizeRecruitEvent(null);
  };

  const handleUsePotion = async () => {
    if (!eventState) return;
    if ((inventory.potion ?? 0) < 1) return;

    if (eventState.success && !hasPartySpace) {
      setShowOverflowChoice(true);
      return;
    }

    await finalizeRecruitEvent(null);
  };

  const handleUseBall = async () => {
    if (!eventState) return;
    if ((inventory[selectedBallId] ?? 0) < 1) return;

    const selectedBall =
      (eventState.ballOptions ?? []).find((ball) => ball.itemId === selectedBallId) ??
      { itemId: "pokeball", label: "Poké Ball", bonus: 0 };

    const rollRngSeed = `${run?.seed ?? runId ?? "event"}:${nodeId ?? "node"}:wild_ball_roll:${selectedBall.itemId}`;
    let hash = 0;
    for (let i = 0; i < rollRngSeed.length; i++) {
      hash = (hash * 31 + rollRngSeed.charCodeAt(i)) >>> 0;
    }
    const roll = (hash % 20) + 1;
    const modifier = selectedBall.bonus ?? 0;
    const total = roll + modifier;
    const success = total >= eventState.target;

    if (success && !hasPartySpace) {
      setShowOverflowChoice(true);
      setEventView((prev) => ({
        ...prev,
        eventState: {
          ...prev.eventState,
          selectedBall,
          roll,
          modifier,
          total,
          success,
          itemCost: { [selectedBall.itemId]: 1 },
        },
      }));
      return;
    }

    setResolving(true);
    try {
      const res = await base44.functions.invoke("resolveNode", {
        runId,
        resolution: {
          type: "event_recruit",
          eventId,
          itemCost: { [selectedBall.itemId]: 1 },
          speciesId: eventState.speciesId,
          speciesName: eventState.speciesName,
          level: eventState.level ?? 4,
          target: eventState.target,
          roll,
          modifier,
          total,
          success,
          overflowChoice: null,
        },
      });
      handleResolveResult(res);
    } finally {
      setResolving(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full" />
      </div>
    );
  }

  if (!eventView) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <GameCard className="py-8">
          <p className="text-white/60">Event data could not be loaded.</p>
        </GameCard>
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  const renderSupplyCache = () => (
    <>
      <GameCard className="py-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Package className="w-8 h-8 text-violet-400" />
          <div className="text-left">
            <p className="text-white font-bold">{eventState.reward.title}</p>
            <p className="text-white/40 text-xs">{eventState.reward.description}</p>
          </div>
        </div>
        <p className="text-white/50 text-sm">Take the items?</p>
      </GameCard>

      <GameButton
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleCollect}
        loading={resolving}
        disabled={resolving}
      >
        <Star className="w-4 h-4" />
        Take Items
      </GameButton>
    </>
  );

  const renderTrainingSpot = () => {
    return (
      <>
        <GameCard className="py-8 border border-cyan-500/20 bg-cyan-500/5">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Dumbbell className="w-8 h-8 text-cyan-300" />
            <div className="text-left">
              <p className="text-white font-bold">
                Selected Pokémon gains +{eventState.evAmount} {eventState.evLabel} EV
              </p>
              <p className="text-white/40 text-xs">
                Choose any party Pokémon from the active team or bench.
              </p>
            </div>
          </div>

          <p className="text-white/50 text-sm">
            Spend a little time drilling technique and form.
          </p>
        </GameCard>

        <GameCard className="py-6">
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-3">
            Choose Training Target
          </p>

          <div className="grid grid-cols-1 gap-2">
            {party.map((mon, index) => (
              <button
                key={`${mon.speciesId}-${index}`}
                type="button"
                onClick={() => setSelectedTrainingIndex(index)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  selectedTrainingIndex === index
                    ? "border-cyan-400 bg-cyan-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">
                      {mon.name} {index < 3 ? "(Active)" : "(Bench)"}
                    </p>
                    <p className="text-white/40 text-xs">
                      Lv. {mon.level} • HP {mon.currentHP}/{mon.maxHP}
                    </p>
                  </div>
                  <div className="text-cyan-300 text-sm font-bold">
                    +{eventState.evAmount} {eventState.evLabel}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </GameCard>

        <div className="space-y-3">
          <GameButton
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleTraining}
            loading={resolving}
            disabled={resolving || party.length === 0 || !party[selectedTrainingIndex]}
          >
            <Dumbbell className="w-4 h-4" />
            Train Selected Pokémon
          </GameButton>

          <GameButton
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => navigate(createPageUrl(`RunMap?runId=${runId}`))}
            disabled={resolving}
          >
            Leave
          </GameButton>
        </div>
      </>
    );
  };

  const renderInjuredPidgey = () => {
    const hasPotion = (inventory.potion ?? 0) >= 1;

    return (
      <>
        <GameCard className="py-8 border border-rose-500/20 bg-rose-500/5">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Heart className="w-8 h-8 text-rose-300" />
            <div className="text-left">
              <p className="text-white font-bold">Help Injured Pidgey</p>
              <p className="text-white/40 text-xs">Use 1 Potion to try to nurse it back to health.</p>
            </div>
          </div>

          <div className="space-y-1 text-sm text-white/70 text-left max-w-xs mx-auto">
            <div className="flex justify-between">
              <span>Required item</span>
              <span className="font-bold text-white">Potion ×1</span>
            </div>
            <div className="flex justify-between">
              <span>Roll</span>
              <span className="font-bold text-white">1d20 + 0</span>
            </div>
            <div className="flex justify-between">
              <span>Target</span>
              <span className="font-bold text-white">{eventState.target}+</span>
            </div>
            <div className="flex justify-between">
              <span>Pre-rolled result</span>
              <span className="font-bold text-white">
                {eventState.roll} → {eventState.total}
              </span>
            </div>
          </div>

          {!hasPotion ? (
            <p className="text-amber-300 text-xs mt-4">Requires Potion.</p>
          ) : null}
        </GameCard>

        <div className="space-y-3">
          <GameButton
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleUsePotion}
            loading={resolving}
            disabled={resolving || !hasPotion}
          >
            <Heart className="w-4 h-4" />
            Use Potion
          </GameButton>

          <GameButton
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => navigate(createPageUrl(`RunMap?runId=${runId}`))}
            disabled={resolving}
          >
            Leave
          </GameButton>
        </div>

        {showOverflowChoice ? (
          <GameCard className="py-6 border border-cyan-500/20 bg-cyan-500/5">
            <div className="space-y-3">
              <div>
                <p className="text-white font-bold">Party Full</p>
                <p className="text-white/50 text-sm mt-1">
                  {eventState.speciesName} wants to join, but your party already has 6 Pokémon.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <GameButton
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => finalizeRecruitEvent("send_to_storage")}
                  disabled={resolving}
                >
                  Send to Storage
                </GameButton>

                <GameButton
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={() => finalizeRecruitEvent("decline")}
                  disabled={resolving}
                >
                  Decline
                </GameButton>
              </div>
            </div>
          </GameCard>
        ) : null}
      </>
    );
  };

const renderWildPokemonSpotted = () => {
  const ballOptions = eventState.ballOptions ?? [
    { itemId: "pokeball", label: "Poké Ball", bonus: 0 },
  ];

  const selectedBall =
    ballOptions.find((ball) => ball.itemId === selectedBallId) ?? ballOptions[0];

  const rollSeed = `${run?.seed ?? runId ?? "event"}:${nodeId ?? "node"}:wild_ball_roll:${selectedBall.itemId}`;
  let hash = 0;
  for (let i = 0; i < rollSeed.length; i++) {
    hash = (hash * 31 + rollSeed.charCodeAt(i)) >>> 0;
  }
  const previewRoll = (hash % 20) + 1;
  const previewTotal = previewRoll + (selectedBall?.bonus ?? 0);

  const hasBall = (inventory[selectedBallId] ?? 0) >= 1;

  return (
    <>
      <GameCard className="py-8 border border-red-500/20 bg-red-500/5">
        <div className="flex items-center justify-center gap-3 mb-4">
          <CircleDot className="w-8 h-8 text-red-300" />
          <div className="text-left">
            <p className="text-white font-bold">{eventState.speciesName} spotted</p>
            <p className="text-white/40 text-xs">Choose a ball and try to catch it.</p>
          </div>
        </div>

        <div className="space-y-3 max-w-xs mx-auto text-left">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">
              Choose Ball
            </p>
            {ballOptions.map((ball) => (
              <button
                key={ball.itemId}
                type="button"
                onClick={() => setSelectedBallId(ball.itemId)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  selectedBallId === ball.itemId
                    ? "border-red-400 bg-red-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">{ball.label}</p>
                    <p className="text-white/40 text-xs">
                      Owned: {inventory[ball.itemId] ?? 0}
                    </p>
                  </div>
                  <div className="text-red-300 text-sm font-bold">
                    +{ball.bonus ?? 0}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-1 text-sm text-white/70">
            <div className="flex justify-between">
              <span>Roll</span>
              <span className="font-bold text-white">1d20 + {selectedBall?.bonus ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Target</span>
              <span className="font-bold text-white">{eventState.target}+</span>
            </div>
            <div className="flex justify-between">
              <span>Pre-rolled result</span>
              <span className="font-bold text-white">
                {previewRoll} → {previewTotal}
              </span>
            </div>
          </div>

          {!hasBall ? (
            <p className="text-amber-300 text-xs">Requires a Poké Ball.</p>
          ) : null}
        </div>
      </GameCard>

      <div className="space-y-3">
        <GameButton
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleUseBall}
          loading={resolving}
          disabled={resolving || !hasBall}
        >
          <CircleDot className="w-4 h-4" />
          Throw Ball
        </GameButton>

        <GameButton
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={() => navigate(createPageUrl(`RunMap?runId=${runId}`))}
          disabled={resolving}
        >
          Leave
        </GameButton>
      </div>

      {showOverflowChoice ? (
        <GameCard className="py-6 border border-cyan-500/20 bg-cyan-500/5">
          <div className="space-y-3">
            <div>
              <p className="text-white font-bold">Party Full</p>
              <p className="text-white/50 text-sm mt-1">
                {eventState.speciesName} was caught, but your party already has 6 Pokémon.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <GameButton
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() =>
                  finalizeRecruitEvent("send_to_storage")
                }
                disabled={resolving}
              >
                Send to Storage
              </GameButton>

              <GameButton
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() =>
                  finalizeRecruitEvent("decline")
                }
                disabled={resolving}
              >
                Decline
              </GameButton>
            </div>
          </div>
        </GameCard>
      ) : null}
    </>
  );
};

  const renderBaitedClearing = () => {
    const hasBait = (inventory.bait ?? 0) >= 1;

    return (
      <>
        <GameCard className="py-8 border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Wand2 className="w-8 h-8 text-emerald-300" />
            <div className="text-left">
              <p className="text-white font-bold">{eventState.speciesName} may appear</p>
              <p className="text-white/40 text-xs">Use 1 Bait to lure it closer.</p>
            </div>
          </div>

          <div className="space-y-1 text-sm text-white/70 text-left max-w-xs mx-auto">
            <div className="flex justify-between">
              <span>Required item</span>
              <span className="font-bold text-white">Bait ×1</span>
            </div>
            <div className="flex justify-between">
              <span>Roll</span>
              <span className="font-bold text-white">1d20 + 0</span>
            </div>
            <div className="flex justify-between">
              <span>Target</span>
              <span className="font-bold text-white">{eventState.target}+</span>
            </div>
            <div className="flex justify-between">
              <span>Pre-rolled result</span>
              <span className="font-bold text-white">
                {eventState.roll} → {eventState.total}
              </span>
            </div>
          </div>

          {!hasBait ? (
            <p className="text-amber-300 text-xs mt-4">Requires Bait.</p>
          ) : null}
        </GameCard>

        <div className="space-y-3">
          <GameButton
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleUseBait}
            loading={resolving}
            disabled={resolving || !hasBait}
          >
            <Star className="w-4 h-4" />
            Use Bait
          </GameButton>

          <GameButton
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => navigate(createPageUrl(`RunMap?runId=${runId}`))}
            disabled={resolving}
          >
            Leave
          </GameButton>
        </div>

        {showOverflowChoice ? (
          <GameCard className="py-6 border border-cyan-500/20 bg-cyan-500/5">
            <div className="space-y-3">
              <div>
                <p className="text-white font-bold">Party Full</p>
                <p className="text-white/50 text-sm mt-1">
                  {eventState.speciesName} is willing to join, but your party already has 6 Pokémon.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <GameButton
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => finalizeRecruitEvent("send_to_storage")}
                  disabled={resolving}
                >
                  Send to Storage
                </GameButton>

                <GameButton
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={() => finalizeRecruitEvent("decline")}
                  disabled={resolving}
                >
                  Decline
                </GameButton>
              </div>
            </div>
          </GameCard>
        ) : null}
      </>
    );
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6 text-center">
      <div className="space-y-2">
        <p className="text-5xl">✨</p>
        <h1 className="text-2xl font-black text-white">{eventView.title}</h1>
        <p className="text-white/40 text-sm">{eventView.description}</p>
      </div>

        {eventId === "training_spot"
          ? renderTrainingSpot()
          : eventId === "injured_pidgey"
          ? renderInjuredPidgey()
          : eventId === "wild_pokemon_spotted"
          ? renderWildPokemonSpotted()
          : eventId === "baited_clearing"
          ? renderBaitedClearing()
          : renderSupplyCache()}


      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}