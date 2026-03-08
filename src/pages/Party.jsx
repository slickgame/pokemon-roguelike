import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useRequiredRunId } from "@/hooks/useRequiredRunId";
import { runApi } from "../components/api/runApi";

const DEFAULT_IVS = {
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
};

const DEFAULT_EVS = {
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
};

const STAT_LABELS = {
  hp: "HP",
  atk: "Attack",
  def: "Defense",
  spa: "Sp. Atk",
  spd: "Sp. Def",
  spe: "Speed",
};

const STARTER_SPECIES = {
  1: {
    id: 1,
    name: "Bulbasaur",
    types: ["grass", "poison"],
    baseStats: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 },
    abilities: ["overgrow"],
    startMoves: [
      { id: "tackle", name: "Tackle", pp: 35 },
      { id: "growl", name: "Growl", pp: 40 },
    ],
  },
  4: {
    id: 4,
    name: "Charmander",
    types: ["fire"],
    baseStats: { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 },
    abilities: ["blaze"],
    startMoves: [
      { id: "scratch", name: "Scratch", pp: 35 },
      { id: "growl", name: "Growl", pp: 40 },
    ],
  },
  7: {
    id: 7,
    name: "Squirtle",
    types: ["water"],
    baseStats: { hp: 44, atk: 48, def: 65, spa: 50, spd: 64, spe: 43 },
    abilities: ["torrent"],
    startMoves: [
      { id: "tackle", name: "Tackle", pp: 35 },
      { id: "tail_whip", name: "Tail Whip", pp: 30 },
    ],
  },
  10: {
    id: 10,
    name: "Caterpie",
    types: ["bug"],
    baseStats: { hp: 45, atk: 30, def: 35, spa: 20, spd: 20, spe: 45 },
    abilities: ["shield_dust"],
    startMoves: [
      { id: "tackle", name: "Tackle", pp: 35 },
      { id: "string_shot", name: "String Shot", pp: 40 },
    ],
  },
  25: {
    id: 25,
    name: "Pikachu",
    types: ["electric"],
    baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
    abilities: ["static"],
    startMoves: [
      { id: "thunder_shock", name: "ThunderShock", pp: 30 },
      { id: "growl", name: "Growl", pp: 40 },
    ],
  },
};

const PARTY_NATURES = [
  "Hardy","Lonely","Brave","Adamant","Naughty",
  "Bold","Docile","Relaxed","Impish","Lax",
  "Timid","Hasty","Serious","Jolly","Naive",
  "Modest","Mild","Quiet","Bashful","Rash",
  "Calm","Gentle","Sassy","Careful","Quirky"
];

