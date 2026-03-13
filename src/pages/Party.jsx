import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useRequiredRunId } from "@/hooks/useRequiredRunId";
import { runApi } from "../components/api/runApi";

const DEFAULT_IVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const DEFAULT_EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

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

const NATURE_EFFECTS = {
  Hardy:   { up: null, down: null },
  Lonely:  { up: "atk", down: "def" },
  Brave:   { up: "atk", down: "spe" },
  Adamant: { up: "atk", down: "spa" },
  Naughty: { up: "atk", down: "spd" },

  Bold:    { up: "def", down: "atk" },
  Docile:  { up: null, down: null },
  Relaxed: { up: "def", down: "spe" },
  Impish:  { up: "def", down: "spa" },
  Lax:     { up: "def", down: "spd" },

  Timid:   { up: "spe", down: "atk" },
  Hasty:   { up: "spe", down: "def" },
  Serious: { up: null, down: null },
  Jolly:   { up: "spe", down: "spa" },
  Naive:   { up: "spe", down: "spd" },

  Modest:  { up: "spa", down: "atk" },
  Mild:    { up: "spa", down: "def" },
  Quiet:   { up: "spa", down: "spe" },
  Bashful: { up: null, down: null },
  Rash:    { up: "spa", down: "spd" },

  Calm:    { up: "spd", down: "atk" },
  Gentle:  { up: "spd", down: "def" },
  Sassy:   { up: "spd", down: "spe" },
  Careful: { up: "spd", down: "spa" },
  Quirky:  { up: null, down: null },
};

