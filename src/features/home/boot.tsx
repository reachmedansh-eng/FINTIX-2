"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Home's opening. The first time Home is entered in a browser session it
 * powers on like a terminal: a stack of system lines types itself out in the
 * dark, corrupting and correcting as it goes, then collapses as the city's
 * lights come up; the treasury figure assembles out of fragmented, displaced,
 * flickering pixel digits; the metrics resolve with shorter, quieter versions
 * of the same corruption; the HUD's labels flicker on and the holdings come
 * in. Later visits in the same session are quiet: everything is simply there.
 * With reduced motion there is no sequence at all.
 *
 * Nothing in the sequence waits on anything: every figure is in the page, in
 * its exact value and readable by assistive technology, from the first frame;
 * the glitch is drawn on a layer over it (aria-hidden), its last frame is the
 * exact value, and every control works while it plays.
 */

export type BootMode = "full" | "quiet" | "none";

const BOOTED = "fintix.home.booted.v1";

/** Decides once, on arrival, whether this visit boots. */
export function useBootMode(reduced: boolean): BootMode {
  const [mode] = useState<BootMode>(() => {
    if (reduced) return "none";
    try {
      return window.sessionStorage.getItem(BOOTED) ? "quiet" : "full";
    } catch {
      return "quiet";
    }
  });
  useEffect(() => {
    try {
      window.sessionStorage.setItem(BOOTED, "1");
    } catch {
      // Without session storage every visit is quiet after this one anyway: the mode was decided on arrival.
    }
  }, []);
  return mode;
}

/** The terminal types for at least this long before the city may light, so its lines can be read as a moment. */
const TERMINAL_MIN = 900;
/** The longest the opening waits for the city before it starts anyway: a slow device never holds the figures back for long. */
export const BOOT_WAIT = 1800;

/**
 * The opening's start: the city's first frame, but never before the terminal
 * has had TERMINAL_MIN, and at the latest BOOT_WAIT after arrival. `start` may
 * be a moment slightly in the future (everything keyed to it waits for it);
 * `go` turns true when it arrives. Null and false on a quiet visit.
 */
export function useBootStart(mode: BootMode) {
  const [start, setStart] = useState<number | null>(null);
  const [go, setGo] = useState(false);
  const arrived = useRef(0);
  useEffect(() => {
    arrived.current = performance.now();
  }, []);
  const begin = useCallback(() => setStart((current) => current ?? Math.max(performance.now(), arrived.current + TERMINAL_MIN)), []);
  useEffect(() => {
    if (mode !== "full") return;
    const timer = window.setTimeout(begin, BOOT_WAIT);
    return () => window.clearTimeout(timer);
  }, [mode, begin]);
  useEffect(() => {
    if (start === null) return;
    const timer = window.setTimeout(() => setGo(true), Math.max(0, start - performance.now()));
    return () => window.clearTimeout(timer);
  }, [start]);
  return { start: mode === "full" ? start : null, go: mode === "full" && go, begin };
}

/** When each step of the opening starts, in milliseconds from `start`. One schedule, so the steps stay in order. */
export const BOOT_AT = { title: 0, value: 120, metrics: 700, meter: 850, split: 950, rows: 1100 } as const;

/* ------------------------------------------------------------------ */
/* The glitch                                                           */
/* ------------------------------------------------------------------ */

const DIGITS = "0123456789";
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const escape = (char: string) => (char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : char);
const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
const chance = (p: number) => Math.random() < p;

/**
 * How each kind of text glitches. `step` is the frame length (the motion is
 * stepped, never tweened), `window` how far ahead of its resolve point a
 * character starts corrupting, and the rest are per-frame chances: a run of
 * characters shoved sideways out of line, the line torn into two slices that
 * slip apart, a solid block flashing over it, and a resolved character
 * flickering back to noise. `echo` is how many earlier states stack under the
 * line as it types.
 */
const PROFILES = {
  hero: { step: 50, window: 0.34, echo: 2, tear: 0.22, shove: 0.32, block: 0.08, flicker: 0.16, noise: DIGITS + DIGITS + "#%&$@/<>[]{}=+?!" },
  metric: { step: 60, window: 0.28, echo: 0, tear: 0, shove: 0.14, block: 0, flicker: 0.07, noise: DIGITS + DIGITS + "#%$/<>=+" },
  title: { step: 55, window: 0.32, echo: 1, tear: 0.14, shove: 0.24, block: 0, flicker: 0.1, noise: LETTERS + "#%&$/<>[]{}=+?" },
} as const;
export type GlitchVariant = keyof typeof PROFILES;

