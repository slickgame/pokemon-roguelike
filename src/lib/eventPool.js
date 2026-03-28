import { withInventoryDefaults } from "@/lib/inventory";

export const RARITY_WEIGHTS = {
  common: 60,
  uncommon: 30,
  rare: 10,
};

export const STARTER_EVENT_DEFS = [
  {
    id: "supply_cache",
    kind: "item_reward",
    title: "Supply Cache",
    description:
      "You found an abandoned bag on the roadside. There may be something useful inside.",
    weight: 30,
    implemented: true,
  },
  {
    id: "baited_clearing",
    kind: "recruitment",
    title: "Baited Clearing",
    description:
      "You find a quiet clearing marked by chewed berries, flower petals, and fresh tracks. Something nearby seems drawn to food.",
    weight: 20,
    implemented: true,
    requiresAny: ["bait"],
  },

  // Defined now, enabled later
  {
    id: "training_spot",
    kind: "ev_training",
    title: "Training Spot",
    description: "A calm stretch of road offers time for focused training.",
    weight: 15,
    implemented: true,
  },
  {
    id: "injured_pidgey",
    kind: "recruitment",
    title: "Injured Pidgey",
    description: "An injured Pidgey struggles by the roadside, too weak to fly.",
    weight: 15,
    implemented: true,
    requiresAny: ["potion"],
  },

{
  id: "burnt_plant_pokemon",
  kind: "recruitment",
  title: "Burnt Plant Pokémon",
  description: "A scorched plant Pokémon recoils in pain near a charred patch of grass.",
  weight: 15,
  implemented: true,
  requiresAny: ["burn_heal"],
},
  {
    id: "wild_pokemon_spotted",
    kind: "capture",
    title: "Wild Pokémon Spotted",
    description: "A wary wild Pokémon appears nearby, watching your every move.",
    weight: 20,
    implemented: true,
    requiresAny: ["pokeball"],
  },
];

