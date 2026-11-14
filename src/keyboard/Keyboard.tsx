import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { cellAt, columnsFor, layoutKeys, type KeyRect } from "./layout";
import { isAccidentalRepeat, type Press } from "./repeatFilter";
import { makeTap, type LetterTap, type TouchModel } from "./touchModel";

const GAP = 8;

interface Props {
  touch: Record<string, TouchModel>;
  repeatWindowMs: number;
  onLetter: (tap: LetterTap, cols: number) => void;
  onSpace: () => void;
  onDelete: () => void;
}

/**
 * A–Z keyboard tuned for imprecise aim. The whole board is one touch surface:
 * a press anywhere, gaps included, counts. Letters are resolved by the learned
 * touch model, not by which key's outline the finger hit.
 */
export function Keyboard({ touch, repeatWindowMs, onLetter, onSpace, onDelete }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pressed, setPressed] = useState<string | null>(null);
  const active = useRef<{ id: number; x: number; y: number; key: KeyRect } | null>(null);
  const last = useRef<Press | null>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const keys = useMemo(() => layoutKeys(size.w, size.h, GAP), [size]);
  const cols = columnsFor(size.w, size.h);

  const pos = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: PointerEvent) => {
    e.preventDefault();
    if (active.current) return; // a second finger or palm while one is down: ignore
    const p = pos(e);
    const key = cellAt(keys, p.x, p.y);
    active.current = { id: e.pointerId, ...p, key };
    ref.current!.setPointerCapture?.(e.pointerId);
    setPressed(key.id);
  };

  const up = (e: PointerEvent) => {
    const a = active.current;
    if (!a || a.id !== e.pointerId) return;
    active.current = null;
    setPressed(null);
    const p = pos(e);
    if (Math.hypot(p.x - a.x, p.y - a.y) > a.key.w) return; // a drag, not a tap
    const press: Press = { t: e.timeStamp, x: a.x, y: a.y, keyW: a.key.w };
    const repeat = isAccidentalRepeat(last.current, press, repeatWindowMs);
    last.current = press;
    if (repeat) return;
    if (a.key.id === "space") onSpace();
    else if (a.key.id === "delete") onDelete();
    else onLetter(makeTap(a.x, a.y, keys, touch[cols] ?? {}), cols);
  };

  const cancel = () => {
    active.current = null;
    setPressed(null);
  };

  return (
    <div
      ref={ref}
      className="keyboard"
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {size.w > 0 &&
        keys.map((k) => (
          <div
            key={k.id}
            className={`key key-${k.id.length > 1 ? k.id : "letter"}${pressed === k.id ? " pressed" : ""}`}
            style={{ left: k.x, top: k.y, width: k.w, height: k.h, fontSize: Math.min(k.w, k.h) * 0.55 }}
            aria-label={k.id}
          >
            {k.id === "space" ? "space" : k.id === "delete" ? "⌫" : k.id.toUpperCase()}
          </div>
        ))}
    </div>
  );
}
