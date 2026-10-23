"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import type { Asset } from "./engine";
import { asset } from "@/lib/asset";

/* ---- Money ------------------------------------------------------------ */

/*
 * One formatter for every figure on these screens: Indian grouping
 * (₹1,00,000.00), two decimals for money and percentages, whole numbers for
 * shares, and a true minus sign (−) for negatives. A change that rounds to
 * zero prints as zero, unsigned and uncoloured.
 */
const MINUS = "−";
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const cents = (value: number) => Math.round(value * 100) / 100;

/** Paise as rupees: ₹1,00,000.00 (or −₹12.50). */
export const inr = (paise: number, digits = 2) => {
  const text = (digits === 0 ? moneyWhole : money).format(Math.abs(paise) / 100);
  return paise < 0 ? `${MINUS}${text}` : text;
};
/** Paise as a signed change: +₹120.00, −₹4.50, ₹0.00. */
export const signedInr = (paise: number) => (paise > 0 ? `+${inr(paise)}` : inr(paise));
/** Rupees (a price from the market) as ₹248.60. */
export const rupees = (value: number) => inr(Math.round(value * 100));
export const signedRupees = (value: number) => signedInr(Math.round(value * 100));
/** A signed percentage: +2.41%, −1.08%, 0.00%. */
export const signedPercent = (value: number) => {
  const shown = cents(value);
  return `${shown > 0 ? "+" : shown < 0 ? MINUS : ""}${decimal.format(Math.abs(shown))}%`;
};
/** A plain number with two decimals and Indian grouping, for chart axes and readouts. */
export const price2 = (value: number) => decimal.format(value);
/** A share of a whole (0–1) as a percentage with one decimal: 38.5%. */
export const portion = (fraction: number) => `${(Math.round(fraction * 1000) / 10).toFixed(1)}%`;
/** A count of shares: 1,240. */
export const count = (value: number) => whole.format(value);
/** "1 share", "12 shares". */
export const shares = (value: number) => `${count(value)} share${value === 1 ? "" : "s"}`;
/** Which way a number points, for colouring: up, down or flat. A change that prints as zero is flat. */
export const tone = (value: number) => (Math.abs(value) < 0.005 ? "flat" : value > 0 ? "up" : "down");

/* ---- Figures that change because of a trade ------------------------------ */

const FORMATS = { inr: (value: number) => inr(Math.round(value)), count: (value: number) => count(Math.round(value)) } as const;

/**
 * A money or share figure. Market ticks change it in place (they happen
 * every few seconds and are not news); when a trade changes it (the `cause`
 * is the latest trade's id), it counts from the old value to the new one and
 * lights briefly, so the eye connects the order to its consequence. With
 * reduced motion it changes at once and only the light remains.
 */
