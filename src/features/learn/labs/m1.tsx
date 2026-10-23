"use client";

import { useRef, useState, type CSSProperties } from "react";
import { CandleChart, LineChart, candles, nudge, useLive, walk } from "../charts";
import type { LabProps } from "../types";
import { Act, Blocks, Segmented, Slider, Stat, Stepper, inr, signedInr, signedPct, toneOf } from "../ui";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { Deck, Pick, Read, Says, Stage } from "./shared";

/* ------------------------------------------------------------------ */
/* 01 — Move the price, feel the position                              */
/* ------------------------------------------------------------------ */

const WIGGLE = walk(7, 44, 50, 1.5).map((value) => value - 50);

export function PriceMove({ onGoal }: LabProps) {
  const ENTRY = 100;
  const SHARES = 10;
  const [price, setPrice] = useState(120);
  const dipped = useRef(false);

  const path = WIGGLE.map((wiggle, index) => {
    const t = index / (WIGGLE.length - 1);
    return ENTRY + (price - ENTRY) * Math.pow(t, 1.3) + wiggle * Math.sin(Math.PI * t);
  });
  const pnl = (price - ENTRY) * SHARES;

  return (
    <div className="lab" data-layout="side">
      <Stage title="FNTX since you bought">
        <LineChart
          data={path}
          min={55}
          max={145}
          height={250}
          tone={pnl > 0 ? "up" : pnl < 0 ? "down" : "cyan"}
          label="Price since entry"
          levels={[{ value: ENTRY, label: "You bought here · ₹100", tone: "gold" }]}
        />
        <Says tone={toneOf(pnl)}>
          {pnl === 0
            ? "The price is back at ₹100. Your position is worth exactly what you paid."
            : pnl > 0
              ? `Each share is worth ${inr(price - ENTRY)} more than you paid. Across 10 shares that is a potential profit of ${inr(pnl)}.`
              : `Each share is worth ${inr(ENTRY - price)} less than you paid. Across 10 shares that is a potential loss of ${inr(pnl)}.`}
        </Says>
      </Stage>
      <Deck title="You hold 10 shares, bought at ₹100">
        <Slider
          label="Current price"
          value={price}
          min={60}
          max={140}
          format={inr}
          tone={toneOf(pnl)}
          onChange={(value) => {
            setPrice(value);
            if (value < ENTRY) dipped.current = true;
            if (value > ENTRY && dipped.current) onGoal();
          }}
        />
        <Read columns={2}>
          <Stat label="Entry price" value={ENTRY} format={inr} size="s" />
          <Stat label="Position size" value="10 shares" size="s" />
          <Stat label="Position value" value={price * SHARES} format={inr} />
          <Stat label="P&L" value={pnl} format={signedInr} tone={toneOf(pnl)} />
          <Stat label="Return" value={((price - ENTRY) / ENTRY) * 100} format={(v) => signedPct(v, 0)} tone={toneOf(pnl)} />
        </Read>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — Buying builds a position, selling takes it down                */
/* ------------------------------------------------------------------ */

type Fill = { side: "buy" | "sell"; shares: number; price: number; after: number };
type Desk = { shares: number; cost: number; realised: number; fills: Fill[]; note: string };

const CAPACITY = 40;

export function BuySell({ onGoal }: LabProps) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState(10);
  const [price, setPrice] = useState(100);
  const [desk, setDesk] = useState<Desk>({ shares: 0, cost: 0, realised: 0, fills: [], note: "You hold nothing yet. Place a buy order to open a position." });

  const average = desk.shares ? desk.cost / desk.shares : 0;
  const blocked = side === "sell" ? (desk.shares === 0 ? "You can only sell what you hold. Buy first." : shares > desk.shares ? `You hold ${desk.shares} shares, so you cannot sell ${shares}.` : "") : desk.shares + shares > CAPACITY ? `This simulator holds up to ${CAPACITY} shares.` : "";

  const place = () => {
    if (side === "buy") {
      const after = desk.shares + shares;
      setDesk({
        ...desk,
        shares: after,
        cost: desk.cost + shares * price,
        fills: [{ side, shares, price, after }, ...desk.fills].slice(0, 4),
        note: desk.shares ? `Bought ${shares} more. Your position grew to ${after} shares.` : `Bought ${shares} shares at ${inr(price)}. You now have an open position, and ${inr(price)} is your entry price.`,
      });
      return;
    }
    const after = desk.shares - shares;
    const gained = (price - average) * shares;
    setDesk({
      shares: after,
      cost: desk.cost - average * shares,
      realised: desk.realised + gained,
      fills: [{ side, shares, price, after }, ...desk.fills].slice(0, 4),
      note: after
        ? `Sold ${shares}. Your position is reduced to ${after} shares, and ${signedInr(gained)} of P&L is now locked in.`
        : `Sold everything at ${inr(price)}. The position is closed. ${inr(price)} was your exit price, and the result is ${signedInr(desk.realised + gained)}.`,
    });
    if (after === 0) onGoal();
  };

  return (
    <div className="lab" data-layout="side" data-flip="true">
      <Deck title="Try a trade (simulation)">
        <Segmented
          label="Action"
          value={side}
          onChange={setSide}
          options={[
            { value: "buy", label: "Buy", tone: "up" },
            { value: "sell", label: "Sell", tone: "down" },
          ]}
        />
        <div className="deck-pair">
          <Stepper label="Quantity" value={shares} min={5} max={CAPACITY} step={5} onChange={setShares} />
          <Stepper label="Price" value={price} min={60} max={160} step={10} format={inr} onChange={setPrice} />
        </div>
        <div className="deck-total">
          <span>Total value</span>
          <strong>{inr(shares * price)}</strong>
        </div>
        <Act onClick={place} tone={side === "buy" ? "up" : "down"} disabled={Boolean(blocked)}>
          Place {side} order
        </Act>
        {blocked ? <p className="deck-note" data-warn="true">{blocked}</p> : null}
      </Deck>
      <Stage title="Your position" tag={desk.shares ? "Open" : desk.fills.length ? "Closed" : "None"}>
        <Blocks total={CAPACITY} lit={desk.shares} tone="cyan" />
        <Read columns={3}>
          <Stat label="Position size" value={desk.shares} format={(v) => `${Math.round(v)} sh`} />
          <Stat label="Entry price" value={average} format={(v) => (v ? inr(v) : "-")} />
          <Stat label="Realized P&L" value={desk.realised} format={signedInr} tone={toneOf(desk.realised)} />
        </Read>
        <Says tone={desk.shares === 0 && desk.fills.length ? toneOf(desk.realised) : "flat"}>{desk.note}</Says>
        {desk.fills.length ? (
          <ol className="tape" aria-label="Recent orders">
            {desk.fills.map((fill, index) => (
              <li key={desk.fills.length - index} data-tone={fill.side === "buy" ? "up" : "down"}>
                <b>{fill.side}</b>
                <span>
                  {fill.shares} @ {inr(fill.price)}
                </span>
                <span>position {fill.after}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </Stage>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — Size stays, value moves                                        */
/* ------------------------------------------------------------------ */

export function PositionCalc({ onGoal }: LabProps) {
  const [shares, setShares] = useState(20);
  const [entry, setEntry] = useState(10000);
  const [price, setPrice] = useState(10000);
  const value = shares * price;
  const paid = shares * entry;
  const change = value - paid;

  const move = (next: number) => {
    setPrice(Math.max(1000, Math.round(next / 100) * 100));
    onGoal();
  };

  return (
    <div className="lab" data-layout="side" data-flip="true">
      <Deck title="Position calculator">
        <Stepper label="Quantity (shares)" value={shares} min={1} max={40} onChange={setShares} />
        <Stepper label="Entry price" value={entry} min={1000} max={20000} step={500} format={inr} onChange={setEntry} />
        <Stepper label="Current price" value={price} min={1000} max={30000} step={500} format={inr} onChange={move} />
        <div className="deck-pair">
          <Act quiet onClick={() => move(price * 1.1)}>
            Price +10%
          </Act>
          <Act quiet onClick={() => move(price * 0.9)}>
            Price -10%
          </Act>
        </div>
      </Deck>
      <Stage title="What you hold" tag="Live">
        <div className="hold">
          <div className="hold-row">
            <span className="hold-label">Position size</span>
            <Blocks total={40} lit={shares} tone="cyan" />
            <Stat label="does not change with price" value={shares} format={(v) => `${Math.round(v)} shares`} />
          </div>
          <div className="hold-row">
            <span className="hold-label">Position value</span>
            <div className="hold-bar" data-tone={toneOf(change)} style={{ "--size": `${Math.min(100, (value / Math.max(paid, value, 1)) * 100)}%`, "--mark": `${Math.min(100, (paid / Math.max(paid, value, 1)) * 100)}%` } as CSSProperties}>
              <i />
            </div>
            <Stat label={`${shares} × ${inr(price)}`} value={value} format={inr} tone={toneOf(change)} size="l" />
          </div>
        </div>
        <Says tone={toneOf(change)}>
          {change === 0
            ? "At the entry price, the position is worth exactly what was paid for it."
            : `The price moved, so the value moved by ${signedInr(change)} (${signedPct((change / paid) * 100)}). You still hold ${shares} shares.`}
        </Says>
      </Stage>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 — Candlestick explorer                                           */
/* ------------------------------------------------------------------ */

const TAPE = candles(23, 26, 220, 10, 0.5);
const HELD = 100;

export function CandleExplorer({ onGoal }: LabProps) {
  const [selected, setSelected] = useState(TAPE.length - 1);
  const seen = useRef({ up: false, down: false });
  const candle = TAPE[selected];
  const rising = candle.close >= candle.open;
  const change = candle.close - candle.open;
  const entry = TAPE[0].open;
  const span = Math.max(1, candle.high - candle.low);
  const at = (value: number) => `${((candle.high - value) / span) * 100}%`;

  const select = (index: number) => {
    setSelected(index);
    const picked = TAPE[index];
    seen.current[picked.close >= picked.open ? "up" : "down"] = true;
    if (seen.current.up && seen.current.down) onGoal();
  };

  return (
    <div className="lab" data-layout="side">
      <Stage title="Interactive candlestick explorer" tag="Hover or tap a candle">
        <CandleChart data={TAPE} selected={selected} onSelect={select} height={290} label="Candlestick chart of FNTX" marks={[{ index: 0, label: "Entry" }]} />
        <Says tone={rising ? "up" : "down"}>
          {`Period ${selected + 1}: opened at ${inr(candle.open)}, traded between ${inr(candle.low)} and ${inr(candle.high)}, closed at ${inr(candle.close)}. ${rising ? "Closed higher than it opened, so the body is green." : "Closed lower than it opened, so the body is red."}`}
        </Says>
      </Stage>
      <div className="lab-side">
        <div className="anatomy" data-tone={rising ? "up" : "down"}>
          <div className="anatomy-candle" aria-hidden="true">
            <i className="anatomy-wick" />
            <i className="anatomy-body" style={{ top: at(Math.max(candle.open, candle.close)), bottom: `calc(100% - ${at(Math.min(candle.open, candle.close))})` }} />
          </div>
          <dl className="anatomy-levels">
            {(
              [
                ["High", candle.high],
                [rising ? "Close" : "Open", Math.max(candle.open, candle.close)],
                [rising ? "Open" : "Close", Math.min(candle.open, candle.close)],
                ["Low", candle.low],
              ] as const
            ).map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{inr(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Deck title={`Your position · ${HELD} shares from ${inr(entry)}`}>
          <Read columns={2}>
            <Stat label="During this candle" value={change * HELD} format={signedInr} tone={toneOf(change)} />
            <Stat label="Since entry" value={(candle.close - entry) * HELD} format={signedInr} tone={toneOf(candle.close - entry)} />
          </Read>
          <p className="deck-formula">
            {signedInr(change)} × {HELD} shares = {signedInr(change * HELD)}
          </p>
        </Deck>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 — Unrealized moves, realized is locked                           */
/* ------------------------------------------------------------------ */

const OPENING = walk(31, 40, 100, 1.6).map((value, index) => (index === 0 ? 100 : value));

export function OpenClosed({ onGoal }: LabProps) {
  const ENTRY = 100;
  const SHARES = 20;
  const reduced = useReducedMotion();
  const [exit, setExit] = useState<number | null>(null);
  const [series, setSeries] = useLive(OPENING, { running: !reduced, swing: 1.7, anchor: 100, keep: 40, every: 520 });
  const price = Math.round(series[series.length - 1]);
  const open = exit === null;
  const unrealised = (price - ENTRY) * SHARES;
  const realised = open ? 0 : (exit - ENTRY) * SHARES;

  return (
    <div className="lab" data-layout="side">
      <Stage title="FNTX · you bought 20 shares at ₹100" tag="Price keeps moving">
        <LineChart
          data={series}
          min={86}
          max={114}
          height={220}
          label="Live price"
          levels={[{ value: ENTRY, label: "Entry ₹100", tone: "gold" }, ...(open ? [] : [{ value: exit, label: `Sold at ₹${exit}`, tone: realised >= 0 ? ("up" as const) : ("down" as const) }])]}
        />
        {reduced ? (
          <Act quiet onClick={() => setSeries((now) => [...now.slice(1), nudge(now[now.length - 1], 2.4, 0, 100)])}>
            Move the price
          </Act>
        ) : null}
      </Stage>
      <div className="lab-side">
        <Segmented
          label="Position state"
          value={open ? "open" : "closed"}
          options={[
            { value: "open", label: "Open position" },
            { value: "closed", label: "Closed position" },
          ]}
          onChange={(value) => {
            if (value === "closed" && open) {
              setExit(price);
              onGoal();
            }
            if (value === "open") setExit(null);
          }}
        />
        <div className="vaults">
          <div className="vault" data-live={open} data-tone={open ? toneOf(unrealised) : "flat"}>
            <span className="vault-label">Unrealized P&amp;L</span>
            <span className="vault-value">{open ? <Stat label="" value={unrealised} format={signedInr} tone={toneOf(unrealised)} size="l" /> : "-"}</span>
            <span className="vault-note">{open ? "Still open. Changes with every price move." : "Nothing left open."}</span>
          </div>
          <div className="vault" data-locked={!open} data-tone={open ? "flat" : toneOf(realised)}>
            <span className="vault-label">Realized P&amp;L</span>
            <span className="vault-value">{open ? "-" : <Stat label="" value={realised} format={signedInr} tone={toneOf(realised)} size="l" />}</span>
            <span className="vault-note">{open ? "Nothing sold yet." : `Locked in at ₹${exit}. The price can no longer change it.`}</span>
          </div>
        </div>
        <Says tone={open ? "flat" : toneOf(realised)}>
          {open
            ? `At ${inr(price)} your P&L is ${signedInr(unrealised)}, but only on paper. Close the position to see what changes.`
            : `You sold all 20 shares at ${inr(exit)}. The market is now at ${inr(price)}, and your result stays ${signedInr(realised)}.`}
        </Says>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 — An amount, and a percentage                                    */
/* ------------------------------------------------------------------ */

export function ReturnCalc({ onGoal }: LabProps) {
  const [invested, setInvested] = useState(10000);
  const [rate, setRate] = useState(10);
  const profit = (invested * rate) / 100;
  const traders: [string, number][] = [
    ["Trader A", 10000],
    ["You", invested],
    ["Trader B", 100000],
  ];
  const largest = Math.max(...traders.map(([, amount]) => Math.abs((amount * rate) / 100)), 1);

  return (
    <div className="lab" data-layout="side" data-flip="true">
      <Deck title="Return calculator">
        <Slider label="Initial investment" value={invested} min={5000} max={100000} step={5000} format={inr} onChange={setInvested} />
        <Slider
          label="Current value"
          value={rate}
          min={-50}
          max={50}
          tone={toneOf(rate)}
          format={(v) => inr(invested * (1 + v / 100))}
          onChange={(value) => {
            setRate(value);
            if (value === 20) onGoal();
          }}
        />
        <Read columns={2}>
          <Stat label="Absolute P&L" value={profit} format={signedInr} tone={toneOf(profit)} />
          <Stat label="Percentage return" value={rate} format={(v) => signedPct(v, 0)} tone={toneOf(rate)} />
        </Read>
        <p className="deck-formula">
          {signedInr(profit)} ÷ {inr(invested)} × 100 = {signedPct(rate, 0)}
        </p>
      </Deck>
      <Stage title={`The same ${signedPct(rate, 0)} on three different amounts`}>
        <div className="versus">
          {traders.map(([name, amount]) => (
            <div className="versus-row" key={name} data-you={name === "You"}>
              <div className="versus-who">
                <strong>{name}</strong>
                <span>invests {inr(amount)}</span>
              </div>
              <div className="versus-track" data-tone={toneOf(rate)} data-side={rate < 0 ? "left" : "right"}>
                <i style={{ "--size": `${(Math.abs((amount * rate) / 100) / largest) * 50}%` } as CSSProperties} />
              </div>
              <Stat label={signedPct(rate, 0)} value={(amount * rate) / 100} format={signedInr} tone={toneOf(rate)} size="s" />
            </div>
          ))}
        </div>
        <Says tone="gold">
          {rate === 0
            ? "Move the current value to create a gain or a loss."
            : `All three have the same percentage return. In money, Trader B's result is ten times Trader A's, because the amount invested is ten times larger.`}
        </Says>
      </Stage>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 — Read a position                                                */
/* ------------------------------------------------------------------ */

const SHEET: [label: string, value: string, meaning: string, tone?: "down"][] = [
  ["Position size", "20 shares", "The quantity held. It only changes when you buy or sell."],
  ["Entry price", "₹500", "The price paid per share when the position was opened."],
  ["Current price", "₹450", "What one share trades for right now."],
  ["Position status", "Open", "Nothing has been sold, so the result can still change."],
  ["Position value", "₹9,000", "20 shares × ₹450. What the holding is worth now."],
  ["Unrealized P&L", "-₹1,000", "(₹450 - ₹500) × 20 shares. A loss on paper, not yet locked in.", "down"],
  ["Percentage return", "-10%", "-₹1,000 ÷ ₹10,000 invested × 100.", "down"],
];

export function ReadPosition({ onGoal }: LabProps) {
  const [open, setOpen] = useState(5);
  const right = useRef(new Set<number>());
  const solve = (question: number) => {
    right.current.add(question);
    if (right.current.size === 2) onGoal();
  };

  return (
    <div className="lab" data-layout="side">
      <Stage title="Position sheet" tag="Tap any line">
        <p className="sheet-story">You buy 20 shares at ₹500. The price falls to ₹450.</p>
        <ul className="sheet">
          {SHEET.map(([label, value, meaning, tone], index) => (
            <li key={label}>
              <button type="button" aria-expanded={open === index} onClick={() => setOpen(index)} data-tone={tone}>
                <span>{label}</span>
                <strong>{value}</strong>
              </button>
              {open === index ? <p>{meaning}</p> : null}
            </li>
          ))}
        </ul>
      </Stage>
      <div className="lab-side">
        <Pick
          prompt="What is happening to this position?"
          onRight={() => solve(0)}
          options={[
            { label: "It is closed, with a ₹1,000 loss", why: "Not closed. Nothing has been sold, so the status is Open and the loss is still unrealized." },
            { label: "It is open, with a ₹1,000 unrealized loss", right: true, why: "Yes. The shares are still held, and at ₹450 they are worth ₹1,000 less than was paid." },
            { label: "It is open, and in profit", why: "The price fell from ₹500 to ₹450. A long position loses value when the price falls." },
          ]}
        />
        <Pick
          prompt="You sell all 20 shares at ₹450. What changes?"
          onRight={() => solve(1)}
          options={[
            { label: "The loss disappears", why: "Selling does not undo the price move. It fixes the result at the exit price." },
            { label: "The -₹1,000 becomes realized P&L", right: true, why: "Exactly. The position is closed, and the loss is locked in at ₹1,000." },
            { label: "The position size doubles", why: "Selling reduces a position. Selling all of it takes the size to zero." },
          ]}
        />
      </div>
    </div>
  );
}
