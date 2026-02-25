export const MODIFIERS = [
  // ── Progression ──────────────────────────────────────────────────────────
  {
    id: "xp_share_on",
    name: "XP Share: ON",
    category: "Progression",
    aetherPct: 0,
    description: "All party members gain XP from every battle (default baseline).",
    incompatibleWith: ["xp_share_off"],
    flags: { xpShare: true },
    isDefault: true,   // default selected; does NOT count toward cap
    noCapCount: true,
    radioGroup: "xp_share",
  },
  {
    id: "xp_share_off",
    name: "XP Share: OFF",
    category: "Progression",
    aetherPct: 10,
    description: "Only the active battler gains XP. Harder but more Aether.",
    incompatibleWith: ["xp_share_on"],
    flags: { xpShare: false },
    radioGroup: "xp_share",
  },

  // ── Team ─────────────────────────────────────────────────────────────────
  {
    id: "starter_pool_expand_5",
    name: "Expanded Starter Pool",
    category: "Team",
    aetherPct: -5,
    description: "Choose from 5 starters instead of 3.",
    incompatibleWith: [],
    flags: { starterPoolSize: 5 },
  },
  {
    id: "starter_rerolls_3",
    name: "3 Starter Rerolls",
    category: "Team",
    aetherPct: -5,
    description: "Reroll the starter selection up to 3 times.",
    incompatibleWith: [],
    flags: { starterRerolls: 3 },
  },
  {
    id: "kanto_starter_direct",
    name: "Kanto Starter Direct",
    category: "Team",
    aetherPct: -10,
    description: "Always offered Bulbasaur, Charmander, or Squirtle as starter choices.",
    incompatibleWith: [],
    flags: { forceKantoStarters: true },
  },
  {
    id: "type_diversity_soft",
    name: "Type Diversity (Soft)",
    category: "Team",
    aetherPct: -5,
    description: "Wild encounters favor types not yet on your team.",
    incompatibleWith: ["type_diversity_hard"],
    flags: { typeDiversity: "soft" },
  },
  {
    id: "type_diversity_hard",
    name: "Type Diversity (Hard)",
    category: "Team",
    aetherPct: -10,
    description: "You cannot catch a Pokémon whose type overlaps with any current party member.",
    incompatibleWith: ["type_diversity_soft"],
    flags: { typeDiversity: "hard" },
  },
  {
    id: "cull_rank_1",
    name: "Cull Rank 1",
    category: "Team",
    aetherPct: -10,
    description: "Rank-1 wild encounters are removed from the pool.",
    incompatibleWith: ["cull_rank_1_2"],
    flags: { cullBelowRank: 1 },
  },
  {
    id: "cull_rank_1_2",
    name: "Cull Rank 1–2",
    category: "Team",
    aetherPct: -20,
    description: "Rank 1 and 2 wild encounters are removed from the pool.",
    incompatibleWith: ["cull_rank_1"],
    flags: { cullBelowRank: 2 },
  },

  // ── Economy ───────────────────────────────────────────────────────────────
  {
    id: "start_money_300",
    name: "Start with ₽300",
    category: "Economy",
    aetherPct: -5,
    description: "Begin the run with 300 extra Pokédollars.",
    incompatibleWith: ["start_money_600"],
    flags: { startMoney: 300 },
  },
  {
    id: "start_money_600",
    name: "Start with ₽600",
    category: "Economy",
    aetherPct: -10,
    description: "Begin the run with 600 extra Pokédollars.",
    incompatibleWith: ["start_money_300"],
    flags: { startMoney: 600 },
  },

  // ── Difficulty ────────────────────────────────────────────────────────────
  {
    id: "enemy_iv_floor_10",
    name: "Enemy IV Floor 10",
    category: "Difficulty",
    aetherPct: 10,
    description: "All wild and trainer Pokémon have a minimum of 10 IVs in every stat.",
    incompatibleWith: [],
    flags: { enemyIvFloor: 10 },
  },

  // ── Ruleset ───────────────────────────────────────────────────────────────
  {
    id: "permadeath",
    name: "Permadeath",
    category: "Ruleset",
    aetherPct: 25,
    description: "Fainted Pokémon are permanently lost. High risk, high Aether.",
    incompatibleWith: [],
    flags: { permadeath: true },
    locked: true,
  },
];

export const MODIFIER_CATEGORIES = ["Progression", "Team", "Economy", "Difficulty", "Ruleset"];

export const MAX_MODIFIERS = 8;