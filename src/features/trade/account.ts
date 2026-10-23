"use client";

import { useSyncExternalStore } from "react";
import { ASSETS, assetByTicker, currentMinute, paiseAt } from "./engine";

/**
 * The player's simulated account: the single source of truth for cash,
 * holdings and trades. Money is kept in whole paise so every figure adds up
 * exactly. Prices are never passed in from the screen: a trade is filled at
 * the market's price for the minute it is confirmed.
 *
 * Kept in this browser only (there is no backend yet), behind a small
 * surface so a server can take over later without the screens changing.
 */

export const STARTING_CASH = 100_000_00;

export type Holding = { qty: number; /** What the shares still held cost, in paise. */ cost: number };

export type Trade = {
  /** Made when the order is reviewed: the same order can never be filled twice. */
  id: string;
  side: "buy" | "sell";
  ticker: string;
  qty: number;
  /** Fill price per share, in paise. */
  price: number;
  /** qty × price, in paise. */
  total: number;
  /** For a sale: proceeds minus what those shares cost. */
  realised?: number;
  minute: number;
  at: number;
};

export type Account = {
  version: 1;
  cash: number;
  holdings: Record<string, Holding>;
  trades: Trade[];
  realised: number;
};

const KEY = "fintix.sim.account.v1";
const FRESH: Account = { version: 1, cash: STARTING_CASH, holdings: {}, trades: [], realised: 0 };

let cache: Account | null = null;
/** Set once the browser has refused to save the account; from then on it lasts for this visit only. */
let unsaved = false;
const listeners = new Set<() => void>();

function valid(stored: unknown): stored is Account {
  const value = stored as Account | null;
  return !!value && value.version === 1 && Number.isInteger(value.cash) && typeof value.holdings === "object" && Array.isArray(value.trades);
}

function read(): Account {
  if (cache) return cache;
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    cache = valid(stored) ? stored : FRESH;
  } catch {
    cache = FRESH;
  }
  return cache;
}

/** Saves the account. False when the browser refused (private mode, a full disk): the account then lasts for this visit only. */
function write(next: Account) {
  cache = next;
  let saved = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    saved = false;
  }
  unsaved = unsaved || !saved;
  listeners.forEach((listener) => listener());
  return saved;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The account, live. Null during the server render, where there is no saved account to read. */
export const useAccount = () => useSyncExternalStore(subscribe, read, () => null);

/** True once a change to the account could not be saved in this browser. */
export const useUnsaved = () => useSyncExternalStore(subscribe, () => unsaved, () => false);

export const orderId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export type Order = { id: string; side: "buy" | "sell"; ticker: string; qty: number };
/** A filled order says whether it was saved: an unsaved trade still counts for this visit, but the player must be told it won't survive a reload. */
export type Fill = { ok: true; trade: Trade; saved: boolean } | { ok: false; reason: string };

/** Largest quantity an order could be for right now. */
export function maxQty(account: Account, side: "buy" | "sell", ticker: string, minute: number) {
  const asset = assetByTicker(ticker);
  if (!asset) return 0;
  if (side === "sell") return account.holdings[ticker]?.qty ?? 0;
  return Math.floor(account.cash / paiseAt(asset, minute));
}

const shares = (count: number) => `${count} share${count === 1 ? "" : "s"}`;
const money = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * What an order would do to the account at a given minute's price, or why it
 * can't be placed (with what to change). This is the one place an order is
 * priced and checked: the ticket's estimate, the review's before-and-after
 * and the fill itself all come from here, so they can never disagree.
 */
export type Quote =
  | {
      ok: true;
      side: "buy" | "sell";
      qty: number;
      /** Price per share at the quoted minute, in paise. */
      price: number;
      /** qty × price, in paise. */
      total: number;
      cash: { before: number; after: number };
      held: { before: number; after: number };
      /** Value of the position after the order, at the quoted price. */
      holdingAfter: number;
      /** Cost of the shares still held after the order (average-cost basis). */
      costAfter: number;
      /** For a sale: proceeds minus what those shares cost. */
      realised?: number;
      /** This asset's share of the market value of all holdings, before and after (0–1): how its building in the city will change. */
      share: { before: number; after: number };
    }
  | { ok: false; field: "qty" | "asset"; reason: string };

/** The asset's share of all holdings' market value at one minute, before and after its quantity changes. */
function shareChange(account: Account, price: number, heldBefore: number, heldAfter: number, minute: number) {
  const invested = ASSETS.reduce((sum, asset) => sum + (account.holdings[asset.ticker]?.qty ?? 0) * paiseAt(asset, minute), 0);
  const others = invested - heldBefore * price;
  const before = invested ? (heldBefore * price) / invested : 0;
  const after = others + heldAfter * price ? (heldAfter * price) / (others + heldAfter * price) : 0;
  return { before, after };
}

