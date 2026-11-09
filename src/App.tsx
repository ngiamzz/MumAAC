import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard } from "./keyboard/Keyboard";
import { suggest, type Scored } from "./keyboard/decoder";
import { learn, type LetterTap } from "./keyboard/touchModel";
import { buildLexicon, parseExtraWords } from "./lexicon";
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
  const [words, setWords] = useState<string[]>([]);
  const [taps, setTaps] = useState<Typed[]>([]);
  const [cleared, setCleared] = useState<{ words: string[]; taps: Typed[] } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wide, setWide] = useState(() => window.innerWidth >= 700);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => save(saved), [saved]);
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

  const { entries, display } = useMemo(() => buildLexicon(saved.settings.extraWords), [saved.settings.extraWords]);
  const show = (w: string) => display.get(w) ?? w;
  const limit = wide ? 4 : 3;

  const suggestions: Scored[] = useMemo(() => {
    if (taps.length) return suggest(taps.map((t) => t.tap), entries, saved.usage, limit);
    // Nothing typed yet: offer family names first, then her most-used words.
    const names = parseExtraWords(saved.settings.extraWords).map((w) => w.toLowerCase());
    const frequent = Object.entries(saved.usage)
      .sort((a, b) => b[1] - a[1])
      .map(([w]) => w);
    return [...new Set([...names, ...frequent])].slice(0, limit).map((word) => ({ word, score: 0, align: [] }));
  }, [taps, entries, saved.usage, saved.settings.extraWords, limit]);

  const literal = taps.map((t) => t.tap.shown).join("");
  const text = [...words, literal].filter(Boolean).join(" ");

  useEffect(() => {
    textRef.current?.scrollTo({ top: textRef.current.scrollHeight });
  }, [text]);

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
      return { ...prev, touch, usage: { ...prev.usage, [s.word]: (prev.usage[s.word] ?? 0) + 1 } };
    });
    setWords((w) => [...w, show(s.word)]);
    setTaps([]);
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
  };

  const undoClear = () => {
    if (!cleared) return;
    setWords(cleared.words);
    setTaps(cleared.taps);
    setCleared(null);
  };

  // Settings open on a long press only, so a stray tap never opens them.
  const holdTimer = useRef<number | undefined>(undefined);
  const holdStart = () => {
    holdTimer.current = window.setTimeout(() => setSettingsOpen(true), 800);
  };
  const holdEnd = () => window.clearTimeout(holdTimer.current);

  return (
    <main className="app">
      <div className="text" ref={textRef} aria-live="polite">
        {words.join(" ")}
        {words.length > 0 && literal ? " " : ""}
        {literal && <span className="partial">{literal}</span>}
        {!text && <span className="placeholder">Tap letters, then pick a word</span>}
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
        {cleared ? (
          <button className="clear undo" onClick={undoClear}>
            Undo clear
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
        {Array.from({ length: limit }, (_, i) => suggestions[i]).map((s, i) =>
          s ? (
            <button key={s.word} className="suggestion" onClick={() => pick(s)}>
              {show(s.word)}
            </button>
          ) : (
            <div key={`empty-${i}`} className="suggestion empty" />
          ),
        )}
      </div>

      <Keyboard
        touch={saved.touch}
        repeatWindowMs={saved.settings.repeatWindowMs}
        onLetter={(tap, cols) => setTaps((t) => [...t, { tap, cols }])}
        onSpace={onSpace}
        onDelete={onDelete}
      />

      {settingsOpen && <Settings saved={saved} setSaved={setSaved} onClose={() => setSettingsOpen(false)} />}
    </main>
  );
}
