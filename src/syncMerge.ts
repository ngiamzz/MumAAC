import type { Stroke } from "./handwriting/recognise";
import type { Sample } from "./handwriting/samples";

/** A row of the cloud `samples` table. */
export interface Row {
  id: string;
  word: string | null;
  strokes: Stroke[];
  written_at: string;
  deleted: boolean;
  updated_at: string;
}

export function toRow(s: Sample, device: string) {
  return {
    id: s.id,
    word: s.word,
    strokes: s.deleted ? [] : s.strokes,
    written_at: new Date(s.at).toISOString(),
    deleted: !!s.deleted,
    device,
  };
}

/** After a successful upload: mark what was sent, unless it changed again meanwhile. */
export function markSynced(current: Sample[], sent: Sample[]): Sample[] {
  const sentSet = new Set(sent);
  if (!current.some((s) => sentSet.has(s))) return current;
  return current.filter((s) => !(sentSet.has(s) && s.deleted)).map((s) => (sentSet.has(s) ? { ...s, synced: true } : s));
}

/** Apply rows from the cloud. A local change not yet uploaded wins over the cloud copy. */
export function mergeRemote(current: Sample[], rows: Row[]): Sample[] {
  const byId = new Map(current.map((s) => [s.id, s]));
  let changed = false;
  for (const r of rows) {
    const mine = byId.get(r.id);
    if (mine && mine.synced === false) continue;
    if (r.deleted) {
      if (mine) {
        byId.delete(r.id);
        changed = true;
      }
      continue;
    }
    const at = Date.parse(r.written_at);
    if (mine && mine.synced && mine.word === r.word && mine.at === at) continue;
    byId.set(r.id, { id: r.id, word: r.word, strokes: r.strokes, at, synced: true });
    changed = true;
  }
  return changed ? [...byId.values()] : current;
}
