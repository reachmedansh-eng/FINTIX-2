"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import type { NeoMood } from "./types";
import { asset } from "@/lib/asset";

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

/** Rupees, grouped the Indian way (1,00,000). */
export const inr = (value: number, digits = 0) =>
  `₹${Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

const sign = (value: number) => (value > 0 ? "+" : value < 0 ? "-" : "");

export const signedInr = (value: number, digits = 0) => `${sign(value)}${inr(value, digits)}`;
export const signedPct = (value: number, digits = 1) => `${sign(value)}${Math.abs(value).toFixed(digits)}%`;
export const count = (value: number) => Math.round(value).toLocaleString("en-IN");

export type Tone = "up" | "down" | "flat";
export const toneOf = (value: number): Tone => (value > 0 ? "up" : value < 0 ? "down" : "flat");

/**
 * A number that travels to its new value instead of jumping, so the learner
 * sees their change arrive. React never rewrites the text after the first
 * render; the effect owns it.
 */
export function Num({ value, format = count, className }: { value: number; format?: (value: number) => string; className?: string }) {
  const element = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const formatter = useRef(format);
  const [first] = useState(() => format(value));
  const reduced = useReducedMotion();

  useEffect(() => {
    formatter.current = format;
  });

  useEffect(() => {
    const el = element.current;
    if (!el) return;
    const from = shown.current;
    const settle = () => {
      shown.current = value;
      el.textContent = formatter.current(value);
    };
    if (from === value || reduced) return settle();

    const start = performance.now();
    let frame = requestAnimationFrame(function run(now) {
      const t = Math.min(1, (now - start) / 240);
      shown.current = from + (value - from) * (1 - Math.pow(1 - t, 3));
      el.textContent = formatter.current(t === 1 ? value : shown.current);
      if (t < 1) frame = requestAnimationFrame(run);
    });
    // Frames stop in a hidden tab; the value must still land.
    const land = window.setTimeout(settle, 300);
    el.dataset.moved = value > from ? "up" : "down";
    const calm = window.setTimeout(() => delete el.dataset.moved, 520);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(land);
      window.clearTimeout(calm);
    };
  }, [value, reduced]);

  return (
    <span ref={element} className={className} suppressHydrationWarning>
      {first}
    </span>
  );
}

/** A labelled figure. The value is the loud part. */
export function Stat({
  label,
  value,
  format,
  tone,
  size = "m",
  note,
}: {
  label: string;
  value: number | string;
  format?: (value: number) => string;
  tone?: Tone;
  size?: "s" | "m" | "l";
  note?: string;
}) {
  return (
    <div className="stat" data-size={size} data-tone={tone}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{typeof value === "number" ? <Num value={value} format={format} /> : value}</span>
      {note ? <span className="stat-note">{note}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  format = count,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
}) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return (
    <div className="stepper">
      <span className="ctl-label">{label}</span>
      <div className="stepper-row">
        <button type="button" onClick={() => set(value - step)} disabled={value <= min} aria-label={`Decrease ${label}`}>
          <i aria-hidden="true" data-glyph="minus" />
        </button>
        <output aria-live="polite">{format(value)}</output>
        <button type="button" onClick={() => set(value + step)} disabled={value >= max} aria-label={`Increase ${label}`}>
          <i aria-hidden="true" data-glyph="plus" />
        </button>
      </div>
    </div>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = count,
  tone,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  tone?: Tone | "gold";
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider" data-tone={tone}>
      <span className="slider-head">
        <span className="ctl-label">{label}</span>
        <output>{format(value)}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--fill": `${fill}%` } as CSSProperties}
      />
    </label>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; tone?: Tone | "gold" }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          data-tone={option.tone}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** The one loud button inside an interactive. */
export function Act({
  children,
  onClick,
  tone,
  disabled,
  quiet,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: Tone | "gold";
  disabled?: boolean;
  quiet?: boolean;
}) {
  return (
    <button type="button" className="act" data-tone={tone} data-quiet={quiet} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/** A row of unit blocks: one block per share (or per `per` units). The plainest picture of a position. */
export function Blocks({ total, lit, per = 1, tone }: { total: number; lit: number; per?: number; tone?: "cyan" | "gold" }) {
  return (
    <div className="blocks" data-tone={tone} role="img" aria-label={`${lit * per} of ${total * per}`}>
      {Array.from({ length: total }, (_, index) => (
        <i key={index} data-on={index < lit} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Neo                                                                 */
/* ------------------------------------------------------------------ */

/** Supplied sprites, with the height of each drawing so they can be shown at a consistent scale. */
const SPRITES: Record<NeoMood, { src: string; width: number; height: number }> = {
  celebrate: { src: asset("/learn/neo/celebrate.png"), width: 466, height: 724 },
  think: { src: asset("/learn/neo/think.png"), width: 396, height: 724 },
  explain: { src: asset("/learn/neo/explain.png"), width: 441, height: 724 },
  wave: { src: asset("/learn/neo/wave.png"), width: 441, height: 724 },
  neutral: { src: asset("/learn/neo/neutral.png"), width: 407, height: 724 },
};

export function Neo({ mood, size = 120, still }: { mood: NeoMood; size?: number; still?: boolean }) {
  const sprite = SPRITES[mood];
  return (
    <span className="neo" data-still={still} style={{ height: size, width: (size * sprite.width) / sprite.height }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- supplied pixel art, shown as drawn */}
      <img key={mood} src={sprite.src} width={sprite.width} height={sprite.height} alt="" draggable={false} />
    </span>
  );
}

export function NeoSays({ mood, children, size, side = "left" }: { mood: NeoMood; children: ReactNode; size?: number; side?: "left" | "right" | "top" }) {
  return (
    <div className="neo-says" data-side={side}>
      <Neo mood={mood} size={size} />
      <p className="bubble" aria-live="polite">
        <span className="bubble-name">Neo</span>
        {children}
      </p>
    </div>
  );
}
