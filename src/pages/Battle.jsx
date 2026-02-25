import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import PokemonBattleCard from "../components/battle/PokemonBattleCard";
import CommandBuilder from "../components/battle/CommandBuilder";
import { ToastContainer, useToast } from "../components/ui/Toast";
import { Swords } from "lucide-react";

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

  // Load initial battle state from Battle entity
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

  // Build default commands from active alive slots
  useEffect(() => {
    if (!state) return;
    const defaults = {};
    const aliveEnemy = state.enemy.active.filter(i => !state.enemy.team[i]?.fainted);
    for (const slot of state.player.active) {
      const poke = state.player.team[slot];
      if (!poke || poke.fainted) continue;
      defaults[slot] = {
        actorSlot: slot,
        type: "move",
        moveId: poke.moves[0]?.id,
        target: { side: "enemy", slot: aliveEnemy[0] ?? 0 },
      };
    }
    setCommands(defaults);
  }, [state?.turnNumber]);

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
      toast(e.message || "Failed to commit turn", "error");
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
      <GameCard><p className="text-red-400">Battle not found. Check URL params.</p></GameCard>
    </div>
  );

  const playerTeam = state.player.team;
  const enemyTeam  = state.enemy.team;
  const playerActive = state.player.active;
  const enemyActive  = state.enemy.active;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <Swords className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Battle</h1>
          <p className="text-white/40 text-xs">Turn {turnNumber} · {winner ? `Battle finished — ${winner === "player" ? "Victory!" : "Defeat"}` : "Active"}</p>
        </div>
      </div>

      {/* 3v3 board */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Enemy side */}
        <GameCard className="order-1">
          <p className="text-[10px] uppercase tracking-widest text-red-400/70 font-semibold mb-2">Enemy</p>
          <div className="space-y-2">
            {enemyTeam.map((poke, i) => (
              <PokemonBattleCard key={i} poke={poke} slot={i} side="enemy" />
            ))}
          </div>
        </GameCard>

        {/* Player side */}
        <GameCard className="order-2">
          <p className="text-[10px] uppercase tracking-widest text-violet-400/70 font-semibold mb-2">Your Team</p>
          <div className="space-y-2">
            {playerTeam.map((poke, i) => (
              <PokemonBattleCard key={i} poke={poke} slot={i} side="player" />
            ))}
          </div>
        </GameCard>
      </div>

      {/* Command builder + battle log */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Commands */}
        {!winner && (
          <GameCard>
            <p className="text-white font-semibold text-sm mb-3">Select Actions</p>
            <CommandBuilder
              playerTeam={playerTeam}
              activeSlots={playerActive}
              commands={commands}
              onChange={(slot, cmd) => setCommands(prev => ({ ...prev, [slot]: cmd }))}
              enemyActiveSlots={enemyActive}
              enemyTeam={enemyTeam}
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
            <GameButton
              variant="primary"
              size="md"
              className="w-full mt-4"
              onClick={() => navigate(createPageUrl(`RunMap?runId=${runId}`))}
            >
              Back to Run Map
            </GameButton>
          )}
        </GameCard>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}