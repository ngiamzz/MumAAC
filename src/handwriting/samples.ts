import { featurize, type Stroke, type Template } from "./recognise";

/** Her handwriting samples, kept on the device: word -> scribbles of that word. */
export interface Sample {
  strokes: Stroke[];
  at: number;
}
export type Samples = Record<string, Sample[]>;

const KEY = "mumaac:handwriting:v1";
const MAX_PER_WORD = 12; // newest kept, so it follows her writing as it changes

export function loadSamples(): Samples {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Samples;
  } catch {
    return {};
  }
}

/** Returns false if the device refused to store them (storage full or blocked). */
export function saveSamples(s: Samples): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function addSample(samples: Samples, word: string, strokes: Stroke[]): Samples {
  if (!featurize(strokes)) return samples;
  const list = [...(samples[word] ?? []), { strokes, at: Date.now() }].slice(-MAX_PER_WORD);
  return { ...samples, [word]: list };
}

export function toTemplates(samples: Samples): Template[] {
  const out: Template[] = [];
  for (const [word, list] of Object.entries(samples))
    for (const s of list) {
      const feat = featurize(s.strokes);
      if (feat) out.push({ word, feat });
    }
  return out;
}
