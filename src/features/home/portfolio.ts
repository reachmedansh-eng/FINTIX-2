import { STARTING_CASH, value, type Account, type Trade } from "@/features/trade/account";
import { ASSETS, assetByTicker, dayChange, paiseAt, type Asset } from "@/features/trade/engine";

/**
 * Everything Home shows about the portfolio, derived from the simulator's one
 * account and one market. Nothing here keeps its own copy of a price or a
 * balance: each figure is worked out from the account and the market minute.
 */

export type Holding = {
  asset: Asset;
  qty: number;
  /** Market value now, in paise. */
  value: number;
  /** Share of the total market value of holdings, 0–1. */
  weight: number;
  /** Price now, in rupees. */
  price: number;
  /** Change over the last simulated day, in percent. */
  dayPercent: number;
  unrealised: number;
  cost: number;
};

/** The account's holdings, largest first, each with its weight in the portfolio. */
export function holdings(account: Account, minute: number): Holding[] {
  const valuation = value(account, minute);
  const total = valuation.invested;
  return valuation.positions
    .map((position) => {
      const asset = assetByTicker(position.ticker) as Asset;
      const day = dayChange(asset, minute);
      return {
        asset,
        qty: position.qty,
        value: position.value,
        weight: total > 0 ? position.value / total : 0,
        price: day.price,
        dayPercent: day.percent,
        unrealised: position.unrealised,
        cost: position.cost,
      };
    })
    .sort((first, second) => second.value - first.value);
}

/**
 * What the portfolio was worth at an earlier minute: the trades made up to
 * then are replayed from the starting cash, and the shares held at that point
 * are priced at that minute. Before the first trade it is simply the cash.
 */
export function worthAt(account: Account, minute: number) {
  let cash = STARTING_CASH;
  const held: Record<string, number> = {};
  for (const trade of [...account.trades].reverse()) {
    if (trade.minute > minute) break;
    cash += trade.side === "buy" ? -trade.total : trade.total;
    held[trade.ticker] = (held[trade.ticker] ?? 0) + (trade.side === "buy" ? trade.qty : -trade.qty);
  }
  return Object.entries(held).reduce((sum, [ticker, qty]) => {
    const asset = assetByTicker(ticker);
    return asset && qty > 0 ? sum + qty * paiseAt(asset, minute) : sum;
  }, cash);
}

export const RANGES = [
  { id: "1D", label: "1D", minutes: 1440, words: "today" },
  { id: "1W", label: "1W", minutes: 1440 * 7, words: "this week" },
  { id: "1M", label: "1M", minutes: 1440 * 30, words: "this month" },
  { id: "3M", label: "3M", minutes: 1440 * 90, words: "in 3 months" },
  { id: "1Y", label: "1Y", minutes: 1440 * 365, words: "this year" },
] as const;
export type RangeId = (typeof RANGES)[number]["id"];

/** Total value now, and how it has moved over a range. */
export function portfolioSummary(account: Account, minute: number, range: RangeId) {
  const valuation = value(account, minute);
  const span = RANGES.find((entry) => entry.id === range) ?? RANGES[0];
  const then = worthAt(account, minute - span.minutes);
  const change = valuation.total - then;
  return { ...valuation, change, percent: then ? (change / then) * 100 : 0, words: span.words };
}

/**
 * The holding that did most to the portfolio's day: the largest move weighted
 * by its share of holdings. Reported as that move and that share (both read
 * from the market and the account), never as an attributed rupee amount,
 * which would be wrong for shares bought during the day.
 */
export function biggestEffect(list: Holding[]) {
  let best: Holding | null = null;
  for (const holding of list) if (holding.dayPercent && (!best || Math.abs(holding.weight * holding.dayPercent) > Math.abs(best.weight * best.dayPercent))) best = holding;
  return best;
}

/** Market assets ranked by today's move: the biggest gainers or the biggest fallers. */
export function movers(minute: number, direction: "up" | "down", count = 3) {
  return ASSETS.map((asset) => ({ asset, ...dayChange(asset, minute) }))
    .filter((entry) => (direction === "up" ? entry.change >= 0 : entry.change < 0))
    .sort((first, second) => (direction === "up" ? second.percent - first.percent : first.percent - second.percent))
    .slice(0, count);
}

/** "2m ago", from a trade's real time. */
export function ago(at: number, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Simulator milestones, checked against the actual trade history: the first
 * one not yet reached. They reward understanding (owning something, spreading
 * across assets, closing a position), never the number of trades.
 */
export function nextMilestone(trades: Trade[], account: Account) {
  const held = Object.values(account.holdings).filter((holding) => holding.qty > 0).length;
  const steps = [
    { title: "Make your first trade", done: Math.min(trades.length, 1), total: 1 },
    { title: "Hold 3 different assets", done: Math.min(held, 3), total: 3 },
    { title: "Make your first sale", done: Math.min(trades.filter((trade) => trade.side === "sell").length, 1), total: 1 },
  ];
  return steps.find((step) => step.done < step.total) ?? null;
}

/** Every asset ranked by the size of today's move, largest first, for the market pulse. */
export function pulse(minute: number) {
  return ASSETS.map((asset) => ({ asset, ...dayChange(asset, minute) })).sort((first, second) => Math.abs(second.percent) - Math.abs(first.percent));
}

/** A lesson from the Learning Hub chosen for what the player holds or just did, with the reason in their own figures. */
export type LessonPick = { module: string; lesson: string; reason: string };

/**
 * Lessons that fit the player's situation, most pressing first: one holding
 * outweighing the rest (diversification), a sale just made (realised and
 * unrealised), a purchase just made (what a position is), or nothing bought
 * yet (making a first trade). The caller takes the first one not yet done.
 */
export function lessonsFor(account: Account, list: Holding[]): LessonPick[] {
  const picks: LessonPick[] = [];
  const largest = list[0];
  if (largest && largest.weight >= 0.4) {
    picks.push({
      module: "risk",
      lesson: "diversification",
      reason: list.length === 1 ? `All of your holdings are in ${largest.asset.name}.` : `${largest.asset.name} is ${(Math.round(largest.weight * 1000) / 10).toFixed(1)}% of your holdings.`,
    });
  }
  const last = account.trades[0];
  const lastAsset = last ? assetByTicker(last.ticker) : undefined;
  if (last && lastAsset && last.side === "sell") picks.push({ module: "what-is-trading", lesson: "unrealized-vs-realized", reason: `You sold ${last.qty} ${lastAsset.name}: that result is now realised.` });
  if (last && lastAsset && last.side === "buy") picks.push({ module: "what-is-trading", lesson: "understanding-a-position", reason: `You bought ${last.qty} ${lastAsset.name}: here is what you now own.` });
  if (!account.trades.length) picks.push({ module: "making-a-trade", lesson: "executing-a-trade", reason: "Everything is still in cash, ready for a first order." });
  if (list.length) picks.push({ module: "what-is-trading", lesson: "price-movement-and-pnl", reason: "Your buildings rise and fall with their prices." });
  return picks;
}
