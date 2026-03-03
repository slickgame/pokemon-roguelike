import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { runApi } from "../components/api/runApi";
import { generateRouteGraph, serializeGraph, hashGraph } from "../components/engine/routeGen";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import { ToastContainer, useToast } from "../components/ui/Toast";
import RouteMapView from "../components/runmap/RouteMapView";
import NextNodeCard from "../components/runmap/NextNodeCard";
import NodeIcon from "../components/runmap/NodeIcon";
import { MapPin, ShoppingBag, RefreshCw, Package, Coins } from "lucide-react";
import BagModal from "../components/battle/BagModal";
import RelicPanel from "../components/runmap/RelicPanel";

// ── Derive progression state from RunActions + Run.results.progress ──────────
function deriveProgress(actions, runProgress) {
  let currentNodeId = runProgress?.currentNodeId ?? null;
  const completedNodeIds = runProgress?.completedNodeIds ? [...runProgress.completedNodeIds] : [];
  let graphPayload = runProgress?.routeGraph ?? null;
  let potions = 0;

  for (const a of actions) {
    if (!graphPayload && a.actionType === "route_generated") {
      graphPayload = a.payload?.graph ?? null;
    }
    // Only fall back to action-derived node tracking if no run progress stored yet
    if (!runProgress) {
      if (a.actionType === "node_enter") {
        currentNodeId = a.payload?.nodeId ?? currentNodeId;
      }
      if (a.actionType === "node_chosen") {
        currentNodeId = a.payload?.toNodeId ?? currentNodeId;
      }
      if (a.actionType === "node_completed") {
        const nid = a.payload?.nodeId;
        if (nid && !completedNodeIds.includes(nid)) completedNodeIds.push(nid);
      }
      if (a.actionType === "node_resolved" && a.payload?.outcome === "win") {
        const nid = a.payload?.nodeId;
        if (nid && !completedNodeIds.includes(nid)) completedNodeIds.push(nid);
        currentNodeId = nid ?? currentNodeId;
      }
    }
    if (a.actionType === "shop_visited" || a.actionType === "event_resolved") {
      potions += 1;
    }
  }

  return { currentNodeId, completedNodeIds, graphPayload, potions };
}

// ── Compute which nodes are currently available to visit ──────────────────────
function computeAvailableNodes(graph, currentNodeId, completedNodeIds, startNodeId) {
  if (!graph) return [];
  const completed = new Set(completedNodeIds);

  // If no node entered yet, only startNode is available
  if (!currentNodeId) return [startNodeId];

  // If current node is completed, the next ones are available
  if (completed.has(currentNodeId)) {
    const current = graph.nodes.find(n => n.id === currentNodeId);
    if (!current) return [];
    return current.nextIds.filter(nid => !completed.has(nid));
  }

  // Current node not yet completed — allow selecting/entering this node.
  return completed.has(currentNodeId) ? [] : [currentNodeId];
}

