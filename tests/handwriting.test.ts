import { describe, expect, it } from "vitest";
import { distance, featurize, recognise, type Stroke, type Template } from "../src/handwriting/recognise";
import { addSample, toTemplates } from "../src/handwriting/samples";

// Small seeded random generator so the tests are repeatable.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

// Each letter gets a fixed squiggle, so words that share letters share shapes,
// as real handwriting does ("water" and "later" differ only in the first letter).
const letterShape = new Map<string, [number, number][]>();
function shapeOf(letter: string): [number, number][] {
  let s = letterShape.get(letter);
  if (!s) {
    const r = rng(letter.charCodeAt(0) * 7919);
    s = Array.from({ length: 5 }, () => [r(), r() * 2] as [number, number]);
    letterShape.set(letter, s);
  }
  return s;
}

/** Write a word with tremor, wobble, a different size and position, and random finger lifts. */
function write(word: string, seed: number, tremor = 0.06): Stroke[] {
  const r = rng(seed);
  const size = 30 + r() * 30;
  const ox = r() * 80;
  const oy = r() * 80;
  const slant = (r() - 0.5) * 0.3;
  const strokes: Stroke[] = [];
  let cur: Stroke = [];
  let t = 0;
  [...word].forEach((ch, li) => {
    const pts = shapeOf(ch);
    for (let i = 0; i < pts.length - 1; i++) {
      for (let f = 0; f < 1; f += 0.125) {
        const x = li * 1.2 + pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f + (r() - 0.5) * tremor * 2;
        const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f + (r() - 0.5) * tremor * 2;
        cur.push([ox + (x + y * slant) * size, oy + y * size, (t += 10)]);
      }
    }
    if (r() < 0.5) {
      strokes.push(cur);
      cur = [];
    }
  });
  if (cur.length) strokes.push(cur);
  return strokes;
}

const WORDS = "yes no water toilet pain tired hungry cold hot help thanks sleep medicine home xinwei dom daniel danny ben jasi later waiter".split(" ");

function teach(perWord: number): Template[] {
  let samples = {};
  WORDS.forEach((w, wi) => {
    for (let k = 0; k < perWord; k++) samples = addSample(samples, w, write(w, wi * 100 + k));
  });
  return toTemplates(samples);
}

describe("handwriting", () => {
  it("ignores her writing size and position", () => {
    const a = featurize(write("water", 1, 0))!;
    const b = featurize(write("water", 2, 0))!;
    expect(distance(a, b)).toBeLessThan(0.12);
  });

  it("returns nothing for an empty pad or a single dot", () => {
    expect(recognise([], teach(1), 3)).toEqual([]);
    expect(recognise([[[5, 5, 0]]], teach(1), 3)).toEqual([]);
  });

  it("recognises shaky writing of taught words from three samples each", () => {
    const templates = teach(3);
    let top1 = 0;
    let top3 = 0;
    let n = 0;
    WORDS.forEach((w, wi) => {
      for (let k = 0; k < 10; k++) {
        const g = recognise(write(w, 50_000 + wi * 100 + k, 0.1), templates, 3).map((x) => x.word);
        if (g[0] === w) top1++;
        if (g.includes(w)) top3++;
        n++;
      }
    });
    console.log(`top-1 ${top1}/${n}, top-3 ${top3}/${n}`);
    expect(top1 / n).toBeGreaterThan(0.85);
    expect(top3 / n).toBeGreaterThan(0.95);
  });

  it("keeps only the newest samples of a word", () => {
    let samples = {};
    for (let k = 0; k < 20; k++) samples = addSample(samples, "water", write("water", k));
    expect((samples as Record<string, unknown[]>).water.length).toBe(12);
  });
});
