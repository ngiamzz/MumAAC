import type { Dispatch, SetStateAction } from "react";
import { speak } from "./speech";
import { TARGET } from "./handwriting/Enrol";
import type { Samples } from "./handwriting/samples";
import type { Saved, Settings as SettingsT } from "./store";

interface Props {
  saved: Saved;
  setSaved: Dispatch<SetStateAction<Saved>>;
  samples: Samples;
  hwWords: { word: string; label: string }[];
  storageFull: boolean;
  onTeach: () => void;
  onResetHandwriting: () => void;
  onClose: () => void;
}

/** For family, not for Mum: opened by pressing and holding the gear. */
export function Settings({ saved, setSaved, samples, hwWords, storageFull, onTeach, onResetHandwriting, onClose }: Props) {
  const s = saved.settings;
  const set = (patch: Partial<SettingsT>) => setSaved((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const learnedTaps = Object.values(saved.touch)
    .flatMap((m) => Object.values(m))
    .reduce((n, k) => n + k.n, 0);
  const taught = hwWords.filter((w) => (samples[w.word]?.length ?? 0) >= TARGET).length;
  const sampleCount = Object.values(samples).reduce((n, l) => n + l.length, 0);

  return (
    <div className="settings-backdrop">
      <section className="settings" role="dialog" aria-label="Settings">
        <header>
          <h2>Settings</h2>
          <button onClick={onClose}>Done</button>
        </header>

        <label>
          <span>
            Ignore repeat taps within <b>{s.repeatWindowMs} ms</b>
          </span>
          <input
            type="range"
            min={150}
            max={900}
            step={50}
            value={s.repeatWindowMs}
            onChange={(e) => set({ repeatWindowMs: Number(e.target.value) })}
          />
          <small>Raise this if one tap still types a letter twice.</small>
        </label>

        <label>
          <span>
            Speaking speed <b>{s.speechRate.toFixed(2)}×</b>
          </span>
          <input
            type="range"
            min={0.5}
            max={1.3}
            step={0.05}
            value={s.speechRate}
            onChange={(e) => set({ speechRate: Number(e.target.value) })}
          />
          <button type="button" className="secondary" onClick={() => speak("Hello, this is my voice.", s.speechRate)}>
            Test voice
          </button>
        </label>

        <label>
          <span>Family names and extra words</span>
          <textarea
            rows={4}
            value={s.extraWords}
            onChange={(e) => set({ extraWords: e.target.value })}
            placeholder="Separate with commas"
          />
          <small>Letters only. These show first before she types.</small>
        </label>

        <label>
          <span>Words she writes by hand</span>
          <textarea
            rows={4}
            value={s.handwritingWords}
            onChange={(e) => set({ handwritingWords: e.target.value })}
            placeholder="Separate with commas"
          />
          <small>Taught together with the family names above. Single words, letters only.</small>
        </label>

        <div className="learned">
          <span>
            Handwriting: <b>{taught}</b> of <b>{hwWords.length}</b> words taught, <b>{sampleCount}</b> samples saved.
          </span>
          {storageFull && <span className="danger">This device's storage is full: new samples are not being saved.</span>}
          <button type="button" className="secondary primary" onClick={onTeach}>
            Teach handwriting
          </button>
          <button
            type="button"
            className="secondary danger"
            onClick={() => {
              if (confirm("Delete all of her handwriting samples?")) onResetHandwriting();
            }}
          >
            Reset handwriting
          </button>
        </div>

        <div className="learned">
          <span>
            Keyboard: learned from <b>{learnedTaps}</b> taps and <b>{Object.keys(saved.usage).length}</b> words.
          </span>
          <button
            type="button"
            className="secondary danger"
            onClick={() => {
              if (confirm("Forget how she taps and which words she uses?"))
                setSaved((p) => ({ ...p, touch: {}, usage: {} }));
            }}
          >
            Reset keyboard learning
          </button>
        </div>
      </section>
    </div>
  );
}
