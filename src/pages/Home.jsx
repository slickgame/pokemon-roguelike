import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentPlayer } from "../components/hooks/useCurrentPlayer";
import GameCard from "../components/ui/GameCard";
import GameButton from "../components/ui/GameButton";
import { ToastContainer, useToast } from "../components/ui/Toast";
import ModifierCategorySection from "../components/modifiers/ModifierCategorySection";
import ModifierSummaryBar from "../components/modifiers/ModifierSummaryBar";
import { MODIFIERS, MODIFIER_CATEGORIES, MAX_MODIFIERS } from "../components/modifiers/modifiersConfig";
import { Swords, Zap, Shield, Star, ArrowRight, LogIn, Play, MapPin, Coins, Package } from "lucide-react";

// XP Share IDs — handled separately as a radio, not stored in selectedModifiers
const XP_SHARE_IDS = new Set(["xp_share_on", "xp_share_off"]);
// Non-XP-Share modifiers (normal toggles)
const NORMAL_MODIFIERS = MODIFIERS.filter(m => !XP_SHARE_IDS.has(m.id));

function useModifiers() {
  // "on" | "off"
  const [xpShareMode, setXpShareMode] = useState("on");
  // { [id]: true } — only normal modifiers (no xp_share_*)
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [validationError, setValidationError] = useState("");

  // Effective selected map: includes xp_share_off only when mode is "off"
  const effectiveSelected = useMemo(() => {
    const base = { ...selectedModifiers };
    if (xpShareMode === "off") base["xp_share_off"] = true;
    return base;
  }, [selectedModifiers, xpShareMode]);

  const selectedCount = Object.keys(effectiveSelected).length;

  const totalPct = useMemo(() => {
    let sum = 0;
    for (const id of Object.keys(effectiveSelected)) {
      const mod = MODIFIERS.find(m => m.id === id);
      if (mod) sum += mod.aetherPct;
    }
    return Math.max(-90, Math.min(200, sum));
  }, [effectiveSelected]);

  // selectedIds set for ModifierCategorySection compatibility
  const selectedIds = useMemo(() => new Set(Object.keys(effectiveSelected)), [effectiveSelected]);

  const disabledMap = useMemo(() => {
    const map = {};
    for (const mod of MODIFIERS) {
      if (XP_SHARE_IDS.has(mod.id)) {
        // XP share cards are handled by the radio — never disabled via normal map
        map[mod.id] = { disabled: false };
        continue;
      }
      if (effectiveSelected[mod.id]) {
        map[mod.id] = { disabled: false };
        continue;
      }
      if (selectedCount >= MAX_MODIFIERS) {
        map[mod.id] = { disabled: true, reason: `Maximum ${MAX_MODIFIERS} modifiers reached` };
        continue;
      }
      const clash = mod.incompatibleWith.find(id => effectiveSelected[id]);
      if (clash) {
        const clashName = MODIFIERS.find(m => m.id === clash)?.name || clash;
        map[mod.id] = { disabled: true, reason: `Incompatible with "${clashName}"` };
        continue;
      }
      map[mod.id] = { disabled: false };
    }
    return map;
  }, [effectiveSelected, selectedCount]);

  const setXpShare = (mode) => {
    setValidationError("");
    if (mode === xpShareMode) return;
    if (mode === "off" && selectedCount >= MAX_MODIFIERS) {
      setValidationError(`You're at the modifier cap (${MAX_MODIFIERS}). Cannot enable XP Share OFF.`);
      return;
    }
    setXpShareMode(mode);
  };

  const toggle = (id) => {
    setValidationError("");
    // XP Share handled by setXpShare
    if (XP_SHARE_IDS.has(id)) {
      setXpShare(id === "xp_share_off" ? "off" : "on");
      return;
    }
    const mod = MODIFIERS.find(m => m.id === id);
    if (!mod) return;

    setSelectedModifiers(prev => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      if (selectedCount >= MAX_MODIFIERS) {
        setValidationError(`You can only select up to ${MAX_MODIFIERS} modifiers.`);
        return prev;
      }
      const clash = mod.incompatibleWith.find(otherId => effectiveSelected[otherId]);
      if (clash) {
        const clashName = MODIFIERS.find(m => m.id === clash)?.name || clash;
        setValidationError(`"${mod.name}" is incompatible with "${clashName}".`);
        return prev;
      }
      return { ...prev, [id]: true };
    });
  };

  const modifierIds = Object.keys(effectiveSelected);

  return { selectedIds, xpShareMode, setXpShare, totalPct, disabledMap, validationError, toggle, modifierIds, selectedCount };
}

