"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { price2, rupees, signedPercent, tone, useWidth } from "./ui";

export type Bar = { open: number; high: number; low: number; close: number };

/** Round, even price steps (1, 2, 2.5 or 5 × a power of ten) with the range widened to whole steps, so ticks read as 262.00, 263.00 rather than 262.17, 263.43. */
function niceScale(low: number, high: number, target = 5) {
  const span = high - low || Math.max(Math.abs(high) * 0.01, 0.05);
  const raw = span / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((value) => value >= raw) ?? 10 * magnitude;
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = min; value <= max + step / 2; value += step) ticks.push(Math.round(value * 100) / 100);
  return { min, max: max > min ? max : min + step, ticks };
}

/**
 * A candlestick chart drawn at its real pixel size, so lines and labels stay
 * sharp, and with no frame: the plot is the surface. Prices sit on round
 * ticks on the right; the last close is marked across the plot and tagged on
 * the axis (the price an order is quoted at now). Pointing at the chart, or
 * stepping through it with the arrow keys once it has focus, draws a
 * crosshair whose price and time are tagged on the axes, and the candle's
 * open, high, low and close are written in the legend line along the top
 * edge, so no readout ever covers a candle.
 */
export function CandleChart({
  candles,
  height = 320,
  highlight,
  readout = true,
  label,
  stampFor,
  tickFor,
  axis,
}: {
  candles: Bar[];
  /** Height of the whole chart, axes included. */
  height?: number;
  /** Index of a candle to pick out; the others are dimmed. */
  highlight?: number | null;
  /** Whether the crosshair and the legend's values are offered. */
  readout?: boolean;
  label: string;
  /** The full time of a candle, for the legend ("Day 5,853, 21:35"). */
  stampFor?: (index: number) => string;
  /** A short time for the axis ("21:35"); with it, the axis is labelled every few candles. */
  tickFor?: (index: number) => string;
  /** Fixed labels under the chart, spread evenly (the tutorial's "Earlier … Later"). */
  axis?: string[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const [at, setAt] = useState<number | null>(null);
  const [pointerY, setPointerY] = useState<number | null>(null);

  if (!candles.length) {
    return (
      <figure className="sim-chart">
        <div className="sim-chart-box sim-chart-empty" style={{ height }} role="img" aria-label={label}>
          <p>Price history isn&apos;t available right now.</p>
        </div>
      </figure>
    );
  }

  const gutter = 64;
  // A narrow chart lets its legend wrap onto a second line, so the band above the candles is taller.
  const legendBand = readout ? (width && width < 560 ? 48 : 30) : 8;
  const axisBand = tickFor || axis ? 24 : 0;
  const plot = Math.max(0, width - gutter);
  const plotBottom = height - axisBand;
  const scale = niceScale(Math.min(...candles.map((candle) => candle.low)), Math.max(...candles.map((candle) => candle.high)));
  const y = (value: number) => legendBand + ((scale.max - value) / (scale.max - scale.min)) * (plotBottom - legendBand - 6);
  const step = plot / candles.length;
  const body = Math.max(3, Math.min(14, step * 0.6));
  const middleOf = (index: number) => Math.round(index * step + step / 2) + 0.5;
  const last = candles.length - 1;

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    if (!readout || !plot) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = Math.floor(((event.clientX - bounds.left) / plot) * candles.length);
    setAt(index >= 0 && index < candles.length ? index : null);
    // A mouse places the horizontal line where it is; a finger or the keyboard puts it on the candle's close.
    const top = event.clientY - bounds.top;
    setPointerY(event.pointerType === "mouse" && top >= legendBand && top <= plotBottom ? top : null);
  };
  /** Arrow keys step through the candles; Home and End jump; Escape clears. Instant: a keyboard readout never animates. */
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!readout) return;
    const next =
      event.key === "ArrowLeft"
        ? Math.max(0, (at ?? last + 1) - 1)
        : event.key === "ArrowRight"
          ? Math.min(last, (at ?? -1) + 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : event.key === "Escape"
                ? null
                : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setPointerY(null);
    setAt(next);
  };

  const close = candles[last].close;
  const closeY = Math.round(y(close)) + 0.5;
  // The legend describes the pointed candle, or the one still forming.
  const shownIndex = at ?? last;
  const shown = candles[shownIndex];
  const reference = shownIndex > 0 ? candles[shownIndex - 1].close : shown.open;
  const move = reference ? ((shown.close - reference) / reference) * 100 : 0;
  const hairY = at === null ? null : pointerY !== null ? Math.round(pointerY) + 0.5 : Math.round(y(shown.close)) + 0.5;
  const hairValue = hairY === null ? null : scale.max - ((hairY - legendBand) / (plotBottom - legendBand - 6)) * (scale.max - scale.min);
  // Axis times every few candles, counted back from the newest so the step lands on the end, never closer than 64px apart.
  const every = Math.max(1, Math.ceil(candles.length / 5), step > 0 ? Math.ceil(64 / step) : 1);
  const ticks = tickFor ? candles.map((_, index) => index).filter((index) => (last - index) % every === 0) : [];

  return (
    <figure className="sim-chart" data-reading={at !== null || undefined}>
      <div
        className="sim-chart-box"
        ref={box}
        style={{ height }}
        onPointerMove={follow}
        onPointerDown={follow}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setAt(null);
        }}
        onKeyDown={keys}
        onBlur={() => setAt(null)}
        tabIndex={readout ? 0 : undefined}
        role="img"
        aria-label={`${label}. Last price ${rupees(close)}.${readout ? " Use the arrow keys to read each candle." : ""}`}
      >
        {readout ? (
          <p className="sim-chart-legend" aria-hidden="true">
            {stampFor && !(width && width < 420) ? <span className="sim-chart-when">{at === null ? `${stampFor(last)}, forming` : stampFor(at)}</span> : null}
            <span>
              O <b>{price2(shown.open)}</b>
            </span>
            <span>
              H <b>{price2(shown.high)}</b>
            </span>
            <span>
              L <b>{price2(shown.low)}</b>
            </span>
            <span>
              C <b>{price2(shown.close)}</b>
            </span>
            <b data-tone={tone(move)}>{signedPercent(move)}</b>
          </p>
        ) : null}
        {width ? (
          <svg width={width} height={height} aria-hidden="true">
            {scale.ticks.map((value) => {
              const lineY = Math.round(y(value)) + 0.5;
              if (lineY < legendBand - 4 || lineY > plotBottom) return null;
              return (
                <g key={value}>
                  <line className="sim-chart-rung" x1={0} x2={plot} y1={lineY} y2={lineY} />
                  {Math.abs(lineY - closeY) > 20 && (hairY === null || Math.abs(lineY - hairY) > 20) ? (
                    <text className="sim-chart-price" x={plot + 10} y={lineY + 4}>
                      {price2(value)}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {candles.map((candle, index) => {
              const middle = middleOf(index);
              const top = y(Math.max(candle.open, candle.close));
              const bottom = y(Math.min(candle.open, candle.close));
              const dim = highlight !== undefined && highlight !== null && highlight !== index;
              return (
                <g key={index} className="sim-candle" data-up={candle.close >= candle.open} data-dim={dim} data-pick={highlight === index} data-at={at === index || undefined}>
                  <line x1={middle} x2={middle} y1={Math.round(y(candle.high))} y2={Math.round(y(candle.low))} />
                  <rect x={Math.round(middle - body / 2)} width={Math.round(body)} y={Math.round(top)} height={Math.max(1, Math.round(bottom - top))} />
                </g>
              );
            })}
            {highlight !== undefined && highlight !== null ? (
              <rect className="sim-chart-pick" x={Math.round(highlight * step + 1) + 0.5} y={legendBand - 6.5} width={Math.round(step - 2)} height={plotBottom - legendBand + 6} />
            ) : null}
            {/* The last close: the price an order would be quoted at now. */}
            <line className="sim-chart-now" x1={0} x2={plot} y1={closeY} y2={closeY} />
            <g className="sim-chart-tag" transform={`translate(${plot + 2}, ${closeY})`}>
              <rect x={0} y={-10} width={gutter - 4} height={20} />
              <text x={8} y={4}>
                {price2(close)}
              </text>
            </g>
            {at !== null ? (
              <g className="sim-chart-hair">
                <line x1={middleOf(at)} x2={middleOf(at)} y1={legendBand - 6} y2={plotBottom} />
                {hairY !== null ? <line x1={0} x2={plot} y1={hairY} y2={hairY} /> : null}
                {hairY !== null && hairValue !== null ? (
                  <g className="sim-chart-hair-tag" transform={`translate(${plot + 2}, ${hairY})`}>
                    <rect x={0} y={-10} width={gutter - 4} height={20} />
                    <text x={8} y={4}>
                      {price2(hairValue)}
                    </text>
                  </g>
                ) : null}
                {tickFor ? (
                  <g className="sim-chart-hair-tag" transform={`translate(${Math.min(Math.max(middleOf(at), 34), plot - 34)}, ${plotBottom + 12})`}>
                    <rect x={-34} y={-10} width={68} height={20} />
                    <text x={0} y={4} textAnchor="middle">
                      {tickFor(at)}
                    </text>
                  </g>
                ) : null}
              </g>
            ) : null}
            {tickFor
              ? ticks.map((index) => (
                  <text
                    key={index}
                    className="sim-chart-time"
                    x={Math.min(Math.max(middleOf(index), 22), plot - 22)}
                    y={plotBottom + 16}
                    textAnchor="middle"
                    data-hidden={at !== null && Math.abs(index - at) * step < 70 ? true : undefined}
                  >
                    {tickFor(index)}
                  </text>
                ))
              : null}
            {axis && !tickFor
              ? axis.map((tick, index) =>
                  tick ? (
                    <text key={`${tick}-${index}`} className="sim-chart-time" x={axis.length > 1 ? (index / (axis.length - 1)) * (plot - 44) + 22 : plot / 2} y={plotBottom + 16} textAnchor="middle">
                      {tick}
                    </text>
                  ) : null,
                )
              : null}
          </svg>
        ) : null}
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* One large candle, labelled: the tutorial's anatomy lesson            */
/* ------------------------------------------------------------------ */

export type Part = "open" | "close" | "high" | "low";

/**
 * A single candle drawn large, with leader lines from each label to the exact
 * point it names: High to the top of the upper wick, Low to the bottom of the
 * lower wick, Open and Close to the edges of the body (bottom and top for a
 * green candle; top and bottom for a red one).
 */
export function Anatomy({
  bar,
  focus = "all",
  show,
  scale,
  caption,
}: {
  bar: Bar;
  /** Which part is lit; the rest is dimmed. */
  focus?: "all" | "body" | "upper" | "lower";
  /** Which labels to draw. */
  show: Part[];
  /** Price range for the vertical scale, so two candles can share one. */
  scale?: { low: number; high: number };
  caption?: string;
}) {
  const W = 360;
  const H = 340;
  const top = 26;
  const bottom = H - 26;
  const low = scale?.low ?? bar.low - (bar.high - bar.low) * 0.12;
  const high = scale?.high ?? bar.high + (bar.high - bar.low) * 0.12;
  const y = (value: number) => top + ((high - value) / (high - low)) * (bottom - top);
  const up = bar.close >= bar.open;
  const cx = 120;
  const half = 26;
  const bodyTop = y(Math.max(bar.open, bar.close));
  const bodyBottom = y(Math.min(bar.open, bar.close));

  const points: Record<Part, { x: number; y: number }> = {
    high: { x: cx, y: y(bar.high) },
    low: { x: cx, y: y(bar.low) },
    open: { x: cx + half, y: y(bar.open) },
    close: { x: cx + half, y: y(bar.close) },
  };
  // Labels stack down the right-hand side in price order, never overlapping.
  const order = (["high", "close", "open", "low"] as Part[]).filter((part) => show.includes(part)).sort((a, b) => points[a].y - points[b].y);
  const slots = order.map((part, index) => ({ part, y: Math.max(points[part].y, top + 10 + index * 58) }));
  for (let index = slots.length - 2; index >= 0; index -= 1) slots[index].y = Math.min(slots[index].y, slots[index + 1].y - 58);
  const names: Record<Part, string> = { open: "Open", close: "Close", high: "High", low: "Low" };
  const values: Record<Part, number> = { open: bar.open, close: bar.close, high: bar.high, low: bar.low };
  const lit = (part: "body" | "upper" | "lower") => focus === "all" || focus === part;

  return (
    <figure className="sim-anatomy" data-up={up}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${up ? "Green" : "Red"} candle: open ${bar.open}, high ${bar.high}, low ${bar.low}, close ${bar.close}`}>
        <line className="sim-anatomy-wick" data-lit={lit("upper")} x1={cx} x2={cx} y1={y(bar.high)} y2={bodyTop} />
        <line className="sim-anatomy-wick" data-lit={lit("lower")} x1={cx} x2={cx} y1={bodyBottom} y2={y(bar.low)} />
        <rect className="sim-anatomy-body" data-lit={lit("body")} x={cx - half} y={bodyTop} width={half * 2} height={Math.max(3, bodyBottom - bodyTop)} />
        {slots.map(({ part, y: labelY }) => {
          const point = points[part];
          return (
            <g key={part} className="sim-anatomy-label" data-part={part}>
              <circle cx={point.x} cy={point.y} r={4} />
              <polyline points={`${point.x + 5},${point.y} ${206},${point.y} ${222},${labelY} ${232},${labelY}`} />
              <text x={240} y={labelY - 4}>
                {names[part]}
              </text>
              <text className="sim-anatomy-value" x={240} y={labelY + 15}>
                {rupees(values[part])}
              </text>
            </g>
          );
        })}
      </svg>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
