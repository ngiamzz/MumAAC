export const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
export type KeyId = string; // a letter, "space" or "delete"

export interface KeyRect {
  id: KeyId;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A–Z in reading order, then Space and Delete in the last two cells. */
export function columnsFor(width: number, height: number): number {
  return width > height * 1.2 ? 7 : 4;
}

export function layoutKeys(width: number, height: number, gap: number): KeyRect[] {
  const ids = [...LETTERS, "space", "delete"];
  const cols = columnsFor(width, height);
  const rows = Math.ceil(ids.length / cols);
  const w = (width - gap * (cols - 1)) / cols;
  const h = (height - gap * (rows - 1)) / rows;
  return ids.map((id, i) => ({
    id,
    x: (i % cols) * (w + gap),
    y: Math.floor(i / cols) * (h + gap),
    w,
    h,
  }));
}

/** The key whose grid cell contains the point, counting gaps as part of the cell. */
export function cellAt(keys: KeyRect[], x: number, y: number): KeyRect {
  let best = keys[0];
  let bestD = Infinity;
  for (const k of keys) {
    const dx = Math.max(k.x - x, 0, x - (k.x + k.w));
    const dy = Math.max(k.y - y, 0, y - (k.y + k.h));
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}
