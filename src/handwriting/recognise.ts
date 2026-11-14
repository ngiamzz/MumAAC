/** A point is [x, y, ms since the first touch]; a stroke is one finger-down path. */
export type Point = [number, number, number];
export type Stroke = Point[];

const N = 96; // points per word after resampling
const BAND = 14; // how far the alignment may drift, in points
const MIN_STROKE = 6; // px; shorter strokes are treated as stray touches

function strokeLength(s: Stroke): number {
  let len = 0;
  for (let i = 1; i < s.length; i++) len += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
  return len;
}

/**
 * Turn a scribble into a fixed-size shape: N points evenly spaced along the
 * ink (finger lifts are skipped, so where she breaks a stroke does not matter),
 * centred, and scaled to unit size. Returns null if there is no real ink.
 */
export function featurize(strokes: Stroke[]): Float32Array | null {
  let kept = strokes.filter((s) => strokeLength(s) >= MIN_STROKE);
  if (!kept.length) kept = strokes.filter((s) => s.length > 0);
  const total = kept.reduce((n, s) => n + strokeLength(s), 0);
  if (!kept.length || total === 0) return null;

  const out = new Float32Array(N * 2);
  let k = 0;
  let walked = 0;
  const step = total / (N - 1);
  for (const s of kept) {
    for (let i = 1; i < s.length; i++) {
      const [x0, y0] = s[i - 1];
      const [x1, y1] = s[i];
      const seg = Math.hypot(x1 - x0, y1 - y0);
      while (k < N && k * step <= walked + seg + 1e-9) {
        const f = seg === 0 ? 0 : (k * step - walked) / seg;
        out[k * 2] = x0 + (x1 - x0) * f;
        out[k * 2 + 1] = y0 + (y1 - y0) * f;
        k++;
      }
      walked += seg;
    }
  }
  const last = kept[kept.length - 1];
  for (; k < N; k++) {
    out[k * 2] = last[last.length - 1][0];
    out[k * 2 + 1] = last[last.length - 1][1];
  }

  let cx = 0;
  let cy = 0;
  for (let i = 0; i < N; i++) {
    cx += out[i * 2];
    cy += out[i * 2 + 1];
  }
  cx /= N;
  cy /= N;
  let spread = 0;
  for (let i = 0; i < N; i++) {
    out[i * 2] -= cx;
    out[i * 2 + 1] -= cy;
    spread += out[i * 2] ** 2 + out[i * 2 + 1] ** 2;
  }
  const scale = Math.sqrt(spread / N) || 1;
  for (let i = 0; i < N * 2; i++) out[i] /= scale;
  return out;
}

/** Shape distance that tolerates her writing parts of a word faster or slower. */
export function distance(a: Float32Array, b: Float32Array): number {
  const W = N + 1;
  const dp = new Float64Array(W * W).fill(Infinity);
  dp[0] = 0;
  for (let i = 1; i <= N; i++) {
    const lo = Math.max(1, i - BAND);
    const hi = Math.min(N, i + BAND);
    for (let j = lo; j <= hi; j++) {
      const d = Math.hypot(a[(i - 1) * 2] - b[(j - 1) * 2], a[(i - 1) * 2 + 1] - b[(j - 1) * 2 + 1]);
      dp[i * W + j] = d + Math.min(dp[(i - 1) * W + j], dp[i * W + j - 1], dp[(i - 1) * W + j - 1]);
    }
  }
  return dp[N * W + N] / N;
}

export interface Template {
  word: string;
  feat: Float32Array;
}

export interface Guess {
  word: string;
  dist: number;
}

/** Closest words first. A word's score is the average of its two closest samples. */
export function recognise(strokes: Stroke[], templates: Template[], limit: number): Guess[] {
  const feat = featurize(strokes);
  if (!feat) return [];
  const byWord = new Map<string, number[]>();
  for (const t of templates) {
    const list = byWord.get(t.word) ?? [];
    list.push(distance(feat, t.feat));
    byWord.set(t.word, list);
  }
  const guesses: Guess[] = [];
  for (const [word, ds] of byWord) {
    ds.sort((x, y) => x - y);
    guesses.push({ word, dist: ds.length > 1 ? (ds[0] + ds[1]) / 2 : ds[0] });
  }
  guesses.sort((x, y) => x.dist - y.dist);
  return guesses.slice(0, limit);
}