export const ROUTE_EVENT_POOLS = {
  route1: {
    baited_clearing: [
      { speciesId: 10, name: "Caterpie", rarity: "common", dc: 6, level: 4 },
      { speciesId: 13, name: "Weedle", rarity: "common", dc: 6, level: 4 },
      { speciesId: 43, name: "Oddish", rarity: "uncommon", dc: 9, level: 5 },
      { speciesId: 69, name: "Bellsprout", rarity: "uncommon", dc: 9, level: 5 },
      { speciesId: 16, name: "Pidgey", rarity: "rare", dc: 8, level: 4 },
      { speciesId: 21, name: "Spearow", rarity: "rare", dc: 10, level: 5 },
    ],
    wild_pokemon_spotted: [
      { speciesId: 10, name: "Caterpie", rarity: "common", dc: 3, level: 4 },
      { speciesId: 13, name: "Weedle", rarity: "common", dc: 3, level: 4 },
      { speciesId: 16, name: "Pidgey", rarity: "uncommon", dc: 5, level: 4 },
      { speciesId: 21, name: "Spearow", rarity: "uncommon", dc: 7, level: 5 },
      { speciesId: 43, name: "Oddish", rarity: "rare", dc: 8, level: 5 },
      { speciesId: 69, name: "Bellsprout", rarity: "rare", dc: 8, level: 5 },
    ],
    burnt_plant_pokemon: [
      { speciesId: 43, name: "Oddish", rarity: "common", dc: 8, level: 5 },
      { speciesId: 69, name: "Bellsprout", rarity: "uncommon", dc: 9, level: 5 },
    ],
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

function pickWeighted(list, rng) {
  const total = list.reduce((sum, entry) => sum + (entry.weight ?? 0), 0);
  if (total <= 0) return list[0] ?? null;

  let roll = rng() * total;
  for (const entry of list) {
    roll -= entry.weight ?? 0;
    if (roll <= 0) return entry;
  }
  return list[list.length - 1] ?? null;
}

function pickRarity(rng, weights = RARITY_WEIGHTS) {
  const entries = [
    { rarity: "common", weight: weights.common ?? 0 },
    { rarity: "uncommon", weight: weights.uncommon ?? 0 },
    { rarity: "rare", weight: weights.rare ?? 0 },
  ];

  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return "common";

  let roll = rng() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.rarity;
  }
  return "common";
}

function pickByRarity(pool, rng, weights = RARITY_WEIGHTS) {
  if (!Array.isArray(pool) || pool.length === 0) return null;

  const chosenRarity = pickRarity(rng, weights);

  const buckets = {
    common: pool.filter((entry) => entry.rarity === "common"),
    uncommon: pool.filter((entry) => entry.rarity === "uncommon"),
    rare: pool.filter((entry) => entry.rarity === "rare"),
  };

  const fallbackOrder =
    chosenRarity === "rare"
      ? ["rare", "uncommon", "common"]
      : chosenRarity === "uncommon"
      ? ["uncommon", "common", "rare"]
      : ["common", "uncommon", "rare"];

  const bucket = fallbackOrder
    .map((rarity) => buckets[rarity])
    .find((entries) => entries.length > 0);

  if (!bucket || bucket.length === 0) return pool[0] ?? null;

  return bucket[Math.floor(rng() * bucket.length)] ?? bucket[0];
}

function hasRequiredItem(def, inventory) {
  if (!def.requiresAny || def.requiresAny.length === 0) return true;
  return def.requiresAny.some((itemId) => (inventory?.[itemId] ?? 0) > 0);
}

export function getEligibleEvents({ inventory }) {
  const inv = withInventoryDefaults(inventory);
  return STARTER_EVENT_DEFS.filter(
    (def) => def.implemented && hasRequiredItem(def, inv)
  );
}

export function buildSupplyCacheState({ runSeed, nodeId }) {
  const key = `${runSeed ?? "event"}:${nodeId ?? "node"}:cache_reward`;
  const hash = hashString(key);

  if (hash % 100 < 30) {
    return {
      reward: {
        itemId: "bait",
        qty: 1,
        title: "Bait ×1",
        description: "Useful for certain Pokémon recruitment events.",
      },
    };
  }

  return {
    reward: {
      itemId: "potion",
      qty: 1,
      title: "Potion ×1",
      description: "Restores 20 HP to one Pokémon.",
    },
  };
}

export function buildTrainingSpotState({ runSeed, nodeId }) {
  const stats = [
    { id: "hp", label: "HP" },
    { id: "atk", label: "Attack" },
    { id: "def", label: "Defense" },
    { id: "spa", label: "Sp. Atk" },
    { id: "spd", label: "Sp. Def" },
    { id: "spe", label: "Speed" },
  ];

  const rng = makeRng(`${runSeed ?? "event"}:${nodeId ?? "node"}:training_stat`);
  const chosen = stats[Math.floor(rng() * stats.length)] ?? stats[0];

  return {
    evStat: chosen.id,
    evLabel: chosen.label,
    evAmount: 16,
  };
}

export function buildInjuredPidgeyState({ runSeed, nodeId }) {
  const rollRng = makeRng(`${runSeed ?? "event"}:${nodeId ?? "node"}:injured_pidgey_roll`);
  const roll = Math.floor(rollRng() * 20) + 1;
  const target = 9;
  const modifier = 0;
  const total = roll + modifier;
  const success = total >= target;

  return {
    speciesId: 16,
    speciesName: "Pidgey",
    level: 4,
    target,
    roll,
    modifier,
    total,
    success,
    itemCost: { potion: 1 },
  };
}

export function buildWildPokemonSpottedState({ runSeed, nodeId, routeId = "route1" }) {
  const routePool =
    ROUTE_EVENT_POOLS[routeId]?.wild_pokemon_spotted ??
    ROUTE_EVENT_POOLS.route1.wild_pokemon_spotted;

  const speciesRng = makeRng(`${runSeed ?? "event"}:${nodeId ?? "node"}:wild_species`);
  const candidate = pickByRarity(routePool, speciesRng) ?? routePool[0];

  return {
    speciesId: candidate.speciesId,
    speciesName: candidate.name,
    level: candidate.level ?? 4,
    target: candidate.dc,
    ballOptions: [
      { itemId: "pokeball", label: "Poké Ball", bonus: 0 },
    ],
  };
}

export function buildBaitedClearingState({ runSeed, nodeId, routeId = "route1" }) {
  const routePool =
    ROUTE_EVENT_POOLS[routeId]?.baited_clearing ??
    ROUTE_EVENT_POOLS.route1.baited_clearing;

  const speciesRng = makeRng(`${runSeed ?? "event"}:${nodeId ?? "node"}:bait_species`);
  const rollRng = makeRng(`${runSeed ?? "event"}:${nodeId ?? "node"}:bait_roll`);

  const candidate = pickByRarity(routePool, speciesRng) ?? routePool[0];
  const roll = Math.floor(rollRng() * 20) + 1;
  const target = candidate.dc;
  const total = roll;
  const success = total >= target;

  return {
    speciesId: candidate.speciesId,
    speciesName: candidate.name,
    level: candidate.level ?? 4,
    target,
    roll,
    modifier: 0,
    total,
    success,
    itemCost: { bait: 1 },
  };
}

export function buildBurntPlantPokemonState({ runSeed, nodeId, routeId = "route1" }) {
  const routePool =
    ROUTE_EVENT_POOLS[routeId]?.burnt_plant_pokemon ??
    ROUTE_EVENT_POOLS.route1.burnt_plant_pokemon;

  const speciesRng = makeRng(`${runSeed ?? "event"}:${nodeId ?? "node"}:burnt_plant_species`);
  const rollRng = makeRng(`${runSeed ?? "event"}:${nodeId ?? "node"}:burnt_plant_roll`);

  const candidate = pickByRarity(routePool, speciesRng) ?? routePool[0];
  const roll = Math.floor(rollRng() * 20) + 1;
  const target = candidate.dc;
  const modifier = 0;
  const total = roll + modifier;
  const success = total >= target;

  return {
    speciesId: candidate.speciesId,
    speciesName: candidate.name,
    level: candidate.level ?? 5,
    target,
    roll,
    modifier,
    total,
    success,
    itemCost: { burn_heal: 1 },
  };
}

export function selectEventForNode({
  runSeed,
  nodeId,
  routeId = "route1",
  inventory,
  forceEventId = null,
}) {
  const eligible = getEligibleEvents({ inventory });
    if (forceEventId) {
      const forced = STARTER_EVENT_DEFS.find((def) => def.id === forceEventId);

    if (forced) {
      let eventState = {};
      if (forced.id === "supply_cache") {
        eventState = buildSupplyCacheState({ runSeed, nodeId });
      } else if (forced.id === "training_spot") {
        eventState = buildTrainingSpotState({ runSeed, nodeId });
      } else if (forced.id === "injured_pidgey") {
        eventState = buildInjuredPidgeyState({ runSeed, nodeId });
      } else if (forced.id === "wild_pokemon_spotted") {
        eventState = buildWildPokemonSpottedState({ runSeed, nodeId, routeId });
      } else if (forced.id === "baited_clearing") {
        eventState = buildBaitedClearingState({ runSeed, nodeId, routeId });
      }

      return {
        eventId: forced.id,
        title: forced.title,
        description: forced.description,
        kind: forced.kind,
        eventState,
      };
    }
  }
  if (eligible.length === 0) {
    const fallback = STARTER_EVENT_DEFS.find((def) => def.id === "supply_cache");
    return {
      eventId: fallback.id,
      title: fallback.title,
      description: fallback.description,
      kind: fallback.kind,
      eventState: buildSupplyCacheState({ runSeed, nodeId }),
    };
  }

  const rng = makeRng(`${runSeed ?? "event"}:${nodeId ?? "node"}:event_pick`);
  const chosen = pickWeighted(eligible, rng) ?? eligible[0];

  let eventState = {};
  if (chosen.id === "supply_cache") {
    eventState = buildSupplyCacheState({ runSeed, nodeId });
  } else if (chosen.id === "training_spot") {
    eventState = buildTrainingSpotState({ runSeed, nodeId });
  } else if (chosen.id === "injured_pidgey") {
    eventState = buildInjuredPidgeyState({ runSeed, nodeId });
  } else if (chosen.id === "wild_pokemon_spotted") {
    eventState = buildWildPokemonSpottedState({ runSeed, nodeId, routeId });
  } else if (chosen.id === "baited_clearing") {
    eventState = buildBaitedClearingState({ runSeed, nodeId, routeId });
  }


  return {
    eventId: chosen.id,
    title: chosen.title,
    description: chosen.description,
    kind: chosen.kind,
    eventState,
  };
}