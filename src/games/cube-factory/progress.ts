/**
 * Stars earned per level, kept in localStorage so they survive a reload.
 *
 * Every read and write is wrapped: a private window or a full disk throws here,
 * and a kids' game must never die because it could not save a star.
 */

export type LevelId = 'arrays' | 'area' | 'factors';

export const LEVEL_IDS: readonly LevelId[] = ['arrays', 'area', 'factors'];

export type StarBook = Record<LevelId, number>;

const STORAGE_KEY = 'cube-factory:stars';
const NO_STARS: StarBook = { arrays: 0, area: 0, factors: 0 };

export function loadStars(): StarBook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...NO_STARS };
    const saved = JSON.parse(raw) as Partial<Record<LevelId, unknown>>;
    return {
      arrays: clampStars(saved.arrays),
      area: clampStars(saved.area),
      factors: clampStars(saved.factors),
    };
  } catch {
    return { ...NO_STARS };
  }
}

/** Stars only ever go up, so one bad run never wipes out a good one. */
export function saveStars(id: LevelId, stars: number): StarBook {
  const book = loadStars();
  book[id] = Math.max(book[id], clampStars(stars));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(book));
  } catch {
    // Nothing to do and nothing worth interrupting the game for.
  }
  return book;
}

function clampStars(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(3, Math.floor(value));
}
