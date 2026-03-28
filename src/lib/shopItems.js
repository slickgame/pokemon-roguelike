export const SHOP_ITEMS = [
  {
    id: "potion",
    name: "Potion",
    buyPrice: 50,
    sellPrice: 25,
    description: "Restores 20 HP to one Pokémon.",
    icon: "💊",
  },

  {
    id: "burn_heal",
    name: "Burn Heal",
    buyPrice: 75,
    sellPrice: 35,
    description: "Treats burns and is useful in certain event encounters.",
    icon: "🔥",
  },

  {
    id: "revive",
    name: "Revive",
    buyPrice: 200,
    sellPrice: 100,
    description: "Revives a fainted Pokémon to 50% HP.",
    icon: "💫",
  },
  {
    id: "bait",
    name: "Bait",
    buyPrice: 40,
    sellPrice: 20,
    description: "A lure item used in certain event encounters.",
    icon: "🪤",
  },

  

  {
  id: "pokeball",
  name: "Poké Ball",
  buyPrice: 100,
  sellPrice: 50,
  description: "A ball used to capture Pokémon during certain event encounters.",
  icon: "🔴",
},
];

export const SHOP_ITEM_BY_ID = Object.fromEntries(
  SHOP_ITEMS.map((item) => [item.id, item])
);