export default function RunMap() {
  const navigate = useNavigate();
  const { toasts, toast, dismiss } = useToast();
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId");

  const [run, setRun] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [graph, setGraph] = useState(null);
  const [showBag, setShowBag] = useState(false);
  const [showRelics, setShowRelics] = useState(false);

  // Reload run + actions
  const reload = useCallback(async () => {
    if (!runId) return;
    const [r, acts] = await Promise.all([
      runApi.getRun(runId),
      runApi.listRunActions(runId),
    ]);
    acts.sort((a, b) => a.idx - b.idx);
    setRun(r);
    setActions(acts);
    return { run: r, actions: acts };
  }, [runId]);

  useEffect(() => {
    if (!runId) { setLoading(false); return; }
    reload().finally(() => setLoading(false));
  }, [runId]);

  // Derive progress — prefer Run.results.progress as source of truth, fall back to actions
  const runProgress = run?.results?.progress ?? null;
  const { currentNodeId, completedNodeIds, graphPayload, potions } = useMemo(
    () => deriveProgress(actions, runProgress),
    [actions, runProgress]
  );

  const routeIndex = runProgress?.routeIndex ?? 1;
  const routeId = runProgress?.routeId ?? `route${routeIndex}`;

  // pendingEncounter — only block if status is "pending" (not resolved)
  const rawPending = runProgress?.pendingEncounter ?? null;
  const pendingEncounter = rawPending?.status === "resolved" ? null : rawPending;

  // Build or restore graph
  useEffect(() => {
    if (!run) return;
    if (graphPayload) {
      setGraph(graphPayload);
      return;
    }
    // Generate fresh graph
    const g = generateRouteGraph({ seed: run.seed, routeId, routeIndex });
    setGraph(g);
    const existingProgress = run.results?.progress ?? {};
    base44.entities.Run.update(runId, {
      results: {
        ...(run.results ?? {}),
        progress: {
          ...existingProgress,
          routeIndex,
          routeId,
          routeGraph: g,
          routeCompleted: false,
          currentNodeId: existingProgress.currentNodeId ?? null,
          completedNodeIds: existingProgress.completedNodeIds ?? [],
        },
      },
    }).catch(() => {});

    // Log it (fire and forget)
    runApi.appendAction(runId, "route_generated", {
      routeId,
      routeIndex,
      graphSummaryHash: hashGraph(g),
      graph: serializeGraph(g),
    }).catch(() => {});
  }, [run, graphPayload, routeId, routeIndex]);

  // Compute state
  const startNodeId = graph?.startNodeId ?? null;
  const availableNodeIds = useMemo(
    () => computeAvailableNodes(graph, currentNodeId, completedNodeIds, startNodeId),
    [graph, currentNodeId, completedNodeIds, startNodeId]
  );

  const currentNode = graph?.nodes.find(n => n.id === currentNodeId) ?? null;
  const availableNodes = pendingEncounter
    ? [] // block navigation while encounter is pending
    : (graph?.nodes.filter(n => availableNodeIds.includes(n.id)) ?? []);

  // Guard: if run is not active, show friendly message
  const runInactive = run && run.status !== "active";

  // Navigate to results when run is finished
  useEffect(() => {
    if (!run) return;
    if (run.status === "finished") {
      navigate(createPageUrl(`Results?runId=${runId}`));
    }
  }, [run?.status]);

  // ── Node selection ───────────────────────────────────────────────────────────
  const handleNodeChoose = async (node) => {
    if (resolving) return;
    setResolving(true);
    try {
      // Log node_chosen
      await runApi.appendAction(runId, "node_chosen", {
        routeId,
        routeIndex,
        fromNodeId: currentNodeId ?? startNodeId,
        toNodeId: node.id,
      });

      // Resolve the node
      await resolveNode(node);
    } catch (e) {
      toast(e.message || "Failed to resolve node", "error");
    } finally {
      setResolving(false);
    }
  };

  const resolveNode = async (node) => {
    const { type, tier, id: nodeId } = node;

    if (type === "trainer" || type === "gym") {
      const resolvedTier = tier ?? (type === "gym" ? "boss" : "weak");
      const gymPending = type === "gym" ? {
        trainerType: "gym",
        trainerId: routeIndex >= 2 ? "gym2" : "gym1",
        trainerName: routeIndex >= 2 ? "Leader Misty" : "Leader Brock",
        aiTier: "boss",
      } : null;
      const res = await base44.functions.invoke("startNodeBattle", {
        runId,
        nodeId,
        nodeType: type,
        tier: resolvedTier,
        routeId,
        pendingEncounter: {
          nodeId,
          nodeType: type,
          tier: resolvedTier,
          routeId,
          ...(gymPending ?? {}),
        },
      });
      const { battleId, pendingEncounter } = res.data;

      // Persist pendingEncounter with canonical status field (includes gym identity when provided)
      const existingProgress = run?.results?.progress ?? {};
      await base44.entities.Run.update(runId, {
        results: {
          ...(run?.results ?? {}),
          progress: {
            ...existingProgress,
            routeId,
            routeIndex,
            currentNodeId: nodeId,
            pendingEncounter: pendingEncounter ?? { nodeId, nodeType: type, tier: resolvedTier, battleId, routeId, status: "pending", createdAt: new Date().toISOString() },
          },
        },
      });

      navigate(createPageUrl(`Battle?runId=${runId}&battleId=${battleId}&nodeId=${nodeId}&routeId=${routeId}`));
      return;
    }

    // For non-battle nodes: create pendingEncounter then navigate to the appropriate page
    const existingProgress = run?.results?.progress ?? {};
    const pendingPayload = { nodeId, nodeType: type, status: "pending", createdAt: new Date().toISOString() };
    await base44.entities.Run.update(runId, {
      results: {
        ...(run?.results ?? {}),
        progress: { ...existingProgress, routeIndex, routeId, routeGraph: graph ?? existingProgress.routeGraph, routeCompleted: false, currentNodeId: nodeId, pendingEncounter: pendingPayload },
      },
    });
    await runApi.appendAction(runId, "node_selected", { routeId, routeIndex, nodeId, nodeType: type });

    if (type === "center") {
      navigate(createPageUrl(`Center?runId=${runId}&nodeId=${nodeId}`));
      return;
    }

    if (type === "shop") {
      navigate(createPageUrl(`Shop?runId=${runId}&nodeId=${nodeId}`));
      return;
    }

    if (type === "event" || type === "event_item") {
      navigate(createPageUrl(`EventNode?runId=${runId}&nodeId=${nodeId}`));
      return;
    }
  };

  // ── Loading / Error guards ────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full" />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );

  if (!run) return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center">
      <GameCard><p className="text-red-400">Run not found. Check URL params.</p></GameCard>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );

  if (runInactive) return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
      <GameCard className="py-10 space-y-4">
        <p className="text-white/60 text-lg font-semibold">This run has ended</p>
        <p className="text-white/30 text-sm">Status: <span className="text-amber-400">{run.status}</span></p>
        <div className="flex gap-2 justify-center">
          <GameButton variant="secondary" size="md" onClick={() => navigate(createPageUrl(`Results?runId=${runId}`))}>View Results</GameButton>
          <GameButton variant="primary" size="md" onClick={() => navigate(createPageUrl("Home"))}>Return Home</GameButton>
        </div>
      </GameCard>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );

  const isInUncompletedNode = pendingEncounter !== null || (currentNodeId && !completedNodeIds.includes(currentNodeId));
  const battlesWon = actions.filter(a => a.actionType === "node_resolved" && a.payload?.outcome === "win").length;
  const money = runProgress?.money ?? 0;
  const inventory = runProgress?.inventory ?? { potion: 0, revive: 0 };
  const partyForBag = (runProgress?.partyState ?? []);

  const handleBagUse = async (itemId, partyIndex) => {
    const party = runProgress?.partyState ?? [];
    const poke = party[partyIndex];
    if (!poke) throw new Error("No pokémon at that index");

    const POTION_HEAL = 20;
    let amountHealed = 0;
    const updatedParty = party.map((p, i) => {
      if (i !== partyIndex) return p;
      if (itemId === "potion" && !p.fainted && p.currentHP < p.maxHP) {
        amountHealed = Math.min(POTION_HEAL, p.maxHP - p.currentHP);
        return { ...p, currentHP: p.currentHP + amountHealed };
      }
      if (itemId === "revive" && p.fainted) {
        const halfHp = Math.floor(p.maxHP * 0.5);
        amountHealed = halfHp;
        return { ...p, currentHP: halfHp, fainted: false, status: null };
      }
      return p;
    });

    const existingProgress = runProgress ?? {};
    const inv = { ...inventory };
    inv[itemId] = Math.max(0, (inv[itemId] ?? 0) - 1);

    await base44.entities.Run.update(runId, {
      results: {
        ...(run?.results ?? {}),
        progress: { ...existingProgress, partyState: updatedParty, inventory: inv },
      },
    });
    await runApi.appendAction(runId, "item_used", {
      context: "map", itemId, targetPartyIndex: partyIndex, amountHealed,
    });
    await reload();
    toast(`Used ${itemId} on ${poke.name}!`, "success");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <MapPin className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Route {routeIndex}</h1>
            <p className="text-white/40 text-xs">
              {completedNodeIds.length} nodes completed · {battlesWon} battles won
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Economy HUD */}
          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300 font-bold text-xs">${money}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl text-xs text-white/60">
            💊{inventory.potion ?? 0} · 💫{inventory.revive ?? 0}
          </div>
          {(runProgress?.relics ?? []).length > 0 && (
            <button
              onClick={() => setShowRelics(v => !v)}
              className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl text-amber-300 text-xs hover:bg-amber-500/20 transition-colors"
            >
              ✨ {(runProgress?.relics ?? []).length}
            </button>
          )}
          <button
            onClick={() => setShowBag(true)}
            className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1.5 rounded-xl text-violet-300 text-xs hover:bg-violet-500/20 transition-colors"
          >
            <Package className="w-3.5 h-3.5" />
            Bag
          </button>
        </div>
      </div>

      {/* Minimap */}
      {graph && (
        <GameCard className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">Route Overview</p>
          <RouteMapView
            graph={graph}
            currentNodeId={currentNodeId}
            completedNodeIds={completedNodeIds}
            availableNodeIds={availableNodeIds}
          />
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-white/5">
            {[
              { icon: "⚔️", label: "Weak Trainer" },
              { icon: "🗡️", label: "Avg Trainer" },
              { icon: "⭐", label: "Ace Trainer" },
              { icon: "💊", label: "Center" },
              { icon: "🛍️", label: "Shop" },
              { icon: "✨", label: "Event" },
              { icon: "👑", label: "Gym" },
            ].map(({ icon, label }) => (
              <span key={label} className="text-[10px] text-white/30 flex items-center gap-1">
                <span>{icon}</span>{label}
              </span>
            ))}
          </div>
        </GameCard>
      )}

      {/* Current location */}
      {currentNode && (
        <GameCard className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">Current Location</p>
          <div className="flex items-center gap-3">
            <NodeIcon type={currentNode.type} tier={currentNode.tier} size="md" active={!isInUncompletedNode} />
            <div>
              <p className="text-white font-semibold text-sm">
                {currentNode.meta?.label ?? currentNode.meta?.trainerName ?? currentNode.type}
              </p>
              <p className="text-white/40 text-xs">
                {completedNodeIds.includes(currentNode.id) ? "Completed ✓" : "In progress…"}
              </p>
            </div>
          </div>
        </GameCard>
      )}

      {/* Available next nodes */}
      <GameCard>
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-3">
          {availableNodes.length === 0
            ? isInUncompletedNode ? "Resolve current node first" : "No paths available"
            : availableNodes.length === 1 ? "Next Node" : `Choose a Path (${availableNodes.length} options)`}
        </p>

        {pendingEncounter && (
          <div className="text-center py-6 text-white/30 text-sm space-y-2">
            <p>Complete your current encounter to continue.</p>
            {pendingEncounter.battleId && (
              <GameButton
                variant="secondary"
                size="sm"
                onClick={() => navigate(createPageUrl(`Battle?runId=${runId}&battleId=${pendingEncounter.battleId}&nodeId=${pendingEncounter.nodeId}&routeId=${routeId}`))}
              >
                Return to Battle
              </GameButton>
            )}
            {(pendingEncounter.nodeType === "event" || pendingEncounter.nodeType === "event_item") && (
              <GameButton variant="secondary" size="sm" onClick={() => navigate(createPageUrl(`EventNode?runId=${runId}&nodeId=${pendingEncounter.nodeId}`))}>
                Continue Event
              </GameButton>
            )}
            {pendingEncounter.nodeType === "center" && (
              <GameButton variant="secondary" size="sm" onClick={() => navigate(createPageUrl(`Center?runId=${runId}&nodeId=${pendingEncounter.nodeId}`))}>
                Go to Center
              </GameButton>
            )}
            {pendingEncounter.nodeType === "shop" && (
              <GameButton variant="secondary" size="sm" onClick={() => navigate(createPageUrl(`Shop?runId=${runId}&nodeId=${pendingEncounter.nodeId}`))}>
                Go to Shop
              </GameButton>
            )}
          </div>
        )}

        {availableNodes.length > 0 && (
          <div className="space-y-2">
            {availableNodes.map(node => (
              <NextNodeCard
                key={node.id}
                node={node}
                onClick={() => handleNodeChoose(node)}
                disabled={resolving}
              />
            ))}
          </div>
        )}

        {availableNodes.length === 0 && !isInUncompletedNode && !loading && (
          <div className="text-center py-6 text-white/30 text-sm space-y-3">
            <p>No available nodes right now.</p>
            <p className="text-xs text-white/20">Runs only end on party wipe, explicit dev end, or future champion victory.</p>
          </div>
        )}
      </GameCard>

      {/* Refresh button for returning from battle */}
      <div className="flex justify-end mt-3">
        <button
          onClick={() => reload()}
          className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/50 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {showBag && (
        <BagModal
          inventory={inventory}
          party={partyForBag}
          onUse={handleBagUse}
          onClose={() => setShowBag(false)}
          context="map"
        />
      )}

      {showRelics && (
        <RelicPanel
          relics={runProgress?.relics ?? []}
          onClose={() => setShowRelics(false)}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}