type Shove = { from: number; length: number; dx: number; dy: number; frames: number };

/**
 * Text that assembles out of corruption, left to right: characters ahead of
 * the leading edge are missing (their places held), characters at the edge
 * cycle through noise in mixed letterforms and jump a little off their line,
 * runs of characters are shoved sideways out of place, the whole line tears
 * into two slices that slip apart for a frame, earlier states echo beneath it
 * as it types (the hero), and resolved characters still flicker back to noise
 * now and then until the end. The last frame is the exact text, and then the
 * layer goes.
 *
 * Until the opening starts the text waits: the hero shows a blinking cursor,
 * everything else is blank. A price tick during the glitch is followed, so the
 * layer always lands on the value that is actually there.
 */
export function Glitch({
  text,
  play,
  start = null,
  delay = 0,
  duration = 900,
  variant = "metric",
  pixel = false,
  children,
  className,
}: {
  /** The text as shown. */
  text: string;
  play: boolean;
  /** When the opening started (a performance.now() time, possibly just ahead), or null while it waits. */
  start?: number | null;
  delay?: number;
  /** How long until the last character resolves, after the delay. */
  duration?: number;
  variant?: GlitchVariant;
  /** Draw the layer in Retropix's fixed digit cells (for a PixelNumber underneath). */
  pixel?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const layer = useRef<HTMLSpanElement>(null);
  const latest = useRef({ text, start });

  useEffect(() => {
    latest.current = { text, start };
  });

  useEffect(() => {
    const host = root.current;
    const over = layer.current;
    if (!play || !host || !over) return;
    const profile = PROFILES[variant];
    host.dataset.glitching = "";
    const resolveAt: number[] = [];
    const noise: string[] = [];
    const history: string[] = [];
    let shove: Shove | null = null;
    let tear = 0;
    let tearBy = 0;
    let blocks = 0;
    let frame = 0;
    let last = -Infinity;
    let finished = 0;
    // A cell is a pixel digit's fixed width; elsewhere a character's width is roughly half an em.
    const cell = pixel ? 0.4542 : 0.55;

    const charHtml = (char: string, kind: "hidden" | "noise" | "plain", style: string, dim: boolean) => {
      const digitCell = pixel && /\d/.test(char);
      const glyph = kind === "noise" ? escape(noise[0] ?? char) : escape(char);
      // Some noise switches typeface for a frame (pixel letters in text, text letters in pixel figures): flickering letterforms.
      const classes = `g-c${kind === "hidden" ? " g-k" : ""}${kind === "noise" ? " g-n" : ""}${kind === "noise" && chance(0.35) ? " g-alt" : ""}${dim ? " g-d" : ""}${pixel && (char === "₹" || char === "−") ? " g-sym" : ""}`;
      const tag = digitCell ? "i" : "span";
      return `<${tag} class="${classes}"${style ? ` style="${style}"` : ""}>${glyph}</${tag}>`;
    };

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < profile.step) return;
      last = now;
      const { text: target, start: begun } = latest.current;
      const chars = [...target];
      // Each character's resolve point: spread left to right, a little uneven, so the edge moves raggedly.
      while (resolveAt.length < chars.length) resolveAt.push(0.12 + (resolveAt.length / Math.max(1, chars.length - 1)) * 0.78 * (0.86 + Math.random() * 0.14));
      const progress = begun === null ? -1 : (now - begun - delay) / duration;

      // Waiting: a cursor blinking where the hero will appear; everything else is blank.
      if (progress < 0) {
        const cursor = variant === "hero" && Math.floor(now / 420) % 2 === 0 ? '<span class="g-cursor"></span>' : "";
        over.innerHTML = `<span class="g-line">${cursor}${chars.map((char) => charHtml(char, "hidden", "", false)).join("")}</span>`;
        return;
      }

      // Done: one clean frame of the exact text, then the layer goes and the real text shows.
      if (progress >= 1) {
        if (finished === 0) {
          finished = now;
          over.innerHTML = `<span class="g-line">${chars.map((char) => charHtml(char, "plain", "", false)).join("")}</span>`;
          return;
        }
        if (now - finished < profile.step) return;
        cancelAnimationFrame(frame);
        over.innerHTML = "";
        delete host.dataset.glitching;
        return;
      }

      // A run of characters shoved out of line for a frame or two.
      if (shove) shove.frames -= 1;
      if (shove && shove.frames <= 0) shove = null;
      if (!shove && progress > 0.08 && progress < 0.8 && chance(profile.shove)) {
        const length = 2 + Math.floor(Math.random() * 3);
        shove = { from: Math.floor(Math.random() * Math.max(1, chars.length - length)), length, dx: (chance(0.5) ? 1 : -1) * (1 + Math.floor(Math.random() * 3)) * cell, dy: chance(0.3) ? (chance(0.5) ? 0.5 : -0.5) : 0, frames: 1 + Math.floor(Math.random() * 2) };
      }

      const line = chars
        .map((char, index) => {
          if (char === " ") return " ";
          const corruptible = pixel ? /\d/.test(char) : /[0-9A-Za-z]/.test(char);
          const at = resolveAt[index];
          let kind: "hidden" | "noise" | "plain" = "plain";
          let x = 0;
          let y = 0;
          let dim = false;
          if (progress < at - profile.window) kind = "hidden";
          else if (progress < at) {
            kind = corruptible ? "noise" : chance(0.3) ? "hidden" : "plain";
            x = chance(0.35) ? (chance(0.5) ? 0.08 : -0.08) : 0;
            y = chance(0.4) ? (chance(0.5) ? 0.14 : -0.14) : 0;
            dim = chance(0.22);
          } else if (chance(profile.flicker * (1 - progress) * (1 - progress))) {
            kind = corruptible && chance(0.6) ? "noise" : "hidden";
          }
          if (kind === "noise") noise[0] = pick(profile.noise);
          if (shove && index >= shove.from && index < shove.from + shove.length && kind !== "hidden") {
            x += shove.dx;
            y += shove.dy;
          }
          const style = x || y ? `transform:translate(${x.toFixed(2)}em,${y.toFixed(2)}em)` : "";
          return charHtml(char, kind, style, dim);
        })
        .join("");

      // Earlier states stack under the line as it types, fainter the older they are.
      const echoes = progress < 0.72 ? history.map((past, index) => `<span class="g-echo" style="top:${(index + 1) * 0.94}em;opacity:${(0.3 / (index + 1)).toFixed(2)}">${past}</span>`).join("") : "";
      history.unshift(line);
      history.length = Math.min(history.length, profile.echo);

      // Now and then the line tears into two slices that slip apart, for a frame or two.
      if (tear > 0) tear -= 1;
      else if (progress > 0.15 && progress < 0.85 && chance(profile.tear)) {
        tear = 1 + Math.floor(Math.random() * 2);
        tearBy = (chance(0.5) ? 1 : -1) * (0.06 + Math.random() * 0.14);
      }
      const body =
        tear > 0
          ? `<span class="g-line g-top" style="transform:translateX(${tearBy.toFixed(2)}em)">${line}</span><span class="g-line g-bottom" style="transform:translateX(${(-tearBy).toFixed(2)}em)">${line}</span>`
          : `<span class="g-line">${line}</span>`;

      // A solid block flashes over the figure, rarely, as a frame drops out.
      const block =
        blocks < 3 && progress > 0.1 && progress < 0.8 && chance(profile.block)
          ? (blocks++, `<b class="g-block" data-tone="${chance(0.5) ? "accent" : "own"}" style="left:${Math.round(Math.random() * 70)}%;top:${(0.1 + Math.random() * 0.5).toFixed(2)}em;width:${(0.5 + Math.random() * 1.4).toFixed(2)}em;height:${(0.12 + Math.random() * 0.3).toFixed(2)}em"></b>`)
          : "";

      over.innerHTML = body + echoes + block;
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      over.innerHTML = "";
      delete host.dataset.glitching;
    };
  }, [play, delay, duration, variant, pixel]);

  return (
    <span ref={root} className={`hm-glitch${pixel ? " hm-glitch-pixel" : ""}${className ? ` ${className}` : ""}`}>
      <span className="hm-glitch-real">{children ?? text}</span>
      <span ref={layer} className={`hm-glitch-layer${pixel ? " sim-pixnum" : ""}`} aria-hidden="true" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* The terminal                                                         */
/* ------------------------------------------------------------------ */

type TerminalLine = { text: string; offset: number; fragment: [number, number] | null };

/**
 * The dark start of the opening: system lines typing themselves out over the
 * unlit city, as a stack of states. Each line types in steps, every step kept
 * as its own line beneath the last ("FINTIX", then "FINTIX simulator"), the
 * newest one always corrupted at its leading edge; now and then a line keeps
 * only a fragment of itself, thrown out of column. Once the opening starts the
 * stack collapses: letters drop out of every line and the lines leave from the
 * top, as the city's lights come up. Decorative (the same facts are on the
 * page as text), so it is hidden from assistive technology.
 */
export function BootTerminal({ lines, start, play }: { lines: string[]; start: number | null; play: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef({ lines, start });

  useEffect(() => {
    latest.current = { lines, start };
  });

  useEffect(() => {
    const element = box.current;
    if (!play || !element) return;
    const STEP = 55;
    const MAX = 6;
    // The script: each line typed in two to three steps, each step a new line in the stack.
    const script: TerminalLine[] = [];
    for (const text of latest.current.lines) {
      const cuts = text.length > 14 ? [0.45, 0.78, 1] : [0.6, 1];
      for (const cut of cuts) {
        const length = Math.max(1, Math.round(text.length * cut));
        const fragmented = cut < 1 && chance(0.28);
        const from = Math.floor(Math.random() * Math.max(1, length - 4));
        script.push({ text: text.slice(0, length), offset: fragmented ? 2 + Math.floor(Math.random() * 6) : 0, fragment: fragmented ? [from, from + 2 + Math.floor(Math.random() * 3)] : null });
      }
    }
    const stack: TerminalLine[] = [];
    const gone: Set<string>[] = [];
    let cursor = 0;
    let frame = 0;
    let last = -Infinity;
    let collapse = 0;
    let ended = false;

    const lineHtml = (line: TerminalLine, newest: boolean, index: number) => {
      const chars = [...line.text];
      const dropped = gone[index] ?? new Set<string>();
      const html = chars
        .map((char, at) => {
          if (line.fragment && (at < line.fragment[0] || at >= line.fragment[1])) return `<span class="g-k">${escape(char)}</span>`;
          if (dropped.has(String(at))) return `<span class="g-k">${escape(char)}</span>`;
          // The newest line's last few characters are still being worked out.
          if (newest && at >= chars.length - 4 && char !== " ") return `<span class="g-n">${escape(pick(LETTERS + "#%&$/<>[]{}=+?!"))}</span>`;
          return escape(char);
        })
        .join("");
      return `<span class="hm-term-line" style="padding-left:${line.offset}ch">${html}</span>`;
    };

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < STEP) return;
      last = now;
      const begun = latest.current.start;
      if (begun !== null && now >= begun) {
        // The collapse: letters drop out of every line and the oldest line leaves, step by step.
        collapse += 1;
        stack.forEach((line, index) => {
          const set = (gone[index] ??= new Set());
          for (let drop = 0; drop < Math.ceil(line.text.length / 3); drop += 1) set.add(String(Math.floor(Math.random() * line.text.length)));
        });
        if (collapse % 2 === 0) {
          stack.shift();
          gone.shift();
        }
        if (!stack.length || collapse > 9) {
          if (!ended) {
            ended = true;
            element.dataset.done = "";
          }
          element.innerHTML = "";
          cancelAnimationFrame(frame);
          return;
        }
      } else if (cursor < script.length) {
        // Typing: the next state joins the stack; the stack scrolls when it is full.
        stack.push(script[cursor]);
        gone.push(new Set());
        cursor += 1;
        if (stack.length > MAX) {
          stack.shift();
          gone.shift();
        }
      }
      element.innerHTML = stack.map((line, index) => lineHtml(line, index === stack.length - 1 && begun === null, index)).join("");
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [play]);

  if (!play) return null;
  return <div ref={box} className="hm-term" aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Sections                                                             */
/* ------------------------------------------------------------------ */

/**
 * A section that comes in once, the first time it is scrolled to: its head's
 * rule draws across, its title glitches into place and its content settles.
 * It never replays, and on a quiet visit or with reduced motion the section
 * is simply there. `shownAt` is when it came in (null if it was simply there).
 */
export function useReveal(mode: BootMode) {
  const ref = useRef<HTMLElement>(null);
  // Without IntersectionObserver there is nothing to wait for: the section is simply there.
  const [shown, setShown] = useState(() => mode !== "full" || typeof IntersectionObserver === "undefined");
  const [shownAt, setShownAt] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (shown || !element) return;
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        setShownAt(performance.now());
        watcher.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    watcher.observe(element);
    return () => watcher.disconnect();
  }, [shown]);
  return { ref, reveal: shown ? "shown" : "pending", shownAt } as const;
}