export default function Home() {
  const navigate = useNavigate();
  const { player, user, loading: playerLoading, error: playerError } = useCurrentPlayer();
  const [loading, setLoading] = useState(false);
  const [isRanked, setIsRanked] = useState(false);
  const [season, setSeason] = useState(null);
  const [activeRun, setActiveRun] = useState(null);
  const [activeRunLoading, setActiveRunLoading] = useState(false);
  const { toasts, toast, dismiss } = useToast();
  const { selectedIds, xpShareMode, setXpShare, totalPct, disabledMap, validationError, toggle, modifierIds, selectedCount } = useModifiers();

  useEffect(() => {
    base44.functions.invoke("getCurrentSeason", {})
      .then(res => setSeason(res.data))
      .catch(() => {});
  }, []);

  // Load most recent active run for this player
  useEffect(() => {
    if (!player) return;
    setActiveRunLoading(true);
    base44.entities.Run.filter({ status: "active" }, "-created_date", 1)
      .then(rows => setActiveRun(rows[0] ?? null))
      .catch(() => setActiveRun(null))
      .finally(() => setActiveRunLoading(false));
  }, [player?.id]);

  const handleStartRun = async () => {
    if (!player) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("startRun", {
        isRanked,
        modifierIds,
      });
      const { runId, seed } = res.data;
      toast(`Run created! Seed: ${seed.slice(0, 8)}…`, "success");
      setTimeout(() => {
        navigate(createPageUrl(`StarterSelect?runId=${runId}`));
      }, 600);
    } catch (err) {
      toast(err.message || "Failed to start run", "error");
      setLoading(false);
    }
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  const modifiersByCategory = useMemo(() =>
    MODIFIER_CATEGORIES.reduce((acc, cat) => {
      acc[cat] = MODIFIERS.filter(m => m.category === cat);
      return acc;
    }, {}),
  []);

  const runMeta = `${isRanked ? "Ranked" : "Unranked"} · ${
    selectedCount === 0 ? "No modifiers" : `${selectedCount} modifier${selectedCount !== 1 ? "s" : ""}`
  }`;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (playerLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full mx-auto mb-4" />
        <p className="text-white/40">Loading...</p>
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (playerError) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <GameCard className="text-center py-10">
          <p className="text-red-400 mb-4">Error: {playerError}</p>
          <GameButton onClick={() => window.location.reload()} variant="primary">Retry</GameButton>
        </GameCard>
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  // ── Not logged in ────────────────────────────────────────────────────────
  if (!user || !player) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-6">
            <Zap className="w-3 h-3" />
            v0.0.1 · M4 Modifiers
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-4">
            Poké<span className="text-violet-400">Rogue</span>
          </h1>
          <p className="text-white/40 text-lg max-w-md mx-auto leading-relaxed mb-12">
            A browser-based Pokémon roguelike. Build your team. Conquer the run. Claim the Aether.
          </p>
          <GameCard className="max-w-md mx-auto text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-6">
              <LogIn className="w-8 h-8 text-violet-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Welcome, Trainer!</h2>
            <p className="text-white/50 mb-8">Sign in to start your adventure and compete on the leaderboard.</p>
            <GameButton onClick={handleLogin} variant="primary" size="lg" className="w-full">
              <LogIn className="w-4 h-4" />
              Sign In to Play
            </GameButton>
          </GameCard>
        </div>
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  // ── Authenticated ────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Two-column layout on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">

        {/* LEFT: Hero + CTA + feature grid */}
        <div className="space-y-6">
          {/* Hero */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-4">
              <Zap className="w-3 h-3" />
              v0.0.1 · M4 Modifiers
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
              Poké<span className="text-violet-400">Rogue</span>
            </h1>
            <p className="text-white/40 leading-relaxed">
              Welcome back, <span className="text-white font-medium">{player.displayName}</span>!
            </p>
            <div className="flex items-center gap-2 mt-3">
              <div className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-amber-300 font-bold text-lg">{player.aether}</span>
                <span className="text-amber-300/60 text-sm ml-2">Aether</span>
              </div>
            </div>
          </div>

          {/* Resume Run — shown if there's an active run */}
          {activeRunLoading && (
            <div className="h-16 flex items-center gap-2 text-white/30 text-sm">
              <div className="animate-spin w-4 h-4 border-2 border-white/10 border-t-white/40 rounded-full" />
              Checking for active run…
            </div>
          )}
          {activeRun && !activeRunLoading && (() => {
            const prog = activeRun.results?.progress ?? {};
            const pe = prog.pendingEncounter ?? null;
            const nodesCompleted = (prog.completedNodeIds ?? []).length;
            const money = prog.money ?? 0;
            const inv = prog.inventory ?? {};
            const resumeUrl = pe?.battleId
              ? `Battle?runId=${activeRun.id}&battleId=${pe.battleId}&nodeId=${pe.nodeId}&routeId=route1`
              : `RunMap?runId=${activeRun.id}`;
            return (
              <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                  <p className="text-violet-300 font-semibold text-sm">Active Run in Progress</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-white/50">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {nodesCompleted} nodes completed</span>
                  <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-amber-400" /> <span className="text-amber-300">${money}</span></span>
                  <span className="flex items-center gap-1"><Package className="w-3 h-3" /> 💊{inv.potion ?? 0} · 💫{inv.revive ?? 0}</span>
                  {pe && <span className="text-orange-300 flex items-center gap-1"><Swords className="w-3 h-3" /> Battle pending</span>}
                </div>
                <GameButton
                  size="md"
                  variant="primary"
                  className="w-full"
                  onClick={() => navigate(createPageUrl(resumeUrl))}
                >
                  <Play className="w-4 h-4" />
                  Resume Run
                </GameButton>
              </div>
            );
          })()}

          {/* CTA */}
          <div className="flex flex-col gap-3">
            {/* Ranked toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRanked(r => !r)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors
                  ${isRanked ? "bg-violet-500 border-violet-500" : "bg-white/10 border-white/15"}`}
              >
                <span className={`my-auto mx-0.5 block h-4 w-4 rounded-full bg-white shadow transition-transform ${isRanked ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <span className="text-white/50 text-sm">{isRanked ? "Ranked" : "Unranked"}</span>
            </div>

            <GameButton size="xl" onClick={handleStartRun} loading={loading} className="w-full max-w-xs">
              <Swords className="w-5 h-5" />
              {activeRun ? "Start New Run" : "Start Run"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </GameButton>
            <p className="text-white/25 text-xs">{runMeta}</p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Swords, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/15", title: "Roguelike Runs",      desc: "Every run is unique with seeded generation, modifiers, and escalating difficulty." },
              { icon: Star,   color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/15",   title: "Seasons & Leaderboard", desc: "Compete each season for the top Aether score across categories." },
              { icon: Shield, color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/15",title: "Carryover Roster",   desc: "Your best Pokémon persist across seasons with inherited talents." },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <GameCard key={title} className="group hover:border-white/12 transition-all">
                <div className={`inline-flex p-2 rounded-xl border ${bg} mb-3`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
              </GameCard>
            ))}
          </div>

          {/* Season status */}
          {season && (
            <GameCard className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white/60 text-sm">Season {season.seasonId}</span>
              </div>
              <span className="text-white/20">·</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                season.state === "ACTIVE_EVENT" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
              }`}>{season.state}</span>
              <span className="ml-auto text-white/25 text-xs font-mono">{season.dbVersionHash}</span>
            </GameCard>
          )}
        </div>

        {/* RIGHT: Modifier panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-sm">Run Modifiers</h2>
            <span className="text-white/30 text-xs">{selectedCount} / {MAX_MODIFIERS}</span>
          </div>

          {/* Summary bar */}
          <ModifierSummaryBar
            selectedCount={selectedCount}
            totalPct={totalPct}
            validationError={validationError}
          />

          {/* Category sections */}
          <div className="space-y-4 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
            {/* Progression: XP Share radio */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-1.5 px-0.5">Progression</p>
              <div className="flex gap-2">
                {[
                  { mode: "on",  label: "XP Share: ON",  pct: "±0%",  desc: "All party members gain XP (default)." },
                  { mode: "off", label: "XP Share: OFF", pct: "+10%", desc: "Only active battler gains XP." },
                ].map(({ mode, label, pct, desc }) => {
                  const active = xpShareMode === mode;
                  const wouldExceedCap = mode === "off" && !active && selectedCount >= MAX_MODIFIERS;
                  return (
                    <button
                      key={mode}
                      onClick={() => setXpShare(mode)}
                      disabled={wouldExceedCap}
                      className={`flex-1 text-left px-3 py-2.5 rounded-lg border transition-all text-sm
                        ${active
                          ? "bg-violet-500/15 border-violet-500/40 text-white"
                          : wouldExceedCap
                            ? "bg-white/2 border-white/5 text-white/25 cursor-not-allowed"
                            : "bg-white/4 border-white/8 text-white/70 hover:bg-white/8 hover:border-white/15 hover:text-white cursor-pointer"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium leading-snug">{label}</span>
                        <span className={`font-mono text-xs font-bold ${active && mode === "off" ? "text-emerald-400" : "text-white/30"}`}>{pct}</span>
                      </div>
                      <p className="text-xs text-white/35 mt-0.5 leading-snug">{desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {MODIFIER_CATEGORIES.filter(c => c !== "Progression").map(cat => (
              modifiersByCategory[cat]?.length > 0 && (
                <ModifierCategorySection
                  key={cat}
                  category={cat}
                  modifiers={modifiersByCategory[cat]}
                  selectedIds={selectedIds}
                  disabledMap={disabledMap}
                  onToggle={toggle}
                />
              )
            ))}
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}