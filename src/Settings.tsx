import type { Dispatch, SetStateAction } from "react";
import { speak } from "./speech";
import type { Saved, Settings as SettingsT } from "./store";

interface Props {
  saved: Saved;
  setSaved: Dispatch<SetStateAction<Saved>>;
  onClose: () => void;
}

/** For family, not for Mum: opened by pressing and holding the gear. */
export function Settings({ saved, setSaved, onClose }: Props) {
  const s = saved.settings;
  const set = (patch: Partial<SettingsT>) => setSaved((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const learnedTaps = Object.values(saved.touch)
    .flatMap((m) => Object.values(m))
    .reduce((n, k) => n + k.n, 0);

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

        <div className="learned">
          <span>
            Learned from <b>{learnedTaps}</b> taps and <b>{Object.keys(saved.usage).length}</b> words.
          </span>
          <button
            type="button"
            className="secondary danger"
            onClick={() => {
              if (confirm("Forget how she taps and which words she uses?"))
                setSaved((p) => ({ ...p, touch: {}, usage: {} }));
            }}
          >
            Reset learning
          </button>
        </div>
      </section>
    </div>
  );
}
