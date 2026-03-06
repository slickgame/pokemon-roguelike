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
    id: "revive",
    name: "Revive",
    buyPrice: 200,
    sellPrice: 100,
    description: "Revives a fainted Pokémon to 50% HP.",
    icon: "💫",
  },
];

export const SHOP_ITEM_BY_ID = Object.fromEntries(SHOP_ITEMS.map((item) => [item.id, item]));
