"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { maxQty, quote, value as valueOf, type Account, type Trade, type value } from "./account";
import { CandleChart } from "./charts";
import { ASSETS, FRAMES, assetByTicker, candlesFor, clockLabel, dayChange, paiseAt, recentEvents, stamp, type Asset, type FrameId } from "./engine";
import { Glyph, Mark, inr, rupees, shares, signedInr, signedPercent, signedRupees, tone } from "./ui";

/** Tutorial emphasis: "on" lights a block, "off" dims it, undefined leaves it alone. */
export type Focus = "on" | "off" | undefined;
export const focusOf = <K extends string>(focus: K | null | undefined, key: K): Focus => (focus ? (focus === key ? "on" : "off") : undefined);

/** Lessons that explain a step of a trade, linked where that step happens. Lessons open directly, whatever the hub's module locks. */
export const LESSONS = {
  marketOrder: { href: "/learn/making-a-trade/choosing-an-order-type", label: "What is a market order?" },
  position: { href: "/learn/what-is-trading/understanding-a-position", label: "What you own after buying" },
  realised: { href: "/learn/what-is-trading/unrealized-vs-realized", label: "Realised vs unrealised P/L" },
  pnl: { href: "/learn/what-is-trading/price-movement-and-pnl", label: "How price moves become P/L" },
  diversification: { href: "/learn/risk/diversification", label: "Why diversification matters" },
  size: { href: "/learn/risk/position-size-and-risk", label: "Position size and risk" },
} as const;

export type Lesson = (typeof LESSONS)[keyof typeof LESSONS];

