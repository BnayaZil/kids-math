/**
 * Star record, kept in localStorage so a child sees yesterday's stars today.
 *
 * Every read and write is wrapped: localStorage throws outright in a private
 * window and in browsers set to block site data, and a thrown storage error
 * must never stop the game from starting. No stars is a fine state to be in.
 */

const KEY = 'number-hopper.stars.v1';

export type StarMap = Record<number, number>;

export function loadStars(): StarMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: StarMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const level = Number(k);
      if (Number.isInteger(level) && typeof v === 'number' && v >= 1 && v <= 3) {
        out[level] = Math.floor(v);
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Records a level result, keeping the child's best ever run. Stars only go up:
 * a sloppy replay of a level never takes away stars already earned.
 */
export function saveStars(levelId: number, stars: number): StarMap {
  const all = loadStars();
  if ((all[levelId] ?? 0) >= stars) return all;
  all[levelId] = stars;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable — the run still counts for this session.
  }
  return all;
}
