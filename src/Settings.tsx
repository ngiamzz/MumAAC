import { useState, type Dispatch, type SetStateAction } from "react";
import type { SyncStatus } from "./App";
import { speak } from "./speech";
import { TARGET } from "./handwriting/Enrol";
import type { Saved, Settings as SettingsT } from "./store";

interface Props {
  saved: Saved;
  setSaved: Dispatch<SetStateAction<Saved>>;
  counts: Record<string, number>;
  unlabelled: number;
  hwWords: { word: string; label: string }[];
  storageFull: boolean;
  cloudConfigured: boolean;
  sync: SyncStatus;
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignOut: () => void;
  onSyncNow: () => void;
  onTeach: () => void;
  onLabel: () => void;
  onResetHandwriting: () => void;
  onClose: () => void;
}

/** For family, not for Mum: opened by pressing and holding the gear. */
export function Settings(props: Props) {
  const { saved, setSaved, counts, unlabelled, hwWords, storageFull, sync, onTeach, onLabel, onResetHandwriting, onClose } = props;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = saved.settings;
  const set = (patch: Partial<SettingsT>) => setSaved((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const learnedTaps = Object.values(saved.touch)
    .flatMap((m) => Object.values(m))
    .reduce((n, k) => n + k.n, 0);
  const taught = hwWords.filter((w) => (counts[w.word] ?? 0) >= TARGET).length;
  const sampleCount = Object.values(counts).reduce((n, c) => n + c, 0);

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
          <button type="button" className="secondary" onClick={onLabel}>
            Label unread scribbles ({unlabelled})
          </button>
          <button
            type="button"
            className="secondary danger"
            onClick={() => {
              if (
                confirm(
                  sync.email
                    ? "Delete all of her handwriting samples, on every device and in the cloud backup?"
                    : "Delete all of her handwriting samples?",
                )
              )
                onResetHandwriting();
            }}
          >
            Reset handwriting
          </button>
        </div>

        <div className="learned">
          <span>
            <b>Cloud backup</b>
          </span>
          {!props.cloudConfigured ? (
            <small>Not set up for this app yet. Everything is stored on this device only.</small>
          ) : sync.email ? (
            <>
              <span>
                Signed in as {sync.email}.{" "}
                {sync.error ? (
                  <span className="danger">Last sync failed: {sync.error}</span>
                ) : sync.at ? (
                  `Last synced ${new Date(sync.at).toLocaleTimeString()}.`
                ) : (
                  "Not synced yet."
                )}
              </span>
              <button type="button" className="secondary" onClick={props.onSyncNow}>
                Sync now
              </button>
              <button type="button" className="secondary" onClick={props.onSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <small>Sign in with the family login to back up and share her data across devices.</small>
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {signInError && <span className="danger">{signInError}</span>}
              <button
                type="button"
                className="secondary primary"
                disabled={busy || !email || !password}
                onClick={async () => {
                  setBusy(true);
                  setSignInError(await props.onSignIn(email.trim(), password));
                  setBusy(false);
                }}
              >
                Sign in
              </button>
            </>
          )}
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
