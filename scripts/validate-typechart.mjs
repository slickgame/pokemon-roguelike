import { TYPE_CHART, effectiveness } from "../src/shared/typeChart.js";

const checks = [
  // Requested known single-type matchups
  { atk: "ghost", def: ["normal"], expected: 0 },
  { atk: "electric", def: ["flying"], expected: 2 },
  { atk: "poison", def: ["steel"], expected: 0 },

  // Dual-type multiplication behavior
  { atk: "fighting", def: ["rock", "steel"], expected: 4 },
  { atk: "fire", def: ["grass", "bug"], expected: 4 },
  { atk: "water", def: ["fire", "rock"], expected: 4 },
  { atk: "grass", def: ["fire", "flying"], expected: 0.25 },
  { atk: "electric", def: ["flying", "grass"], expected: 1 },
  { atk: "ghost", def: ["normal", "psychic"], expected: 0 },
];

for (const { atk, def, expected } of checks) {
  const got = effectiveness(atk, def);
  if (got !== expected) {
    throw new Error(`effectiveness(${atk} -> ${def.join('/')}) expected ${expected}, got ${got}`);
  }
}

if (TYPE_CHART.ghost.normal !== 0 || TYPE_CHART.electric.flying !== 2 || TYPE_CHART.poison.steel !== 0) {
  throw new Error("Canonical chart values do not match expected constants");
}

console.log("Type chart validation passed.");