export function LessonLink({ lesson }: { lesson: Lesson }) {
  return (
    <Link className="sim-lesson" href={lesson.href}>
      <span aria-hidden="true">?</span> {lesson.label}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Market list                                                          */
/* ------------------------------------------------------------------ */

export function Watchlist({ minute, selected, onSelect, focus }: { minute: number; selected: string | null; onSelect: (ticker: string) => void; focus?: Focus }) {
  return (
    <section className="sim-watch" data-focus={focus} aria-labelledby="sim-watch-title">
      <header className="sim-watch-head">
        <h2 id="sim-watch-title" className="sim-title">
          Market
        </h2>
        <small>Simulated prices</small>
      </header>
      <ul>
        {ASSETS.map((asset) => {
          const day = dayChange(asset, minute);
          return (
            <li key={asset.ticker}>
              <button type="button" aria-pressed={asset.ticker === selected} onClick={() => onSelect(asset.ticker)}>
                <Mark asset={asset} size={24} />
                <span className="sim-watch-name">
                  <b>{asset.name}</b>
                  <small>{asset.sector}</small>
                </span>
                <span className="sim-watch-price">
                  <b>{rupees(day.price)}</b>
                  <small data-tone={tone(day.change)}>{signedPercent(day.percent)}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* One asset: identity, price and movement                              */
/* ------------------------------------------------------------------ */

/**
 * An asset's identity and price, the same on Home and the desk: name and
 * ticker, sector, the simulated price now and today's move. The move carries
 * an arrow and a sign as well as its colour.
 */
export function AssetHeading({
  asset,
  minute,
  owned,
  as: Tag = "h2",
  id,
  size = "m",
}: {
  asset: Asset;
  minute: number;
  owned?: number;
  as?: "h1" | "h2";
  id?: string;
  /** "l" heads the trading floor (the screen's subject); "m" heads a panel. */
  size?: "m" | "l";
}) {
  const day = dayChange(asset, minute);
  const direction = tone(day.change) === "up" ? "up" : tone(day.change) === "down" ? "down" : null;
  return (
    <header className="sim-heading" data-size={size}>
      <Mark asset={asset} size={size === "l" ? 32 : 24} />
      <div className="sim-heading-name">
        <Tag id={id} className="px">
          {asset.name}
        </Tag>
        <p>
          <span className="sim-ticker">{asset.ticker}</span> {asset.sector}
          {owned !== undefined ? (
            owned > 0 ? (
              <span className="sim-heading-own">
                <i aria-hidden="true" /> You own {shares(owned)}
              </span>
            ) : (
              <span>Not owned</span>
            )
          ) : null}
        </p>
      </div>
      <p className="sim-heading-price">
        <b>{rupees(day.price)}</b>
        <span data-tone={tone(day.change)}>
          {direction ? <Glyph name={direction} size={11} /> : null}
          {signedRupees(day.change)} ({signedPercent(day.percent)}) <small>today</small>
        </span>
      </p>
    </header>
  );
}

/**
 * The player's position in one asset, from the account at today's prices:
 * shares, average cost, value, unrealised P/L and share of holdings. Nothing
 * when the asset isn't held.
 */
export function PositionFacts({ account, minute, ticker }: { account: Account; minute: number; ticker: string }) {
  const valuation = valueOf(account, minute);
  const position = valuation.positions.find((each) => each.ticker === ticker);
  if (!position) return null;
  const percent = position.cost ? (position.unrealised / position.cost) * 100 : 0;
  const share = valuation.invested ? (position.value / valuation.invested) * 100 : 0;
  return (
    <dl className="sim-facts">
      <div>
        <dt>Shares held</dt>
        <dd>{position.qty}</dd>
      </div>
      <div>
        <dt>Holding value</dt>
        <dd>{inr(position.value)}</dd>
      </div>
      <div>
        <dt>Average cost</dt>
        <dd>{inr(Math.round(position.average))}</dd>
      </div>
      <div>
        <dt>Unrealised P/L</dt>
        <dd data-tone={tone(position.unrealised)}>
          {signedInr(position.unrealised)} <small>({signedPercent(percent)})</small>
        </dd>
      </div>
      <div>
        <dt>Share of holdings</dt>
        <dd>{share.toFixed(1)}%</dd>
      </div>
    </dl>
  );
}

/**
 * A segmented control: one choice of a few, the chosen one pressed and
 * marked by the accent line. One line per control slides to the chosen
 * option (its own transform, so nothing else restyles), showing where the
 * selection came from. Shared by every period and size picker.
 */
export function Segments<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  const index = Math.max(0, options.findIndex((option) => option.id === value));
  return (
    <div className="sim-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.id} type="button" aria-pressed={option.id === value} onClick={() => onChange(option.id)}>
          {option.label}
        </button>
      ))}
      <i className="sim-seg-mark" aria-hidden="true" style={{ width: `${100 / options.length}%`, transform: `translateX(${index * 100}%)` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One asset: price, movement and chart                                 */
/* ------------------------------------------------------------------ */

export function AssetView({
  asset,
  minute,
  focus,
  height = 320,
  owned,
  aside,
  children,
}: {
  asset: Asset;
  minute: number;
  focus?: Focus;
  height?: number;
  owned?: number;
  /** Beside the heading, where price and position are read together. */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const [frame, setFrame] = useState<FrameId>("5m");
  const candles = useMemo(() => candlesFor(asset, frame, minute, 48), [asset, frame, minute]);
  const label = FRAMES.find((entry) => entry.id === frame)?.label ?? "";
  return (
    <section className="sim-block sim-asset" data-focus={focus} aria-labelledby="sim-asset-title">
      {aside ? (
        <div className="sim-asset-top">
          <AssetHeading asset={asset} minute={minute} owned={owned} id="sim-asset-title" />
          {aside}
        </div>
      ) : (
        <AssetHeading asset={asset} minute={minute} owned={owned} id="sim-asset-title" />
      )}
      <div className="sim-asset-bar">
        <p className="sim-note">
          Each candle is {label} of simulated trading. The last one is still forming.
        </p>
        <Segments label="Candle size" options={FRAMES} value={frame} onChange={setFrame} />
      </div>
      <CandleChart
        candles={candles}
        height={height}
        label={`${asset.name}, ${label} candles, simulated prices`}
        stampFor={(index) => stamp(candles[index].start, frame)}
        tickFor={(index) => clockLabel(candles[index].start, frame)}
      />
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Order ticket                                                         */
/* ------------------------------------------------------------------ */

export type TicketFocus = "asset" | "qty" | "value" | "cash" | "review";

/** Parse what was typed into the quantity box: a whole number of shares, or null. */
export const parseQty = (text: string) => (/^\d{1,6}$/.test(text.trim()) ? Number(text.trim()) : null);

export function Ticket({
  asset,
  minute,
  account,
  side,
  onSide,
  qty,
  onQty,
  onReview,
  reveal = 5,
  focus,
}: {
  asset: Asset;
  minute: number;
  account: Account;
  side: "buy" | "sell";
  /** Without it the ticket can only buy (as in the tutorial). */
  onSide?: (side: "buy" | "sell") => void;
  qty: string;
  onQty: (qty: string) => void;
  onReview: () => void;
  /** How many of the ticket's parts are shown, in order: asset, quantity, value, cash, review. */
  reveal?: number;
  focus?: TicketFocus | null;
}) {
  const price = paiseAt(asset, minute);
  const count = parseQty(qty);
  const most = maxQty(account, side, asset.ticker, minute);
  const owned = account.holdings[asset.ticker]?.qty ?? 0;
  // The engine prices and checks the order; the ticket only shows what it says.
  const priced = qty.trim() === "" ? null : quote(account, { side, ticker: asset.ticker, qty: count }, minute);
  const problem = priced && !priced.ok ? priced.reason : null;
  const ready = !!priced && priced.ok;
  const step = (change: number) => onQty(String(Math.max(1, Math.min(Math.max(1, most), (count ?? 0) + change))));

  return (
    <section className="sim-block sim-ticket" aria-labelledby="sim-ticket-title" data-side={side}>
      <h2 id="sim-ticket-title" className="sim-title">
        Order
      </h2>
      {onSide ? (
        <>
          <div className="sim-sides" role="group" aria-label="Buy or sell">
            <button type="button" data-side="buy" aria-pressed={side === "buy"} onClick={() => onSide("buy")}>
              Buy
            </button>
            <button type="button" data-side="sell" aria-pressed={side === "sell"} onClick={() => onSide("sell")} disabled={!owned && side !== "sell"} aria-describedby={owned ? undefined : "sim-sell-why"}>
              Sell
            </button>
          </div>
          {owned ? null : (
            <p id="sim-sell-why" className="sim-why">
              You don&apos;t own any {asset.name} yet, so there&apos;s nothing to sell.
            </p>
          )}
        </>
      ) : null}

      <div className="sim-ticket-row sim-ticket-asset" data-focus={focusOf(focus, "asset")}>
        <Mark asset={asset} size={32} />
        <p>
          <b>{asset.name}</b>
          <small>{asset.ticker} · {asset.sector}</small>
        </p>
        <p className="sim-ticket-price">
          <b>{inr(price)}</b>
          <small>per share, now</small>
        </p>
      </div>

      {reveal >= 2 ? (
        <div className="sim-ticket-row sim-qty" data-focus={focusOf(focus, "qty")}>
          <div className="sim-qty-head">
            <label htmlFor="sim-qty-input">Quantity (shares)</label>
            {most > 0 ? (
              <button type="button" className="sim-qty-max" onClick={() => onQty(String(most))}>
                {side === "buy" ? `Max ${most}` : `All ${most}`}
              </button>
            ) : null}
          </div>
          <div className="sim-qty-box" data-error={!!problem}>
            <button type="button" aria-label="One share fewer" onClick={() => step(-1)} disabled={!count || count <= 1}>
              <Glyph name="minus" />
            </button>
            <input
              id="sim-qty-input"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={qty}
              onChange={(event) => onQty(event.target.value.replace(/[^\d]/g, "").slice(0, 6))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && ready) onReview();
              }}
              aria-invalid={!!problem}
              aria-describedby="sim-qty-help"
            />
            <button type="button" aria-label="One share more" onClick={() => step(1)} disabled={count !== null && count >= most}>
              <Glyph name="plus" />
            </button>
          </div>
          <p id="sim-qty-help" className="sim-qty-help" data-error={!!problem} aria-live="polite">
            {problem ? <Glyph name="close" size={12} /> : null}
            <span>{problem ?? (side === "buy" ? `Your cash covers up to ${most} share${most === 1 ? "" : "s"} at this price.` : `You own ${owned} share${owned === 1 ? "" : "s"}.`)}</span>
          </p>
        </div>
      ) : null}

      {reveal >= 3 ? (
        <div className="sim-ticket-row sim-ticket-line" data-lead data-focus={focusOf(focus, "value")}>
          <span>Estimated {side === "buy" ? "cost" : "proceeds"}</span>
          {priced?.ok ? <b>{inr(priced.total)}</b> : <b className="sim-dash">—</b>}
          <small>{priced?.ok ? `${priced.qty} × ${inr(priced.price)}` : "price × quantity"}</small>
          {priced?.ok && reveal >= 5 ? (
            <small className="sim-ticket-after">
              After: {inr(priced.cash.after)} cash · {priced.held.after} share{priced.held.after === 1 ? "" : "s"} held
            </small>
          ) : null}
        </div>
      ) : null}

      {reveal >= 4 ? (
        <div className="sim-ticket-row sim-ticket-line" data-focus={focusOf(focus, "cash")}>
          <span>{side === "buy" ? "Available cash" : "Shares you own"}</span>
          <b>{side === "buy" ? inr(account.cash) : owned}</b>
        </div>
      ) : null}

      {reveal >= 5 ? (
        <>
          <button type="button" className="sim-button" data-tone={side} data-focus={focusOf(focus, "review")} disabled={!ready} onClick={onReview} aria-describedby={ready ? undefined : "sim-review-why"}>
            Review {side === "buy" ? "buy" : "sell"} order
          </button>
          {ready ? null : (
            <p id="sim-review-why" className="sim-why">
              {problem ? "Change the quantity above to continue." : "Enter how many shares, then review the order before anything is placed."}
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Review and confirm                                                   */
/* ------------------------------------------------------------------ */

/** A figure before and after the order. */
function Change({ before, after }: { before: string | number; after: string | number }) {
  return (
    <dd className="sim-change">
      <span>{before}</span>
      <Glyph name="arrow" size={11} />
      <b>{after}</b>
    </dd>
  );
}

export function Review({
  asset,
  minute,
  account,
  side,
  qty,
  onEdit,
  onConfirm,
  error,
  busy,
  learn,
}: {
  asset: Asset;
  minute: number;
  account: Account;
  side: "buy" | "sell";
  qty: number;
  onEdit: () => void;
  onConfirm: () => void;
  error?: string | null;
  /** The order is being placed: both actions wait. */
  busy?: boolean;
  /** Link the lesson on market orders (left out in the tutorial, which explains it itself). */
  learn?: boolean;
}) {
  // The estimate is the engine's own quote at this minute's price.
  const priced = quote(account, { side, ticker: asset.ticker, qty }, minute);
  return (
    <section className="sim-block sim-review" data-side={side} aria-labelledby="sim-review-title" aria-busy={busy || undefined}>
      <h2 id="sim-review-title" className="sim-title">
        Review your order
      </h2>
      <p className="sim-review-lead">
        You are {side === "buy" ? "buying" : "selling"}
        <b>
          {qty} share{qty === 1 ? "" : "s"} of {asset.name} <span className="sim-ticker">{asset.ticker}</span>
        </b>
      </p>
      {priced.ok ? (
        <dl className="sim-review-lines">
          <div>
            <dt>Price per share, now</dt>
            <dd>{inr(priced.price)}</dd>
          </div>
          <div className="sim-review-total">
            <dt>Estimated {side === "buy" ? "cost" : "proceeds"}</dt>
            <dd>{inr(priced.total)}</dd>
          </div>
          <div>
            <dt>Cash</dt>
            <Change before={inr(priced.cash.before)} after={inr(priced.cash.after)} />
          </div>
          <div>
            <dt>{asset.name} shares</dt>
            <Change before={priced.held.before} after={priced.held.after} />
          </div>
          <div>
            <dt>Holding value after</dt>
            <dd>{inr(priced.holdingAfter)}</dd>
          </div>
          <div>
            <dt>Share of your holdings</dt>
            <Change before={`${(priced.share.before * 100).toFixed(1)}%`} after={`${(priced.share.after * 100).toFixed(1)}%`} />
          </div>
          {priced.realised !== undefined ? (
            <div>
              <dt>Estimated realised {priced.realised >= 0 ? "gain" : "loss"}</dt>
              <dd data-tone={tone(priced.realised)}>{signedInr(priced.realised)}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="sim-error" role="alert">
          {priced.reason}
        </p>
      )}
      <p className="sim-note">These are estimates at the current simulated price. A market order fills at the price at the moment you confirm, which may differ slightly.</p>
      {learn ? <LessonLink lesson={LESSONS.marketOrder} /> : null}
      {error ? (
        <p className="sim-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="sim-review-actions">
        <button type="button" className="sim-button" data-tone="quiet" onClick={onEdit} disabled={busy}>
          <Glyph name="back" size={12} /> Edit
        </button>
        <button type="button" className="sim-button" data-tone={side} onClick={onConfirm} disabled={busy || !priced.ok} aria-disabled={busy || !priced.ok} aria-busy={busy || undefined}>
          {busy ? (
            <>
              Placing order
              <i className="sim-busy" aria-hidden="true">
                <i />
                <i />
                <i />
              </i>
            </>
          ) : error ? (
            "Try again"
          ) : (
            `Confirm ${side === "buy" ? "buy" : "sell"}`
          )}
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Receipt                                                              */
/* ------------------------------------------------------------------ */

/**
 * What actually happened, read from the filled trade and the account after
 * it: the fill price (which can differ from the reviewed one), the total,
 * any realised gain or loss, the cash left and the position now held.
 */
export function Receipt({ trade, asset, account, minute, saved, actions, consequence }: { trade: Trade; asset: Asset; account: Account; minute: number; saved: boolean; actions: ReactNode; consequence?: string }) {
  const bought = trade.side === "buy";
  const valuation = valueOf(account, minute);
  const position = valuation.positions.find((each) => each.ticker === trade.ticker);
  const share = position && valuation.invested ? (position.value / valuation.invested) * 100 : 0;
  return (
    <section className="sim-block sim-receipt" aria-labelledby="sim-receipt-title" data-side={trade.side}>
      <h2 id="sim-receipt-title" className="sim-hud">
        Order filled
      </h2>
      <p className="sim-receipt-lead" role="status">
        <Glyph name="check" />
        <b>
          {bought ? "Bought" : "Sold"} {trade.qty} {asset.name} share{trade.qty === 1 ? "" : "s"}
        </b>
      </p>
      <dl className="sim-review-lines">
        <div>
          <dt>Filled at</dt>
          <dd>{inr(trade.price)} per share</dd>
        </div>
        <div className="sim-review-total">
          <dt>Total {bought ? "cost" : "proceeds"}</dt>
          <dd>{inr(trade.total)}</dd>
        </div>
        {trade.realised !== undefined ? (
          <div>
            <dt>Realised {trade.realised >= 0 ? "gain" : "loss"}</dt>
            <dd data-tone={tone(trade.realised)}>{signedInr(trade.realised)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Cash now</dt>
          <dd>{inr(account.cash)}</dd>
        </div>
        <div>
          <dt>You now own</dt>
          <dd>{position ? `${position.qty} share${position.qty === 1 ? "" : "s"} · ${share.toFixed(1)}% of holdings` : "None"}</dd>
        </div>
      </dl>
      {consequence ? <p className="sim-note">{consequence}</p> : null}
      {saved ? null : <p className="sim-note">Not saved in this browser: see the warning at the top of the page.</p>}
      <LessonLink lesson={bought ? LESSONS.position : LESSONS.realised} />
      <div className="sim-receipt-actions">{actions}</div>
    </section>
  );
}

/** Shown once the browser has refused to save: trades still count now, but are gone after a reload. */
export function UnsavedNotice() {
  return (
    <p className="sim-error" role="alert">
      This browser couldn&apos;t save your account, so this visit&apos;s trades will be lost if you reload or close the page. Private browsing or full storage usually causes this.
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Portfolio                                                            */
/* ------------------------------------------------------------------ */

type Valuation = ReturnType<typeof value>;
export type PortfolioFocus = "cash" | "holdings" | "total" | "unrealised" | "realised" | "trades";

export function Summary({
  valuation,
  focus,
  show = ["total", "cash", "unrealised", "realised"],
  flash,
  variant = "cards",
}: {
  valuation: Valuation;
  focus?: PortfolioFocus | null;
  show?: PortfolioFocus[];
  /** The latest trade's id, once a trade has been made on this screen: the figures it changed light once. */
  flash?: string;
  /** Cards (the tutorial, where each figure is explained) or a compact strip (the desk, where the chart and order matter most). */
  variant?: "cards" | "strip";
}) {
  const cells: { key: PortfolioFocus; label: string; value: string; tone?: string; note: string }[] = [
    { key: "total", label: "Total portfolio value", value: inr(valuation.total), note: "Cash + holdings at today's prices" },
    { key: "cash", label: "Available cash", value: inr(valuation.cash), note: "Ready to spend" },
    { key: "holdings", label: "Holdings value", value: inr(valuation.invested), note: "Your shares at today's prices" },
    { key: "unrealised", label: "Unrealised P/L", value: signedInr(valuation.unrealised), tone: tone(valuation.unrealised), note: "On shares you still hold" },
    { key: "realised", label: "Realised P/L", value: signedInr(valuation.realised), tone: tone(valuation.realised), note: "Locked in by selling" },
  ];
  return (
    <section className="sim-summary" data-variant={variant} aria-label="Portfolio summary">
      {cells
        .filter((cell) => show.includes(cell.key))
        .map((cell) => (
          <div key={cell.key} className="sim-summary-cell" data-focus={focusOf(focus, cell.key)}>
            <p className="sim-label">{cell.label}</p>
            <p className="sim-summary-value" data-tone={cell.tone} key={`${cell.key}-${flash ?? ""}`} data-flash={flash ? true : undefined}>
              {cell.value}
            </p>
            <p className="sim-summary-note">{cell.note}</p>
          </div>
        ))}
    </section>
  );
}

export function Holdings({ valuation, focus, onPick }: { valuation: Valuation; focus?: Focus; onPick?: (ticker: string) => void }) {
  return (
    <section className="sim-block sim-holdings" data-focus={focus} aria-labelledby="sim-holdings-title">
      <h2 id="sim-holdings-title" className="sim-title">
        Holdings
      </h2>
      {valuation.positions.length ? (
        <div className="sim-table-wrap">
          <table className="sim-table">
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col">Shares</th>
                <th scope="col">Avg. price</th>
                <th scope="col">Current price</th>
                <th scope="col">Value</th>
                <th scope="col">Unrealised P/L</th>
              </tr>
            </thead>
            <tbody>
              {valuation.positions.map((position) => {
                const asset = assetByTicker(position.ticker);
                if (!asset) return null;
                const percent = (position.unrealised / position.cost) * 100;
                return (
                  <tr key={position.ticker}>
                    <th scope="row">
                      {onPick ? (
                        <button type="button" onClick={() => onPick(position.ticker)}>
                          <Mark asset={asset} size={24} />
                          <span className="sim-table-name">
                            {asset.name}
                            <small>{position.qty} shares</small>
                          </span>
                        </button>
                      ) : (
                        <span>
                          <Mark asset={asset} size={24} />
                          <span className="sim-table-name">
                            {asset.name}
                            <small>{position.qty} shares</small>
                          </span>
                        </span>
                      )}
                    </th>
                    <td>{position.qty}</td>
                    <td>{inr(Math.round(position.average))}</td>
                    <td>{inr(position.price)}</td>
                    <td>{inr(position.value)}</td>
                    <td data-tone={tone(position.unrealised)}>
                      {signedInr(position.unrealised)} <small>({signedPercent(percent)})</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="sim-empty">You don&apos;t own any shares yet. Pick an asset and place a buy order to start.</p>
      )}
    </section>
  );
}

export function Trades({ trades, focus, limit, fresh }: { trades: Trade[]; focus?: Focus; limit?: number; /** The id of a trade made on this screen: its row arrives lit, once. */ fresh?: string }) {
  const shown = limit ? trades.slice(0, limit) : trades;
  return (
    <section className="sim-block sim-trades" data-focus={focus} aria-labelledby="sim-trades-title">
      <h2 id="sim-trades-title" className="sim-title">
        Transactions
      </h2>
      {shown.length ? (
        <ul>
          {shown.map((trade) => {
            const asset = assetByTicker(trade.ticker);
            return (
              <li key={trade.id} data-fresh={trade.id === fresh || undefined}>
                <span className="sim-trade-side" data-side={trade.side}>
                  {trade.side === "buy" ? "Bought" : "Sold"}
                </span>
                <span className="sim-trade-what">
                  <b>
                    {trade.qty} {asset?.name ?? trade.ticker}
                  </b>
                  <small>
                    at {inr(trade.price)} · {stamp(trade.minute)}
                  </small>
                </span>
                <span className="sim-trade-total">
                  <b>{trade.side === "buy" ? `-${inr(trade.total)}` : `+${inr(trade.total)}`}</b>
                  {trade.realised !== undefined ? <small data-tone={tone(trade.realised)}>{signedInr(trade.realised)} realised</small> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="sim-empty">No trades yet. Your buys and sells will be listed here.</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* News                                                                 */
/* ------------------------------------------------------------------ */

export function News({ minute, onPick }: { minute: number; onPick?: (ticker: string) => void }) {
  const events = recentEvents(minute, 5);
  return (
    <section className="sim-block sim-news" aria-labelledby="sim-news-title">
      <h2 id="sim-news-title" className="sim-title">
        Market news <small className="sim-label">simulated</small>
      </h2>
      <ul>
        {events.map((event) => {
          const asset = assetByTicker(event.ticker);
          return (
            <li key={event.id}>
              <button type="button" onClick={() => onPick?.(event.ticker)} disabled={!onPick}>
                <span className="sim-news-when">{stamp(event.minute)}</span>
                <span className="sim-news-text">{event.headline}</span>
                <span className="sim-news-asset" data-tone={event.effect > 0 ? "up" : "down"}>
                  {asset?.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
