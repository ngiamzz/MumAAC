import type { TouchModel } from "./keyboard/touchModel";

export interface Settings {
  repeatWindowMs: number;
  speechRate: number;
  extraWords: string; // family names and other words, comma or newline separated
}

export interface Saved {
  settings: Settings;
  touch: Record<string, TouchModel>; // keyed by column count: phone and tablet layouts differ
  usage: Record<string, number>; // how often she has used each word
}

const KEY = "mumaac:v1";

export const DEFAULT_SETTINGS: Settings = {
  repeatWindowMs: 400,
  speechRate: 0.9,
  extraWords: "Xinwei, Dom, Daniel, Danny, Ben, Jasi",
};

export function load(): Saved {
  const empty: Saved = { settings: DEFAULT_SETTINGS, touch: {}, usage: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const s = JSON.parse(raw) as Partial<Saved>;
    return {
      settings: { ...DEFAULT_SETTINGS, ...s.settings },
      touch: s.touch ?? {},
      usage: s.usage ?? {},
    };
  } catch {
    return empty;
  }
}

export function save(s: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked or full: keep working, just without memory.
  }
}