export function Figure({ value, kind = "inr", cause, className }: { value: number; kind?: keyof typeof FORMATS; cause?: string; className?: string }) {
  const reduced = useReducedMotion();
  const element = useRef<HTMLSpanElement>(null);
  const before = useRef({ value, cause });
  const [counting, setCounting] = useState<number | null>(null);

  useEffect(() => {
    const previous = before.current;
    before.current = { value, cause };
    if (cause === undefined || cause === previous.cause || previous.value === value) return;
    element.current?.animate([{ backgroundColor: "rgba(42, 124, 246, 0.3)" }, { backgroundColor: "rgba(42, 124, 246, 0)" }], { duration: 900, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    if (reduced) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      // A frame's timestamp can precede the moment the count began: clamp, so the first frame never runs backwards past the old value.
      const t = Math.min(1, Math.max(0, (now - start) / 450));
      const eased = 1 - Math.pow(1 - t, 4);
      setCounting(t < 1 ? previous.value + (value - previous.value) * eased : null);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    // Interrupted (a new value arrived, or the figure left the screen): show the real value, never a frame of the count.
    return () => {
      cancelAnimationFrame(frame);
      setCounting(null);
    };
  }, [value, cause, reduced]);

  return (
    <span ref={element} className={`sim-figure${className ? ` ${className}` : ""}`}>
      {FORMATS[kind](counting ?? value)}
    </span>
  );
}

/**
 * A figure set in Retropix. Its digits are drawn in equal cells (the font's
 * 1 is narrower than its other digits), so the number never shifts as it
 * changes; ₹ and − come from the text face, which Retropix lacks. Screen
 * readers get the plain text once.
 */
export function PixelNumber({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`sim-pixnum${className ? ` ${className}` : ""}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {[...text].map((char, index) =>
          /\d/.test(char) ? (
            <i key={index}>{char}</i>
          ) : (
            <span key={index} data-sym={char === "₹" || char === MINUS || undefined}>
              {char}
            </span>
          ),
        )}
      </span>
    </span>
  );
}

/* ---- Neo --------------------------------------------------------------- */

export type Mood = "celebrate" | "think" | "explain" | "wave" | "neutral";

/** The five supplied sprites (shared with the Learning Hub), with each drawing's size so all show at one scale. */
const SPRITES: Record<Mood, { src: string; width: number; height: number }> = {
  celebrate: { src: asset("/learn/neo/celebrate.png"), width: 466, height: 724 },
  think: { src: asset("/learn/neo/think.png"), width: 396, height: 724 },
  explain: { src: asset("/learn/neo/explain.png"), width: 441, height: 724 },
  wave: { src: asset("/learn/neo/wave.png"), width: 441, height: 724 },
  neutral: { src: asset("/learn/neo/neutral.png"), width: 407, height: 724 },
};

export function NeoSprite({ mood, size = 112 }: { mood: Mood; size?: number }) {
  const sprite = SPRITES[mood];
  return (
    <span className="sim-neo" style={{ "--neo-size": size, aspectRatio: `${sprite.width} / ${sprite.height}` } as CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element -- supplied pixel art, shown as drawn */}
      <img key={mood} src={sprite.src} width={sprite.width} height={sprite.height} alt="" draggable={false} />
    </span>
  );
}

/** Neo speaking: the sprite, his words, and whatever controls the moment needs. */
export function NeoLine({ mood, children, actions, size }: { mood: Mood; children: ReactNode; actions?: ReactNode; size?: number }) {
  return (
    <div className="sim-say">
      <NeoSprite mood={mood} size={size} />
      <div className="sim-say-box">
        <p className="sim-say-name">Neo</p>
        <div className="sim-say-text" aria-live="polite">
          {children}
        </div>
        {actions ? <div className="sim-say-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

/* ---- Small pieces ------------------------------------------------------ */

/**
 * Each asset's mark: an icon for its sector, the same everywhere an asset is
 * named (the trading floor's skyline switcher, lists, tickets, Home's
 * holdings, market and ledger). Drawn on the same 16-pixel grid and in the
 * same solid pixel style as the interface's glyphs: every icon sits inside a
 * 12 × 12 area, two pixels in from the edge, with strokes two or three pixels
 * wide, so the eight carry the same weight side by side.
 *
 * The sectors are the market's own (engine.ts): NOVA Technology (a chip),
 * MEDX Healthcare (a cross), KRON Energy (a lightning bolt), TERA Food (a
 * leaf), AERO Aviation (an aircraft), VNTA Consumer (a shopping bag), BOLT
 * Electric vehicles (a charging plug) and LUMA Banking (a bank's columns).
 *
 * Shapes are [x, y, width, height] blocks; `cut` blocks are openings through
 * them (drawn the other way round, so the non-zero fill leaves them empty).
 */
const ICONS: Record<string, { solid: number[][]; cut?: number[][] }> = {
  // A chip: a square die with two pins on every side and a core in its window.
  NOVA: {
    solid: [[4, 4, 8, 8], [5, 2, 2, 2], [9, 2, 2, 2], [5, 12, 2, 2], [9, 12, 2, 2], [2, 5, 2, 2], [2, 9, 2, 2], [12, 5, 2, 2], [12, 9, 2, 2], [7, 7, 2, 2]],
    cut: [[6, 6, 4, 1], [6, 9, 4, 1], [6, 7, 1, 2], [9, 7, 1, 2]],
  },
  // A medical cross.
  MEDX: { solid: [[6, 2, 4, 12], [2, 6, 4, 4], [10, 6, 4, 4]] },
  // A lightning bolt: down to the left, across, down to the left again.
  KRON: { solid: [[9, 1, 3, 1], [8, 2, 3, 1], [7, 3, 3, 1], [6, 4, 3, 1], [5, 5, 3, 1], [4, 6, 8, 2], [8, 8, 3, 1], [7, 9, 3, 1], [6, 10, 3, 1], [5, 11, 3, 1], [4, 12, 3, 1], [4, 13, 2, 1]] },
  // A leaf on its stem, with its vein.
  TERA: {
    solid: [[10, 2, 4, 1], [8, 3, 6, 1], [7, 4, 7, 1], [6, 5, 7, 1], [5, 6, 8, 1], [5, 7, 7, 1], [4, 8, 7, 1], [4, 9, 6, 1], [4, 10, 5, 1], [4, 11, 3, 1], [3, 12, 2, 1], [2, 13, 2, 1]],
    cut: [[11, 4, 1, 1], [10, 5, 1, 1], [9, 6, 1, 1], [8, 7, 1, 1], [7, 8, 1, 1], [6, 9, 1, 1]],
  },
  // An aircraft from above, nose up: fuselage, swept wings, tailplane.
  AERO: { solid: [[7, 1, 2, 13], [5, 6, 2, 1], [9, 6, 2, 1], [2, 7, 5, 2], [9, 7, 5, 2], [5, 12, 2, 2], [9, 12, 2, 2]] },
  // A shopping bag with its handle.
  VNTA: { solid: [[3, 6, 10, 8], [6, 2, 4, 1], [5, 3, 1, 3], [10, 3, 1, 3]], cut: [[5, 8, 1, 1], [10, 8, 1, 1]] },
  // A charging plug: two pins, a rounded head with a spark cut through it, and its cable.
  BOLT: {
    solid: [[5, 1, 2, 3], [9, 1, 2, 3], [3, 4, 10, 5], [4, 9, 8, 1], [5, 10, 6, 1], [7, 11, 2, 3]],
    cut: [[8, 5, 1, 1], [7, 6, 2, 1], [7, 7, 1, 1]],
  },
  // A bank: pediment, architrave, three columns and the steps.
  LUMA: { solid: [[7, 2, 2, 1], [5, 3, 6, 1], [3, 4, 10, 1], [2, 5, 12, 1], [3, 7, 2, 5], [7, 7, 2, 5], [11, 7, 2, 5], [2, 12, 12, 2]] },
};
const clockwise = ([x, y, w, h]: number[]) => `M${x} ${y}h${w}v${h}h${-w}z`;
const anticlockwise = ([x, y, w, h]: number[]) => `M${x} ${y}v${h}h${w}v${-h}z`;
const iconPath = (ticker: string) => {
  const icon = ICONS[ticker];
  if (!icon) return "M3 3h10v10H3z";
  return icon.solid.map(clockwise).join("") + (icon.cut ?? []).map(anticlockwise).join("");
};

/** An asset's mark: its sector icon in the asset's colour. Sizes that are multiples of 16 draw every pixel square. */
export function Mark({ asset, size = 32 }: { asset: Asset; size?: number }) {
  return (
    <svg className="sim-mark" viewBox="0 0 16 16" width={size} height={size} style={{ color: asset.tone }} aria-hidden="true">
      <path d={iconPath(asset.ticker)} fill="currentColor" fillRule="nonzero" />
    </svg>
  );
}

export function Glyph({ name, size = 14 }: { name: "arrow" | "back" | "plus" | "minus" | "check" | "help" | "close" | "up" | "down"; size?: number }) {
  const paths = {
    arrow: "M1 7h9V5h1V4h1v1h1v1h1v1h1v2h-1v1h-1v1h-1v1h-1v-1h-1V9H1z",
    back: "M15 7H6V5H5V4H4v1H3v1H2v1H1v2h1v1h1v1h1v1h1v-1h1V9h9z",
    plus: "M7 2h2v5h5v2H9v5H7V9H2V7h5z",
    minus: "M2 7h12v2H2z",
    check: "M1 8h2v1h1v1h1v1h1v-1h1V9h1V8h1V7h1V6h1V5h1V4h1V3h2v2h-1v1h-1v1h-1v1h-1v1h-1v1H9v1H8v1H7v1H5v-1H4v-1H3v-1H2V9H1z",
    help: "M5 2h6v1h1v1h1v4h-1v1h-1v1H9v2H7V9h1V8h2V7h1V5h-1V4H6v1H5v1H3V4h1V3h1zm2 11h2v2H7z",
    up: "M7 3h2v1h1v1h1v1h1v1h1v2H3V7h1V6h1V5h1V4h1z",
    down: "M3 6h10v2h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5V9H4V8H3z",
    close: "M2 2h2v1h1v1h1v1h1v1h2V5h1V4h1V3h1V2h2v2h-1v1h-1v1h-1v1h-1v2h1v1h1v1h1v1h1v2h-2v-1h-1v-1h-1v-1H9v-1H7v1H6v1H5v1H4v1H2v-2h1v-1h1v-1h1V9h1V7H5V6H4V5H3V4H2z",
  };
  return (
    <svg className="sim-glyph" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path d={paths[name]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/** The width of an element, kept up to date. Zero until it has been measured. */
export function useWidth(element: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(target);
    return () => observer.disconnect();
  }, [element]);
  return width;
}
