[
  {
    "id": "field_medic_patch",
    "name": "Field Medic Patch",
    "rarity": "common",
    "tags": ["battle"],
    "description": "After each battle, heal all party members by +5 HP.",
    "hook": "onAfterBattle"
  },
  {
    "id": "lucky_coin",
    "name": "Lucky Coin",
    "rarity": "common",
    "tags": ["map", "econ"],
    "description": "+20% Pokédollars gained from trainer battles.",
    "hook": "onMoneyGain"
  },
  {
    "id": "ration_pack",
    "name": "Ration Pack",
    "rarity": "common",
    "tags": ["map"],
    "description": "On Event node resolution, 25% chance to gain an extra Potion.",
    "hook": "onNodeResolved"
  },
  {
    "id": "scout_compass",
    "name": "Scout Compass",
    "rarity": "common",
    "tags": ["map"],
    "description": "After selecting a node, reveal the next 3 node types on the route.",
    "hook": "onNodeSelected"
  },
  {
    "id": "band_of_resonance",
    "name": "Band of Resonance",
    "rarity": "uncommon",
    "tags": ["battle", "targeting"],
    "description": "Your single-target moves splash for 50% damage to the other two enemies.",
    "hook": "onDamageDealt"
  },
  {
    "id": "cracked_everstone",
    "name": "Cracked Everstone",
    "rarity": "uncommon",
    "tags": ["battle"],
    "description": "Unevolved Pokémon deal +15% damage and take -10% damage.",
    "hook": "onDamageCalc"
  },
  {
    "id": "ether_lens",
    "name": "Ether Lens",
    "rarity": "uncommon",
    "tags": ["battle"],
    "description": "+5% damage bonus for all your Pokémon (MVP: accuracy substitute).",
    "hook": "onDamageCalc"
  },
  {
    "id": "gym_scout_contract",
    "name": "Gym Scout Contract",
    "rarity": "uncommon",
    "tags": ["map"],
    "description": "After selecting a node, the next 3 node types in the route are revealed.",
    "hook": "onNodeSelected"
  },
  {
    "id": "focus_charm",
    "name": "Focus Charm",
    "rarity": "rare",
    "tags": ["battle"],
    "description": "Once per battle, the first Pokémon that would faint survives at 1 HP.",
    "hook": "onFaintCheck"
  },
  {
    "id": "surge_battery",
    "name": "Surge Battery",
    "rarity": "rare",
    "tags": ["battle"],
    "description": "At battle start, your lead Pokémon's first move deals +20% damage.",
    "hook": "onFirstActionDamage"
  },
  {
    "id": "bargain_seal",
    "name": "Bargain Seal",
    "rarity": "rare",
    "tags": ["shop"],
    "description": "First purchase at each shop is 50% cheaper.",
    "hook": "onShopBuy"
  },
  {
    "id": "relic_of_mastery",
    "name": "Relic of Mastery",
    "rarity": "legendary",
    "tags": ["battle", "map"],
    "description": "+1 relic cap (up to 9) AND +10% Aether multiplier at run end.",
    "hook": "onRunFinalized"
  }
]