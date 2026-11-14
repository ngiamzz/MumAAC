import common from "./data/words.json";
import type { Entry } from "./keyboard/decoder";

const NAME_ZIPF = 6; // as common as everyday words, so names surface early

export function parseExtraWords(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((w) => w.trim())
    .filter((w) => /^[A-Za-z]+$/.test(w));
}

/** Common English plus her family's names. Names keep their capitalisation for display. */
export function buildLexicon(extraWords: string): { entries: Entry[]; display: Map<string, string> } {
  const display = new Map<string, string>();
  const byWord = new Map<string, number>();
  for (const [w, z] of common as [string, number][]) byWord.set(w, z);
  for (const w of parseExtraWords(extraWords)) {
    const lower = w.toLowerCase();
    byWord.set(lower, Math.max(byWord.get(lower) ?? 0, NAME_ZIPF));
    display.set(lower, w);
  }
  display.set("i", "I");
  const entries = [...byWord].map(([word, zipf]) => ({ word, zipf }));
  return { entries, display };
}

/** The words she is taught to write: family names plus the handwriting list. */
export function handwritingWords(extraWords: string, hwWords: string): { word: string; label: string }[] {
  const seen = new Set<string>();
  const out: { word: string; label: string }[] = [];
  for (const label of [...parseExtraWords(extraWords), ...parseExtraWords(hwWords)]) {
    const word = label.toLowerCase();
    if (seen.has(word)) continue;
    seen.add(word);
    out.push({ word, label });
  }
  return out;
}