const PARTY_GENDER_RATIOS = {
  1: { male: 0.875, female: 0.125 },
  4: { male: 0.875, female: 0.125 },
  7: { male: 0.875, female: 0.125 },
  10: { male: 0.5, female: 0.5 },
  25: { male: 0.5, female: 0.5 },
};

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function makeRng(seedStr) {
  let s = hashString(String(seedStr));
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngInt(rng, max) {
  return Math.floor(rng() * max);
}

function rollGender(speciesId, rng) {
  const ratio = PARTY_GENDER_RATIOS[speciesId];
  if (!ratio) return rng() < 0.5 ? "Male" : "Female";
  return rng() < ratio.male ? "Male" : "Female";
}

function computeFallbackStats(baseStats, level) {
  const cs = (b) => Math.floor((2 * b * level) / 100 + 5);
  const chp = (b) => Math.floor((2 * b * level) / 100) + level + 10;
  return {
    hp: chp(baseStats.hp),
    atk: cs(baseStats.atk),
    def: cs(baseStats.def),
    spa: cs(baseStats.spa),
    spd: cs(baseStats.spd),
    spe: cs(baseStats.spe),
  };
}

function buildFallbackPartyFromRun(run, actions) {
  const existingParty = run?.results?.progress?.partyState ?? [];
  if (existingParty.length > 0) return existingParty;

  const starterConfirm = [...(actions ?? [])]
    .reverse()
    .find((a) => a.actionType === "starter_confirm");

  const team = starterConfirm?.payload?.team ?? [];
  if (!Array.isArray(team) || team.length === 0) return [];

  return team
    .map((entry, index) => {
      const speciesId = Number(entry?.speciesId);
      const species = STARTER_SPECIES[speciesId];
      if (!species) return null;

      const level = 5;
      const rng = makeRng(`${run?.seed ?? "fallback"}:starter_confirm:${index}:${speciesId}`);
      const nature = PARTY_NATURES[rngInt(rng, PARTY_NATURES.length)];
      const abilityId = species.abilities[rngInt(rng, species.abilities.length)];
      const shiny = rngInt(rng, 1024) === 0;
      const gender = rollGender(speciesId, rng);
      const stats = computeFallbackStats(species.baseStats, level);

      return {
        speciesId,
        name: species.name,
        level,
        exp: 0,
        gender,
        types: species.types,
        nature,
        abilityId,
        shiny,
        ivs: { ...DEFAULT_IVS },
        evs: { ...DEFAULT_EVS },
        baseStats: species.baseStats,
        stats: {
          hp: stats.hp,
          atk: stats.atk,
          def: stats.def,
          spa: stats.spa,
          spd: stats.spd,
          spe: stats.spe,
        },
        currentHP: stats.hp,
        maxHP: stats.hp,
        fainted: false,
        status: null,
        heldItem: null,
        moves: species.startMoves.map((m) => ({
          id: m.id,
          name: m.name,
          pp: m.pp,
          ppMax: m.pp,
        })),
      };
    })
    .filter(Boolean);
}

function getPartyStateFromRun(run) {
  return run?.results?.progress?.partyState ?? [];
}

function formatAbilityName(abilityId) {
  if (!abilityId) return "None";
  return abilityId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getGrowthRateForSpecies(speciesId) {
  const GROWTH_RATES = {
    1: "Medium Slow",
    4: "Medium Slow",
    7: "Medium Slow",
    10: "Fast",
    25: "Medium Fast",
  };
  return GROWTH_RATES[speciesId] ?? "Medium Fast";
}

function getExpForLevel(level, curve) {
  if (level <= 1) return 0;
  const n = level;

  switch (curve) {
    case "Fast":
      return Math.floor((4 * n * n * n) / 5);
    case "Medium Fast":
      return n * n * n;
    case "Medium Slow":
      return Math.floor((6 / 5) * n * n * n - 15 * n * n + 100 * n - 140);
    case "Slow":
      return Math.floor((5 * n * n * n) / 4);
    case "Erratic":
      if (n <= 50) return Math.floor((n * n * n * (100 - n)) / 50);
      if (n <= 68) return Math.floor((n * n * n * (150 - n)) / 100);
      if (n <= 98) return Math.floor((n * n * n * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n * n * n * (160 - n)) / 100);
    case "Fluctuating":
      if (n <= 15) return Math.floor((n * n * n * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n <= 35) return Math.floor((n * n * n * (n + 14)) / 50);
      return Math.floor((n * n * n * (Math.floor(n / 2) + 32)) / 50);
    default:
      return n * n * n;
  }
}

function getXpData(mon) {
  const level = mon?.level ?? 1;
  const currentExp = mon?.exp ?? 0;
  const curve = getGrowthRateForSpecies(mon?.speciesId);

  if (level >= 100) {
    return {
      currentExp,
      currentLevelExp: currentExp,
      nextLevelExp: currentExp,
      progressIntoLevel: 0,
      expNeededForNext: 0,
      progressPercent: 100,
    };
  }

  const currentLevelExp = getExpForLevel(level, curve);
  const nextLevelExp = getExpForLevel(level + 1, curve);
  const progressIntoLevel = Math.max(0, currentExp - currentLevelExp);
  const expNeededForNext = Math.max(0, nextLevelExp - currentExp);
  const levelSpan = Math.max(1, nextLevelExp - currentLevelExp);
  const progressPercent = Math.max(
    0,
    Math.min(100, (progressIntoLevel / levelSpan) * 100)
  );

  return {
    currentExp,
    currentLevelExp,
    nextLevelExp,
    progressIntoLevel,
    expNeededForNext,
    progressPercent,
  };
}

function getHpPercent(mon) {
  const current = mon?.currentHP ?? 0;
  const max = mon?.maxHP ?? 1;
  return Math.max(0, Math.min(100, (current / max) * 100));
}

function getHpBarColor(mon) {
  const pct = getHpPercent(mon);
  if (pct <= 30) return "#dc2626";
  if (pct <= 60) return "#eab308";
  return "#16a34a";
}

function PartyDetailModal({ pokemon, onClose }) {
  const [statView, setStatView] = useState("total");

  if (!pokemon) return null;

  const xp = getXpData(pokemon);
  const totalStats = pokemon.stats ?? {};
  const baseStats = pokemon.baseStats ?? {};
  const ivs = pokemon.ivs ?? DEFAULT_IVS;
  const evs = pokemon.evs ?? DEFAULT_EVS;

  const statSets = {
    total: totalStats,
    base: baseStats,
    iv: ivs,
    ev: evs,
  };

  const selectedStats = statSets[statView] ?? totalStats;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>
              {pokemon.name} {pokemon.gender ? `(${pokemon.gender})` : ""}
            </h2>
            <div style={styles.subText}>
              Lv. {pokemon.level} • {(pokemon.types ?? []).join(" / ") || "Unknown"}
            </div>
          </div>
          <button style={styles.closeButton} onClick={onClose}>
            X
          </button>
        </div>

        <div style={styles.infoGrid}>
          <div><strong>Nature:</strong> {pokemon.nature ?? "Hardy"}</div>
          <div><strong>Ability:</strong> {formatAbilityName(pokemon.abilityId)}</div>
          <div><strong>Held Item:</strong> {pokemon.heldItem ?? "None"}</div>
          <div><strong>Status:</strong> {pokemon.fainted ? "FNT" : (pokemon.status ?? "Normal")}</div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>HP</div>
          <div style={styles.valueText}>
            {pokemon.currentHP ?? 0} / {pokemon.maxHP ?? 0}
          </div>
          <div style={styles.barOuter}>
            <div
              style={{
                ...styles.barInner,
                width: `${getHpPercent(pokemon)}%`,
                backgroundColor: getHpBarColor(pokemon),
              }}
            />
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>XP</div>
          <div style={styles.valueText}>
            Current XP: {xp.currentExp}
          </div>
          <div style={styles.valueText}>
            Next Level In: {xp.expNeededForNext} XP
          </div>
          <div style={styles.barOuter}>
            <div
              style={{
                ...styles.barInner,
                width: `${xp.progressPercent}%`,
                backgroundColor: "#2563eb",
              }}
            />
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Stats</div>
          <div style={styles.tabRow}>
            <button style={statView === "total" ? styles.activeTab : styles.tab} onClick={() => setStatView("total")}>Total</button>
            <button style={statView === "base" ? styles.activeTab : styles.tab} onClick={() => setStatView("base")}>Base</button>
            <button style={statView === "iv" ? styles.activeTab : styles.tab} onClick={() => setStatView("iv")}>IV</button>
            <button style={statView === "ev" ? styles.activeTab : styles.tab} onClick={() => setStatView("ev")}>EV</button>
          </div>

          <div style={styles.statsGrid}>
            {Object.keys(STAT_LABELS).map((key) => (
              <div key={key} style={styles.statRow}>
                <span>{STAT_LABELS[key]}</span>
                <strong>{selectedStats?.[key] ?? 0}</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Moves</div>
          <div style={styles.movesList}>
            {(pokemon.moves ?? []).length === 0 ? (
              <div style={styles.subText}>No moves found.</div>
            ) : (
              pokemon.moves.map((move) => (
                <div key={move.id} style={styles.moveRow}>
                  <span>{move.name}</span>
                  <strong>
                    PP {move.pp ?? 0}/{move.ppMax ?? move.pp ?? 0}
                  </strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Party() {
  const navigate = useNavigate();
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [run, setRun] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  const { runId, handleInvalidRun } = useRequiredRunId({ page: "Party" });

  useEffect(() => {
    if (!runId) return;

    let mounted = true;

    async function loadPartyData() {
      try {
        setLoading(true);

        // This is the only required call.
        const loadedRun = await runApi.getRun(runId);
        if (!mounted) return;
        setRun(loadedRun);

        // This is optional fallback support only.
        try {
          const loadedActions = await runApi.listRunActions(runId);
          if (!mounted) return;
          setActions(Array.isArray(loadedActions) ? loadedActions : []);
        } catch (actionsErr) {
          console.warn("Party page could not load run actions fallback:", actionsErr);
          if (!mounted) return;
          setActions([]);
        }
      } catch (err) {
        console.error("Failed to load Party page run:", err);
        if (mounted) handleInvalidRun?.();
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPartyData();

    return () => {
      mounted = false;
    };
  }, [runId, handleInvalidRun]);

  const party = useMemo(() => {
    return buildFallbackPartyFromRun(run, actions);
  }, [run, actions]);

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.pageTitle}>Party</h1>
          <p style={styles.subText}>View your current team and Pokémon details.</p>
        </div>
        <button
          style={styles.backButton}
          onClick={() => navigate(createPageUrl(`RunMap?runId=${runId}`))}
        >
          Back
        </button>
      </div>

      {loading ? (
        <div style={styles.emptyBox}>Loading party...</div>
      ) : party.length === 0 ? (
        <div style={styles.emptyBox}>No party data found.</div>
      ) : (
        <div style={styles.cardGrid}>
          {party.map((mon, index) => {
            const xp = getXpData(mon);

            return (
              <button
                key={`${mon.speciesId}-${index}`}
                style={styles.card}
                onClick={() => setSelectedPokemon(mon)}
              >
                <div style={styles.cardTopRow}>
                  <div>
                    <div style={styles.cardName}>
                      {mon.name} {mon.gender ? `(${mon.gender})` : ""}
                    </div>
                    <div style={styles.subText}>
                      Lv. {mon.level} • {(mon.types ?? []).join(" / ") || "Unknown"}
                    </div>
                  </div>
                  <div style={styles.slotBadge}>Slot {index + 1}</div>
                </div>

                <div style={styles.infoLine}>
                  HP: {mon.currentHP ?? 0} / {mon.maxHP ?? 0}
                </div>
                <div style={styles.barOuter}>
                  <div
                    style={{
                      ...styles.barInner,
                      width: `${getHpPercent(mon)}%`,
                      backgroundColor: getHpBarColor(mon),
                    }}
                  />
                </div>

                <div style={{ ...styles.infoLine, marginTop: 10 }}>
                  XP: {xp.currentExp} • Next in {xp.expNeededForNext}
                </div>
                <div style={styles.barOuter}>
                  <div
                    style={{
                      ...styles.barInner,
                      width: `${xp.progressPercent}%`,
                      backgroundColor: "#2563eb",
                    }}
                  />
                </div>

                <div style={styles.metaRow}>
                  <span>Nature: {mon.nature ?? "Hardy"}</span>
                  <span>Status: {mon.fainted ? "FNT" : (mon.status ?? "Normal")}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <PartyDetailModal
        pokemon={selectedPokemon}
        onClose={() => setSelectedPokemon(null)}
      />
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#e2e8f0",
    padding: "24px",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "24px",
  },
  pageTitle: {
    margin: 0,
    fontSize: "32px",
    fontWeight: 700,
  },
  subText: {
    color: "#94a3b8",
    fontSize: "14px",
  },
  backButton: {
    background: "#334155",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 600,
  },
  emptyBox: {
    background: "#1e293b",
    borderRadius: "16px",
    padding: "24px",
    border: "1px solid #334155",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "16px",
  },
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "16px",
    padding: "16px",
    textAlign: "left",
    cursor: "pointer",
    color: "#e2e8f0",
  },
  cardTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
    marginBottom: "12px",
  },
  cardName: {
    fontSize: "20px",
    fontWeight: 700,
  },
  slotBadge: {
    fontSize: "12px",
    background: "#334155",
    padding: "6px 10px",
    borderRadius: "999px",
  },
  infoLine: {
    fontSize: "14px",
    marginBottom: "6px",
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginTop: "12px",
    fontSize: "13px",
    color: "#cbd5e1",
    flexWrap: "wrap",
  },
  barOuter: {
    width: "100%",
    height: "10px",
    background: "#334155",
    borderRadius: "999px",
    overflow: "hidden",
  },
  barInner: {
    height: "100%",
    borderRadius: "999px",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 999,
  },
  modal: {
    width: "100%",
    maxWidth: "700px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "20px",
    padding: "20px",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "20px",
  },
  modalTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
  },
  closeButton: {
    background: "#7f1d1d",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 700,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    marginBottom: "20px",
  },
  section: {
    marginBottom: "20px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 700,
    marginBottom: "8px",
  },
  valueText: {
    fontSize: "14px",
    marginBottom: "6px",
    color: "#cbd5e1",
  },
  tabRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "12px",
  },
  tab: {
    background: "#334155",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "8px 12px",
    cursor: "pointer",
  },
  activeTab: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "8px 12px",
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "10px",
  },
  statRow: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
  },
  movesList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  moveRow: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
  },
};
