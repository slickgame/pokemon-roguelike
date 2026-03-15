export const EMPTY_INVENTORY = {
  potion: 0,
  revive: 0,
  bait: 0,
  pokeball: 0,
};

export function withInventoryDefaults(inventory) {
  return {
    ...EMPTY_INVENTORY,
    ...(inventory ?? {}),
  };
}
