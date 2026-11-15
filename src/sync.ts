import { createClient } from "@supabase/supabase-js";
import type { Sample } from "./handwriting/samples";
import type { Saved } from "./store";
import { toRow, type Row } from "./syncMerge";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

/** Null when this build has no cloud database configured; the app then works on-device only. */
export const cloud = url && key ? createClient(url, key) : null;

const META_KEY = "mumaac:sync:v1";
interface Meta {
  device: string;
  cursor: string | null; // newest cloud change already applied here
}

function meta(): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? "null") as Meta | null;
    if (m?.device) return m;
  } catch {
    // fall through to a fresh one
  }
  return setMeta({ device: crypto.randomUUID(), cursor: null });
}

function setMeta(m: Meta): Meta {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    // Without storage every sync starts from scratch, which is slow but correct.
  }
  return m;
}

export function forgetCursor(): void {
  setMeta({ ...meta(), cursor: null });
}

export async function pushSamples(samples: Sample[]): Promise<void> {
  const device = meta().device;
  for (let i = 0; i < samples.length; i += 50) {
    const { error } = await cloud!.from("samples").upsert(samples.slice(i, i + 50).map((s) => toRow(s, device)));
    if (error) throw new Error(`Saving samples failed: ${error.message}`);
  }
}

/** Rows changed in the cloud since the last pull, oldest first. Call `done` once they are applied. */
export async function pullSamples(): Promise<{ rows: Row[]; done: () => void }> {
  const m = meta();
  const rows: Row[] = [];
  let cursor = m.cursor;
  for (;;) {
    let q = cloud!.from("samples").select("id,word,strokes,written_at,deleted,updated_at").order("updated_at").limit(500);
    if (cursor) q = q.gt("updated_at", cursor);
    const { data, error } = await q;
    if (error) throw new Error(`Loading samples failed: ${error.message}`);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length) cursor = page[page.length - 1].updated_at;
    if (page.length < 500) break;
  }
  return { rows, done: () => setMeta({ ...m, cursor }) };
}

/** Settings and what the keyboard has learned travel as one document; the newest edit wins. */
export type ProfileData = Pick<Saved, "settings" | "touch" | "usage">;

export async function fetchProfile(): Promise<{ data: ProfileData; client_updated_at: number } | null> {
  const { data, error } = await cloud!.from("profile").select("data,client_updated_at").eq("id", "mum").limit(1);
  if (error) throw new Error(`Loading settings failed: ${error.message}`);
  return (data?.[0] as { data: ProfileData; client_updated_at: number } | undefined) ?? null;
}

export async function pushProfile(saved: Saved): Promise<void> {
  const data: ProfileData = { settings: saved.settings, touch: saved.touch, usage: saved.usage };
  const { error } = await cloud!.from("profile").upsert({ id: "mum", data, client_updated_at: saved.updatedAt });
  if (error) throw new Error(`Saving settings failed: ${error.message}`);
}
