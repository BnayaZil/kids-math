/**
 * The arithmetic the game teaches, with no three.js and no DOM attached.
 *
 * Everything here is pure, so the teaching rules can be read (and corrected)
 * without untangling them from rendering.
 */

/** Place-value split, biggest place first: 13 -> [10, 3]; 7 -> [7]; 240 -> [200, 40]. */
export function splitPlaceValue(n: number): number[] {
  const parts: number[] = [];
  let rest = Math.abs(Math.floor(n));
  let unit = 1;
  while (rest > 0) {
    const digit = rest % 10;
    if (digit > 0) parts.push(digit * unit);
    rest = Math.floor(rest / 10);
    unit *= 10;
  }
  return parts.reverse();
}

/** One coloured block of the area model: a slice of `a` times a slice of `b`. */
export interface PartialProduct {
  /** The part taken from the left-hand factor (the rows). */
  a: number;
  /** The part taken from the top factor (the columns). */
  b: number;
  product: number;
  /** Where the block sits in the split rectangle. */
  row: number;
  col: number;
}

/**
 * Break `a x b` into the blocks of the area model.
 *
 * 13 x 24 becomes 10x20, 10x4, 3x20 and 3x4 — four blocks that add up to 312.
 * A one-digit factor simply yields fewer blocks, which is how the level ramps.
 */
export function partialProducts(a: number, b: number): PartialProduct[] {
  const rows = splitPlaceValue(a);
  const cols = splitPlaceValue(b);
  const out: PartialProduct[] = [];
  rows.forEach((ap, row) => {
    cols.forEach((bp, col) => {
      out.push({ a: ap, b: bp, product: ap * bp, row, col });
    });
  });
  return out;
}

/** Factor pairs, each listed once with the small side first: 24 -> 1x24, 2x12, 3x8, 4x6. */
export function factorPairs(n: number): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let a = 1; a * a <= n; a++) {
    if (n % a === 0) pairs.push([a, n / a]);
  }
  return pairs;
}

/** The running totals a kid says out loud: step 4, six times -> 4, 8, 12, 16, 20, 24. */
export function skipCounts(step: number, times: number): number[] {
  return Array.from({ length: times }, (_, i) => step * (i + 1));
}

/** Pick a random whole number from lo to hi, both ends included. */
export function randomInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/** Pick a random item. Only ever called with a non-empty list. */
export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