export function quote(account: Account, order: { side: "buy" | "sell"; ticker: string; qty: number | null }, minute: number): Quote {
  const asset = assetByTicker(order.ticker);
  if (!asset) return { ok: false, field: "asset", reason: "That asset isn't in this market." };
  const qty = order.qty;
  if (qty === null || !Number.isFinite(qty) || !Number.isInteger(qty)) return { ok: false, field: "qty", reason: "Enter a whole number of shares, such as 5." };
  if (qty < 1) return { ok: false, field: "qty", reason: "Quantity must be at least 1 share." };
  const price = paiseAt(asset, minute);
  const total = price * qty;
  const held = account.holdings[order.ticker] ?? { qty: 0, cost: 0 };
  if (order.side === "buy") {
    if (total > account.cash) {
      const most = Math.floor(account.cash / price);
      return {
        ok: false,
        field: "qty",
        reason: `Needs ${money(total - account.cash)} more virtual cash: ${shares(qty)} cost ${money(total)} and you have ${money(account.cash)}. ${most ? `You can buy up to ${shares(most)}.` : "Sell something first to free up cash."}`,
      };
    }
    return {
      ok: true,
      side: "buy",
      qty,
      price,
      total,
      cash: { before: account.cash, after: account.cash - total },
      held: { before: held.qty, after: held.qty + qty },
      holdingAfter: (held.qty + qty) * price,
      costAfter: held.cost + total,
      share: shareChange(account, price, held.qty, held.qty + qty, minute),
    };
  }
  if (qty > held.qty) return { ok: false, field: "qty", reason: held.qty ? `You hold ${shares(held.qty)}. Sell ${held.qty} or fewer.` : `You don't own any ${asset.name} to sell.` };
  // The shares sold take their share of the cost with them, at the average purchase price.
  const costOut = Math.round((held.cost * qty) / held.qty);
  const left = held.qty - qty;
  return {
    ok: true,
    side: "sell",
    qty,
    price,
    total,
    cash: { before: account.cash, after: account.cash + total },
    held: { before: held.qty, after: left },
    holdingAfter: left * price,
    costAfter: held.cost - costOut,
    realised: total - costOut,
    share: shareChange(account, price, held.qty, left, minute),
  };
}

/**
 * Fill an order at this minute's price, or explain why it cannot be filled.
 * The account is checked and changed in one step, so a refused order leaves
 * it exactly as it was, and an order id can only ever be filled once.
 */
export function execute(order: Order): Fill {
  const account = read();
  if (account.trades.some((trade) => trade.id === order.id)) return { ok: false, reason: "This order has already been placed." };
  const minute = currentMinute();
  const priced = quote(account, order, minute);
  if (!priced.ok) return { ok: false, reason: priced.reason };

  const holdings = { ...account.holdings };
  if (priced.held.after === 0) delete holdings[order.ticker];
  else holdings[order.ticker] = { qty: priced.held.after, cost: priced.costAfter };
  const trade: Trade = { id: order.id, side: order.side, ticker: order.ticker, qty: priced.qty, price: priced.price, total: priced.total, realised: priced.realised, minute, at: Date.now() };
  const saved = write({ ...account, cash: priced.cash.after, holdings, trades: [trade, ...account.trades], realised: account.realised + (priced.realised ?? 0) });
  return { ok: true, trade, saved };
}

/* ---- Valuation ------------------------------------------------------ */

export type Position = {
  ticker: string;
  qty: number;
  cost: number;
  average: number;
  price: number;
  value: number;
  unrealised: number;
};

/** The account valued at one minute's prices. Everything is in paise. */
export function value(account: Account, minute: number) {
  const positions: Position[] = ASSETS.filter((asset) => account.holdings[asset.ticker]?.qty).map((asset) => {
    const held = account.holdings[asset.ticker];
    const price = paiseAt(asset, minute);
    const worth = price * held.qty;
    return { ticker: asset.ticker, qty: held.qty, cost: held.cost, average: held.cost / held.qty, price, value: worth, unrealised: worth - held.cost };
  });
  const invested = positions.reduce((sum, position) => sum + position.value, 0);
  const unrealised = positions.reduce((sum, position) => sum + position.unrealised, 0);
  return { positions, invested, unrealised, realised: account.realised, cash: account.cash, total: account.cash + invested };
}
