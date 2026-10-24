"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { auth } from "@/features/auth/authClient";
import { Glyph, type Mood } from "@/features/trade/ui";
import { asset } from "@/lib/asset";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useReducedMotion } from "@/lib/useReducedMotion";
import "./tour.css";

/**
 * The product tour: when a new player first arrives at Home after signing
 * in, Neo flies in and shows them around, the way a game's signature
 * character walks a new player through the menus. Each stop dims the page and opens a window on one part
 * of it: the navigation bar, the city and its heads-up display, the sections
 * below, then the other two areas and the account menu. It ends with a
 * choice of where to go first.
 *
 * The page underneath is never changed: the tour only scrolls it and looks
 * at it. Stops whose part isn't on screen (a layout that hides it) are passed
 * over. It runs once per player (remembered on their account, and per
 * player in this browser), and can be asked for again from the account menu
 * (SiteNav), which opens /home?tour or, on Home, sends TOUR_EVENT.
 */

const SEEN = "fintix.tour.v1";
export const TOUR_EVENT = "fintix:tour";

/** Ask Home to run the tour again. Home listens while it's open; elsewhere, go to /home?tour. */
export const requestTour = () => window.dispatchEvent(new Event(TOUR_EVENT));

type Context = { name: string; holdings: number };

type Stop = {
  title: string;
  mood: Mood;
  say: (context: Context) => string;
  /** The part of the page this stop is about; none for the welcome and the goodbye. */
  find?: () => DOMRect | null;
};

