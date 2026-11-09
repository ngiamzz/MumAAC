export interface Press {
  t: number;
  x: number;
  y: number;
  keyW: number;
}

/**
 * A second press soon after the first and close to it is one intended tap.
 * Compared by position rather than resolved key, because a shaky repeat can
 * land on a neighbouring key. Genuine double letters ("hello") are recovered
 * by the decoder, which lets one tap stand for a doubled letter.
 */
export function isAccidentalRepeat(prev: Press | null, cur: Press, windowMs: number): boolean {
  if (!prev) return false;
  if (cur.t - prev.t >= windowMs) return false;
  return Math.hypot(cur.x - prev.x, cur.y - prev.y) < 0.6 * cur.keyW;
}
