import { describe, expect, it } from "vitest";
import { distance, featurize, recognise, type Stroke, type Template } from "../src/handwriting/recognise";
import { MAX_PER_WORD, counts, deleteSamples, labelSample, newSample, toTemplates, trim, type Sample } from "../src/handwriting/samples";
import { markSynced, mergeRemote, toRow, type Row } from "../src/syncMerge";

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
  const samples: Sample[] = [];
  WORDS.forEach((w, wi) => {
    for (let k = 0; k < perWord; k++) samples.push(newSample(w, write(w, wi * 100 + k))!);
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

  it("keeps only the newest samples of a word on the device", () => {
    const samples = Array.from({ length: 20 }, (_, k) => ({ ...newSample("water", write("water", k))!, at: k }));
    const kept = trim(samples, false);
    expect(kept.length).toBe(MAX_PER_WORD);
    expect(Math.min(...kept.map((s) => s.at))).toBe(20 - MAX_PER_WORD);
  });

  it("with cloud backup, never drops a sample that has not been uploaded", () => {
    const samples = Array.from({ length: 20 }, (_, k) => ({ ...newSample("water", write("water", k))!, at: k }));
    expect(trim(samples, true).length).toBe(20);
    expect(trim(samples.map((s) => ({ ...s, synced: true })), true).length).toBe(MAX_PER_WORD);
  });
});

describe("cloud sync merging", () => {
  const mk = (word: string | null, seed = 1) => newSample(word, write("water", seed))!;
  const row = (s: Sample, patch: Partial<Row> = {}): Row => ({ ...toRow(s, "other"), updated_at: "2026-01-01T00:00:00Z", ...patch });

  it("marks uploaded samples, but not ones that changed during the upload", () => {
    const a = mk("water");
    const b = mk(null, 2);
    const during = labelSample([a, b], b.id, "pain"); // b relabelled while the upload ran
    const after = markSynced(during, [a, b]);
    expect(after.find((s) => s.id === a.id)!.synced).toBe(true);
    expect(after.find((s) => s.id === b.id)!.synced).toBe(false);
  });

  it("adds samples from another device and applies labels given there", () => {
    const mine = { ...mk(null), synced: true };
    const theirs = mk("home", 3);
    const merged = mergeRemote([mine], [row(theirs), row(mine, { word: "tired" })]);
    expect(counts(merged)).toEqual({ home: 1, tired: 1 });
  });

  it("keeps a local change that has not been uploaded yet", () => {
    const mine = labelSample([{ ...mk(null), synced: true }], "x", "y");
    const local = labelSample(mine, mine[0].id, "pain");
    expect(mergeRemote(local, [row(local[0], { word: "wrong" })])[0].word).toBe("pain");
  });

  it("removes samples deleted on another device, and sends local deletions", () => {
    const a = { ...mk("water"), synced: true };
    expect(mergeRemote([a], [row(a, { deleted: true })])).toEqual([]);
    const gone = deleteSamples([a], new Set([a.id]), true);
    expect(counts(gone)).toEqual({});
    expect(toRow(gone[0], "d")).toMatchObject({ deleted: true, strokes: [] });
    expect(markSynced(gone, gone)).toEqual([]);
  });

  it("returns the same list when nothing changed, so sync does not loop", () => {
    const a = { ...mk("water"), synced: true };
    const list = [a];
    expect(mergeRemote(list, [row(a)])).toBe(list);
    expect(markSynced(list, [])).toBe(list);
  });
});