/** One element's box, if it's on screen at all. */
const box = (selector: string) => {
  const element = document.querySelector(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1 ? rect : null;
};

/** What a panel holds, where the panel itself stretches to fill its column. */
const contents = (selector: string) => {
  const parts = [...(document.querySelector(selector)?.children ?? [])].map((child) => child.getBoundingClientRect()).filter((rect) => rect.width > 1 && rect.height > 1);
  if (!parts.length) return null;
  const left = Math.min(...parts.map((rect) => rect.left));
  const top = Math.min(...parts.map((rect) => rect.top));
  return new DOMRect(left, top, Math.max(...parts.map((rect) => rect.right)) - left, Math.max(...parts.map((rect) => rect.bottom)) - top);
};

/**
 * The city sits behind the heads-up display, across the whole first screen.
 * Its window is the open plaza between the panels on either side, where they
 * stand beside it.
 */
const plaza = () => {
  const city = box(".hm-city");
  if (!city) return null;
  const middle = city.left + city.width / 2;
  const left = box(".hm-treasury");
  const right = box(".hm-holdings");
  const from = left && left.right < middle ? left.right + 12 : city.left;
  const to = right && right.left > middle ? right.left - 12 : city.right;
  return new DOMRect(from, city.top, to - from, city.height);
};

const STOPS: Stop[] = [
  {
    title: "Welcome to FINTIX",
    mood: "wave",
    say: ({ name }) => `Hey ${name}, I'm Neo! Let me show you around. It takes about a minute. Everything here runs on virtual money, so nothing you do can cost you real cash.`,
  },
  {
    title: "Getting around",
    mood: "explain",
    say: () => "This bar is on every screen. It has three places: Home, Learn and Trade. Tap one to jump there. You're on Home now.",
    find: () => box(".nav-areas"),
  },
  {
    title: "Your city's worth",
    mood: "neutral",
    say: () => "You start with ₹1,00,000 of virtual money. This is what your city is worth right now, and how far it has moved from that start.",
    find: () => box(".hm-treasury"),
  },
  {
    title: "Your city",
    mood: "explain",
    say: ({ holdings }) =>
      holdings
        ? "Every stock you own is a building on this plaza. The bigger your stake, the taller it stands. Tap a building to see it up close and trade it."
        : "Every stock you buy becomes a building on this plaza. The bigger your stake, the taller it stands. Right now it's empty, waiting for your first one.",
    find: plaza,
  },
  {
    title: "Invested and cash",
    mood: "think",
    say: () => "Gold is money you've invested, navy is cash you still have to spend. Below that: profit on what you still own, and profit you've locked in by selling.",
    find: () => box(".hm-balance"),
  },
  {
    title: "Your buildings",
    mood: "explain",
    say: ({ holdings }) =>
      holdings
        ? "The same buildings as a list, largest first. Point at a row and its building lights up. Tap it to trade without leaving Home."
        : "Once you buy something it shows up here, with what it's worth and how it's doing.",
    find: () => contents(".hm-holdings"),
  },
  {
    title: "Market pulse",
    mood: "explain",
    say: () => "Every asset in the market and how it moved today, from the biggest gain to the biggest fall. Tap any of them to look closer or buy it.",
    find: () => box("#hm-market"),
  },
  {
    title: "Market news",
    mood: "think",
    say: () => "News moves prices, just like in a real market. Each story shows which asset it hit and how far that price has moved since.",
    find: () => box("#hm-news"),
  },
  {
    title: "Your ledger",
    mood: "neutral",
    say: () => "Every trade you make is written down here: what you bought or sold, at what price, and what it did to your cash.",
    find: () => box("#hm-ledger"),
  },
  {
    title: "Learn",
    mood: "think",
    say: () => "Learn is where it starts making sense: short modules on stocks, risk and reading charts, each with something to try and a quick challenge at the end.",
    find: () => box('.nav-area[data-area="learn"]'),
  },
  {
    title: "Trade",
    mood: "explain",
    say: () => "Trade is the trading floor: live charts, prices, and the buy and sell buttons. The first time you go there, I'll walk you through a real trade, step by step.",
    find: () => box('.nav-area[data-area="trade"]'),
  },
  {
    title: "Your account",
    mood: "neutral",
    say: () => "Your account lives here. If you ever want this tour again, you'll find it in this menu.",
    find: () => box(".nav-user"),
  },
  {
    title: "You're all set",
    mood: "celebrate",
    say: () => "That's FINTIX! Your city grows with every trade you make. Where do you want to go first?",
  },
];

const SPRITES: Record<Mood, { src: string; width: number; height: number }> = {
  celebrate: { src: asset("/learn/neo/celebrate.png"), width: 466, height: 724 },
  think: { src: asset("/learn/neo/think.png"), width: 396, height: 724 },
  explain: { src: asset("/learn/neo/explain.png"), width: 441, height: 724 },
  wave: { src: asset("/learn/neo/wave.png"), width: 441, height: 724 },
  neutral: { src: asset("/learn/neo/neutral.png"), width: 407, height: 724 },
};

/** Each player's own record in this browser: a new player signing in here gets the tour even if someone else already had it. */
const seenKey = () => `${SEEN}:${auth.getSession()?.email || "guest"}`;

const seen = () => {
  // A signed-in account remembers it on the server too, so a player isn't shown round again on a new device.
  if (auth.getSession()?.toured) return true;
  try {
    return window.localStorage.getItem(seenKey()) !== null;
  } catch {
    // Without storage the tour can't remember it ran; better not to repeat it on every visit.
    return true;
  }
};

const remember = () => {
  auth.markToured();
  try {
    window.localStorage.setItem(seenKey(), "done");
  } catch {
    // Nothing to keep it in; the tour still closes.
  }
};

/** Space kept clear under the navigation bar when a stop scrolls its part into view. */
const CLEAR_TOP = 84;
const PAD = 8;
/** The navigation bar's height. */
const BAR = 60;

/**
 * Home mounts this once its opening has played (`ready`). It decides whether
 * a first visit gets the tour, and listens for the tour being asked for again.
 */
export function Tour({ ready, context }: { ready: boolean; context: Context }) {
  const [open, setOpen] = useState(false);
  // Asked for by the account menu on another page: read once, on arrival, then taken off the address.
  const [asked] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("tour"));

  useEffect(() => {
    if (asked) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.hash);
  }, [asked]);

  useEffect(() => {
    if (!ready) return;
    if (!asked && seen()) return;
    // A first visit lets the city settle for a moment before Neo arrives.
    const timer = window.setTimeout(() => setOpen(true), asked ? 200 : 900);
    return () => window.clearTimeout(timer);
  }, [ready, asked]);

  useEffect(() => {
    const again = () => setOpen(true);
    window.addEventListener(TOUR_EVENT, again);
    return () => window.removeEventListener(TOUR_EVENT, again);
  }, []);

  if (!open) return null;
  return (
    <Guide
      context={context}
      onClose={() => {
        remember();
        setOpen(false);
      }}
    />
  );
}

