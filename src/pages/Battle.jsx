import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import PokemonBattleCard from "../components/battle/PokemonBattleCard";
import CommandBuilder from "../components/battle/CommandBuilder";
import { ToastContainer, useToast } from "../components/ui/Toast";
import { Swords, Bug } from "lucide-react";
import ReplacementPanel from "../components/battle/ReplacementPanel";

export default function Battle() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId");
  const battleId = params.get("battleId");

  const { toasts, toast, dismiss } = useToast();
  const [state, setState] = useState(null);
  const [turnNumber, setTurnNumber] = useState(0);
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [commands, setCommands] = useState({});
  const [showDebug, setShowDebug] = useState(false);
  const [choosing, setChoosing] = useState(false);

  // Load / reload battle state from Battle entity (persistence on refresh)
  useEffect(() => {
    if (!battleId) { setLoading(false); return; }
    base44.entities.Battle.filter({ id: battleId })
      .then(rows => {
        const b = rows[0];
        if (b) {
          setState(b.state);
          setTurnNumber(b.turnNumber ?? 0);
          setWinner(b.state?.winner ?? null);
        }
      })
      .catch(e => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [battleId]);

  // Rebuild default commands when state changes (new turn)
  useEffect(() => {
    if (!state) return;
    const defaults = {};
    const aliveEnemyTargets = (state.enemy.active ?? []).map((p, i) => ({ p, i })).filter(({ p }) => p && !p.fainted);
    for (let i = 0; i < (state.player.active ?? []).length; i++) {
      const poke = state.player.active[i];
      if (!poke || poke.fainted) continue;
      defaults[i] = {
        actorSlot: i,
        type: "move",
        moveId: poke.moves[0]?.id,
        target: { side: "enemy", slot: aliveEnemyTargets[0]?.i ?? 0 },
      };
    }
    setCommands(defaults);
  }, [turnNumber, !!state]);

  const handleCommit = async () => {
    const cmds = Object.values(commands);
    if (cmds.length === 0) return;
    setCommitting(true);
    try {
      const res = await base44.functions.invoke("commitTurn", {
        runId, battleId, playerCommands: cmds,
      });
      const data = res.data;
      setState(data.state);
      setTurnNumber(data.turnNumber);
      setWinner(data.winner ?? null);
      if (data.winner) toast(data.winner === "player" ? "You won! 🎉" : "You lost...", data.winner === "player" ? "success" : "error");
    } catch (e) {
      toast(e.response?.data?.error || e.message || "Failed to commit turn", "error");
    } finally {
      setCommitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full" />
    </div>
  );

  if (!state) return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center">
      <GameCard><p className="text-red-400">Battle not found. Check URL params (runId &amp; battleId).</p></GameCard>
    </div>
  );

  const playerActive = state.player.active ?? [];
  const playerBench  = state.player.bench  ?? [];
  const enemyActive  = state.enemy.active  ?? [];
  const enemyBench   = state.enemy.bench   ?? [];
  const pendingReplacement = state.pendingReplacement ?? null;

  const handleChooseReplacement = async (benchIndex) => {
    setChoosing(true);
    try {
      const res = await base44.functions.invoke("chooseReplacement", {
        runId, battleId, slot: pendingReplacement.slot, benchIndex,
      });
      const data = res.data;
      setState(data.state);
      setTurnNumber(data.turnNumber ?? turnNumber);
    } catch (e) {
      toast(e.response?.data?.error || e.message || "Failed to choose replacement", "error");
    } finally {
      setChoosing(false);
    }
  };

  const lastRngUsed = state.lastRngUsed ?? 0;
  const lastActionOrder = state.lastActionOrder ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Swords className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Battle</h1>
            <p className="text-white/40 text-xs">
              Turn {turnNumber} · {winner
                ? `Battle finished — ${winner === "player" ? "Victory!" : "Defeat"}`
                : `Active · RNG calls: ${state.rngCallCount ?? 0}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowDebug(v => !v)}
          className="flex items-center gap-1 text-xs text-white/25 hover:text-white/50 transition-colors"
        >
          <Bug className="w-3 h-3" /> Debug
        </button>
      </div>

      {/* Debug panel */}
      {showDebug && (
        <GameCard className="mb-4 font-mono text-xs text-white/50 space-y-1">
          <p className="text-white/25 uppercase tracking-widest text-[9px] mb-2">Dev — Last Turn Debug</p>
          <p>RNG rolls this turn: <span className="text-amber-400">{lastRngUsed}</span></p>
          <p>Total RNG cursor: <span className="text-amber-400">{state.rngCallCount ?? 0}</span></p>
          <p>Enemy switch used: <span className="text-amber-400">{state.enemySwitchUsed ? "yes" : "no"}</span></p>
          <p className="mt-1 text-white/30">Last action order:</p>
          {lastActionOrder.length === 0
            ? <p className="text-white/20">— no turns committed yet —</p>
            : lastActionOrder.map((a, i) => <p key={i} className="pl-2">#{i + 1} {a}</p>)
          }
        </GameCard>
      )}

      {/* 3v3 board with bench */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Enemy */}
        <GameCard>
          <p className="text-[10px] uppercase tracking-widest text-red-400/70 font-semibold mb-2">Enemy Active</p>
          <div className="space-y-1.5">
            {enemyActive.map((poke, i) => (
              <PokemonBattleCard key={i} poke={poke} slot={i} side="enemy" isActive={true} />
            ))}
          </div>
          {enemyBench.length > 0 && (
            <>
              <p className="text-[9px] uppercase tracking-widest text-white/20 font-semibold mt-3 mb-1">Bench</p>
              <div className="space-y-1.5">
                {enemyBench.map((poke, i) => (
                  <PokemonBattleCard key={i} poke={poke} slot={i} side="enemy" isActive={false} />
                ))}
              </div>
            </>
          )}
        </GameCard>

        {/* Player */}
        <GameCard>
          <p className="text-[10px] uppercase tracking-widest text-violet-400/70 font-semibold mb-2">Your Active</p>
          <div className="space-y-1.5">
            {playerActive.map((poke, i) => (
              <PokemonBattleCard key={i} poke={poke} slot={i} side="player" isActive={true} />
            ))}
          </div>
          {playerBench.length > 0 && (
            <>
              <p className="text-[9px] uppercase tracking-widest text-white/20 font-semibold mt-3 mb-1">Bench</p>
              <div className="space-y-1.5">
                {playerBench.map((poke, i) => (
                  <PokemonBattleCard key={i} poke={poke} slot={i} side="player" isActive={false} />
                ))}
              </div>
            </>
          )}
        </GameCard>
      </div>

      {/* Command builder + log */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!winner && (
          <GameCard>
            <p className="text-white font-semibold text-sm mb-3">Select Actions</p>
            <CommandBuilder
              playerActive={playerActive}
              playerBench={playerBench}
              commands={commands}
              onChange={(slot, cmd) => setCommands(prev => ({ ...prev, [slot]: cmd }))}
              enemyActive={enemyActive}
            />
            <GameButton
              variant="primary"
              size="md"
              className="w-full mt-4"
              onClick={handleCommit}
              loading={committing}
              disabled={committing || !!winner}
            >
              <Swords className="w-4 h-4" />
              Commit Turn
            </GameButton>
          </GameCard>
        )}

        {/* Battle log */}
        <GameCard className={winner ? "md:col-span-2" : ""}>
          <p className="text-white font-semibold text-sm mb-3">Battle Log — Turn {turnNumber}</p>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {(state.turnLog ?? []).length === 0
              ? <p className="text-white/25 text-xs">No actions yet. Commit a turn!</p>
              : (state.turnLog ?? []).map((msg, i) => (
                  <p key={i} className="text-white/70 text-xs leading-relaxed">{msg}</p>
                ))
            }
          </div>
          {winner && (
            <div className="mt-4 space-y-2">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 space-y-1">
                <p className="font-semibold text-white/80 mb-1">Battle Summary</p>
                <p>Winner: <span className={winner === "player" ? "text-emerald-400" : "text-red-400"}>{winner}</span></p>
                <p>Turns: {turnNumber}</p>
                <p>Your fainted: {[...playerActive, ...playerBench].filter(p => p?.fainted).length}</p>
                <p>Enemy fainted: {[...enemyActive, ...enemyBench].filter(p => p?.fainted).length}</p>
              </div>
              <GameButton
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => navigate(createPageUrl(`RunMap?runId=${runId}`))}
              >
                Back to Run Map
              </GameButton>
            </div>
          )}
        </GameCard>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}