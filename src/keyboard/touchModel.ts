import { LETTERS, type KeyRect } from "./layout";

/**
 * Where she actually lands on each key, learned from words she confirms.
 * Offsets are in key units (1 = one key width/height) relative to the key's
 * centre, so they survive small changes in screen size.
 */
export interface KeyStat {
  n: number;
  mx: number;
  my: number;
  m2x: number;
  m2y: number;
}
export type TouchModel = Record<string, KeyStat>;

const PRIOR_N = 4;
const PRIOR_SD = 0.45;
const FLOOR = -12;

export function keyParams(model: TouchModel, id: string) {
  const s = model[id];
  if (!s) return { mx: 0, my: 0, sd: PRIOR_SD };
  const k = s.n / (s.n + PRIOR_N);
  const prior = PRIOR_N * PRIOR_SD * PRIOR_SD;
  const vx = (s.m2x + prior) / (s.n + PRIOR_N);
  const vy = (s.m2y + prior) / (s.n + PRIOR_N);
  const sd = Math.min(0.9, Math.max(0.25, Math.sqrt((vx + vy) / 2)));
  return { mx: s.mx * k, my: s.my * k, sd };
}

/** One letter tap, with everything the decoder and learner need precomputed. */
export interface LetterTap {
  shown: string; // most likely letter, displayed as she types
  ll: Record<string, number>; // log-likelihood of each letter
  off: Record<string, [number, number]>; // offset from each letter's centre, key units
}

export function makeTap(x: number, y: number, keys: KeyRect[], model: TouchModel): LetterTap {
  const ll: Record<string, number> = {};
  const off: Record<string, [number, number]> = {};
  let shown = "a";
  let best = -Infinity;
  for (const k of keys) {
    if (!LETTERS.includes(k.id)) continue;
    const ox = (x - (k.x + k.w / 2)) / k.w;
    const oy = (y - (k.y + k.h / 2)) / k.h;
    off[k.id] = [ox, oy];
    const p = keyParams(model, k.id);
    const dx = ox - p.mx;
    const dy = oy - p.my;
    const v = Math.max(FLOOR, -(dx * dx + dy * dy) / (2 * p.sd * p.sd));
    ll[k.id] = v;
    if (v > best) {
      best = v;
      shown = k.id;
    }
  }
  return { shown, ll, off };
}

export function learn(model: TouchModel, letter: string, offset: [number, number]): TouchModel {
  const s = model[letter] ?? { n: 0, mx: 0, my: 0, m2x: 0, m2y: 0 };
  const n = s.n + 1;
  const dx = offset[0] - s.mx;
  const mx = s.mx + dx / n;
  const dy = offset[1] - s.my;
  const my = s.my + dy / n;
  return {
    ...model,
    [letter]: {
      n,
      mx,
      my,
      m2x: s.m2x + dx * (offset[0] - mx),
      m2y: s.m2y + dy * (offset[1] - my),
    },
  };
}