function Guide({ context, onClose }: { context: Context; onClose: () => void }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  // Which side of the screen Neo stands on: away from the part he's talking about.
  const [side, setSide] = useState<"left" | "right" | "middle">("middle");
  const phone = useMediaQuery("(max-width: 760px)");
  const hole = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const stop = STOPS[index];
  const last = index === STOPS.length - 1;
  const text = stop.say(context);
  const typed = useTyping(text, reduced);
  const typing = typed.length < text.length;

  // The stops that have something to show on this layout, worked out when the tour opens.
  const [route] = useState(() => STOPS.map((entry, at) => (!entry.find || entry.find() ? at : -1)).filter((at) => at >= 0));
  const position = route.indexOf(index);
  const step = (direction: 1 | -1) => {
    const next = route[position + direction];
    if (next === undefined) return;
    const target = STOPS[next].find?.();
    setSide(!target ? "middle" : target.left + target.width / 2 > window.innerWidth / 2 ? "left" : "right");
    setIndex(next);
  };

  // Scroll the stop's part into the clear space under the bar, then keep the window on it every frame.
  useLayoutEffect(() => {
    const target = stop.find?.() ?? null;
    const narrow = window.innerWidth <= 760;
    if (target) {
      const room = window.innerHeight - CLEAR_TOP;
      // Parts of the navigation bar are always in view; others come up under it, or into the upper part of the screen on a phone.
      const onBar = target.bottom <= BAR + 4;
      if (!onBar && (target.top < CLEAR_TOP || target.bottom > window.innerHeight * (narrow ? 0.55 : 0.82))) {
        const lift = target.height < room * 0.5 && !narrow ? (room - target.height) * 0.25 : 0;
        window.scrollTo({ top: Math.max(0, window.scrollY + target.top - CLEAR_TOP - lift), behavior: reduced ? "auto" : "smooth" });
      }
    }
  }, [index, stop, reduced]);

  useEffect(() => {
    let frame = 0;
    let shown = "";
    const track = () => {
      const target = stop.find?.() ?? null;
      const element = hole.current;
      if (element) {
        // With nothing to point at, the window closes to a point in the middle of the screen and the whole page is dimmed.
        // A part of the page never draws its window over the navigation bar, which stays on top as the page scrolls under it.
        const floor = target && target.top >= BAR ? BAR + 2 : 2;
        const x = target ? target.left - PAD : window.innerWidth / 2;
        const y = target ? Math.max(floor, target.top - PAD) : window.innerHeight / 2;
        const w = target ? target.width + PAD * 2 : 0;
        const h = target ? Math.max(0, target.bottom + PAD - y) : 0;
        const next = `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
        if (next !== shown) {
          shown = next;
          element.style.transform = `translate(${x}px, ${y}px)`;
          element.style.width = `${w}px`;
          element.style.height = `${h}px`;
          element.dataset.empty = target ? "" : "true";
        }
      }
      frame = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(frame);
  }, [stop]);

  // While Neo talks, the page only moves when he moves it: no wheel, touch or key scrolling underneath.
  useEffect(() => {
    const hold = (event: Event) => event.preventDefault();
    window.addEventListener("wheel", hold, { passive: false });
    window.addEventListener("touchmove", hold, { passive: false });
    return () => {
      window.removeEventListener("wheel", hold);
      window.removeEventListener("touchmove", hold);
    };
  }, []);

  // Focus moves into the tour and returns where it was when the tour closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => before?.focus?.({ preventScroll: true });
  }, []);
  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>("[data-primary]")?.focus({ preventScroll: true });
  }, [index, side]);

  const advance = () => {
    // The first press finishes Neo's sentence; the next one moves on, as in a game's dialogue.
    if (typing) return typed.finish();
    if (last) return onClose();
    step(1);
  };

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        advance();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if ([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && !(event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement)) {
        event.preventDefault();
      } else if (event.key === "Tab" && dialog.current) {
        // Keep keyboard focus inside the tour.
        const items = [...dialog.current.querySelectorAll<HTMLElement>("button, a[href]")];
        const first = items[0];
        const end = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          end.focus();
        } else if (!event.shiftKey && document.activeElement === end) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });

  const sprite = SPRITES[stop.mood];
  const actions: ReactNode = last ? (
    <>
      <button type="button" className="tour-skip" onClick={onClose}>
        Stay on Home
      </button>
      <Link className="sim-button" data-tone="quiet" href="/learn" onClick={onClose}>
        Start learning
      </Link>
      <Link className="sim-button" data-tone="buy" href="/trade" onClick={onClose} data-primary>
        Make my first trade <Glyph name="arrow" />
      </Link>
    </>
  ) : (
    <>
      {position > 0 ? (
        <button type="button" className="sim-button" data-tone="quiet" onClick={() => step(-1)}>
          Back
        </button>
      ) : null}
      <button type="button" className="sim-button" data-tone="buy" onClick={advance} data-primary>
        {position === 0 ? "Show me around" : "Next"} <Glyph name="arrow" />
      </button>
    </>
  );

  return (
    <div className="tour" data-side={side} data-phone={phone || undefined} data-reduced={reduced || undefined}>
      {/* The dimmed page, with a window cut where Neo is pointing. Clicks stay with the tour: a tap anywhere moves on, until the last stop's choice. */}
      <div className="tour-shade" onClick={last ? undefined : advance} aria-hidden="true">
        <div className="tour-hole" ref={hole} />
      </div>

      <div className="tour-cast" key={side} ref={dialog} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-said">
        <span className="tour-neo" style={{ "--ratio": sprite.width / sprite.height } as CSSProperties} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- supplied pixel art, shown as drawn */}
          <img key={stop.mood} src={sprite.src} width={sprite.width} height={sprite.height} alt="" draggable={false} />
        </span>

        <div className="tour-box">
          <p className="tour-name">
            <span className="px">Neo</span>
            <span className="tour-count">
              {position + 1} of {route.length}
            </span>
          </p>
          <h2 id="tour-title" className="tour-title px">
            {stop.title}
          </h2>
          <p id="tour-said" className="sr-only" aria-live="polite">
            {text}
          </p>
          <p className="tour-text" aria-hidden="true" onClick={typed.finish}>
            {typed.text}
            {/* The rest of the sentence holds its space, so the box doesn't grow as Neo speaks. */}
            <span className="tour-rest">{text.slice(typed.length)}</span>
          </p>
          <div className="tour-foot">
            <ol className="tour-dots" aria-hidden="true">
              {route.map((at, dot) => (
                <li key={at} data-state={dot < position ? "done" : dot === position ? "now" : "todo"} />
              ))}
            </ol>
            <div className="tour-actions">{actions}</div>
          </div>
          {last ? null : (
            <button type="button" className="tour-skip tour-out" onClick={onClose}>
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Neo's line, typed out at about 90 letters a second (never more than about 1.4 seconds); at once with reduced motion. `finish` shows the whole line. */
function useTyping(text: string, reduced: boolean) {
  const [shown, setShown] = useState({ text, length: reduced ? text.length : 0 });
  if (shown.text !== text) setShown({ text, length: reduced ? text.length : 0 });
  const length = shown.text === text ? shown.length : reduced ? text.length : 0;

  useEffect(() => {
    if (reduced) return;
    // Paced by the clock, not by counting ticks, so a busy or throttled page still finishes on time.
    const began = performance.now();
    const rate = Math.max(90, text.length / 1.4) / 1000;
    const timer = window.setInterval(() => {
      const reached = Math.min(text.length, Math.ceil((performance.now() - began) * rate));
      setShown((current) => (current.text === text && current.length < reached ? { text, length: reached } : current));
      if (reached >= text.length) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [text, reduced]);

  return { text: text.slice(0, length), length, finish: () => setShown({ text, length: text.length }) };
}
