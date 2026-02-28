// Minimal Kanto learnsets — 151 Pokémon, starter moves + 2-3 level-up moves each
// Format: { [speciesId]: { startMoves: [...], levelUp: [{ level, moveId }] } }

const LEARNSETS = {
  // Bulbasaur line
  1:  { startMoves: ["tackle", "growl"], levelUp: [{ level: 7, moveId: "vine_whip" }] },
  2:  { startMoves: ["tackle", "growl", "vine_whip"], levelUp: [] },
  3:  { startMoves: ["tackle", "growl", "vine_whip"], levelUp: [] },

  // Charmander line
  4:  { startMoves: ["scratch", "growl"], levelUp: [{ level: 7, moveId: "ember" }] },
  5:  { startMoves: ["scratch", "growl", "ember"], levelUp: [] },
  6:  { startMoves: ["scratch", "growl", "ember"], levelUp: [] },

  // Squirtle line
  7:  { startMoves: ["tackle", "tail_whip"], levelUp: [{ level: 7, moveId: "water_gun" }] },
  8:  { startMoves: ["tackle", "tail_whip", "water_gun"], levelUp: [] },
  9:  { startMoves: ["tackle", "tail_whip", "water_gun"], levelUp: [] },

  // Caterpie line
  10: { startMoves: ["tackle", "string_shot"], levelUp: [] },
  11: { startMoves: ["tackle", "string_shot"], levelUp: [] },
  12: { startMoves: ["tackle", "quick_attack"], levelUp: [] },

  // Weedle line
  13: { startMoves: ["tackle", "string_shot"], levelUp: [] },
  14: { startMoves: ["tackle", "string_shot"], levelUp: [] },
  15: { startMoves: ["tackle", "quick_attack"], levelUp: [] },

  // Pidgey line
  16: { startMoves: ["tackle", "growl"], levelUp: [{ level: 9, moveId: "quick_attack" }] },
  17: { startMoves: ["tackle", "growl", "quick_attack"], levelUp: [] },
  18: { startMoves: ["tackle", "growl", "quick_attack"], levelUp: [] },

  // Rattata line
  19: { startMoves: ["tackle", "tail_whip"], levelUp: [{ level: 7, moveId: "quick_attack" }] },
  20: { startMoves: ["tackle", "tail_whip", "quick_attack"], levelUp: [] },

  // Spearow line
  21: { startMoves: ["tackle", "growl"], levelUp: [{ level: 9, moveId: "quick_attack" }] },
  22: { startMoves: ["tackle", "growl", "quick_attack"], levelUp: [] },

  // Ekans line
  23: { startMoves: ["tackle", "string_shot"], levelUp: [] },
  24: { startMoves: ["tackle", "string_shot"], levelUp: [] },

  // Pikachu line
  25: { startMoves: ["thunder_shock", "growl"], levelUp: [{ level: 9, moveId: "quick_attack" }] },
  26: { startMoves: ["thunder_shock", "growl", "quick_attack"], levelUp: [] },

  // Sandshrew line
  27: { startMoves: ["scratch", "growl"], levelUp: [] },
  28: { startMoves: ["scratch", "growl"], levelUp: [] },

  // Nidoran lines
  29: { startMoves: ["tackle", "growl"], levelUp: [] },
  30: { startMoves: ["tackle", "growl"], levelUp: [] },
  31: { startMoves: ["tackle", "growl"], levelUp: [] },
  32: { startMoves: ["tackle", "growl"], levelUp: [] },
  33: { startMoves: ["tackle", "growl"], levelUp: [] },
  34: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Clefairy line
  35: { startMoves: ["tackle", "growl"], levelUp: [] },
  36: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Vulpix line
  37: { startMoves: ["ember", "growl"], levelUp: [] },
  38: { startMoves: ["ember", "growl"], levelUp: [] },

  // Jigglypuff line
  39: { startMoves: ["tackle", "growl"], levelUp: [] },
  40: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Zubat line
  41: { startMoves: ["tackle", "string_shot"], levelUp: [] },
  42: { startMoves: ["tackle", "string_shot"], levelUp: [] },

  // Oddish line
  43: { startMoves: ["vine_whip", "growl"], levelUp: [] },
  44: { startMoves: ["vine_whip", "growl"], levelUp: [] },
  45: { startMoves: ["vine_whip", "growl"], levelUp: [] },

  // Paras line
  46: { startMoves: ["scratch", "string_shot"], levelUp: [] },
  47: { startMoves: ["scratch", "string_shot"], levelUp: [] },

  // Venonat line
  48: { startMoves: ["tackle", "string_shot"], levelUp: [] },
  49: { startMoves: ["tackle", "string_shot"], levelUp: [] },

  // Diglett line
  50: { startMoves: ["scratch", "growl"], levelUp: [] },
  51: { startMoves: ["scratch", "growl"], levelUp: [] },

  // Meowth line
  52: { startMoves: ["scratch", "growl"], levelUp: [{ level: 9, moveId: "quick_attack" }] },
  53: { startMoves: ["scratch", "growl", "quick_attack"], levelUp: [] },

  // Psyduck line
  54: { startMoves: ["water_gun", "growl"], levelUp: [] },
  55: { startMoves: ["water_gun", "growl"], levelUp: [] },

  // Mankey line
  56: { startMoves: ["scratch", "growl"], levelUp: [] },
  57: { startMoves: ["scratch", "growl"], levelUp: [] },

  // Growlithe line
  58: { startMoves: ["ember", "growl"], levelUp: [] },
  59: { startMoves: ["ember", "growl"], levelUp: [] },

  // Poliwag line
  60: { startMoves: ["water_gun", "growl"], levelUp: [] },
  61: { startMoves: ["water_gun", "growl"], levelUp: [] },
  62: { startMoves: ["water_gun", "growl"], levelUp: [] },

  // Abra line
  63: { startMoves: ["tackle", "growl"], levelUp: [] },
  64: { startMoves: ["tackle", "growl"], levelUp: [] },
  65: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Machop line
  66: { startMoves: ["tackle", "growl"], levelUp: [] },
  67: { startMoves: ["tackle", "growl"], levelUp: [] },
  68: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Bellsprout line
  69: { startMoves: ["vine_whip", "growl"], levelUp: [] },
  70: { startMoves: ["vine_whip", "growl"], levelUp: [] },
  71: { startMoves: ["vine_whip", "growl"], levelUp: [] },

  // Tentacool line
  72: { startMoves: ["water_gun", "string_shot"], levelUp: [] },
  73: { startMoves: ["water_gun", "string_shot"], levelUp: [] },

  // Geodude line
  74: { startMoves: ["tackle", "growl"], levelUp: [] },
  75: { startMoves: ["tackle", "growl"], levelUp: [] },
  76: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Ponyta line
  77: { startMoves: ["ember", "growl"], levelUp: [] },
  78: { startMoves: ["ember", "growl"], levelUp: [] },

  // Slowpoke line
  79: { startMoves: ["water_gun", "growl"], levelUp: [] },
  80: { startMoves: ["water_gun", "growl"], levelUp: [] },

  // Magnemite line
  81: { startMoves: ["thunder_shock", "growl"], levelUp: [] },
  82: { startMoves: ["thunder_shock", "growl"], levelUp: [] },

  // Farfetch'd
  83: { startMoves: ["scratch", "growl"], levelUp: [] },

  // Doduo line
  84: { startMoves: ["tackle", "growl"], levelUp: [] },
  85: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Seel line
  86: { startMoves: ["water_gun", "growl"], levelUp: [] },
  87: { startMoves: ["water_gun", "growl"], levelUp: [] },

  // Grimer line
  88: { startMoves: ["tackle", "growl"], levelUp: [] },
  89: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Shellder line
  90: { startMoves: ["tackle", "string_shot"], levelUp: [] },
  91: { startMoves: ["tackle", "string_shot"], levelUp: [] },

  // Gastly line
  92: { startMoves: ["tackle", "growl"], levelUp: [] },
  93: { startMoves: ["tackle", "growl"], levelUp: [] },
  94: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Onix
  95: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Drowzee line
  96: { startMoves: ["tackle", "growl"], levelUp: [] },
  97: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Krabby line
  98: { startMoves: ["tackle", "growl"], levelUp: [] },
  99: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Voltorb line
  100: { startMoves: ["thunder_shock", "growl"], levelUp: [] },
  101: { startMoves: ["thunder_shock", "growl"], levelUp: [] },

  // Exeggcute line
  102: { startMoves: ["vine_whip", "growl"], levelUp: [] },
  103: { startMoves: ["vine_whip", "growl"], levelUp: [] },

  // Cubone line
  104: { startMoves: ["tackle", "growl"], levelUp: [] },
  105: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Hitmons
  106: { startMoves: ["tackle", "growl"], levelUp: [] },
  107: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Lickitung
  108: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Koffing line
  109: { startMoves: ["tackle", "growl"], levelUp: [] },
  110: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Rhyhorn line
  111: { startMoves: ["tackle", "growl"], levelUp: [] },
  112: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Chansey
  113: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Tangela
  114: { startMoves: ["vine_whip", "growl"], levelUp: [] },

  // Kangaskhan
  115: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Horsea line
  116: { startMoves: ["water_gun", "growl"], levelUp: [] },
  117: { startMoves: ["water_gun", "growl"], levelUp: [] },

  // Goldeen line
  118: { startMoves: ["water_gun", "tail_whip"], levelUp: [] },
  119: { startMoves: ["water_gun", "tail_whip"], levelUp: [] },

  // Staryu line
  120: { startMoves: ["tackle", "water_gun"], levelUp: [] },
  121: { startMoves: ["tackle", "water_gun"], levelUp: [] },

  // Mr. Mime
  122: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Scyther
  123: { startMoves: ["scratch", "quick_attack"], levelUp: [] },

  // Jynx
  124: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Electabuzz
  125: { startMoves: ["thunder_shock", "quick_attack"], levelUp: [] },

  // Magmar
  126: { startMoves: ["ember", "growl"], levelUp: [] },

  // Pinsir
  127: { startMoves: ["scratch", "string_shot"], levelUp: [] },

  // Tauros
  128: { startMoves: ["tackle", "tail_whip"], levelUp: [] },

  // Magikarp line
  129: { startMoves: ["tackle", "string_shot"], levelUp: [] },
  130: { startMoves: ["tackle", "water_gun"], levelUp: [] },

  // Eevee and eeveelutions
  133: { startMoves: ["tackle", "tail_whip"], levelUp: [{ level: 9, moveId: "quick_attack" }] },
  134: { startMoves: ["tackle", "water_gun"], levelUp: [] },
  135: { startMoves: ["tackle", "thunder_shock"], levelUp: [] },
  136: { startMoves: ["tackle", "ember"], levelUp: [] },

  // Porygon
  137: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Omanyte line
  138: { startMoves: ["tackle", "water_gun"], levelUp: [] },
  139: { startMoves: ["tackle", "water_gun"], levelUp: [] },

  // Kabuto line
  140: { startMoves: ["tackle", "scratch"], levelUp: [] },
  141: { startMoves: ["tackle", "scratch"], levelUp: [] },

  // Aerodactyl
  142: { startMoves: ["tackle", "scratch"], levelUp: [] },

  // Snorlax
  143: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Articuno
  144: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Zapdos
  145: { startMoves: ["thunder_shock", "growl"], levelUp: [] },

  // Moltres
  146: { startMoves: ["ember", "growl"], levelUp: [] },

  // Dratini line
  147: { startMoves: ["tackle", "growl"], levelUp: [] },
  148: { startMoves: ["tackle", "growl"], levelUp: [] },
  149: { startMoves: ["tackle", "water_gun"], levelUp: [] },

  // Mewtwo
  150: { startMoves: ["tackle", "growl"], levelUp: [] },

  // Mew
  151: { startMoves: ["tackle", "growl"], levelUp: [] },
};

export function getLearnset(speciesId) {
  return LEARNSETS[speciesId] ?? { startMoves: ["tackle"], levelUp: [] };
}

export function getStartMoves(speciesId) {
  return getLearnset(speciesId).startMoves;
}

// Returns moves learned AT exactly this level
export function getMovesLearnedAtLevel(speciesId, level) {
  return getLearnset(speciesId).levelUp
    .filter(e => e.level === level)
    .map(e => e.moveId);
}

export default LEARNSETS;