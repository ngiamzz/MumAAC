import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard } from "./keyboard/Keyboard";
import { suggest, type Scored } from "./keyboard/decoder";
import { learn, type LetterTap } from "./keyboard/touchModel";
import { Enrol } from "./handwriting/Enrol";
import { Pad } from "./handwriting/Pad";
import { recognise, type Stroke } from "./handwriting/recognise";
import { addSample, loadSamples, saveSamples, toTemplates, type Samples } from "./handwriting/samples";
import { buildLexicon, handwritingWords, parseExtraWords } from "./lexicon";
import { speak } from "./speech";
import { load, save, type Saved } from "./store";
import { Settings } from "./Settings";

interface Typed {
  tap: LetterTap;
  cols: number;
}

const LEARN_MIN_LL = -6; // ignore taps too far from the letter to be informative

export default function App() {
  const [saved, setSaved] = useState<Saved>(load);
  const [samples, setSamples] = useState<Samples>(loadSamples);
  const [storageFull, setStorageFull] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const [taps, setTaps] = useState<Typed[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  // A scribble none of the guesses matched: the next word she picks on the keyboard labels it.
  const [unmatched, setUnmatched] = useState<Stroke[] | null>(null);
  const [cleared, setCleared] = useState<{ words: string[]; taps: Typed[] } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teaching, setTeaching] = useState(false);
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

  const mode = saved.mode;
  const setMode = (m: Saved["mode"]) => setSaved((p) => ({ ...p, mode: m }));
  const { extraWords, handwritingWords: hwText } = saved.settings;
  const { entries, display } = useMemo(() => buildLexicon(extraWords), [extraWords]);
  const hwWords = useMemo(() => handwritingWords(extraWords, hwText), [extraWords, hwText]);
  const templates = useMemo(() => toTemplates(samples), [samples]);
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
      // She told us what the scribble was: keep it as a sample and go back to writing.
      setSamples((p) => addSample(p, s.word, unmatched));
      setUnmatched(null);
      setMode("write");
    }
  };

  const pickGuess = (word: string) => {
    setSamples((p) => addSample(p, word, strokes));
    countUse(word);
    setWords((w) => [...w, show(word)]);
    setStrokes([]);
  };

  const noneOfThese = () => {
    setUnmatched(strokes);
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
          samples={samples}
          hwWords={hwWords}
          storageFull={storageFull}
          onTeach={() => {
            setSettingsOpen(false);
            setTeaching(true);
          }}
          onResetHandwriting={() => setSamples({})}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {teaching && (
        <Enrol
          words={hwWords}
          samples={samples}
          onSave={(word, s) => setSamples((p) => addSample(p, word, s))}
          onClose={() => setTeaching(false)}
        />
      )}
    </main>
  );
}
