"use client";

import { useRef, useState, type CSSProperties } from "react";
import { CandleChart, LineChart, candles, walk } from "../charts";
import type { LabProps } from "../types";
import { Act, Blocks, Segmented, Slider, Stat, Stepper, inr, signedInr, toneOf } from "../ui";
import { BookWalk, Deck, OrderType, Read, Says, SizeCompare, Stage } from "./shared";

/* ------------------------------------------------------------------ */
/* 01 — The four decisions in every trade                              */
/* ------------------------------------------------------------------ */

export function OrderTicket({ onGoal }: LabProps) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState(10);
  const [price, setPrice] = useState(100);
  const [sent, setSent] = useState<string | null>(null);
  const edit = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setSent(null);
  };

  return (
    <div className="lab" data-layout="side" data-flip="true">
      <Deck title="Build the order">
        <div className="ticket-line">
          <span className="ctl-label">1 · Asset</span>
          <strong>FNTX company shares</strong>
        </div>
        <div className="ticket-line">
          <span className="ctl-label">2 · Action</span>
          <Segmented
            label="Action"
            value={side}
            onChange={edit(setSide)}
            options={[
              { value: "buy", label: "Buy", tone: "up" },
              { value: "sell", label: "Sell", tone: "down" },
            ]}
          />
        </div>
        <div className="deck-pair">
          <Stepper label="3 · Quantity" value={shares} min={1} max={100} onChange={edit(setShares)} />
          <Stepper label="4 · Price" value={price} min={50} max={200} step={5} format={inr} onChange={edit(setPrice)} />
        </div>
        <Act
          tone={side === "buy" ? "up" : "down"}
          onClick={() => {
            setSent(`${side} ${shares} @ ${price}`);
            onGoal();
          }}
        >
          Submit order
        </Act>
      </Deck>
      <Stage title="Order ticket" tag={sent ? "Executed" : "Draft"}>
        <div className="ticket" data-sent={Boolean(sent)} data-tone={side === "buy" ? "up" : "down"}>
          <p className="ticket-sentence">
            <b>{side}</b> {shares} shares of FNTX at around {inr(price)} each
          </p>
          <Read columns={2}>
            <Stat label="Position size" value={shares} format={(v) => `${Math.round(v)} shares`} />
            <Stat label="Position value" value={shares * price} format={inr} />
          </Read>
          <p className="deck-formula">
            {shares} × {inr(price)} = {inr(shares * price)}
          </p>
        </div>
        <Says tone={sent ? "up" : "flat"}>
          {sent
            ? side === "buy"
              ? `Matched with a seller. The trade is executed and you now have a position of ${shares} shares.`
              : `Matched with a buyer. The trade is executed and ${shares} shares have left your holdings.`
            : "Nothing has happened yet. An order only becomes a trade when it is matched with someone on the other side."}
        </Says>
      </Stage>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — Different assets answer to different things                    */
/* ------------------------------------------------------------------ */

const MARKETS = [
  { name: "Stocks", drivers: ["Company performance", "Market expectations"], swing: 2.2, seed: 4, line: "A company's results and what people expect from it move its share price." },
  { name: "Commodities", drivers: ["Supply", "Demand", "Production"], swing: 1.8, seed: 9, line: "How much is produced, and how much the world wants, moves the price of a raw material." },
  { name: "Currencies", drivers: ["Economic conditions", "Interest rates"], swing: 0.5, seed: 14, line: "A currency is priced against another, and follows the two economies behind them." },
  { name: "Crypto", drivers: ["Market demand", "News", "Technology", "Expectations"], swing: 5.5, seed: 21, line: "Demand and expectations can shift quickly, and prices can move a long way with them." },
] as const;

export function AssetDrivers({ onGoal }: LabProps) {
  const [which, setWhich] = useState(0);
  const seen = useRef(new Set([0]));
  const market = MARKETS[which];
  return (
    <div className="lab" data-layout="stack">
      <div className="tabs" role="tablist" aria-label="Asset type">
        {MARKETS.map((entry, index) => (
          <button
            key={entry.name}
            role="tab"
            type="button"
            aria-selected={index === which}
            onClick={() => {
              setWhich(index);
              seen.current.add(index);
              if (seen.current.size >= 3) onGoal();
            }}
          >
            {entry.name}
          </button>
        ))}
      </div>
      <div className="lab" data-layout="side">
        <Stage title={`A simulated ${market.name.toLowerCase()} market`} tag="Start = 100">
          <LineChart data={walk(market.seed, 60, 100, market.swing)} min={70} max={130} height={210} prefix="" tone={which === 3 ? "purple" : "cyan"} label={`${market.name} price path`} />
        </Stage>
        <Deck title="What moves it">
          <ul className="chips">
            {market.drivers.map((driver) => (
              <li key={driver}>{driver}</li>
            ))}
          </ul>
          <p className="deck-note">{market.line}</p>
          <Says tone="gold">Choosing an asset means choosing which market you take part in. It does not mean the price will move your way.</Says>
        </Deck>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — Long and short are mirror images                               */
/* ------------------------------------------------------------------ */

const DRIFT = walk(5, 44, 50, 1.4).map((value) => value - 50);

export function LongShort({ onGoal }: LabProps) {
  const ENTRY = 100;
  const SHARES = 10;
  const [side, setSide] = useState<"long" | "short">("long");
  const [price, setPrice] = useState(120);
  const pnl = (side === "long" ? price - ENTRY : ENTRY - price) * SHARES;
  const path = DRIFT.map((wiggle, index) => {
    const t = index / (DRIFT.length - 1);
    return ENTRY + (price - ENTRY) * Math.pow(t, 1.3) + wiggle * Math.sin(Math.PI * t);
  });
  const check = (nextSide: string, nextPrice: number) => {
    if (nextSide === "short" && nextPrice < ENTRY) onGoal();
  };

  return (
    <div className="lab" data-layout="side">
      <Stage title={side === "long" ? "Long: bought at ₹100, hoping it rises" : "Short: sold at ₹100, hoping it falls"}>
        <LineChart
          data={path}
          min={55}
          max={145}
          height={240}
          tone={pnl > 0 ? "up" : pnl < 0 ? "down" : "cyan"}
          label="Price since the position was opened"
          levels={[{ value: ENTRY, label: side === "long" ? "Bought · ₹100" : "Sold first · ₹100", tone: "gold" }]}
        />
        <Says tone={toneOf(pnl)}>
          {side === "long"
            ? `Long gains when the price rises. At ${inr(price)} the position shows ${signedInr(pnl)}.`
            : `Short gains when the price falls: sold at ₹100, it could be bought back at ${inr(price)}. That is ${signedInr(pnl)}.`}
        </Says>
      </Stage>
      <Deck title="10 shares, opened at ₹100">
        <Segmented
          label="Position"
          value={side}
          options={[
            { value: "long", label: "Long (buy)", tone: "up" },
            { value: "short", label: "Short (sell)", tone: "down" },
          ]}
          onChange={(value) => {
            setSide(value);
            check(value, price);
          }}
        />
        <Slider
          label="Price now"
          value={price}
          min={60}
          max={140}
          format={inr}
          onChange={(value) => {
            setPrice(value);
            check(side, value);
          }}
        />
        <Read columns={2}>
          <Stat label="Price change" value={price - ENTRY} format={signedInr} size="s" />
          <Stat label="Potential P&L" value={pnl} format={signedInr} tone={toneOf(pnl)} />
        </Read>
        <p className="deck-note">Short selling carries extra requirements and risks. Module 05 comes back to it.</p>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04, 05, 06 — shared interactives, framed for this module            */
/* ------------------------------------------------------------------ */

export const PositionSize = (props: LabProps) => <SizeCompare {...props} small={10} large={100} start={5} />;
export const ChooseOrderType = OrderType;
export const Execute = (props: LabProps) => (
  <BookWalk
    {...props}
    books={[
      {
        name: "FNTX order book",
        note: "A market buy starts with the cheapest seller. If that seller cannot cover the whole order, it moves to the next price.",
        asks: [
          [101, 20],
          [102, 30],
          [103, 50],
        ],
      },
    ]}
  />
);

/* ------------------------------------------------------------------ */
/* 07 — Pick an entry and an exit                                      */
/* ------------------------------------------------------------------ */

const SESSION = candles(41, 30, 100, 6, 0.4);

export function EntryExit({ onGoal }: LabProps) {
  const SHARES = 20;
  const [entry, setEntry] = useState<number | null>(4);
  const [exit, setExit] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const armed = useRef(false);

  const select = (index: number) => {
    if (!armed.current) return setHover(index);
    armed.current = false;
    if (entry === null || exit !== null) {
      setEntry(index);
      setExit(null);
    } else if (index > entry) {
      setExit(index);
      onGoal();
    } else {
      setEntry(index);
    }
  };

  const bought = entry === null ? null : SESSION[entry].close;
  const sold = exit === null ? null : SESSION[exit].close;
  const pnl = bought !== null && sold !== null ? (sold - bought) * SHARES : 0;

  return (
    <div className="lab" data-layout="side">
      <Stage title="Choose where you get in, then where you get out" tag="Tap two candles">
        <div
          onPointerDownCapture={() => {
            armed.current = true;
          }}
        >
          <CandleChart
            data={SESSION}
            selected={hover}
            onSelect={select}
            height={270}
            label="Candlestick chart for choosing entry and exit"
            marks={[...(entry !== null ? [{ index: entry, label: "Entry", tone: "gold" as const }] : []), ...(exit !== null ? [{ index: exit, label: "Exit", tone: pnl >= 0 ? ("up" as const) : ("down" as const) }] : [])]}
          />
        </div>
        <Says tone={sold === null ? "flat" : toneOf(pnl)}>
          {bought === null
            ? "Tap a candle to buy 20 shares at its closing price."
            : sold === null
              ? `Bought at ${inr(bought)}. Now tap a later candle to sell.`
              : `Price change ${signedInr(sold - bought)} × 20 shares = ${signedInr(pnl)}. Tap any candle to start again.`}
        </Says>
      </Stage>
      <Deck title="Trade summary · 20 shares">
        <Read columns={2}>
          <Stat label="Entry price" value={bought ?? 0} format={(v) => (bought === null ? "-" : inr(v))} />
          <Stat label="Exit price" value={sold ?? 0} format={(v) => (sold === null ? "-" : inr(v))} />
          <Stat label="Change per share" value={sold !== null && bought !== null ? sold - bought : 0} format={(v) => (sold === null ? "-" : signedInr(v))} tone={sold === null ? "flat" : toneOf(pnl)} />
          <Stat label="P&L" value={pnl} format={(v) => (sold === null ? "-" : signedInr(v))} tone={sold === null ? "flat" : toneOf(pnl)} />
        </Read>
        <p className="deck-note">Fees, commissions and taxes can also change the final result. Lesson 10 covers them.</p>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 — Reduce, then close                                             */
/* ------------------------------------------------------------------ */

export function ClosePosition({ onGoal }: LabProps) {
  const ENTRY = 100;
  const PRICE = 120;
  const START = 20;
  const [held, setHeld] = useState(START);
  const sold = START - held;
  const sell = (shares: number) => {
    const next = Math.max(0, held - shares);
    setHeld(next);
    if (next === 0) onGoal();
  };

  return (
    <div className="lab" data-layout="side">
      <Stage title="Bought 20 shares at ₹100 · price now ₹120" tag={held === 0 ? "Closed" : held < START ? "Reduced" : "Open"}>
        <Blocks total={START} lit={held} tone="cyan" />
        <div className="split-bar" role="img" aria-label="Unrealized and realized share of the profit">
          <i data-kind="open" style={{ "--size": `${(held / START) * 100}%` } as CSSProperties} />
          <i data-kind="locked" style={{ "--size": `${(sold / START) * 100}%` } as CSSProperties} />
        </div>
        <Read columns={3}>
          <Stat label="Position size" value={held} format={(v) => `${Math.round(v)} sh`} />
          <Stat label="Unrealized P&L" value={(PRICE - ENTRY) * held} format={signedInr} tone={held ? "up" : "flat"} />
          <Stat label="Realized P&L" value={(PRICE - ENTRY) * sold} format={signedInr} tone={sold ? "up" : "flat"} />
        </Read>
        <Says tone={held === 0 ? "up" : "flat"}>
          {held === START
            ? "Everything is still open, so all ₹400 of profit is unrealized."
            : held === 0
              ? "Position size is 0: the position is closed, and the whole ₹400 is realized."
              : `You sold ${sold}, so ${signedInr((PRICE - ENTRY) * sold)} is realized. The ${held} shares you still hold remain exposed to the price.`}
        </Says>
      </Stage>
      <Deck title="Sell at ₹120">
        <Act tone="down" onClick={() => sell(5)} disabled={held === 0}>
          Sell 5 shares
        </Act>
        <Act tone="down" onClick={() => sell(held)} disabled={held === 0}>
          Sell all {held || ""} and close
        </Act>
        <Act quiet onClick={() => setHeld(START)} disabled={held === START}>
          Start again
        </Act>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 — The whole trade, one step at a time                            */
/* ------------------------------------------------------------------ */

const FLOW: [step: string, detail: string][] = [
  ["Choose an asset", "FNTX company shares."],
  ["Choose buy or sell", "Buy: a long position, expecting the price to rise."],
  ["Choose position size", "20 shares."],
  ["Choose order type", "Market order: execution first."],
  ["Submit the order", "The order enters the market."],
  ["Order is matched", "Executed at ₹100. Entry price = ₹100."],
  ["Position is created", "20 shares held. Position value ₹2,000."],
  ["Monitor the position", "Price rises to ₹120. Unrealized P&L +₹400."],
  ["Exit the position", "Sell 20 shares at ₹120. Exit price = ₹120."],
  ["P&L becomes realized", "₹20 × 20 shares = ₹400 profit, locked in."],
];

export function TradeFlow({ onGoal }: LabProps) {
  const [at, setAt] = useState(0);
  const price = at >= 7 ? 120 : 100;
  const held = at >= 6 && at < 8 ? 20 : 0;
  return (
    <div className="lab" data-layout="side">
      <ol className="flow" aria-label="Steps of a complete trade">
        {FLOW.map(([step, detail], index) => (
          <li key={step} data-state={index < at ? "done" : index === at ? "now" : "next"}>
            <span className="flow-step">{step}</span>
            {index <= at ? <span className="flow-detail">{detail}</span> : null}
          </li>
        ))}
      </ol>
      <div className="lab-side">
        <Deck title="The trade so far">
          <Read columns={2}>
            <Stat label="Position size" value={held} format={(v) => `${Math.round(v)} sh`} />
            <Stat label="Price" value={price} format={inr} />
            <Stat label="Unrealized P&L" value={at === 7 ? 400 : 0} format={signedInr} tone={at === 7 ? "up" : "flat"} />
            <Stat label="Realized P&L" value={at >= 9 ? 400 : 0} format={signedInr} tone={at >= 9 ? "up" : "flat"} />
          </Read>
          <Act
            tone="up"
            disabled={at === FLOW.length - 1}
            onClick={() => {
              setAt(at + 1);
              if (at + 1 === FLOW.length - 1) onGoal();
            }}
          >
            {at === FLOW.length - 1 ? "Trade complete" : `Next: ${FLOW[at + 1][0].toLowerCase()}`}
          </Act>
          <Act quiet onClick={() => setAt(0)} disabled={at === 0}>
            Run it again
          </Act>
        </Deck>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10 — What is left after costs                                       */
/* ------------------------------------------------------------------ */

export function Costs({ onGoal }: LabProps) {
  const [gross, setGross] = useState(500);
  const [costs, setCosts] = useState(50);
  const net = gross - costs;
  const scale = Math.max(gross, costs, 1);
  return (
    <div className="lab" data-layout="side" data-flip="true">
      <Deck title="One finished trade">
        <Slider label="Gross P&L (from price movement)" value={gross} min={0} max={1500} step={50} format={inr} tone="up" onChange={setGross} />
        <Slider
          label="Trading costs (fees, taxes, charges)"
          value={costs}
          min={0}
          max={600}
          step={10}
          format={inr}
          tone="down"
          onChange={(value) => {
            setCosts(value);
            onGoal();
          }}
        />
        <p className="deck-formula">Net P&amp;L = Gross P&amp;L - Trading costs</p>
      </Deck>
      <Stage title="Where the money goes">
        <div className="split-bar" data-tall="true" role="img" aria-label="Gross profit split into costs and net result">
          <i data-kind="locked" style={{ "--size": `${(Math.max(0, net) / scale) * 100}%` } as CSSProperties} />
          <i data-kind="cost" style={{ "--size": `${(Math.min(costs, scale) / scale) * 100}%` } as CSSProperties} />
        </div>
        <Read columns={3}>
          <Stat label="Gross P&L" value={gross} format={signedInr} />
          <Stat label="Costs" value={-costs} format={signedInr} tone={costs ? "down" : "flat"} />
          <Stat label="Net P&L" value={net} format={signedInr} tone={toneOf(net)} size="l" />
        </Read>
        <Says tone={toneOf(net)}>
          {net < 0
            ? "The costs are larger than the gain. The price moved your way and the trade still lost money."
            : net === gross
              ? "With no costs, you keep the whole gain. Real trades rarely work that way."
              : `Costs took ${Math.round((costs / Math.max(1, gross)) * 100)}% of what the price movement earned.`}
        </Says>
      </Stage>
    </div>
  );
}
