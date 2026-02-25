/**
 * Deterministic PRNG utilities.
 * Uses mulberry32 seeded from a string hash (djb2).
 * No Math.random() used anywhere.
 */

/** djb2 string -> uint32 */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — returns a float [0, 1) */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * createRng(seedString) -> { nextFloat, nextInt, pick, shuffle }
 * All operations are deterministic for the same seedString.
 */
export function createRng(seedString) {
  const seed = hashString(String(seedString));
  const rand = mulberry32(seed);

  return {
    /** [0, 1) */
    nextFloat() {
      return rand();
    },
    /** integer in [0, max) */
    nextInt(max) {
      return Math.floor(rand() * max);
    },
    /** random element from array (does not mutate) */
    pick(arr) {
      return arr[Math.floor(rand() * arr.length)];
    },
    /** Fisher-Yates shuffle, returns NEW array */
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}