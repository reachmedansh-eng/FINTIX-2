/**
 * The simulated market. Everything that shows or uses a price reads it from
 * here, so the watchlist, charts, order ticket and portfolio always agree.
 *
 * There is one clock for everyone: a market minute passes every MINUTE_MS of
 * real time, counted from a fixed starting instant. A price is a pure function
 * of (asset, minute), so any minute — past or present — can be worked out on
 * demand, a refresh never resets the market, and two tabs always see the same
 * numbers. Movement comes from layered smooth noise (slow drifts down to small
 * wiggles) plus a schedule of news events, each of which nudges one asset and
 * then fades. Nothing here is real market data.
 */

/** Real milliseconds per simulated market minute. */
export const MINUTE_MS = 3000;
/** The instant the simulated market started. */
export const EPOCH = Date.UTC(2026, 0, 1);

export const currentMinute = () => Math.floor((Date.now() - EPOCH) / MINUTE_MS);

/* ---- Assets --------------------------------------------------------- */

export type Asset = {
  ticker: string;
  name: string;
  sector: string;
  /** Typical price, in rupees. */
  base: number;
  /** How lively the price is: 1 is average. */
  vol: number;
  seed: number;
  /** Colour of the asset's marker. */
  tone: string;
};

/** Eight fictional companies. Any likeness to a real one is unintended. */
export const ASSETS: Asset[] = [
  { ticker: "NOVA", name: "Nova", sector: "Technology", base: 248.6, vol: 1.15, seed: 11, tone: "#4f8dff" },
  { ticker: "AERO", name: "Aero", sector: "Aviation", base: 164.2, vol: 1.25, seed: 23, tone: "#9b7bff" },
  { ticker: "VNTA", name: "Vanta", sector: "Consumer", base: 92.8, vol: 0.8, seed: 37, tone: "#ff7a8a" },
  { ticker: "KRON", name: "Kron", sector: "Energy", base: 310.1, vol: 1.05, seed: 41, tone: "#f4b63a" },
  { ticker: "MEDX", name: "Medix", sector: "Healthcare", base: 512.4, vol: 0.7, seed: 53, tone: "#37d79b" },
  { ticker: "TERA", name: "Terra", sector: "Food", base: 68.4, vol: 0.6, seed: 67, tone: "#c3a06b" },
  { ticker: "BOLT", name: "Bolt", sector: "Electric vehicles", base: 735, vol: 1.4, seed: 79, tone: "#2fc0ff" },
  { ticker: "LUMA", name: "Luma", sector: "Banking", base: 185.3, vol: 0.85, seed: 97, tone: "#d38bff" },
];

export const assetByTicker = (ticker: string) => ASSETS.find((asset) => asset.ticker === ticker);

/* ---- Noise ---------------------------------------------------------- */

/** A repeatable pseudo-random value in [-1, 1] for an integer and a seed. */
function hash(value: number, seed: number) {
  let mixed = Math.imul(value | 0, 0x27d4eb2d) ^ Math.imul(seed, 0x165667b1);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x85ebca6b);
  mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35);
  mixed ^= mixed >>> 16;
  return ((mixed >>> 0) / 4294967295) * 2 - 1;
}

/** Smooth noise: random values at whole numbers, eased between. */
function smooth(x: number, seed: number) {
  const whole = Math.floor(x);
  const part = x - whole;
  const ease = part * part * (3 - 2 * part);
  return hash(whole, seed) * (1 - ease) + hash(whole + 1, seed) * ease;
}

/** Layers from slow drifts (days) to small moves (minutes): [period in minutes, size]. */
const LAYERS: [number, number][] = [
  [5760, 0.06],
  [1440, 0.022],
  [360, 0.014],
  [90, 0.011],
  [20, 0.005],
  [5, 0.0022],
  [1, 0.0009],
];

/* ---- News events ---------------------------------------------------- */

export type MarketEvent = { id: number; minute: number; ticker: string; headline: string; effect: number };

/** Headlines per asset: the sign says which way the story moves the price. */
const STORIES: Record<string, [string, 1 | -1][]> = {
  NOVA: [
    ["Nova shows a faster, cheaper chip at its product event", 1],
    ["Nova wins a large cloud contract", 1],
    ["Nova delays its new laptop after a supplier problem", -1],
    ["A rival undercuts Nova's prices", -1],
  ],
  AERO: [
    ["Aero reports record holiday bookings", 1],
    ["Fuel prices fall, easing costs for Aero", 1],
    ["Storms ground part of Aero's fleet", -1],
    ["Fuel prices jump, squeezing Aero's margins", -1],
  ],
  VNTA: [
    ["Vanta's new snack range sells out in its first week", 1],
    ["Shoppers return to Vanta stores after a price cut", 1],
    ["Vanta recalls a batch of drinks", -1],
    ["Vanta warns of slower festive sales", -1],
  ],
  KRON: [
    ["Kron switches on a big new solar farm ahead of schedule", 1],
    ["Power demand rises in a heatwave, lifting Kron", 1],
    ["A fault shuts one of Kron's plants for repairs", -1],
    ["New rules cap what Kron can charge", -1],
  ],
  MEDX: [
    ["Medix medicine passes a key trial", 1],
    ["Medix opens three new hospitals", 1],
    ["Regulators ask Medix for more trial data", -1],
    ["Medix loses a patent case", -1],
  ],
  TERA: [
    ["A strong harvest lowers Terra's costs", 1],
    ["Terra signs a supply deal with a large grocer", 1],
    ["Poor rainfall raises Terra's crop costs", -1],
    ["Terra pauses a factory for a safety check", -1],
  ],
  BOLT: [
    ["Bolt delivers more cars than expected this quarter", 1],
    ["Bolt opens a battery plant", 1],
    ["Bolt recalls cars over a software fault", -1],
    ["A battery shortage slows Bolt's production", -1],
  ],
  LUMA: [
    ["Luma reports more customers saving with it", 1],
    ["Luma's loans perform better than expected", 1],
    ["Interest rate rise worries Luma's borrowers", -1],
    ["Luma is fined over a reporting error", -1],
  ],
};

