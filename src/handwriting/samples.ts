import { featurize, type Stroke, type Template } from "./recognise";

/**
 * One scribble. `word` is null until someone says what it was. Kept on the
 * device; when cloud backup is signed in, also copied to the database.
 */
export interface Sample {
  id: string;
  word: string | null;
  strokes: Stroke[];
  at: number;
  synced?: boolean; // the cloud has this exact version
  deleted?: boolean; // removed here, removal not yet sent to the cloud
}

const KEY = "mumaac:handwriting:v2";
const OLD_KEY = "mumaac:handwriting:v1";
export const MAX_PER_WORD = 12; // newest kept on the device, so it follows her writing as it changes
const MAX_UNLABELLED = 30;

export function loadSamples(): Sample[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Sample[];
    // First run after the upgrade from word-keyed storage.
    const old = JSON.parse(localStorage.getItem(OLD_KEY) ?? "{}") as Record<string, { strokes: Stroke[]; at: number }[]>;
    return Object.entries(old).flatMap(([word, list]) =>
      list.map((s) => ({ id: crypto.randomUUID(), word, strokes: s.strokes, at: s.at })),
    );
  } catch {
    return [];
  }
}

/** Returns false if the device refused to store them (storage full or blocked). */
export function saveSamples(s: Sample[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export const live = (samples: Sample[]) => samples.filter((s) => !s.deleted);

export function newSample(word: string | null, strokes: Stroke[]): Sample | null {
  if (!featurize(strokes)) return null;
  return { id: crypto.randomUUID(), word, strokes, at: Date.now() };
}

export function labelSample(samples: Sample[], id: string, word: string): Sample[] {
  return samples.map((s) => (s.id === id ? { ...s, word, synced: false } : s));
}

/** With cloud backup the removal has to reach the cloud, so a marker stays until it is sent. */
export function deleteSamples(samples: Sample[], ids: Set<string>, cloud: boolean): Sample[] {
  if (!cloud) return samples.filter((s) => !ids.has(s.id));
  return samples.map((s) => (ids.has(s.id) ? { ...s, strokes: [], deleted: true, synced: false } : s));
}

/**
 * Keep the device copy small: the newest samples of each word and the newest
 * unlabelled scribbles. With cloud backup, nothing is dropped before it has
 * been copied to the cloud.
 */
export function trim(samples: Sample[], cloud: boolean): Sample[] {
  const seen = new Map<string | null, number>();
  const keep = new Set<string>();
  for (const s of [...samples].sort((a, b) => b.at - a.at)) {
    if (s.deleted) {
      keep.add(s.id);
      continue;
    }
    const n = seen.get(s.word) ?? 0;
    seen.set(s.word, n + 1);
    if (n < (s.word === null ? MAX_UNLABELLED : MAX_PER_WORD) || (cloud && !s.synced)) keep.add(s.id);
  }
  return keep.size === samples.length ? samples : samples.filter((s) => keep.has(s.id));
}

export function counts(samples: Sample[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of live(samples)) if (s.word !== null) out[s.word] = (out[s.word] ?? 0) + 1;
  return out;
}

export function toTemplates(samples: Sample[]): Template[] {
  const out: Template[] = [];
  const perWord = new Map<string, number>();
  for (const s of [...live(samples)].sort((a, b) => b.at - a.at)) {
    if (s.word === null) continue;
    const n = perWord.get(s.word) ?? 0;
    if (n >= MAX_PER_WORD) continue;
    const feat = featurize(s.strokes);
    if (!feat) continue;
    perWord.set(s.word, n + 1);
    out.push({ word: s.word, feat });
  }
  return out;
}
