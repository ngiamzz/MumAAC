import { useMemo, useState } from "react";
import { Pad } from "./Pad";
import type { Stroke } from "./recognise";
import type { Samples } from "./samples";

interface Props {
  words: { word: string; label: string }[];
  samples: Samples;
  onSave: (word: string, strokes: Stroke[]) => void;
  onClose: () => void;
}

export const TARGET = 3; // samples of each word before it is considered taught

/** Family sits with Mum: the screen shows a word, she writes it, family saves. */
export function Enrol({ words, samples, onSave, onClose }: Props) {
  // Words with the fewest samples come first; the order is fixed when the screen opens.
  const queue = useMemo(
    () => [...words].sort((a, b) => (samples[a.word]?.length ?? 0) - (samples[b.word]?.length ?? 0)),
    [words],
  );
  const [i, setI] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  if (!queue.length)
    return (
      <div className="enrol">
        <header>
          <span>Add some words in Settings first.</span>
          <button onClick={onClose}>Done</button>
        </header>
      </div>
    );

  const cur = queue[i % queue.length];
  const have = samples[cur.word]?.length ?? 0;
  const taught = words.filter((w) => (samples[w.word]?.length ?? 0) >= TARGET).length;
  const next = () => {
    setStrokes([]);
    setI((n) => n + 1);
  };

  return (
    <div className="enrol">
      <header>
        <span>
          {taught} of {words.length} words taught
        </span>
        <button onClick={onClose}>Done</button>
      </header>
      <div className="enrol-word">
        <small>Write this word</small>
        <b>{cur.label}</b>
        <small>
          {have} saved{have < TARGET ? `, ${TARGET - have} more to go` : ""}
        </small>
      </div>
      <Pad strokes={strokes} onChange={setStrokes} hint="Write here" />
      <div className="pad-actions">
        <button onClick={() => setStrokes([])} disabled={!strokes.length}>
          Erase
        </button>
        <button onClick={next}>Skip</button>
        <button
          className="primary"
          disabled={!strokes.length}
          onClick={() => {
            onSave(cur.word, strokes);
            next();
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