/** A story breaks roughly every EVENT_EVERY market minutes. */
const EVENT_EVERY = 150;
/** Minutes for a story's effect to build, and the time scale over which it fades. */
const EVENT_RISE = 15;
const EVENT_FADE = 420;
/** Stories older than this no longer move prices noticeably. */
const EVENT_REACH = EVENT_FADE * 5;

/** The story scheduled in slot k. */
function eventAt(slot: number): MarketEvent {
  const minute = slot * EVENT_EVERY + Math.floor(((hash(slot, 5) + 1) / 2) * (EVENT_EVERY * 0.6));
  const asset = ASSETS[Math.floor(((hash(slot, 7) + 1) / 2) * ASSETS.length) % ASSETS.length];
  const stories = STORIES[asset.ticker];
  const [headline, sign] = stories[Math.floor(((hash(slot, 13) + 1) / 2) * stories.length) % stories.length];
  const effect = sign * (0.02 + ((hash(slot, 17) + 1) / 2) * 0.035);
  return { id: slot, minute, ticker: asset.ticker, headline, effect };
}

function eventPush(asset: Asset, minute: number) {
  let push = 0;
  const last = Math.floor(minute / EVENT_EVERY);
  for (let slot = last - Math.ceil(EVENT_REACH / EVENT_EVERY); slot <= last; slot += 1) {
    const event = eventAt(slot);
    const age = minute - event.minute;
    if (event.ticker !== asset.ticker || age < 0) continue;
    push += event.effect * Math.min(1, age / EVENT_RISE) * Math.exp(-age / EVENT_FADE);
  }
  return push;
}

/** Stories that have broken, newest first. */
export function recentEvents(minute: number, count = 6): MarketEvent[] {
  const found: MarketEvent[] = [];
  for (let slot = Math.floor(minute / EVENT_EVERY); found.length < count && slot > 0; slot -= 1) {
    const event = eventAt(slot);
    if (event.minute <= minute) found.push(event);
  }
  return found;
}

/* ---- Prices --------------------------------------------------------- */

/** The price of an asset at a market minute, in rupees, on a 5-paise tick. */
export function priceAt(asset: Asset, minute: number) {
  let wander = 0;
  for (const [period, size] of LAYERS) wander += smooth(minute / period, asset.seed * 31 + period) * size;
  // A very slow cycle, different for each asset, so trends last for days.
  const cycle = Math.sin((minute / (1440 * 9)) * Math.PI * 2 + asset.seed) * 0.04;
  const value = asset.base * Math.exp(wander * asset.vol + cycle + eventPush(asset, minute));
  return Math.round(value * 20) / 20;
}

/** In whole paise: the unit the account keeps its books in. */
export const paiseAt = (asset: Asset, minute: number) => Math.round(priceAt(asset, minute) * 100);

/** Change over the last simulated day. */
export function dayChange(asset: Asset, minute: number) {
  const now = priceAt(asset, minute);
  const before = priceAt(asset, minute - 1440);
  return { price: now, change: now - before, percent: ((now - before) / before) * 100 };
}

/* ---- Candles -------------------------------------------------------- */

export type Candle = { open: number; high: number; low: number; close: number; start: number };

export const FRAMES = [
  { id: "5m", label: "5 min", minutes: 5 },
  { id: "15m", label: "15 min", minutes: 15 },
  { id: "1h", label: "1 hour", minutes: 60 },
  { id: "1d", label: "1 day", minutes: 1440 },
] as const;
export type FrameId = (typeof FRAMES)[number]["id"];

/** The last `count` candles of one size, ending at `minute`. The newest one is still forming. */
export function candlesFor(asset: Asset, frame: FrameId, minute: number, count = 48): Candle[] {
  const size = FRAMES.find((entry) => entry.id === frame)?.minutes ?? 5;
  const step = Math.max(1, Math.floor(size / 24));
  const current = Math.floor(minute / size);
  const candles: Candle[] = [];
  for (let index = current - count + 1; index <= current; index += 1) {
    const start = index * size;
    const end = Math.min(start + size, minute);
    const open = priceAt(asset, start);
    const close = priceAt(asset, end);
    let high = Math.max(open, close);
    let low = Math.min(open, close);
    for (let at = start + step; at < end; at += step) {
      const price = priceAt(asset, at);
      if (price > high) high = price;
      if (price < low) low = price;
    }
    candles.push({ open, high, low, close, start });
  }
  return candles;
}

/** A short label for a chart axis: the simulated time of day, or the day for daily candles. */
export function clockLabel(minute: number, frame: FrameId = "5m") {
  if (frame === "1d") return `Day ${Math.floor(minute / 1440).toLocaleString("en-IN")}`;
  const inDay = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(inDay / 60)).padStart(2, "0")}:${String(inDay % 60).padStart(2, "0")}`;
}

/** A clock label for a market minute: the simulated day and time. */
export function stamp(minute: number, frame: FrameId = "5m") {
  const day = Math.floor(minute / 1440);
  const inDay = ((minute % 1440) + 1440) % 1440;
  const time = `${String(Math.floor(inDay / 60)).padStart(2, "0")}:${String(inDay % 60).padStart(2, "0")}`;
  return frame === "1d" ? `Day ${day.toLocaleString("en-IN")}` : `Day ${day.toLocaleString("en-IN")}, ${time}`;
}
