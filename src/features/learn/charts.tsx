"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/* ------------------------------------------------------------------ */
/* Simulated prices. Nothing here is real market data.                 */
/* ------------------------------------------------------------------ */

/** Small seeded generator, so a chart is identical on the server and in the browser. */
export function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random walk of `length` prices starting at `start`. */
export function walk(seed: number, length: number, start: number, swing: number, drift = 0) {
  const random = seeded(seed);
  const out = [start];
  for (let i = 1; i < length; i++) out.push(Math.max(1, out[i - 1] + (random() + random() - 1) * swing + drift));
  return out;
}

export type Candle = { open: number; high: number; low: number; close: number };

export function candles(seed: number, length: number, start: number, swing: number, drift = 0): Candle[] {
  const random = seeded(seed);
  const out: Candle[] = [];
  let open = start;
  for (let i = 0; i < length; i++) {
    const close = Math.max(1, open + (random() + random() - 1) * swing + drift);
    const high = Math.max(open, close) + random() * swing * 0.55;
    const low = Math.min(open, close) - random() * swing * 0.55;
    out.push({ open: round(open), high: round(high), low: round(low), close: round(close) });
    open = round(close);
  }
  return out;
}

const round = (value: number) => Math.round(value);

/** The next step of a live walk. Called from timers, never during render. */
export const nudge = (price: number, swing: number, drift = 0, anchor?: number) =>
  Math.max(1, price + (Math.random() + Math.random() - 1) * swing + drift + (anchor === undefined ? 0 : (anchor - price) * 0.04));

/* ------------------------------------------------------------------ */
/* Measuring                                                           */
/* ------------------------------------------------------------------ */

export function useWidth(element: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = element.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [element]);
  return width;
}

const nice = (min: number, max: number, lines: number) => {
  const span = Math.max(1e-6, max - min);
  const raw = span / lines;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const from = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = from; v <= max + step * 0.01; v += step) if (v >= min - step * 0.01) out.push(Number(v.toFixed(6)));
  return out;
};

const AXIS = 44;
const TAG = 54;

/* ------------------------------------------------------------------ */
/* Line chart                                                          */
/* ------------------------------------------------------------------ */

export type Level = { value: number; label: string; tone?: "gold" | "up" | "down" | "cyan" };

