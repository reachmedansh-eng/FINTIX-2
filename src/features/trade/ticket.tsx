"use client";

import { useRef, type KeyboardEvent } from "react";
import { maxQty, quote, value as valueOf, type Account } from "./account";
import { ASSETS, paiseAt, type Asset } from "./engine";
import { dismissNote, useDismissedNotes, type NoteKind } from "./notes";
import { LESSONS, LessonLink, type Lesson } from "./parts";
import { Glyph, count, inr, portion, shares, signedInr, tone } from "./ui";

/*
 * The order ticket: the trading floor's one console. It reads as the
 * sequence a trade is: choose Buy or Sell, set the quantity, see what the
 * order will do (cost, cash before and after, shares before and after, and
 * the city after it), then confirm with a button that says exactly what it
 * will do. Every figure comes from the account's own quote(), the same
 * function that fills the order, so the ticket can never promise a different
 * result from the one that happens.
 */

export type Side = "buy" | "sell";

/** What was typed, read as an order quantity: a whole number of shares, or a sentence saying why it isn't one. */
export function readQty(text: string): { qty: number | null; problem: string | null } {
  const typed = text.trim();
  if (typed === "") return { qty: null, problem: null };
  if (/^\d+$/.test(typed)) {
    const value = Number(typed);
    return value < 1 ? { qty: null, problem: "Quantity must be at least 1 share." } : { qty: value, problem: null };
  }
  if (typed.startsWith("-")) return { qty: null, problem: "Quantity can't be negative. Enter how many shares, such as 5." };
  if (/^\d*[.,]\d*$/.test(typed)) return { qty: null, problem: "Shares come whole: enter 2 or 3, not 2.5." };
  return { qty: null, problem: "Use digits only, such as 5." };
}

/** The city's height rule (City.tsx): taller for a larger share, compressed so small holdings stay readable. */
const heightFor = (share: number, largest: number) => (largest > 0 && share > 0 ? 0.9 + 5.5 * Math.pow(share / largest, 0.6) : 0);

/** Every holding before and after the order, drawn the way the city draws it: the city-impact skyline. */
function skylineAfter(account: Account, ticker: string, heldAfter: number, minute: number) {
  const rows = ASSETS.map((asset) => {
    const before = account.holdings[asset.ticker]?.qty ?? 0;
    const price = paiseAt(asset, minute);
    return { asset, before: before * price, after: (asset.ticker === ticker ? heldAfter : before) * price };
  }).filter((row) => row.before > 0 || row.after > 0);
  const totalBefore = rows.reduce((sum, row) => sum + row.before, 0);
  const totalAfter = rows.reduce((sum, row) => sum + row.after, 0);
  const shareBefore = (row: (typeof rows)[number]) => (totalBefore ? row.before / totalBefore : 0);
  const shareAfter = (row: (typeof rows)[number]) => (totalAfter ? row.after / totalAfter : 0);
  const largestBefore = Math.max(0, ...rows.map(shareBefore));
  const largestAfter = Math.max(0, ...rows.map(shareAfter));
  return rows
    .map((row) => ({ asset: row.asset, before: heightFor(shareBefore(row), largestBefore), after: heightFor(shareAfter(row), largestAfter), traded: row.asset.ticker === ticker }))
    .sort((first, second) => second.after - first.after || second.before - first.before);
}

