import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard } from "./keyboard/Keyboard";
import { suggest, type Scored } from "./keyboard/decoder";
import { learn, type LetterTap } from "./keyboard/touchModel";
import { Enrol } from "./handwriting/Enrol";
import { Pad } from "./handwriting/Pad";
import { recognise, type Stroke } from "./handwriting/recognise";
import { LabelScribbles } from "./handwriting/LabelScribbles";
import {
  counts,
  deleteSamples,
  labelSample,
  live,
  loadSamples,
  newSample,
  saveSamples,
  toTemplates,
  trim,
  type Sample,
} from "./handwriting/samples";
import { buildLexicon, handwritingWords, parseExtraWords } from "./lexicon";
import { speak } from "./speech";
import { load, save, type Saved } from "./store";
import { Settings } from "./Settings";
import { cloud, fetchProfile, forgetCursor, pullSamples, pushProfile, pushSamples } from "./sync";
import { markSynced, mergeRemote } from "./syncMerge";

export interface SyncStatus {
  email: string | null; // signed-in family login, if any
  at: number | null; // last successful sync
  error: string | null; // why the last sync failed
}

interface Typed {
  tap: LetterTap;
  cols: number;
}

const LEARN_MIN_LL = -6; // ignore taps too far from the letter to be informative

export default function App() {
  const [saved, setSavedRaw] = useState<Saved>(load);
  const [samples, setSamplesRaw] = useState<Sample[]>(loadSamples);
  const [sync, setSync] = useState<SyncStatus>({ email: null, at: null, error: null });
  const signedIn = sync.email !== null;
  // Every change to settings or learning is stamped, so sync knows which copy is newer.
  const setSaved: typeof setSavedRaw = (next) =>
    setSavedRaw((p) => ({ ...(typeof next === "function" ? next(p) : next), updatedAt: Date.now() }));
  const setSamples = (fn: (cur: Sample[]) => Sample[]) => setSamplesRaw((cur) => trim(fn(cur), signedIn));
  const [storageFull, setStorageFull] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const [taps, setTaps] = useState<Typed[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  // Id of a scribble none of the guesses matched: the next word she picks on the keyboard labels it.
  const [unmatched, setUnmatched] = useState<string | null>(null);
  const [cleared, setCleared] = useState<{ words: string[]; taps: Typed[] } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teaching, setTeaching] = useState(false);
  const [labelling, setLabelling] = useState(false);
  const [wide, setWide] = useState(() => window.innerWidth >= 700);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => save(saved), [saved]);
  useEffect(() => setStorageFull(!saveSamples(samples)), [samples]);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 700);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    if (!cleared) return;
    const t = setTimeout(() => setCleared(null), 6000);
    return () => clearTimeout(t);
  }, [cleared]);

  // Cloud sync. The device copy is always the working copy; this only copies changes both ways.
  const samplesRef = useRef(samples);
  samplesRef.current = samples;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const syncing = useRef(false);
  const profileSyncedAt = useRef(-1);

  const runSync = async () => {
    if (!cloud || syncing.current) return;
    syncing.current = true;
    try {
      const pending = samplesRef.current.filter((s) => !s.synced);
      if (pending.length) {
        await pushSamples(pending);
        setSamplesRaw((cur) => markSynced(cur, pending));
      }
      const { rows, done } = await pullSamples();
      if (rows.length) setSamplesRaw((cur) => trim(mergeRemote(cur, rows), true));
      done();

      const remote = await fetchProfile();
      const local = savedRef.current;
      if (remote && remote.client_updated_at > local.updatedAt) {
        setSavedRaw((p) =>
          p.updatedAt >= remote.client_updated_at ? p : { ...p, ...remote.data, updatedAt: remote.client_updated_at },
        );
        profileSyncedAt.current = remote.client_updated_at;
      } else {
        if (local.updatedAt > (remote?.client_updated_at ?? 0)) await pushProfile(local);
        profileSyncedAt.current = local.updatedAt;
      }
      setSync((s) => ({ ...s, at: Date.now(), error: null }));
    } catch (e) {
      setSync((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
    } finally {
      syncing.current = false;
    }
  };
  const runSyncRef = useRef(runSync);
  runSyncRef.current = runSync;

  useEffect(() => {
    if (!cloud) return;
    cloud.auth.getSession().then(({ data }) => setSync((s) => ({ ...s, email: data.session?.user.email ?? null })));
    const { data } = cloud.auth.onAuthStateChange((_event, session) =>
      setSync((s) => ({ ...s, email: session?.user.email ?? null })),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  // Sync when signed in, when the connection returns, and when the app comes back to the front.
  useEffect(() => {
    if (!signedIn) return;
    const go = () => {
      if (document.visibilityState === "visible") void runSyncRef.current();
    };
    go();
    window.addEventListener("online", go);
    document.addEventListener("visibilitychange", go);
    return () => {
      window.removeEventListener("online", go);
      document.removeEventListener("visibilitychange", go);
    };
  }, [signedIn]);

  // And a few seconds after anything changes here.
  useEffect(() => {
    if (!signedIn) return;
    if (!samples.some((s) => !s.synced) && saved.updatedAt <= profileSyncedAt.current) return;
    const t = setTimeout(() => void runSyncRef.current(), 4000);
    return () => clearTimeout(t);
  }, [signedIn, samples, saved.updatedAt]);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await cloud!.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };
  const signOut = async () => {
    await cloud!.auth.signOut();
    forgetCursor();
    setSync({ email: null, at: null, error: null });
  };

  const mode = saved.mode;
  const setMode = (m: Saved["mode"]) => setSavedRaw((p) => ({ ...p, mode: m }));
  const addSample = (word: string | null, s: Stroke[]): string | null => {
    const sample = newSample(word, s);
    if (sample) setSamples((cur) => [...cur, sample]);
    return sample?.id ?? null;
  };
  const { extraWords, handwritingWords: hwText } = saved.settings;
  const { entries, display } = useMemo(() => buildLexicon(extraWords), [extraWords]);
  const hwWords = useMemo(() => handwritingWords(extraWords, hwText), [extraWords, hwText]);
  const templates = useMemo(() => toTemplates(samples), [samples]);
  const sampleCounts = useMemo(() => counts(samples), [samples]);
  const unlabelled = useMemo(
    () => live(samples).filter((x) => x.word === null).sort((a, b) => b.at - a.at),
    [samples],
  );
  const show = (w: string) => display.get(w) ?? hwWords.find((h) => h.word === w)?.label ?? w;
  const limit = wide ? 4 : 3;

  const suggestions: Scored[] = useMemo(() => {
    if (taps.length) return suggest(taps.map((t) => t.tap), entries, saved.usage, limit);
    // Nothing typed yet: offer family names first, then her most-used words.
    const names = parseExtraWords(extraWords).map((w) => w.toLowerCase());
    const frequent = Object.entries(saved.usage)
      .sort((a, b) => b[1] - a[1])
      .map(([w]) => w);
    return [...new Set([...names, ...frequent])].slice(0, limit).map((word) => ({ word, score: 0, align: [] }));
  }, [taps, entries, saved.usage, extraWords, limit]);

  const guesses = useMemo(() => recognise(strokes, templates, limit), [strokes, templates, limit]);

  const literal = taps.map((t) => t.tap.shown).join("");
  const text = [...words, literal].filter(Boolean).join(" ");

  useEffect(() => {
    textRef.current?.scrollTo({ top: textRef.current.scrollHeight });
  }, [text]);

  const countUse = (word: string) =>
    setSaved((prev) => ({ ...prev, usage: { ...prev.usage, [word]: (prev.usage[word] ?? 0) + 1 } }));

  const pick = (s: Scored) => {
    setSaved((prev) => {
      const touch = { ...prev.touch };
      taps.forEach((t, i) => {
        const j = s.align[i];
        if (j === undefined || j < 0) return;
        const letter = s.word[j];
        if ((t.tap.ll[letter] ?? -Infinity) < LEARN_MIN_LL) return;
        touch[t.cols] = learn(touch[t.cols] ?? {}, letter, t.tap.off[letter]);
      });
      return { ...prev, touch };
    });
    countUse(s.word);
    setWords((w) => [...w, show(s.word)]);
    setTaps([]);
    if (unmatched) {
      // She told us what the scribble was: label it and go back to writing.
      setSamples((cur) => labelSample(cur, unmatched, s.word));
      setUnmatched(null);
      setMode("write");
    }
  };

  const pickGuess = (word: string) => {
    addSample(word, strokes);
    countUse(word);
    setWords((w) => [...w, show(word)]);
    setStrokes([]);
  };

  const noneOfThese = () => {
    // Kept unlabelled; if she does not name it now, family can label it later.
    setUnmatched(addSample(null, strokes));
    setStrokes([]);
    setMode("keys");
  };

  const onSpace = () => {
    if (!taps.length) return;
    setWords((w) => [...w, literal]);
    setTaps([]);
  };

  const onDelete = () => {
    if (taps.length) setTaps((t) => t.slice(0, -1));
    else setWords((w) => w.slice(0, -1));
  };

  const clear = () => {
    if (!text) return;
    setCleared({ words, taps });
    setWords([]);
    setTaps([]);
    setUnmatched(null);
  };

  const undoClear = () => {
    if (!cleared) return;
    setWords(cleared.words);
    setTaps(cleared.taps);
    setCleared(null);
  };

  const switchMode = () => {
    setStrokes([]);
    setUnmatched(null);
    setMode(mode === "keys" ? "write" : "keys");
  };

  // Settings open on a long press only, so a stray tap never opens them.
  const holdTimer = useRef<number | undefined>(undefined);
  const holdStart = () => {
    holdTimer.current = window.setTimeout(() => setSettingsOpen(true), 800);
  };
  const holdEnd = () => window.clearTimeout(holdTimer.current);

  const row =
    mode === "write"
      ? guesses.map((g) => ({ word: g.word, onPick: () => pickGuess(g.word) }))
      : suggestions.map((s) => ({ word: s.word, onPick: () => pick(s) }));

  return (
    <main className="app">
      <div className="text" ref={textRef} aria-live="polite">
        {words.join(" ")}
        {words.length > 0 && literal ? " " : ""}
        {literal && <span className="partial">{literal}</span>}
        {!text && (
          <span className="placeholder">
            {unmatched
              ? "Type the word you wrote"
              : mode === "write"
                ? "Write a word, then pick it"
                : "Tap letters, then pick a word"}
          </span>
        )}
      </div>

      <div className="actions">
        <button
          className="gear"
          aria-label="Settings (press and hold)"
          onPointerDown={holdStart}
          onPointerUp={holdEnd}
          onPointerLeave={holdEnd}
          onContextMenu={(e) => e.preventDefault()}
        >
          ⚙︎
        </button>
        <button className="mode" onClick={switchMode}>
          {mode === "keys" ? "✍️ Write" : "🔤 Keys"}
        </button>
        {cleared ? (
          <button className="clear undo" onClick={undoClear}>
            Undo
          </button>
        ) : (
          <button className="clear" onClick={clear} disabled={!text}>
            Clear
          </button>
        )}
        <button className="speak" onClick={() => speak(text, saved.settings.speechRate)} disabled={!text}>
          🔊 Speak
        </button>
      </div>

      <div className="suggestions" style={{ gridTemplateColumns: `repeat(${limit}, 1fr)` }}>
        {Array.from({ length: limit }, (_, i) => row[i]).map((s, i) =>
          s ? (
            <button key={s.word} className="suggestion" onClick={s.onPick}>
              {show(s.word)}
            </button>
          ) : (
            <div key={`empty-${i}`} className="suggestion empty" />
          ),
        )}
      </div>

      {mode === "write" ? (
        <div className="write">
          <Pad
            strokes={strokes}
            onChange={setStrokes}
            hint={templates.length ? "Write here" : "No handwriting taught yet. Family: hold ⚙︎, then Teach handwriting."}
          />
          <div className="pad-actions">
            <button onClick={() => setStrokes([])} disabled={!strokes.length}>
              Erase
            </button>
            <button onClick={noneOfThese} disabled={!strokes.length}>
              None of these
            </button>
          </div>
        </div>
      ) : (
        <Keyboard
          touch={saved.touch}
          repeatWindowMs={saved.settings.repeatWindowMs}
          onLetter={(tap, cols) => setTaps((t) => [...t, { tap, cols }])}
          onSpace={onSpace}
          onDelete={onDelete}
        />
      )}

      {settingsOpen && (
        <Settings
          saved={saved}
          setSaved={setSaved}
          counts={sampleCounts}
          unlabelled={unlabelled.length}
          hwWords={hwWords}
          storageFull={storageFull}
          cloudConfigured={cloud !== null}
          sync={sync}
          onSignIn={signIn}
          onSignOut={signOut}
          onSyncNow={runSync}
          onTeach={() => {
            setSettingsOpen(false);
            setTeaching(true);
          }}
          onLabel={() => {
            setSettingsOpen(false);
            setLabelling(true);
          }}
          onResetHandwriting={() => setSamples((cur) => deleteSamples(cur, new Set(cur.map((x) => x.id)), signedIn))}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {teaching && (
        <Enrol
          words={hwWords}
          counts={sampleCounts}
          onSave={addSample}
          onClose={() => setTeaching(false)}
        />
      )}
      {labelling && (
        <LabelScribbles
          scribbles={unlabelled}
          onLabel={(id, word) => setSamples((cur) => labelSample(cur, id, word))}
          onDelete={(id) => setSamples((cur) => deleteSamples(cur, new Set([id]), signedIn))}
          onClose={() => setLabelling(false)}
        />
      )}
    </main>
  );
}
