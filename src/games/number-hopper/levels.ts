/**
 * The teaching model behind Number Hopper.
 *
 * A 2nd grader adds 37 + 25 by decomposing 25 into "2 tens and 5 ones" and
 * hopping that far along a number line: +10, +10, +1, +1, +1, +1, +1. So a
 * problem is never "here is a sum, type the answer" — it is "you are standing
 * on 37, now travel 25". The number line does the arithmetic; the child does
 * the decomposition.
 *
 * Everything in this file is pure: no three.js, no DOM. That keeps the levels
 * readable and lets the hop rules be reasoned about on their own.
 */

/** Lowest and highest number on the road. The road IS the domain. */
export const MIN = 0;
export const MAX = 100;

export type Op = 'add' | 'sub';

/** One challenge, e.g. "start on 37, add 25, land on 62". */
export interface Problem {
  /** Where the frog is placed when the challenge appears. */
  start: number;
  /** How far it has to travel. Always positive; `op` gives the direction. */
  amount: number;
  op: Op;
  /** The square it must land on exactly. */
  target: number;
}

export interface Level {
  /** Stable key: used for the localStorage star record, so never renumber. */
  id: number;
  /** Shown on the level button. Kept to two words a 7-year-old can read. */
  title: string;
  emoji: string;
  /** How many challenges before the level is finished. */
  problemCount: number;
  makeProblem: () => Problem;
}

/** Random integer in [lo, hi], both ends included. */
function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function pick<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)];
}

function problem(start: number, amount: number, op: Op): Problem {
  return {
    start,
    amount,
    op,
    target: op === 'add' ? start + amount : start - amount,
  };
}

/**
 * The fewest hops that can solve a problem: every ten first, then every one.
 * This is the definition of "did it the smart way", so it is also what the
 * star rating is measured against.
 */
export function minimumHops(amount: number): number {
  return Math.floor(amount / 10) + (amount % 10);
}

/**
 * Stars for one solved challenge. Finishing at all is always worth a star —
 * the game never scores zero, because a 7-year-old who got there by pressing
 * +1 twenty times still got there.
 */
export function starsForHops(hops: number, amount: number): 1 | 2 | 3 {
  const best = minimumHops(amount);
  if (hops <= best) return 3;
  if (hops <= best + 2) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Level 1 — addition within 20, ones only.
// Small numbers, single-digit jumps. The child only ever needs +1, which is
// how they learn what a hop is before tens enter the picture.
function makeOnesWithin20(): Problem {
  const start = randInt(1, 12);
  const amount = randInt(2, Math.min(9, 20 - start));
  return problem(start, amount, 'add');
}

// Level 2 — adding whole tens.
// The amount is always a round ten, so the whole level is solved with the +10
// button. Starting off a ten (23 + 40) is deliberate: it shows that a tens hop
// leaves the ones digit alone, which is the single most useful thing to notice.
function makeWholeTens(): Problem {
  const start = randInt(5, 59);
  const maxTens = Math.floor((MAX - start) / 10);
  const amount = randInt(1, Math.max(1, Math.min(4, maxTens))) * 10;
  return problem(start, amount, 'add');
}

// Level 3 — addition within 100 that crosses a ten.
// The ones digits are forced to sum past 10, so the child cannot avoid
// carrying: 37 + 25 has to pass through 60 on the way to 62.
function makeCrossingTens(): Problem {
  for (let tries = 0; tries < 40; tries++) {
    const start = randInt(12, 78);
    const amount = randInt(12, Math.min(48, MAX - start));
    const crosses = (start % 10) + (amount % 10) >= 10;
    if (amount % 10 !== 0 && crosses) return problem(start, amount, 'add');
  }
  // Hand-built fallback so this can never loop forever or return nothing.
  return problem(37, 25, 'add');
}

// Level 4 — subtraction within 100.
// Same road, travelled leftwards. Borrowing is forced the same way carrying
// was in level 3: the ones digit of the amount is bigger than the start's.
function makeSubtraction(): Problem {
  for (let tries = 0; tries < 40; tries++) {
    const start = randInt(25, MAX);
    const amount = randInt(12, Math.min(48, start));
    const borrows = start % 10 < amount % 10;
    if (amount % 10 !== 0 && borrows) return problem(start, amount, 'sub');
  }
  return problem(62, 28, 'sub');
}

// Level 5 — mixed. Anything from levels 2 to 4, unannounced, so the child has
// to read the sign and decide the direction before hopping.
function makeMixed(): Problem {
  return pick([makeWholeTens, makeCrossingTens, makeSubtraction])();
}

export const levels: readonly Level[] = [
  { id: 1, title: 'Little Hops', emoji: '🌱', problemCount: 5, makeProblem: makeOnesWithin20 },
  { id: 2, title: 'Big Tens', emoji: '🔟', problemCount: 5, makeProblem: makeWholeTens },
  { id: 3, title: 'Over the Ten', emoji: '🌉', problemCount: 5, makeProblem: makeCrossingTens },
  { id: 4, title: 'Hop Back', emoji: '⬅️', problemCount: 5, makeProblem: makeSubtraction },
  { id: 5, title: 'All Mixed Up', emoji: '🎲', problemCount: 6, makeProblem: makeMixed },
];