function CitySkyline({ towers }: { towers: ReturnType<typeof skylineAfter> }) {
  const column = 14;
  const gap = 6;
  const height = 40;
  const scale = (value: number) => Math.round((value / 6.4) * (height - 4));
  return (
    <svg className="sim-order-city" width={towers.length * (column + gap) - gap} height={height} aria-hidden="true">
      <line x1={0} x2={towers.length * (column + gap) - gap} y1={height - 0.5} y2={height - 0.5} />
      {towers.map((tower, index) => {
        const x = index * (column + gap);
        return (
          <g key={tower.asset.ticker} data-traded={tower.traded || undefined}>
            {tower.after > 0 ? <rect x={x} y={height - 1 - scale(tower.after)} width={column} height={scale(tower.after)} style={tower.traded ? { fill: tower.asset.tone } : undefined} /> : null}
            {tower.traded && tower.before > 0 && Math.abs(tower.before - tower.after) > 0.05 ? (
              <rect className="sim-order-city-before" x={x + 0.5} y={height - 0.5 - scale(tower.before)} width={column - 1} height={scale(tower.before)} />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Buy or Sell: one segmented switch whose indicator slides to the chosen side, calm blue for buying and calm purple for selling. */
function SideSwitch({ side, onSide, canSell }: { side: Side; onSide: (side: Side) => void; canSell: boolean }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const options: Side[] = ["buy", "sell"];
  const keys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next: Side = side === "buy" ? "sell" : "buy";
    if (next === "sell" && !canSell) return;
    onSide(next);
    buttons.current[options.indexOf(next)]?.focus();
  };
  return (
    <div className="sim-sideswitch" role="radiogroup" aria-label="Buy or sell" data-side={side}>
      {options.map((option, index) => (
        <button
          key={option}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          type="button"
          role="radio"
          aria-checked={side === option}
          tabIndex={side === option ? 0 : -1}
          disabled={option === "sell" && !canSell}
          aria-describedby={option === "sell" && !canSell ? "sim-order-sell-why" : undefined}
          onClick={() => onSide(option)}
          onKeyDown={keys}
        >
          {option === "buy" ? "Buy" : "Sell"}
        </button>
      ))}
      <i className="sim-sideswitch-mark" aria-hidden="true" style={{ transform: `translateX(${side === "buy" ? 0 : 100}%)` }} />
    </div>
  );
}

export function OrderTicket({
  asset,
  account,
  minute,
  side,
  onSide,
  qty,
  onQty,
  onConfirm,
  busy,
  error,
}: {
  asset: Asset;
  account: Account;
  minute: number;
  side: Side;
  onSide: (side: Side) => void;
  qty: string;
  onQty: (qty: string) => void;
  onConfirm: () => void;
  /** The order is being placed: the button waits and refuses a second press. */
  busy?: boolean;
  /** Why the last attempt was refused (the price moved, cash changed); it stays until the order is changed. */
  error?: string | null;
}) {
  const dismissed = useDismissedNotes();
  const held = account.holdings[asset.ticker]?.qty ?? 0;
  const most = maxQty(account, side, asset.ticker, minute);
  const typed = readQty(qty);
  // The account prices and checks the order; the ticket only shows what it says.
  const priced = typed.qty === null ? null : quote(account, { side, ticker: asset.ticker, qty: typed.qty }, minute);
  const problem = typed.problem ?? (priced && !priced.ok ? priced.reason : null);
  const ready = !!priced && priced.ok && !busy;
  const price = paiseAt(asset, minute);
  const valuation = valueOf(account, minute);
  const total = valuation.total;
  // This asset's share of all holdings now, before any order: the start of the city line.
  const shareNow = valuation.invested ? (valuation.positions.find((position) => position.ticker === asset.ticker)?.value ?? 0) / valuation.invested : 0;

  const setQty = (value: number) => onQty(String(Math.max(1, Math.min(Math.max(1, most), value))));
  const step = (delta: number) => setQty((typed.qty ?? 0) + delta);
  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    // Typed changes never animate: the figures below update at once.
    const big = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowUp") step(big);
    else if (event.key === "ArrowDown") step(-big);
    else if (event.key === "PageUp") step(10);
    else if (event.key === "PageDown") step(-10);
    else if (event.key === "Enter") {
      if (ready) onConfirm();
      return;
    } else return;
    event.preventDefault();
  };
  const fills = [
    { label: "¼", value: Math.floor(most / 4), name: side === "buy" ? "A quarter of what your cash buys" : "A quarter of your shares" },
    { label: "½", value: Math.floor(most / 2), name: side === "buy" ? "Half of what your cash buys" : "Half of your shares" },
    { label: side === "buy" ? "Max" : "All", value: most, name: side === "buy" ? "As many as your cash buys" : "All your shares" },
  ];

  // One note at a time, at the moment it matters, until the player dismisses that kind.
  let note: { kind: NoteKind; text: string; lesson: Lesson } | null = null;
  if (priced?.ok) {
    if (side === "sell" && priced.realised !== undefined && !dismissed.includes("realise")) {
      note = { kind: "realise", text: `Selling locks in ${signedInr(priced.realised)} on these shares: it stops moving with the price and becomes realised P/L.`, lesson: LESSONS.realised };
    } else if (side === "buy" && priced.share.after >= 0.4 && !dismissed.includes("concentration")) {
      note = {
        kind: "concentration",
        text:
          priced.share.after >= 0.999
            ? `${asset.name} would be your only holding, so its price alone would move your whole city. Spreading across assets softens any one company's bad day.`
            : `After this order ${asset.name} would be ${portion(priced.share.after)} of your holdings. When one company is most of what you own, its bad days become your bad days.`,
        lesson: LESSONS.diversification,
      };
    } else if (side === "buy" && total > 0 && priced.total / total >= 0.25 && !dismissed.includes("size")) {
      note = { kind: "size", text: `This order puts ${portion(priced.total / total)} of your portfolio's value into one trade. Position size decides how much a single price move can cost you.`, lesson: LESSONS.size };
    }
  }

  const verb = side === "buy" ? "Buy" : "Sell";
  const label = priced?.ok ? `${verb} ${count(priced.qty)} ${asset.ticker} · ${inr(priced.total)}` : `${verb} ${asset.ticker}`;
  const towers = skylineAfter(account, asset.ticker, priced?.ok ? priced.held.after : held, minute);

  return (
    <section className="sim-order" data-side={side} aria-labelledby="sim-order-title">
      <header className="sim-order-head">
        <h2 id="sim-order-title" className="sim-hud">
          Order
        </h2>
        <p>Fills at the simulated price when you confirm</p>
      </header>

      <SideSwitch side={side} onSide={onSide} canSell={held > 0} />
      {held > 0 ? null : (
        <p id="sim-order-sell-why" className="sim-order-why">
          You don&apos;t own any {asset.name} yet, so there&apos;s nothing to sell.
        </p>
      )}

      <div className="sim-qty2">
        <div className="sim-qty2-head">
          <label htmlFor="sim-order-qty" className="sim-cap">
            Quantity
          </label>
          <span>{side === "buy" ? (most ? `Your cash buys up to ${shares(most)} at ${inr(price)}` : `Your cash doesn't cover one share at ${inr(price)}`) : `You hold ${shares(held)}`}</span>
        </div>
        <div className="sim-qty2-box" data-error={!!problem || undefined}>
          <button type="button" aria-label="One share fewer" onClick={() => step(-1)} disabled={!typed.qty || typed.qty <= 1}>
            <Glyph name="minus" />
          </button>
          <input
            id="sim-order-qty"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={qty}
            onChange={(event) => onQty(event.target.value.slice(0, 7))}
            onKeyDown={keys}
            aria-invalid={!!problem}
            aria-describedby="sim-order-qty-help"
          />
          <button type="button" aria-label="One share more" onClick={() => step(1)} disabled={most < 1 || (typed.qty !== null && typed.qty >= most)}>
            <Glyph name="plus" />
          </button>
        </div>
        <div className="sim-qty2-fill" role="group" aria-label="Fill the quantity">
          {fills.map((fill) => (
            <button key={fill.label} type="button" disabled={fill.value < 1} aria-label={`${fill.name}: ${shares(Math.max(0, fill.value))}`} aria-pressed={typed.qty === fill.value && fill.value > 0} onClick={() => onQty(String(fill.value))}>
              {fill.label} <small>{fill.value >= 1 ? count(fill.value) : "–"}</small>
            </button>
          ))}
        </div>
        <p id="sim-order-qty-help" className="sim-qty2-help" aria-live="polite">
          {problem ? (
            <>
              <Glyph name="close" size={12} /> <span>{problem}</span>
            </>
          ) : null}
        </p>
      </div>

      <dl className="sim-order-lines" aria-live="off">
        <div data-lead>
          <dt className="sim-cap">{side === "buy" ? "Estimated cost" : "Estimated proceeds"}</dt>
          <dd>
            {priced?.ok ? <b>{inr(priced.total)}</b> : <b className="sim-dash">–</b>}
            <small>{priced?.ok ? `${count(priced.qty)} × ${inr(priced.price)}` : `price × quantity`}</small>
          </dd>
        </div>
        <div>
          <dt className="sim-cap">Cash</dt>
          <dd className="sim-order-change">
            <span>{inr(account.cash)}</span>
            <Glyph name="arrow" size={11} />
            {priced?.ok ? <b>{inr(priced.cash.after)}</b> : <b className="sim-dash">–</b>}
          </dd>
        </div>
        <div>
          <dt className="sim-cap">{asset.ticker} shares</dt>
          <dd className="sim-order-change">
            <span>{count(held)}</span>
            <Glyph name="arrow" size={11} />
            {priced?.ok ? <b>{count(priced.held.after)}</b> : <b className="sim-dash">–</b>}
          </dd>
        </div>
        {priced?.ok && priced.realised !== undefined ? (
          <div>
            <dt className="sim-cap">Realised P/L, estimated</dt>
            <dd data-tone={tone(priced.realised)}>
              <b>{signedInr(priced.realised)}</b>
            </dd>
          </div>
        ) : null}
        <div className="sim-order-impact">
          <dt className="sim-cap">Your city after this order</dt>
          <dd>
            <span className="sim-order-change">
              <span>{portion(priced?.ok ? priced.share.before : shareNow)}</span>
              <Glyph name="arrow" size={11} />
              {priced?.ok ? <b>{portion(priced.share.after)}</b> : <b className="sim-dash">–</b>}
              <small>of holdings</small>
            </span>
            {towers.length ? <CitySkyline towers={towers} /> : <small className="sim-order-empty">No buildings yet</small>}
          </dd>
        </div>
      </dl>

      {note ? (
        <div className="sim-order-note" role="note">
          <p>{note.text}</p>
          <LessonLink lesson={note.lesson} />
          <button type="button" className="sim-explain-close" aria-label="Dismiss this note" onClick={() => note && dismissNote(note.kind)}>
            <Glyph name="close" size={12} />
          </button>
        </div>
      ) : null}

      <button type="button" className="sim-button sim-order-go" data-tone={side} onClick={onConfirm} disabled={!ready} aria-disabled={!ready} aria-busy={busy || undefined} aria-describedby={ready ? undefined : "sim-order-go-why"}>
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
          `Try again: ${label}`
        ) : (
          label
        )}
      </button>
      {error ? (
        <p className="sim-error" role="alert">
          {error}
        </p>
      ) : ready ? null : (
        <p id="sim-order-go-why" className="sim-order-why">
          {problem ? "Change the quantity above to continue." : typed.qty === null ? "Enter how many shares to see the cost and what changes." : "Placing your order."}
        </p>
      )}
    </section>
  );
}