export function LineChart({
  data,
  height = 220,
  min,
  max,
  levels = [],
  tone = "cyan",
  tag = true,
  prefix = "₹",
  marks = [],
  onPick,
  label,
}: {
  data: number[];
  height?: number;
  min?: number;
  max?: number;
  levels?: Level[];
  tone?: "cyan" | "up" | "down" | "gold" | "purple";
  tag?: boolean;
  prefix?: string;
  /** Indices to mark on the line, with a short label. */
  marks?: { index: number; label: string; tone?: "gold" | "up" | "down" }[];
  onPick?: (index: number) => void;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const [hover, setHover] = useState<number | null>(null);

  const values = [...data, ...levels.map((level) => level.value)];
  const low = min ?? Math.min(...values);
  const high = max ?? Math.max(...values);
  const pad = (high - low || 1) * 0.12;
  const bottom = min ?? low - pad;
  const top = max ?? high + pad;

  const left = AXIS;
  const right = Math.max(left + 10, width - (tag ? TAG : 10));
  const y = (value: number) => 10 + ((top - value) / (top - bottom)) * (height - 30);
  const x = (index: number) => left + (index / Math.max(1, data.length - 1)) * (right - left);
  const path = data.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join("");
  const last = data[data.length - 1];

  const indexAt = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return 0;
    const ratio = (clientX - rect.left - left) / (right - left);
    return Math.round(Math.min(1, Math.max(0, ratio)) * (data.length - 1));
  };

  return (
    <div className="chart" ref={box} style={{ height }} data-tone={tone} data-pick={Boolean(onPick)}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          onPointerMove={onPick ? (event) => setHover(indexAt(event.clientX)) : undefined}
          onPointerLeave={onPick ? () => setHover(null) : undefined}
          onClick={onPick ? (event) => onPick(indexAt(event.clientX)) : undefined}
        >
          {nice(bottom, top, 4).map((value) => (
            <g key={value}>
              <line className="chart-grid" x1={left} x2={right} y1={y(value)} y2={y(value)} />
              <text className="chart-axis" x={left - 8} y={y(value) + 4} textAnchor="end">
                {value}
              </text>
            </g>
          ))}
          <path className="chart-area" d={`${path}L${right} ${height - 20}L${left} ${height - 20}Z`} />
          <path className="chart-line" d={path} />
          {levels.map((level) => (
            <g key={level.label} data-tone={level.tone ?? "gold"} className="chart-level">
              <line x1={left} x2={right} y1={y(level.value)} y2={y(level.value)} />
              <text x={left + 6} y={y(level.value) - 5}>
                {level.label}
              </text>
            </g>
          ))}
          {marks.map((mark) => (
            <g key={mark.label} className="chart-mark" data-tone={mark.tone ?? "gold"}>
              <line x1={x(mark.index)} x2={x(mark.index)} y1={10} y2={height - 20} />
              <rect x={x(mark.index) - 4} y={y(data[mark.index]) - 4} width={8} height={8} />
              <text x={x(mark.index)} y={height - 5} textAnchor="middle">
                {mark.label}
              </text>
            </g>
          ))}
          {hover !== null ? (
            <g className="chart-hover">
              <line x1={x(hover)} x2={x(hover)} y1={10} y2={height - 20} />
              <rect x={x(hover) - 3} y={y(data[hover]) - 3} width={6} height={6} />
            </g>
          ) : null}
          {tag ? (
            <g className="chart-tag" transform={`translate(${right + 6} ${y(last)})`}>
              <rect x={0} y={-11} width={TAG - 10} height={22} />
              <text x={(TAG - 10) / 2} y={4} textAnchor="middle">
                {prefix}
                {last.toFixed(last < 100 && prefix !== "₹" ? 2 : 0)}
              </text>
            </g>
          ) : null}
          <rect className="chart-dot" x={x(data.length - 1) - 3} y={y(last) - 3} width={6} height={6} />
        </svg>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Candlestick chart                                                   */
/* ------------------------------------------------------------------ */

export function CandleChart({
  data,
  height = 260,
  selected,
  onSelect,
  marks = [],
  label,
}: {
  data: Candle[];
  height?: number;
  selected?: number | null;
  onSelect?: (index: number) => void;
  marks?: { index: number; label: string; tone?: "gold" | "up" | "down" }[];
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);

  const top0 = Math.max(...data.map((c) => c.high));
  const bottom0 = Math.min(...data.map((c) => c.low));
  const pad = (top0 - bottom0) * 0.1;
  const top = top0 + pad;
  const bottom = bottom0 - pad;

  const left = AXIS;
  const right = Math.max(left + 10, width - 10);
  const pitch = (right - left) / data.length;
  const body = Math.max(3, Math.min(18, Math.floor(pitch * 0.62)));
  const y = (value: number) => 10 + ((top - value) / (top - bottom)) * (height - 34);
  const cx = (index: number) => left + pitch * (index + 0.5);

  const indexAt = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.min(data.length - 1, Math.max(0, Math.floor((clientX - rect.left - left) / pitch)));
  };

  return (
    <div className="chart" ref={box} style={{ height }} data-pick={Boolean(onSelect)}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          onPointerMove={onSelect ? (event) => event.pointerType === "mouse" && onSelect(indexAt(event.clientX)) : undefined}
          onPointerDown={onSelect ? (event) => onSelect(indexAt(event.clientX)) : undefined}
        >
          {nice(bottom, top, 4).map((value) => (
            <g key={value}>
              <line className="chart-grid" x1={left} x2={right} y1={y(value)} y2={y(value)} />
              <text className="chart-axis" x={left - 8} y={y(value) + 4} textAnchor="end">
                {value}
              </text>
            </g>
          ))}
          {selected !== null && selected !== undefined ? (
            <rect className="candle-focus" x={cx(selected) - pitch / 2} y={6} width={pitch} height={height - 26} />
          ) : null}
          {data.map((candle, index) => {
            const rising = candle.close >= candle.open;
            const from = y(Math.max(candle.open, candle.close));
            const to = y(Math.min(candle.open, candle.close));
            return (
              <g key={index} className="candle" data-tone={rising ? "up" : "down"} data-on={selected === index}>
                <rect x={cx(index) - 1} y={y(candle.high)} width={2} height={Math.max(1, y(candle.low) - y(candle.high))} />
                <rect x={cx(index) - body / 2} y={from} width={body} height={Math.max(2, to - from)} />
              </g>
            );
          })}
          {marks.map((mark) => (
            <g key={mark.label} className="chart-mark" data-tone={mark.tone ?? "gold"}>
              <text x={cx(mark.index)} y={height - 5} textAnchor="middle">
                {mark.label}
              </text>
              <rect x={cx(mark.index) - 3} y={height - 22} width={6} height={3} />
            </g>
          ))}
        </svg>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A live price                                                        */
/* ------------------------------------------------------------------ */

/**
 * A price series that keeps moving while `running` is true. `swing`, `drift`
 * and `anchor` are read fresh on every tick, so controls can steer the market
 * while it runs.
 */
export function useLive(initial: number[], settings: { running: boolean; swing: number; drift?: number; anchor?: number; every?: number; keep?: number }) {
  const [series, setSeries] = useState(initial);
  const live = useRef(settings);
  useEffect(() => {
    live.current = settings;
  });
  const { running, every = 420 } = settings;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const { swing, drift = 0, anchor, keep = initial.length } = live.current;
      setSeries((now) => [...now.slice(-(keep - 1)), nudge(now[now.length - 1], swing, drift, anchor)]);
    }, every);
    return () => window.clearInterval(timer);
  }, [running, every, initial.length]);
  return [series, setSeries] as const;
}
