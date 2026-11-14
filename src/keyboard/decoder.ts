import type { LetterTap } from "./touchModel";

const DOUBLE_PENALTY = -0.5; // one tap standing for a doubled letter
const EXTRA_PENALTY = -3; // a stray repeat tap the filter missed
const PRIOR_WEIGHT = 1.2; // nats per Zipf unit (one Zipf unit = 10x as common)
const USAGE_WEIGHT = 1.5;

export interface Entry {
  word: string;
  zipf: number;
}

export interface Scored {
  word: string;
  score: number;
  align: number[]; // align[i] = index of the letter tap i stands for, or -1
}

/** Best alignment of the taps to a prefix of the word, or null if hopeless. */
export function scoreWord(taps: LetterTap[], word: string): { score: number; align: number[] } | null {
  const n = taps.length;
  const L = word.length;
  if (n === 0) return null;
  const W = L + 1;
  const dp = new Float64Array((n + 1) * W).fill(-Infinity);
  const from = new Int32Array((n + 1) * W).fill(-1);
  const how = new Int8Array((n + 1) * W); // 1 match, 2 double, 3 extra
  dp[0] = 0;
  const relax = (i: number, j: number, ni: number, nj: number, v: number, kind: number) => {
    const idx = ni * W + nj;
    if (v > dp[idx]) {
      dp[idx] = v;
      from[idx] = i * W + j;
      how[idx] = kind;
    }
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= L; j++) {
      const cur = dp[i * W + j];
      if (cur === -Infinity) continue;
      const ll = taps[i].ll;
      if (j < L) relax(i, j, i + 1, j + 1, cur + (ll[word[j]] ?? -12), 1);
      if (j + 1 < L && word[j] === word[j + 1])
        relax(i, j, i + 1, j + 2, cur + (ll[word[j]] ?? -12) + DOUBLE_PENALTY, 2);
      if (j > 0) relax(i, j, i + 1, j, cur + (ll[word[j - 1]] ?? -12) + EXTRA_PENALTY, 3);
    }
  }
  let bestJ = -1;
  let best = -Infinity;
  for (let j = 1; j <= L; j++) {
    if (dp[n * W + j] > best) {
      best = dp[n * W + j];
      bestJ = j;
    }
  }
  if (bestJ < 0 || best < -6 * n) return null;
  const align = new Array<number>(n).fill(-1);
  let idx = n * W + bestJ;
  while (idx > 0) {
    const i = Math.floor(idx / W) - 1;
    const j = (idx % W) - 1;
    const kind = how[idx];
    if (kind === 1) align[i] = j;
    else if (kind === 2) align[i] = j - 1;
    // kind 3: stray tap, left at -1 so the learner ignores it
    idx = from[idx];
  }
  return { score: best, align };
}

export function suggest(
  taps: LetterTap[],
  lexicon: Entry[],
  usage: Record<string, number>,
  limit: number,
): Scored[] {
  const out: Scored[] = [];
  for (const e of lexicon) {
    const r = scoreWord(taps, e.word);
    if (!r) continue;
    const prior = PRIOR_WEIGHT * e.zipf + USAGE_WEIGHT * Math.log1p(usage[e.word] ?? 0);
    out.push({ word: e.word, score: r.score + prior, align: r.align });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