const MOVE_DATA = {
  tackle: {
    name: "Tackle",
    power: 40,
    accuracy: 100,
    target: "One enemy",
    description: "A physical attack in which the user charges into the target.",
  },
  scratch: {
    name: "Scratch",
    power: 40,
    accuracy: 100,
    target: "One enemy",
    description: "Hard, pointed claws rake the target to inflict damage.",
  },
  growl: {
    name: "Growl",
    power: null,
    accuracy: 100,
    target: "All enemies",
    description: "The user growls in an endearing way, making opposing Pokémon less wary. Lowers Attack.",
  },
  ember: {
    name: "Ember",
    power: 40,
    accuracy: 100,
    target: "One enemy",
    description: "The target is attacked with small flames. May inflict a burn later if you expand status effects.",
  },
  vine_whip: {
    name: "Vine Whip",
    power: 45,
    accuracy: 100,
    target: "One enemy",
    description: "The target is struck with slender, whiplike vines.",
  },
  water_gun: {
    name: "Water Gun",
    power: 40,
    accuracy: 100,
    target: "One enemy",
    description: "The target is blasted with a forceful shot of water.",
  },
  thunder_shock: {
    name: "ThunderShock",
    power: 40,
    accuracy: 100,
    target: "One enemy",
    description: "A jolt of electricity crashes down on the target. May inflict paralysis later if expanded.",
  },
  quick_attack: {
    name: "Quick Attack",
    power: 40,
    accuracy: 100,
    target: "One enemy",
    description: "An almost invisibly fast attack that usually strikes first.",
  },
  string_shot: {
    name: "String Shot",
    power: null,
    accuracy: 95,
    target: "All enemies",
    description: "The targets are bound with silk blown from the user’s mouth. Lowers Speed.",
  },
  tail_whip: {
    name: "Tail Whip",
    power: null,
    accuracy: 100,
    target: "All enemies",
    description: "The user wags its tail cutely, making opposing Pokémon less wary. Lowers Defense.",
  },
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
  const progressPercent = Math.max(0, Math.min(100, (progressIntoLevel / levelSpan) * 100));

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

function getPartyRole(index) {
  return index < 3 ? "Active" : "Bench";
}

function getNatureText(nature) {
  const effect = NATURE_EFFECTS[nature] ?? { up: null, down: null };
  if (!effect.up || !effect.down) return `${nature} is neutral.`;
  return `${nature} raises ${STAT_LABELS[effect.up]} and lowers ${STAT_LABELS[effect.down]}.`;
}

function getStatColor(nature, statKey) {
  const effect = NATURE_EFFECTS[nature] ?? { up: null, down: null };
  if (effect.up === statKey) return "#22c55e";
  if (effect.down === statKey) return "#ef4444";
  return "#e2e8f0";
}

function getSpriteUrl(speciesId, shiny = false) {
  const dex = String(speciesId).padStart(3, "0");
  if (shiny) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${speciesId}.png`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${speciesId}.png`;
}

function MoveTooltip({ move, visible }) {
  const moveInfo = MOVE_DATA[move?.id] ?? {
    name: move?.name ?? "Unknown Move",
    power: null,
    accuracy: null,
    target: "Unknown",
    description: "No move details available.",
  };

  if (!visible) return null;

  return (
    <div style={styles.moveTooltip}>
      <div style={styles.moveTooltipTitle}>{moveInfo.name}</div>
      <div style={styles.moveTooltipLine}>Power: {moveInfo.power ?? "—"}</div>
      <div style={styles.moveTooltipLine}>Accuracy: {moveInfo.accuracy ?? "—"}</div>
      <div style={styles.moveTooltipLine}>Target: {moveInfo.target}</div>
      <div style={styles.moveTooltipDescription}>{moveInfo.description}</div>
    </div>
  );
}

function PartyDetailModal({ pokemon, slotIndex, onClose }) {
  const [statView, setStatView] = useState("total");
  const [hoveredMoveId, setHoveredMoveId] = useState(null);
  const [spriteErrored, setSpriteErrored] = useState(false);

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
  const spriteUrl = !spriteErrored
    ? getSpriteUrl(pokemon.speciesId, pokemon.shiny)
    : getSpriteUrl(pokemon.speciesId, false);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalIdentityRow}>
            <img
              src={spriteUrl}
              alt={pokemon.name}
              style={styles.modalSprite}
              onError={() => {
                if (pokemon.shiny && !spriteErrored) setSpriteErrored(true);
              }}
            />
            <div>
              <h2 style={styles.modalTitle}>
                {pokemon.name} {pokemon.gender ? `(${pokemon.gender})` : ""}
              </h2>
              <div style={styles.subText}>
                Lv. {pokemon.level} • {(pokemon.types ?? []).join(" / ") || "Unknown"}
              </div>
              {pokemon.shiny ? <div style={styles.shinyModalBadge}>✨ Shiny</div> : null}
            </div>
          </div>
          <button style={styles.closeButton} onClick={onClose}>
            X
          </button>
        </div>

        <div style={styles.infoGrid}>
          <div><strong>Party Slot:</strong> {slotIndex !== null && slotIndex !== undefined ? slotIndex + 1 : "-"}</div>
          <div><strong>Role:</strong> {slotIndex !== null && slotIndex !== undefined ? getPartyRole(slotIndex) : "Box"}</div>
          <div><strong>Nature:</strong> {pokemon.nature ?? "Hardy"}</div>
          <div><strong>Ability:</strong> {formatAbilityName(pokemon.abilityId)}</div>
          <div><strong>Held Item:</strong> {pokemon.heldItem ?? "None"}</div>
          <div><strong>Status:</strong> {pokemon.fainted ? "FNT" : (pokemon.status ?? "Normal")}</div>
        </div>

        <div style={styles.natureBox}>
          {getNatureText(pokemon.nature ?? "Hardy")}
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
          <div style={styles.valueText}>Current XP: {xp.currentExp}</div>
          <div style={styles.valueText}>Next Level In: {xp.expNeededForNext} XP</div>
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
                <strong style={{ color: statView === "total" ? getStatColor(pokemon.nature ?? "Hardy", key) : "#e2e8f0" }}>
                  {selectedStats?.[key] ?? 0}
                </strong>
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
              pokemon.moves.map((move, idx) => {
                const moveKey = `${move.id}-${idx}`;
                return (
                  <div
                    key={moveKey}
                    style={styles.moveRowWithTooltip}
                    onMouseEnter={() => setHoveredMoveId(moveKey)}
                    onMouseLeave={() => setHoveredMoveId(null)}
                  >
                    <div style={styles.moveRow}>
                      <div style={styles.moveTextBlock}>
                        <span style={styles.moveNameText}>
                          {move.name ?? MOVE_DATA[move.id]?.name ?? move.id}
                        </span>
                        <span style={styles.moveSubText}>
                          {MOVE_DATA[move.id]?.description ?? "No move details available."}
                        </span>
                      </div>
                      <strong>
                        PP {move.pp ?? 0}/{move.ppMax ?? move.pp ?? 0}
                      </strong>
                    </div>
                    <MoveTooltip move={move} visible={hoveredMoveId === moveKey} />
                  </div>
                );
              })
          </div>
        </div>
      </div>
    </div>
  );
}

