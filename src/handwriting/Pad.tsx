import { useLayoutEffect, useRef, type PointerEvent } from "react";
import type { Point, Stroke } from "./recognise";

interface Props {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  hint: string;
}

const MIN_MOVE = 2; // px between recorded points

/** A writing surface. One finger at a time; a second finger or palm is ignored. */
export function Pad({ strokes, onChange, hint }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useRef<{ id: number; pts: Stroke } | null>(null);
  const t0 = useRef(0);

  const ctx = () => {
    const c = canvas.current!;
    const g = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineWidth = Math.max(5, Math.min(c.clientWidth, c.clientHeight) / 45);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = g.fillStyle = "#1d1b18";
    return g;
  };

  const redraw = () => {
    const c = canvas.current!;
    const g = ctx();
    g.clearRect(0, 0, c.clientWidth, c.clientHeight);
    for (const s of strokes) {
      if (s.length === 1) {
        g.beginPath();
        g.arc(s[0][0], s[0][1], g.lineWidth / 2, 0, Math.PI * 2);
        g.fill();
        continue;
      }
      g.beginPath();
      g.moveTo(s[0][0], s[0][1]);
      for (const p of s) g.lineTo(p[0], p[1]);
      g.stroke();
    }
  };

  useLayoutEffect(() => {
    const c = canvas.current!;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  });

  const point = (e: PointerEvent): Point => {
    const r = canvas.current!.getBoundingClientRect();
    return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top), Math.round(e.timeStamp - t0.current)];
  };

  const down = (e: PointerEvent) => {
    e.preventDefault();
    if (active.current) return;
    if (!strokes.length) t0.current = e.timeStamp;
    active.current = { id: e.pointerId, pts: [point(e)] };
    canvas.current!.setPointerCapture?.(e.pointerId);
  };

  const move = (e: PointerEvent) => {
    const a = active.current;
    if (!a || a.id !== e.pointerId) return;
    const p = point(e);
    const q = a.pts[a.pts.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) < MIN_MOVE) return;
    a.pts.push(p);
    const g = ctx();
    g.beginPath();
    g.moveTo(q[0], q[1]);
    g.lineTo(p[0], p[1]);
    g.stroke();
  };

  const up = (e: PointerEvent) => {
    const a = active.current;
    if (!a || a.id !== e.pointerId) return;
    active.current = null;
    onChange([...strokes, a.pts]);
  };

  return (
    <div className="pad">
      <canvas
        ref={canvas}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onContextMenu={(e) => e.preventDefault()}
      />
      {!strokes.length && <div className="pad-hint">{hint}</div>}
    </div>
  );
}
