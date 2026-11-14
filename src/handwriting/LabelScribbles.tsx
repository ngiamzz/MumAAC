import { useState } from "react";
import type { Stroke } from "./recognise";
import type { Sample } from "./samples";

/** A scribble drawn small, scaled to fit. */
function StrokeView({ strokes }: { strokes: Stroke[] }) {
  const pts = strokes.flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 || 1;
  const h = Math.max(...ys) - y0 || 1;
  const pad = Math.max(w, h) * 0.06;
  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${w + pad * 2} ${h + pad * 2}`} className="scribble">
      {strokes.map((s, i) => (
        <polyline
          key={i}
          points={s.map((p) => `${p[0]},${p[1]}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={Math.max(w, h) / 45}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

interface Props {
  scribbles: Sample[];
  onLabel: (id: string, word: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/** For family: say what her unread scribbles were, so the app learns them. */
export function LabelScribbles({ scribbles, onLabel, onDelete, onClose }: Props) {
  const [text, setText] = useState<Record<string, string>>({});
  return (
    <div className="enrol labelling">
      <header>
        <span>{scribbles.length} unread scribbles</span>
        <button onClick={onClose}>Done</button>
      </header>
      {!scribbles.length && <p className="empty-note">Nothing to label. Scribbles she marks "None of these" appear here.</p>}
      <ul>
        {scribbles.map((s) => {
          const word = (text[s.id] ?? "").trim().toLowerCase();
          const ok = /^[a-z]+$/.test(word);
          return (
            <li key={s.id}>
              <StrokeView strokes={s.strokes} />
              <small>{new Date(s.at).toLocaleString()}</small>
              <div className="label-row">
                <input
                  value={text[s.id] ?? ""}
                  onChange={(e) => setText((t) => ({ ...t, [s.id]: e.target.value }))}
                  placeholder="What was this word?"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <button className="primary" disabled={!ok} onClick={() => onLabel(s.id, word)}>
                  Save
                </button>
                <button className="danger" onClick={() => onDelete(s.id)}>
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