function PokemonCard({
  mon,
  index,
  roleLabel,
  isBench = false,
  isBox = false,
  draggedIndex,
  dragOverIndex,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  onClick,
  onMoveLeft,
  onMoveRight,
  onMoveToBox,
  onAddToParty,
  disableLeft,
  disableRight,
  savingOrder = false,
}) {
  const xp = getXpData(mon);
  const [spriteErrored, setSpriteErrored] = useState(false);

  const spriteUrl = !spriteErrored
    ? getSpriteUrl(mon.speciesId, mon.shiny)
    : getSpriteUrl(mon.speciesId, false);

  const baseStyle = isBox ? styles.boxCard : isBench ? styles.benchCard : styles.card;

  return (
    <button
      key={`${mon.speciesId}-${index}`}
      style={{
        ...baseStyle,
        ...(dragOverIndex === index ? styles.dragOverCard : {}),
        ...(draggedIndex === index ? styles.draggingCard : {}),
        ...(mon.shiny ? styles.shinyCardAccent : {}),
      }}
      draggable={!savingOrder}
      onDragStart={() => {
        if (savingOrder) return;
        onDragStart(index);
      }}
      onDragEnter={() => onDragEnter(index)}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(index);
      }}
      onClick={onClick}
    >
      <div style={styles.cardTopRow}>
        <div style={styles.cardIdentityRow}>
          <img
            src={spriteUrl}
            alt={mon.name}
            style={styles.cardSprite}
            onError={() => {
              if (mon.shiny && !spriteErrored) setSpriteErrored(true);
            }}
          />
          <div>
            <div style={styles.cardName}>
              {mon.name} {mon.gender ? `(${mon.gender})` : ""}
            </div>
            <div style={styles.subText}>
              Lv. {mon.level} • {(mon.types ?? []).join(" / ") || "Unknown"}
            </div>
          </div>
        </div>

        <div style={styles.badgeColumn}>
          <div style={styles.slotBadge}>Slot {index + 1}</div>
          <div style={roleLabel === "Active" ? styles.activeBadge : roleLabel === "Bench" ? styles.benchBadge : styles.boxBadge}>
            {roleLabel}
          </div>
          {mon.shiny ? <div style={styles.shinyBadge}>✨ Shiny</div> : null}
        </div>
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

<div style={styles.cardNatureText}>
  {getNatureText(mon.nature ?? "Hardy")}
</div>

<div style={styles.cardMovesPreview}>
  <strong style={styles.cardMovesPreviewLabel}>Moves:</strong>
  <div style={styles.cardMovesPreviewList}>
    {(mon.moves ?? []).length === 0
      ? "No moves"
      : mon.moves
          .map((move) => move.name ?? MOVE_DATA[move.id]?.name ?? move.id)
          .join(" • ")}
  </div>
</div>

      {!isBox ? (
        <div style={styles.reorderRow}>
          <button
            type="button"
            style={disableLeft ? styles.disabledReorderButton : styles.reorderButton}
            disabled={disableLeft}
            onClick={(e) => {
              e.stopPropagation();
              onMoveLeft(index);
            }}
          >
            ← Move Left
          </button>

          <button
            type="button"
            style={disableRight ? styles.disabledReorderButton : styles.reorderButton}
            disabled={disableRight}
            onClick={(e) => {
              e.stopPropagation();
              onMoveRight(index);
            }}
          >
            Move Right →
          </button>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={(e) => {
              e.stopPropagation();
              onMoveToBox(mon, index);
            }}
          >
            Send to Box
          </button>
        </div>
      ) : (
        <div style={styles.reorderRow}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={(e) => {
              e.stopPropagation();
              onAddToParty(mon, index);
            }}
          >
            Add to Party
          </button>
        </div>
      )}
    </button>
  );
}

