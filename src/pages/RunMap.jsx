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
import { MapPin, Heart, ShoppingBag, Sparkles, RefreshCw } from "lucide-react";

const ROUTE_ID = "route1";

// ── Derive progression state from RunActions + Run.results.progress ──────────
function deriveProgress(actions, runProgress) {
  let currentNodeId = runProgress?.currentNodeId ?? null;
  const completedNodeIds = runProgress?.completedNodeIds ? [...runProgress.completedNodeIds] : [];
  let graphPayload = null;
  let gymDefeated = false;
  let potions = 0;

  for (const a of actions) {
    if (a.actionType === "route_generated" && a.payload?.routeId === ROUTE_ID) {
      graphPayload = a.payload.graph;
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
    if (a.actionType === "gym_defeated") {
      gymDefeated = true;
    }
  }

  return { currentNodeId, completedNodeIds, graphPayload, gymDefeated, potions };
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

  // Current node not yet completed — it's the one we're "in"
  return [];
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
  const { currentNodeId, completedNodeIds, graphPayload, gymDefeated, potions } = useMemo(
    () => deriveProgress(actions, runProgress),
    [actions, runProgress]
  );

  // pendingEncounter from Run.results.progress (set by resolveEncounterFromBattle / startNodeBattle)
  const pendingEncounter = runProgress?.pendingEncounter ?? null;

  // Build or restore graph
  useEffect(() => {
    if (!run) return;
    if (graphPayload) {
      setGraph(graphPayload);
      return;
    }
    // Generate fresh graph
    const g = generateRouteGraph({ seed: run.seed, routeId: ROUTE_ID });
    setGraph(g);
    // Log it (fire and forget)
    runApi.appendAction(runId, "route_generated", {
      routeId: ROUTE_ID,
      graphSummaryHash: hashGraph(g),
      graph: serializeGraph(g),
    }).catch(() => {});
  }, [run, graphPayload]);

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
        routeId: ROUTE_ID,
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
      // Start a battle and record pendingEncounter on Run
      const res = await base44.functions.invoke("startNodeBattle", {
        runId,
        nodeId,
        nodeType: type,
        tier: tier ?? (type === "gym" ? "boss" : "weak"),
        routeId: ROUTE_ID,
      });
      const { battleId } = res.data;

      // Persist pendingEncounter so RunMap knows an encounter is in-flight
      const existingProgress = run?.results?.progress ?? {};
      await base44.entities.Run.update(runId, {
        results: {
          ...(run?.results ?? {}),
          progress: {
            ...existingProgress,
            routeId: ROUTE_ID,
            currentNodeId: nodeId,
            pendingEncounter: { nodeId, nodeType: type, battleId },
          },
        },
      });

      navigate(createPageUrl(`Battle?runId=${runId}&battleId=${battleId}&nodeId=${nodeId}&routeId=${ROUTE_ID}`));
      return;
    }

    if (type === "center") {
      await runApi.appendAction(runId, "node_enter", { routeId: ROUTE_ID, nodeId, nodeType: type });
      await runApi.appendAction(runId, "center_used", { routeId: ROUTE_ID, nodeId });
      await runApi.appendAction(runId, "node_completed", { routeId: ROUTE_ID, nodeId });
      toast("Your party was fully healed! 💊", "success");
      await reload();
      return;
    }

    if (type === "shop") {
      await runApi.appendAction(runId, "node_enter", { routeId: ROUTE_ID, nodeId, nodeType: type });
      await runApi.appendAction(runId, "shop_visited", { routeId: ROUTE_ID, nodeId, reward: "potion" });
      await runApi.appendAction(runId, "node_completed", { routeId: ROUTE_ID, nodeId });
      toast("You got a Potion from the Poké Mart! 🛍", "success");
      await reload();
      return;
    }

    if (type === "event") {
      await runApi.appendAction(runId, "node_enter", { routeId: ROUTE_ID, nodeId, nodeType: type });
      await runApi.appendAction(runId, "event_resolved", { routeId: ROUTE_ID, nodeId, reward: "potion" });
      await runApi.appendAction(runId, "node_completed", { routeId: ROUTE_ID, nodeId });
      toast(node.meta?.label === "Route Start" ? "Your journey begins!" : "Found a Potion! ✨", "success");
      await reload();
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

  const isAtStartNode = !currentNodeId || (currentNodeId === startNodeId && !completedNodeIds.includes(startNodeId));
  const isInUncompletedNode = currentNodeId && !completedNodeIds.includes(currentNodeId);
  const battlesWon = actions.filter(a => a.actionType === "battle_end" && a.payload?.summary?.winner === "player").length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <MapPin className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Route 1</h1>
          <p className="text-white/40 text-xs">
            {completedNodeIds.length} nodes completed · {battlesWon} battles won · {potions} potions
          </p>
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

        {isInUncompletedNode && !completedNodeIds.includes(currentNodeId) && (
          <div className="text-center py-6 text-white/30 text-sm">
            <p>Complete your current encounter to continue.</p>
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
            <p>All nodes completed!</p>
            <GameButton variant="primary" size="sm" onClick={() => navigate(createPageUrl(`Results?runId=${runId}`))}>
              View Results
            </GameButton>
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

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}