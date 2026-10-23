"use client";

import { useRef, useState, type CSSProperties } from "react";
import { LineChart, useLive, walk } from "../charts";
import type { LabProps } from "../types";
import { Act, Segmented, Slider, Stat, inr, signedPct, toneOf } from "../ui";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { BookWalk, Deck, OrderType, Read, Says, Stage, Swings } from "./shared";

/* ------------------------------------------------------------------ */
/* 01 — A market connects orders                                       */
/* ------------------------------------------------------------------ */

type Order = { who: string; price: number };
const BUYERS: Order[] = [
  { who: "Asha", price: 100 },
  { who: "Dev", price: 99 },
  { who: "Mira", price: 101 },
];
const SELLERS: Order[] = [
  { who: "Kabir", price: 101 },
  { who: "Zoya", price: 100 },
  { who: "Ishan", price: 103 },
];

export function Venue({ onGoal }: LabProps) {
  const [buyers, setBuyers] = useState(BUYERS);
  const [sellers, setSellers] = useState(SELLERS);
  const [trades, setTrades] = useState<string[]>([]);
  const [note, setNote] = useState("Tap a buyer to send their order into the market.");

  const send = (buyer: Order) => {
    const match = [...sellers].sort((a, b) => a.price - b.price).find((seller) => seller.price <= buyer.price);
    if (!match) {
      setNote(`${buyer.who} will pay up to ${inr(buyer.price)}, but no seller accepts that. The order waits in the market.`);
      return;
    }
    setBuyers(buyers.filter((entry) => entry !== buyer));
    setSellers(sellers.filter((entry) => entry !== match));
    setTrades([`${buyer.who} bought from ${match.who} at ${inr(match.price)}`, ...trades]);
    setNote(`The market connected ${buyer.who} and ${match.who}: a trade at ${inr(match.price)}.`);
    onGoal();
  };

  return (
    <div className="lab" data-layout="stack">
      <div className="venue">
        <div className="venue-side" data-side="buy">
          <h3>Buyers want to buy</h3>
          {buyers.map((buyer) => (
            <button key={buyer.who} type="button" className="order" data-tone="up" onClick={() => send(buyer)}>
              <span>{buyer.who}</span>
              <strong>pays up to {inr(buyer.price)}</strong>
            </button>
          ))}
          {buyers.length === 0 ? <p className="deck-note">No buyers left.</p> : null}
        </div>
        <div className="venue-core">
          <span className="venue-title">The market</span>
          <ol className="tape" aria-label="Trades">
            {trades.length ? trades.map((trade) => <li key={trade}>{trade}</li>) : <li data-empty="true">No trades yet</li>}
          </ol>
          <Act
            quiet
            onClick={() => {
              setBuyers(BUYERS);
              setSellers(SELLERS);
              setTrades([]);
              setNote("Tap a buyer to send their order into the market.");
            }}
            disabled={trades.length === 0}
          >
            Reset orders
          </Act>
        </div>
        <div className="venue-side" data-side="sell">
          <h3>Sellers want to sell</h3>
          {sellers.map((seller) => (
            <div key={seller.who} className="order" data-tone="down">
              <span>{seller.who}</span>
              <strong>accepts {inr(seller.price)} or more</strong>
            </div>
          ))}
          {sellers.length === 0 ? <p className="deck-note">No sellers left.</p> : null}
        </div>
      </div>
      <Says tone="gold">{note}</Says>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — A trade needs two compatible prices                            */
/* ------------------------------------------------------------------ */

export function Handshake({ onGoal }: LabProps) {
  const [bid, setBid] = useState(97);
  const [ask, setAsk] = useState(102);
  const agreed = bid >= ask;
  const at = (value: number) => `${((value - 90) / 20) * 100}%`;
  const check = (nextBid: number, nextAsk: number) => {
    if (nextBid >= nextAsk) onGoal();
  };
  return (
    <div className="lab" data-layout="side">
      <Stage title="One buyer, one seller" tag={agreed ? "Trade" : "No trade"}>
        <div className="gapline" data-agreed={agreed} style={{ "--bid": at(bid), "--ask": at(ask) } as CSSProperties}>
          <i className="gapline-gap" />
          <span className="gapline-pin" data-who="bid">
            <b>{inr(bid)}</b>Buyer pays up to
          </span>
          <span className="gapline-pin" data-who="ask">
            <b>{inr(ask)}</b>Seller accepts from
          </span>
        </div>
        <Says tone={agreed ? "up" : "flat"}>
          {agreed
            ? `Their prices are compatible, so a trade can occur at ${inr(ask)}.`
            : `They are ${inr(ask - bid)} apart. Nobody is forced to trade, so nothing happens until one of them moves.`}
        </Says>
      </Stage>
      <Deck title="Move either side">
        <Slider
          label="Buyer is willing to pay"
          value={bid}
          min={90}
          max={110}
          format={inr}
          tone="up"
          onChange={(value) => {
            setBid(value);
            check(value, ask);
          }}
        />
        <Slider
          label="Seller is willing to accept"
          value={ask}
          min={90}
          max={110}
          format={inr}
          tone="down"
          onChange={(value) => {
            setAsk(value);
            check(bid, value);
          }}
        />
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — Pressure moves price                                           */
/* ------------------------------------------------------------------ */

const CALM = walk(8, 60, 100, 0.8);

export function Pressure({ onGoal }: LabProps) {
  const reduced = useReducedMotion();
  const [balance, setBalance] = useState(0);
  const pushed = useRef({ up: false, down: false });
  const [series] = useLive(CALM, { running: !reduced, swing: 0.9, drift: balance * 0.16, keep: 60, every: 300 });
  const price = series[series.length - 1];
  const change = ((price - series[0]) / series[0]) * 100;

  return (
    <div className="lab" data-layout="side">
      <Stage title="FNTX · live" tag={balance > 0 ? "Buyers in control" : balance < 0 ? "Sellers in control" : "Balanced"}>
        <LineChart data={series} height={250} tone={balance > 0 ? "up" : balance < 0 ? "down" : "cyan"} label="Live price responding to pressure" />
        <div className="tug" style={{ "--lean": `${50 + balance * 9}%` } as CSSProperties} role="img" aria-label="Balance between buying and selling pressure">
          <span>Buying pressure</span>
          <i />
          <span>Selling pressure</span>
        </div>
      </Stage>
      <Deck title="Shift the balance">
        <Slider
          label="Who is more eager?"
          value={balance}
          min={-5}
          max={5}
          tone={toneOf(balance)}
          format={(v) => (v === 0 ? "Balanced" : v > 0 ? `Buyers +${v}` : `Sellers +${-v}`)}
          onChange={(value) => {
            setBalance(value);
            if (value >= 3) pushed.current.up = true;
            if (value <= -3) pushed.current.down = true;
            if (pushed.current.up && pushed.current.down) onGoal();
          }}
        />
        <Read columns={2}>
          <Stat label="Price" value={price} format={(v) => inr(v, 1)} />
          <Stat label="On screen" value={change} format={signedPct} tone={toneOf(change)} />
        </Read>
        <Says tone={toneOf(balance)}>
          {balance === 0
            ? "Buyers and sellers are evenly matched. The price wanders, and goes nowhere in particular."
            : balance > 0
              ? "Buyers are competing and paying higher prices to get filled. The price can move up."
              : "Sellers are competing and accepting lower prices to get out. The price can move down."}
        </Says>
        {reduced ? <p className="deck-note">Motion is reduced on this device, so the chart is paused.</p> : null}
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 — Price is the last agreed trade                                 */
/* ------------------------------------------------------------------ */

export function PriceSteps({ onGoal }: LabProps) {
  const [trades, setTrades] = useState([100]);
  const price = trades[trades.length - 1];
  const step = (by: number) => {
    const next = [...trades, price + by].slice(-24);
    setTrades(next);
    if (next.length >= 6) onGoal();
  };
  return (
    <div className="lab" data-layout="side">
      <Stage title="Every trade prints a price" tag={`Last trade ${inr(price)}`}>
        <LineChart data={trades.length > 1 ? trades : [100, 100]} min={Math.min(94, price - 2)} max={Math.max(106, price + 2)} height={230} label="Trade by trade price" />
        <ol className="tape" data-row="true" aria-label="Recent trades">
          {trades
            .slice(-7)
            .reverse()
            .map((trade, index) => (
              <li key={`${trades.length}-${index}`} data-tone={index === 0 ? "gold" : undefined}>
                {inr(trade)}
              </li>
            ))}
        </ol>
      </Stage>
      <Deck title="Who gives way?">
        <Act tone="up" onClick={() => step(1)}>
          A buyer agrees to pay ₹1 more
        </Act>
        <Act tone="down" onClick={() => step(-1)}>
          A seller agrees to take ₹1 less
        </Act>
        <Says tone="gold">
          The market price is not set by anyone. It is simply the price of the latest trade two people agreed on.
        </Says>
        <Act quiet onClick={() => setTrades([100])} disabled={trades.length === 1}>
          Back to ₹100
        </Act>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 — Read the order book                                            */
/* ------------------------------------------------------------------ */

const BIDS: [number, number][] = [
  [99, 120],
  [98, 260],
  [97, 410],
];
const ASKS: [number, number][] = [
  [101, 90],
  [102, 240],
  [103, 380],
];

export function BookRead({ onGoal }: LabProps) {
  const [ask, setAsk] = useState<"bid" | "ask">("bid");
  const [note, setNote] = useState("");
  const [found, setFound] = useState<string[]>([]);
  const tap = (side: "bid" | "ask", price: number) => {
    if (found.length === 2) return;
    const best = ask === "bid" ? 99 : 101;
    if (side !== ask) return setNote(side === "bid" ? "That is a bid: a price a buyer is offering. Look on the other side." : "That is an ask: a price a seller wants. Look on the other side.");
    if (price !== best) return setNote(ask === "bid" ? "A buyer is offering more than that. The best bid is the highest one." : "A seller will accept less than that. The best ask is the lowest one.");
    const next = [...found, `${side}-${price}`];
    setFound(next);
    if (next.length === 2) {
      setNote("Best bid ₹99, best ask ₹101. These two are the closest the market is to a trade.");
      onGoal();
    } else {
      setAsk("ask");
      setNote("Right: ₹99 is the most any buyer will currently pay.");
    }
  };
  const row = (side: "bid" | "ask", [price, size]: [number, number]) => (
    <li key={price}>
      <button type="button" data-side={side} data-found={found.includes(`${side}-${price}`)} onClick={() => tap(side, price)} style={{ "--depth": `${(size / 410) * 100}%` } as CSSProperties}>
        <strong>{inr(price)}</strong>
        <span>{size} shares</span>
      </button>
    </li>
  );
  return (
    <div className="lab" data-layout="stack">
      <p className="quest">{found.length === 2 ? "Order book read." : ask === "bid" ? "Find the best bid: tap the highest price a buyer will pay." : "Now find the best ask: tap the lowest price a seller will accept."}</p>
      <div className="book">
        <div>
          <h3>Bids · buyers</h3>
          <ul>{BIDS.map((entry) => row("bid", entry))}</ul>
        </div>
        <div>
          <h3>Asks · sellers</h3>
          <ul>{ASKS.map((entry) => row("ask", entry))}</ul>
        </div>
      </div>
      {note ? <Says tone={found.length === 2 ? "up" : "gold"}>{note}</Says> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 — The spread                                                     */
/* ------------------------------------------------------------------ */

export function Spread({ onGoal }: LabProps) {
  const [bid, setBid] = useState(99);
  const [ask, setAsk] = useState(101);
  const spread = ask - bid;
  const at = (value: number) => `${((value - 90) / 20) * 100}%`;
  const done = (b: number, a: number) => {
    if (a - b <= 1) onGoal();
  };
  return (
    <div className="lab" data-layout="side">
      <Stage title="The gap between best bid and best ask" tag={spread <= 1 ? "Tight" : spread <= 4 ? "Normal" : "Wide"}>
        <div className="gapline" data-spread="true" style={{ "--bid": at(bid), "--ask": at(ask) } as CSSProperties}>
          <i className="gapline-gap" />
          <span className="gapline-pin" data-who="bid">
            <b>{inr(bid)}</b>Best bid
          </span>
          <span className="gapline-pin" data-who="ask">
            <b>{inr(ask)}</b>Best ask
          </span>
        </div>
        <Read columns={2}>
          <Stat label="Spread = ask - bid" value={spread} format={inr} tone="flat" size="l" />
          <Stat label="Buyers and sellers are" value={spread <= 1 ? "Close together" : spread <= 4 ? "Fairly close" : "Far apart"} size="s" />
        </Read>
      </Stage>
      <Deck title="Move the best prices">
        <Slider
          label="Best bid"
          value={bid}
          min={90}
          max={ask - 1}
          format={inr}
          tone="up"
          onChange={(value) => {
            setBid(value);
            done(value, ask);
          }}
        />
        <Slider
          label="Best ask"
          value={ask}
          min={bid + 1}
          max={110}
          format={inr}
          tone="down"
          onChange={(value) => {
            setAsk(value);
            done(bid, value);
          }}
        />
        <Says tone="gold">
          {spread <= 1 ? "A small spread: someone only has to give up ₹1 for a trade to happen." : `For a trade to happen now, a buyer has to pay ${inr(spread)} more, a seller has to take ${inr(spread)} less, or they meet in between.`}
        </Says>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07, 08, 10 — shared interactives, framed for this module            */
/* ------------------------------------------------------------------ */

export const MarketOrLimit = OrderType;

export const Liquidity = (props: LabProps) => (
  <BookWalk
    {...props}
    max={100}
    books={[
      {
        name: "Busy market",
        note: "Many sellers at prices close to the market. A large order is absorbed easily.",
        asks: [
          [101, 300],
          [102, 400],
          [103, 500],
        ],
      },
      {
        name: "Quiet market",
        note: "Few sellers, spread over distant prices. The same order pushes the price up as it fills.",
        asks: [
          [101, 10],
          [104, 15],
          [108, 25],
          [115, 50],
        ],
      },
    ]}
  />
);

export const Volatility = (props: LabProps) => <Swings {...props} control="slider" calm={{ name: "Asset A", swing: 0.5 }} wild={{ name: "Asset B", swing: 2 }} />;

/* ------------------------------------------------------------------ */
/* 09 — News meets expectations                                        */
/* ------------------------------------------------------------------ */

const HEADLINES = [
  { title: "Company reports record profits", good: true },
  { title: "Central bank raises interest rates", good: false },
  { title: "New product launch is delayed", good: false },
  { title: "Regulator approves a new fund for the asset", good: true },
];

const BEFORE = walk(12, 30, 100, 0.7);

export function NewsDesk({ onGoal }: LabProps) {
  const [headline, setHeadline] = useState(0);
  const [view, setView] = useState<"surprise" | "expected">("surprise");
  const [fired, setFired] = useState(0);
  const tried = useRef(new Set<string>());
  const news = HEADLINES[headline];

  const last = BEFORE[BEFORE.length - 1];
  const jump = view === "surprise" ? (news.good ? 9 : -9) : news.good ? -1.5 : 1.5;
  const after = fired ? walk(fired * 7 + headline, 30, last + jump, 0.8, view === "surprise" ? (news.good ? 0.12 : -0.12) : 0).map((value) => value) : [];
  const series = [...BEFORE, ...after];

  return (
    <div className="lab" data-layout="side" data-flip="true">
      <Deck title="News desk">
        <ul className="headlines">
          {HEADLINES.map((entry, index) => (
            <li key={entry.title}>
              <button
                type="button"
                aria-pressed={index === headline}
                onClick={() => {
                  setHeadline(index);
                  setFired(0);
                }}
              >
                {entry.title}
              </button>
            </li>
          ))}
        </ul>
        <Segmented
          label="What traders expected"
          value={view}
          options={[
            { value: "surprise", label: "A surprise" },
            { value: "expected", label: "Already expected" },
          ]}
          onChange={(value) => {
            setView(value);
            setFired(0);
          }}
        />
        <Act
          tone="gold"
          onClick={() => {
            setFired(fired + 1);
            tried.current.add(view);
            if (tried.current.size === 2) onGoal();
          }}
        >
          Publish the news
        </Act>
      </Deck>
      <Stage title="How the market responds" tag={fired ? "News is out" : "Before the news"}>
        <LineChart data={series} min={84} max={116} height={240} tone={!fired ? "cyan" : jump > 0 ? "up" : "down"} label="Price before and after the news" marks={fired ? [{ index: BEFORE.length - 1, label: "News", tone: "gold" }] : []} />
        <Says tone={!fired ? "flat" : "gold"}>
          {!fired
            ? "Information changes expectations, expectations change buying and selling, and that can move the price."
            : view === "surprise"
              ? `Nobody saw this coming. Traders changed their minds at once, ${news.good ? "buyers rushed in and the price jumped" : "sellers rushed out and the price dropped"}.`
              : "Traders had already acted on this. With nothing new to react to, the price barely moved, and even drifted the other way."}
        </Says>
      </Stage>
    </div>
  );
}