export default function Party() {
  const navigate = useNavigate();
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [selectedPokemonIndex, setSelectedPokemonIndex] = useState(null);
  const [run, setRun] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | success | error
  const [partyOverride, setPartyOverride] = useState(null);
  const [boxOverride, setBoxOverride] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");

  const { runId } = useRequiredRunId({ page: "Party" });

useEffect(() => {
  if (!saveMessage) return;

  const timeout = setTimeout(() => {
    setSaveMessage("");
    setSaveStatus("idle");
  }, 2200);

  return () => clearTimeout(timeout);
}, [saveMessage]);

useEffect(() => {
  if (!runId) return;

  let mounted = true;

  async function loadPartyData() {
    try {
      setLoading(true);
      setLoadError("");

      const loadedRun = await runApi.getRun(runId);
      if (!mounted) return;
      setRun(loadedRun);

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
      if (!mounted) return;

      const message =
        err?.message ||
        err?.response?.data?.error ||
        "Failed to load Party page.";

      setLoadError(String(message));
    } finally {
      if (mounted) setLoading(false);
    }
  }

  loadPartyData();

  return () => {
    mounted = false;
  };
}, [runId]);

  const baseParty = useMemo(() => {
    return buildFallbackPartyFromRun(run, actions);
  }, [run, actions]);

  const baseBox = useMemo(() => {
    return run?.results?.progress?.boxState ?? [];
  }, [run]);

  const party = partyOverride ?? baseParty;
  const box = boxOverride ?? baseBox;

  const activeParty = party.slice(0, 3);
  const benchParty = party.slice(3);

  async function savePartyAndBox(nextParty, nextBox, message = "Saved.") {
    setPartyOverride(nextParty);
    setBoxOverride(nextBox);

    try {
      setSavingOrder(true);
      setSaveStatus("saving");
      setSaveMessage("Saving party changes...");

      await runApi.appendAction(runId, "party_box_update", {
        partyState: nextParty,
        boxState: nextBox,
      });

      setSaveStatus("success");
      setSaveMessage(message || "Party changes saved.");
    } catch (err) {
      console.error("Failed to save party/box update:", err);
      setSaveStatus("error");
      setSaveMessage("Save failed. Please try again.");
    } finally {
      setSavingOrder(false);
    }
  }

  function reorderParty(fromIndex, toIndex) {
    if (
      fromIndex === null ||
      toIndex === null ||
      fromIndex === undefined ||
      toIndex === undefined ||
      fromIndex === toIndex
    ) {
      return;
    }

    const nextParty = [...party];
    const [moved] = nextParty.splice(fromIndex, 1);
    nextParty.splice(toIndex, 0, moved);

    savePartyAndBox(nextParty, box, "Party order saved.");

    if (selectedPokemonIndex === fromIndex) {
      setSelectedPokemon(moved);
      setSelectedPokemonIndex(toIndex);
    } else if (selectedPokemonIndex !== null && selectedPokemonIndex !== undefined) {
      const movedSelected = nextParty[selectedPokemonIndex];
      if (movedSelected) {
        setSelectedPokemon(movedSelected);
      }
    }
  }

  function handleDragStart(index) {
    setDraggedIndex(index);
  }

  function handleDragEnter(index) {
    setDragOverIndex(index);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDrop(index) {
    if (draggedIndex === null || draggedIndex === undefined) return;
    reorderParty(draggedIndex, index);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function movePartyMemberLeft(index) {
    if (index <= 0) return;
    const nextParty = [...party];
    [nextParty[index - 1], nextParty[index]] = [nextParty[index], nextParty[index - 1]];
    savePartyAndBox(nextParty, box, "Party order saved.");

    if (selectedPokemonIndex === index) {
      setSelectedPokemon(nextParty[index - 1]);
      setSelectedPokemonIndex(index - 1);
    } else if (selectedPokemonIndex === index - 1) {
      setSelectedPokemon(nextParty[index]);
      setSelectedPokemonIndex(index);
    }
  }

  function movePartyMemberRight(index) {
    if (index >= party.length - 1) return;
    const nextParty = [...party];
    [nextParty[index], nextParty[index + 1]] = [nextParty[index + 1], nextParty[index]];
    savePartyAndBox(nextParty, box, "Party order saved.");

    if (selectedPokemonIndex === index) {
      setSelectedPokemon(nextParty[index + 1]);
      setSelectedPokemonIndex(index + 1);
    } else if (selectedPokemonIndex === index + 1) {
      setSelectedPokemon(nextParty[index]);
      setSelectedPokemonIndex(index);
    }
  }

  function sendToBox(mon, index) {
    if (party.length <= 1) return;
    const nextParty = [...party];
    const [moved] = nextParty.splice(index, 1);
    const nextBox = [...box, moved];
    savePartyAndBox(nextParty, nextBox, `${mon.name} sent to Box.`);

    if (selectedPokemonIndex === index) {
      setSelectedPokemon(null);
      setSelectedPokemonIndex(null);
    }
  }

  function addToParty(mon, boxIndex) {
    if (party.length >= 6) {
      setSaveMessage("Party is full.");
      setTimeout(() => setSaveMessage(""), 1800);
      return;
    }

    const nextBox = [...box];
    const [moved] = nextBox.splice(boxIndex, 1);
    const nextParty = [...party, moved];
    savePartyAndBox(nextParty, nextBox, `${mon.name} added to Party.`);
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.pageTitle}>Party</h1>
          <p style={styles.subText}>View your current team, Pokémon details, and storage box.</p>
        </div>
        <div style={styles.headerButtonStack}>
          {saveMessage ? (
            <div
              style={
                saveStatus === "saving"
                  ? styles.saveBannerSaving
                  : saveStatus === "error"
                  ? styles.saveBannerError
                  : styles.saveBannerSuccess
              }
            >
              {saveMessage}
            </div>
          ) : null}
          <button
            style={styles.backButton}
            onClick={() => navigate(createPageUrl(`RunMap?runId=${runId}`))}
          >
            Back
          </button>
        </div>
      </div>

        {loading ? (
          <div style={styles.emptyBox}>Loading party...</div>
        ) : loadError ? (
          <div style={styles.errorBox}>
            <div style={styles.errorTitle}>Party failed to load.</div>
            <div>{loadError}</div>
            <div style={{ marginTop: 12, color: "#94a3b8", fontSize: "13px" }}>
              This helps us see the real problem instead of redirecting away.
            </div>
          </div>
        ) : party.length === 0 ? (
          <div style={styles.emptyBox}>No party data found.</div>
        ) : (
        <div style={styles.partySections}>
          <div style={styles.partySection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitleText}>Active Team</h2>
              <div style={styles.sectionSubtitle}>These are your current battle slots.</div>
            </div>

            <div style={styles.cardGrid}>
              {activeParty.map((mon, localIndex) => {
                const index = localIndex;
                return (
                  <PokemonCard
                    key={`${mon.speciesId}-${index}`}
                    mon={mon}
                    index={index}
                    roleLabel="Active"
                    draggedIndex={draggedIndex}
                    dragOverIndex={dragOverIndex}
                    onDragStart={handleDragStart}
                    onDragEnter={handleDragEnter}
                    onDragEnd={handleDragEnd}
                    onDrop={handleDrop}
                    onClick={() => {
                      setSelectedPokemon(mon);
                      setSelectedPokemonIndex(index);
                    }}
                    onMoveLeft={movePartyMemberLeft}
                    onMoveRight={movePartyMemberRight}
                    onMoveToBox={sendToBox}
                    disableLeft={index === 0}
                    disableRight={index === party.length - 1}
                    savingOrder={savingOrder}
                  />
                );
              })}
            </div>
          </div>

          <div style={styles.partySection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitleText}>Bench</h2>
              <div style={styles.sectionSubtitle}>Reserve Pokémon outside the current front 3.</div>
            </div>

            {benchParty.length === 0 ? (
              <div style={styles.emptyBenchBox}>No bench Pokémon.</div>
            ) : (
              <div style={styles.cardGrid}>
                {benchParty.map((mon, localIndex) => {
                  const index = localIndex + 3;
                  return (
                    <PokemonCard
                      key={`${mon.speciesId}-${index}`}
                      mon={mon}
                      index={index}
                      roleLabel="Bench"
                      isBench
                      draggedIndex={draggedIndex}
                      dragOverIndex={dragOverIndex}
                      onDragStart={handleDragStart}
                      onDragEnter={handleDragEnter}
                      onDragEnd={handleDragEnd}
                      onDrop={handleDrop}
                      onClick={() => {
                        setSelectedPokemon(mon);
                        setSelectedPokemonIndex(index);
                      }}
                      onMoveLeft={movePartyMemberLeft}
                      onMoveRight={movePartyMemberRight}
                      onMoveToBox={sendToBox}
                      disableLeft={index === 0}
                      disableRight={index === party.length - 1}
                      savingOrder={savingOrder}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div style={styles.partySection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitleText}>Box</h2>
              <div style={styles.sectionSubtitle}>Stored Pokémon outside your active party.</div>
            </div>

            {box.length === 0 ? (
              <div style={styles.emptyBenchBox}>No boxed Pokémon yet.</div>
            ) : (
              <div style={styles.cardGrid}>
                {box.map((mon, index) => (
                  <PokemonCard
                    key={`box-${mon.speciesId}-${index}`}
                    mon={mon}
                    index={index}
                    roleLabel="Box"
                    isBox
                    draggedIndex={null}
                    dragOverIndex={null}
                    onDragStart={() => {}}
                    onDragEnter={() => {}}
                    onDragEnd={() => {}}
                    onDrop={() => {}}
                    onClick={() => {
                      setSelectedPokemon(mon);
                      setSelectedPokemonIndex(null);
                    }}
                    onMoveLeft={() => {}}
                    onMoveRight={() => {}}
                    onMoveToBox={() => {}}
                    onAddToParty={addToParty}
                    disableLeft
                    disableRight
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <PartyDetailModal
        pokemon={selectedPokemon}
        slotIndex={selectedPokemonIndex}
        onClose={() => {
          setSelectedPokemon(null);
          setSelectedPokemonIndex(null);
        }}
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

  errorBox: {
  background: "#3b0a0a",
  border: "1px solid #7f1d1d",
  borderRadius: "16px",
  padding: "24px",
  color: "#fecaca",
},

errorTitle: {
  fontSize: "18px",
  fontWeight: 700,
  marginBottom: "8px",
  color: "#ffffff",
},

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "24px",
  },
  headerButtonStack: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    alignItems: "flex-end",
  },
  saveToast: {
    background: "#1d4ed8",
    color: "#ffffff",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 700,
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
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
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
    position: "relative",
  },
  benchCard: {
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: "16px",
    padding: "16px",
    textAlign: "left",
    cursor: "pointer",
    color: "#cbd5e1",
    opacity: 0.9,
    position: "relative",
  },
  boxCard: {
    background: "#172033",
    border: "1px solid #475569",
    borderRadius: "16px",
    padding: "16px",
    textAlign: "left",
    cursor: "pointer",
    color: "#dbeafe",
    position: "relative",
  },
  shinyCardAccent: {
    boxShadow: "0 0 0 1px #facc15 inset, 0 0 18px rgba(250, 204, 21, 0.18)",
  },
  cardTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
    marginBottom: "12px",
  },
  cardIdentityRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  cardSprite: {
    width: "72px",
    height: "72px",
    objectFit: "contain",
    imageRendering: "auto",
  },
  modalIdentityRow: {
    display: "flex",
    gap: "14px",
    alignItems: "center",
  },
  modalSprite: {
    width: "120px",
    height: "120px",
    objectFit: "contain",
    imageRendering: "auto",
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
  badgeColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    alignItems: "flex-end",
  },
  activeBadge: {
    fontSize: "11px",
    background: "#14532d",
    color: "#bbf7d0",
    padding: "4px 8px",
    borderRadius: "999px",
    border: "1px solid #166534",
    fontWeight: 700,
  },
  benchBadge: {
    fontSize: "11px",
    background: "#3f3f46",
    color: "#e4e4e7",
    padding: "4px 8px",
    borderRadius: "999px",
    border: "1px solid #52525b",
    fontWeight: 700,
  },
  boxBadge: {
    fontSize: "11px",
    background: "#1e3a8a",
    color: "#bfdbfe",
    padding: "4px 8px",
    borderRadius: "999px",
    border: "1px solid #2563eb",
    fontWeight: 700,
  },
  shinyBadge: {
    fontSize: "11px",
    background: "#f59e0b",
    color: "#1f2937",
    padding: "4px 8px",
    borderRadius: "999px",
    border: "1px solid #facc15",
    fontWeight: 800,
  },
  shinyModalBadge: {
    display: "inline-block",
    marginTop: "8px",
    background: "#f59e0b",
    color: "#1f2937",
    padding: "6px 10px",
    borderRadius: "999px",
    border: "1px solid #facc15",
    fontWeight: 800,
    fontSize: "12px",
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
  reorderRow: {
    display: "flex",
    gap: "8px",
    marginTop: "12px",
    flexWrap: "wrap",
  },
  reorderButton: {
    background: "#1d4ed8",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#475569",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  disabledReorderButton: {
    background: "#334155",
    color: "#94a3b8",
    border: "none",
    borderRadius: "10px",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "not-allowed",
  },
  dragOverCard: {
    outline: "2px solid #60a5fa",
    transform: "scale(1.01)",
  },
  draggingCard: {
    opacity: 0.55,
  },
  partySections: {
    display: "flex",
    flexDirection: "column",
    gap: "28px",
  },
  partySection: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  sectionHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  sectionTitleText: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  sectionSubtitle: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  emptyBenchBox: {
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: "16px",
    padding: "20px",
    color: "#9ca3af",
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
    maxWidth: "760px",
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
  natureBox: {
    background: "#132033",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "12px",
    marginBottom: "20px",
    color: "#cbd5e1",
    fontSize: "14px",
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

  saveBannerSaving: {
  background: "#1e3a8a",
  border: "1px solid #3b82f6",
  color: "#dbeafe",
  borderRadius: "12px",
  padding: "12px 14px",
  fontSize: "13px",
  fontWeight: 700,
},

saveBannerSuccess: {
  background: "#14532d",
  border: "1px solid #22c55e",
  color: "#dcfce7",
  borderRadius: "12px",
  padding: "12px 14px",
  fontSize: "13px",
  fontWeight: 700,
},

saveBannerError: {
  background: "#7f1d1d",
  border: "1px solid #ef4444",
  color: "#fee2e2",
  borderRadius: "12px",
  padding: "12px 14px",
  fontSize: "13px",
  fontWeight: 700,
},

cardNatureText: {
  marginTop: "10px",
  fontSize: "12px",
  color: "#93c5fd",
  lineHeight: 1.4,
},

cardMovesPreview: {
  marginTop: "10px",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "10px",
  padding: "10px",
},

cardMovesPreviewLabel: {
  display: "block",
  marginBottom: "4px",
  fontSize: "12px",
  color: "#cbd5e1",
},

cardMovesPreviewList: {
  fontSize: "12px",
  color: "#94a3b8",
  lineHeight: 1.4,
},

moveTextBlock: {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: 0,
},

moveNameText: {
  fontWeight: 600,
  color: "#e2e8f0",
},

moveSubText: {
  fontSize: "12px",
  color: "#94a3b8",
  lineHeight: 1.35,
  textAlign: "left",
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
  moveRowWithTooltip: {
    position: "relative",
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
  moveTooltip: {
    display: "none",
    position: "absolute",
    left: "0",
    top: "100%",
    marginTop: "6px",
    zIndex: 50,
    width: "260px",
    background: "#0f172a",
    border: "1px solid #475569",
    borderRadius: "12px",
    padding: "10px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
    color: "#e2e8f0",
  },
  moveTooltipTitle: {
    fontWeight: 700,
    marginBottom: "6px",
  },
  moveTooltipLine: {
    fontSize: "12px",
    color: "#cbd5e1",
    marginBottom: "4px",
  },
  moveTooltipDescription: {
    fontSize: "12px",
    color: "#94a3b8",
    marginTop: "6px",
    lineHeight: 1.4,
  },
};



styles.moveRowWithTooltip[":hover"] = {};