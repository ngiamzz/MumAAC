import type { TouchModel } from "./keyboard/touchModel";

export interface Settings {
  repeatWindowMs: number;
  speechRate: number;
  extraWords: string; // family names and other words, comma or newline separated
  handwritingWords: string; // extra words she is taught to write, besides the names
}

export type Mode = "keys" | "write";

export interface Saved {
  settings: Settings;
  touch: Record<string, TouchModel>; // keyed by column count: phone and tablet layouts differ
  usage: Record<string, number>; // how often she has used each word
  mode: Mode; // the mode she last used
}

const KEY = "mumaac:v1";

export const DEFAULT_SETTINGS: Settings = {
  repeatWindowMs: 400,
  speechRate: 0.9,
  extraWords: "Xinwei, Dom, Daniel, Danny, Ben, Jasi",
  handwritingWords: "yes, no, water, toilet, pain, tired, hungry, cold, hot, help, thanks, sleep, medicine, home",
};

export function load(): Saved {
  const empty: Saved = { settings: DEFAULT_SETTINGS, touch: {}, usage: {}, mode: "keys" };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const s = JSON.parse(raw) as Partial<Saved>;
    return {
      settings: { ...DEFAULT_SETTINGS, ...s.settings },
      touch: s.touch ?? {},
      usage: s.usage ?? {},
      mode: s.mode === "write" ? "write" : "keys",
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
