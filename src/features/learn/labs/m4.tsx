"use client";

import { useRef, useState, type CSSProperties } from "react";
import { LineChart } from "../charts";
import type { LabProps } from "../types";
import { Act, Blocks, Segmented, Slider, Stat, inr, signedInr, signedPct, toneOf } from "../ui";
import { Deck, Pick, Read, Says, Stage, Swings } from "./shared";

/* ------------------------------------------------------------------ */
/* The six asset types, described the way the module describes them    */
/* ------------------------------------------------------------------ */

const ASSETS = [
  { key: "stock", name: "Stock", buying: "Ownership in a company", example: "10 shares of a company", traits: { volatility: 3, potential: 4, risk: 3, liquidity: 4 } },
  { key: "bond", name: "Bond", buying: "A loan to a company or government", example: "A government bond paying interest", traits: { volatility: 1, potential: 2, risk: 1, liquidity: 3 } },
  { key: "commodity", name: "Commodity", buying: "A physical good or raw material", example: "Gold, crude oil, wheat", traits: { volatility: 3, potential: 3, risk: 3, liquidity: 3 } },
  { key: "currency", name: "Currency", buying: "One country's currency relative to another", example: "USD/INR", traits: { volatility: 2, potential: 2, risk: 2, liquidity: 5 } },
  { key: "crypto", name: "Cryptocurrency", buying: "A digital asset", example: "Bitcoin, Ethereum", traits: { volatility: 5, potential: 5, risk: 5, liquidity: 3 } },
  { key: "etf", name: "ETF", buying: "A fund containing a collection of assets", example: "A fund tracking 500 large companies", traits: { volatility: 2, potential: 3, risk: 2, liquidity: 4 } },
] as const;

const TRAITS = [
  ["volatility", "Volatility", "How sharply the price tends to move"],
  ["potential", "Potential return", "How much it could gain"],
  ["risk", "Risk", "How much it could lose"],
  ["liquidity", "Liquidity", "How easily it can be bought or sold"],
] as const;

/* ------------------------------------------------------------------ */
/* 01 — What are you actually buying?                                  */
/* ------------------------------------------------------------------ */

export function AssetExplorer({ onGoal }: LabProps) {
  const [which, setWhich] = useState(0);
  const seen = useRef(new Set([0]));
  const asset = ASSETS[which];
  return (
    <div className="lab" data-layout="stack">
      <div className="asset-grid">
        {ASSETS.map((entry, index) => (
          <button
            key={entry.key}
            type="button"
            className="asset-tile"
            data-asset={entry.key}
            aria-pressed={index === which}
            onClick={() => {
              setWhich(index);
              seen.current.add(index);
              if (seen.current.size >= 4) onGoal();
            }}
          >
            <i aria-hidden="true" />
            {entry.name}
          </button>
        ))}
      </div>
      <div className="asset-card" data-asset={asset.key}>
        <span className="ctl-label">When you buy a {asset.name.toLowerCase()}, you are buying</span>
        <strong>{asset.buying}</strong>
        <span>For example: {asset.example}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — A share is a slice of a company                                */
/* ------------------------------------------------------------------ */

export function Ownership({ onGoal }: LabProps) {
  const TOTAL = 1000;
  const [shares, setShares] = useState(10);
  const [price, setPrice] = useState(250);
  return (
    <div className="lab" data-layout="side">
      <Stage title="Northwind Ltd · 1,000 shares in total" tag="Each block = 10 shares">
        <Blocks total={100} lit={Math.round(shares / 10)} tone="gold" />
        <Says tone="gold">
          {`You own ${shares} of ${TOTAL.toLocaleString("en-IN")} shares: ${((shares / TOTAL) * 100).toFixed(0)}% of the company. You are a shareholder.`}
        </Says>
      </Stage>
      <Deck title="Your stake">
        <Slider
          label="Shares you buy"
          value={shares}
          min={10}
          max={500}
          step={10}
          format={(v) => `${v} shares`}
          tone="gold"
          onChange={(value) => {
            setShares(value);
            onGoal();
          }}
        />
        <Slider label="Market price per share" value={price} min={100} max={400} step={10} format={inr} onChange={setPrice} />
        <Read columns={2}>
          <Stat label="Ownership" value={(shares / TOTAL) * 100} format={(v) => `${v.toFixed(0)}%`} />
          <Stat label="Value of your shares" value={shares * price} format={inr} tone={toneOf(price - 250)} />
        </Read>
        <p className="deck-note">The slice you own stays the same. What it is worth follows the market price.</p>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — A bond is a loan                                               */
/* ------------------------------------------------------------------ */

export function BondLoan({ onGoal }: LabProps) {
  const LENT = 10000;
  const [rate, setRate] = useState(6);
  const [years, setYears] = useState(5);
  const interest = (LENT * rate) / 100;
  const touch = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    onGoal();
  };
  return (
    <div className="lab" data-layout="side" data-flip="true">
      <Deck title="You lend ₹10,000 to a government">
        <Slider label="Interest rate per year" value={rate} min={2} max={10} format={(v) => `${v}%`} tone="gold" onChange={touch(setRate)} />
        <Slider label="Length of the bond" value={years} min={1} max={10} format={(v) => `${v} years`} onChange={touch(setYears)} />
        <Read columns={2}>
          <Stat label="Interest each year" value={interest} format={inr} />
          <Stat label="Total received" value={LENT + interest * years} format={inr} tone="up" />
        </Read>
        <div className="contrast">
          <span>
            <b>Stock</b> ownership
          </span>
          <span>
            <b>Bond</b> lending
          </span>
        </div>
      </Deck>
      <Stage title="What the issuer agrees to pay you" tag={`${years} payments + your money back`}>
        <ol className="timeline" style={{ "--n": years + 1 } as CSSProperties}>
          <li data-kind="out">
            <b>-{inr(LENT)}</b>
            <span>Today: you lend</span>
          </li>
          {Array.from({ length: years }, (_, index) => (
            <li key={index} data-kind={index === years - 1 ? "back" : "in"}>
              <b>+{inr(index === years - 1 ? interest + LENT : interest)}</b>
              <span>Year {index + 1}</span>
            </li>
          ))}
        </ol>
        <Says tone="gold">You do not own any part of the issuer. You are owed interest, and the amount you lent, on the terms of the bond.</Says>
      </Stage>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 — Commodities answer to supply and demand                        */
/* ------------------------------------------------------------------ */

const GOODS = [
  { name: "Gold", start: 100 },
  { name: "Crude oil", start: 100 },
  { name: "Wheat", start: 100 },
];
const EVENTS: { label: string; kind: "supply" | "demand"; move: number; why: string }[] = [
  { label: "Production is cut", kind: "supply", move: 8, why: "Less of it is available. Buyers compete for what is left, so the price can rise." },
  { label: "A record harvest / output", kind: "supply", move: -7, why: "More of it is available than buyers need, so sellers accept less." },
  { label: "Demand surges", kind: "demand", move: 6, why: "More buyers want the same amount of goods, so the price can rise." },
  { label: "Demand slows", kind: "demand", move: -6, why: "Fewer buyers want it, so sellers lower prices to find them." },
];

export function Commodity({ onGoal }: LabProps) {
  const [good, setGood] = useState("Gold");
  const [series, setSeries] = useState([100, 100]);
  const [why, setWhy] = useState("Trigger an event and watch the price respond.");
  const used = useRef(new Set<string>());
  const price = series[series.length - 1];
  return (
    <div className="lab" data-layout="side">
      <Stage title={`${good} · simulated price`} tag="Start = 100">
        <LineChart data={series} min={Math.min(70, price - 5)} max={Math.max(130, price + 5)} height={230} tone="gold" prefix="" label={`${good} price after events`} />
        <Says tone="gold">{why}</Says>
      </Stage>
      <Deck title="World events">
        <Segmented
          label="Commodity"
          value={good}
          options={GOODS.map((entry) => ({ value: entry.name, label: entry.name }))}
          onChange={(value) => {
            setGood(value);
            setSeries([100, 100]);
            setWhy("Trigger an event and watch the price respond.");
          }}
        />
        <div className="deck-grid">
          {EVENTS.map((event) => (
            <Act
              key={event.label}
              quiet
              tone={toneOf(event.move)}
              onClick={() => {
                setSeries([...series, price + event.move * 0.6, price + event.move].slice(-30));
                setWhy(event.why);
                used.current.add(event.kind);
                if (used.current.size === 2) onGoal();
              }}
            >
              {event.label}
            </Act>
          ))}
        </div>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 — A currency is always priced against another                    */
/* ------------------------------------------------------------------ */

export function FxPair({ onGoal }: LabProps) {
  const THEN = 88.84;
  const NOW = 95.95;
  const [rate, setRate] = useState(THEN);
  const change = ((rate - THEN) / THEN) * 100;
  const set = (value: number) => {
    setRate(value);
    if (Math.abs(value - NOW) < 0.03) onGoal();
  };
  return (
    <div className="lab" data-layout="side">
      <Stage title="USD / INR" tag="How many rupees one US dollar buys">
        <div className="fx">
          <div>
            <span className="ctl-label">1 US dollar</span>
            <strong>$1</strong>
          </div>
          <i aria-hidden="true">=</i>
          <div>
            <span className="ctl-label">Indian rupees</span>
            <Stat label="" value={rate} format={(v) => inr(v, 2)} size="l" tone={toneOf(change)} />
          </div>
        </div>
        <Read columns={3}>
          <Stat label="One year ago" value={THEN} format={(v) => v.toFixed(2)} size="s" />
          <Stat label="Rate shown" value={rate} format={(v) => v.toFixed(2)} size="s" />
          <Stat label="Change" value={change} format={(v) => signedPct(v, 2)} tone={toneOf(change)} size="s" />
        </Read>
        <Says tone="gold">
          {change > 0.01
            ? `A dollar buys more rupees than a year ago. The dollar has strengthened against the rupee, and $100 now costs ${inr(rate * 100)}.`
            : change < -0.01
              ? `A dollar buys fewer rupees than a year ago. The rupee has strengthened against the dollar.`
              : "This was the rate one year ago. Move it to the current rate."}
        </Says>
      </Stage>
      <Deck title="Move the exchange rate">
        <Slider label="USD/INR" value={rate} min={84} max={100} step={0.01} format={(v) => v.toFixed(2)} tone="gold" onChange={set} />
        <div className="deck-pair">
          <Act quiet onClick={() => set(THEN)}>
            One year ago
          </Act>
          <Act quiet onClick={() => set(NOW)}>
            Current rate
          </Act>
        </div>
        <p className="deck-note">The figures are the example from this lesson, not a live feed.</p>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 — Crypto can move a long way, quickly                            */
/* ------------------------------------------------------------------ */

export const CryptoSwing = (props: LabProps) => <Swings {...props} control="rerun" calm={{ name: "A major currency pair", swing: 0.5 }} wild={{ name: "A cryptocurrency", swing: 6 }} />;

/* ------------------------------------------------------------------ */
/* 07 — One fund, many companies                                       */
/* ------------------------------------------------------------------ */

const COMPANIES = ["Aster", "Borea", "Cirrus", "Delta", "Ember", "Fjord", "Gale", "Halo", "Iris", "Juno"];

export function EtfBasket({ onGoal }: LabProps) {
  const INVESTED = 10000;
  const [down, setDown] = useState<string[]>([]);
  const etf = (-30 * down.length) / COMPANIES.length;
  const single = down.includes("Aster") ? -30 : 0;
  return (
    <div className="lab" data-layout="side">
      <Stage title="Inside the ETF: 10 companies, equal parts" tag="Tap a company to drop it 30%">
        <div className="basket">
          {COMPANIES.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={down.includes(name)}
              data-first={name === "Aster"}
              onClick={() => {
                setDown(down.includes(name) ? down.filter((entry) => entry !== name) : [...down, name]);
                onGoal();
              }}
            >
              <span>{name}</span>
              <b>{down.includes(name) ? "-30%" : "0%"}</b>
            </button>
          ))}
        </div>
        <Act quiet onClick={() => setDown([])} disabled={down.length === 0}>
          Reset
        </Act>
      </Stage>
      <Deck title="Two investors, ₹10,000 each">
        <Read columns={2}>
          <Stat label="All in Aster shares" value={INVESTED * (1 + single / 100)} format={inr} tone={toneOf(single)} note={signedPct(single, 0)} />
          <Stat label="In the ETF" value={INVESTED * (1 + etf / 100)} format={inr} tone={toneOf(etf)} note={signedPct(etf, 0)} />
        </Read>
        <Says tone="gold">
          {down.length === 0
            ? "Drop Aster first, then try other companies."
            : single < 0
              ? `Aster fell 30%. The single-stock investor took the whole fall (${signedInr((INVESTED * single) / 100)}); the ETF holder felt a tenth of it per company.`
              : "A company fell, and the Aster-only investor was untouched this time. The ETF holder shares in every company, for better and for worse."}
        </Says>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 — Compare two assets                                             */
/* ------------------------------------------------------------------ */

export function AssetCompare({ onGoal }: LabProps) {
  const [left, setLeft] = useState(1);
  const [right, setRight] = useState(4);
  const changes = useRef(0);
  const choose = (set: (value: number) => void) => (value: string) => {
    set(Number(value));
    changes.current += 1;
    if (changes.current >= 2) onGoal();
  };
  const a = ASSETS[left];
  const b = ASSETS[right];
  const select = (label: string, value: number, set: (value: number) => void) => (
    <label className="chooser">
      <span className="ctl-label">{label}</span>
      <select value={value} onChange={(event) => choose(set)(event.target.value)}>
        {ASSETS.map((asset, index) => (
          <option key={asset.key} value={index}>
            {asset.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="lab" data-layout="stack">
      <div className="compare">
        <div className="compare-head">
          {select("Asset one", left, setLeft)}
          <span className="compare-vs">vs</span>
          {select("Asset two", right, setRight)}
        </div>
        <div className="compare-what">
          <p data-side="a">{a.buying}</p>
          <span className="ctl-label">What you are buying</span>
          <p data-side="b">{b.buying}</p>
        </div>
        {TRAITS.map(([key, name, meaning]) => (
          <div className="compare-row" key={key}>
            <div className="meter" data-side="a" style={{ "--level": a.traits[key] } as CSSProperties} role="img" aria-label={`${a.name} ${name}: ${a.traits[key]} of 5`}>
              <i />
            </div>
            <div className="compare-name">
              <strong>{name}</strong>
              <span>{meaning}</span>
            </div>
            <div className="meter" data-side="b" style={{ "--level": b.traits[key] } as CSSProperties} role="img" aria-label={`${b.name} ${name}: ${b.traits[key]} of 5`}>
              <i />
            </div>
          </div>
        ))}
      </div>
      <p className="deck-note">These levels are simplified for learning. Real assets vary, and none of this is a recommendation.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 — Name the asset                                                 */
/* ------------------------------------------------------------------ */

const CASES = [
  { text: "You want a small ownership stake in one company.", answer: "Stock", why: "Shares are ownership. That is a stock." },
  { text: "You want to lend money and receive agreed interest.", answer: "Bond", why: "Lending in exchange for interest is a bond." },
  { text: "You want exposure to hundreds of companies in one purchase.", answer: "ETF", why: "One fund holding a collection of assets: an ETF." },
  { text: "You want to trade the price of crude oil.", answer: "Commodity", why: "Crude oil is a raw material, a commodity." },
];

export function MatchAsset({ onGoal }: LabProps) {
  const [at, setAt] = useState(0);
  const solved = useRef(0);
  const current = CASES[at];
  return (
    <div className="lab" data-layout="stack">
      <div className="progress-pips" aria-label={`Situation ${at + 1} of ${CASES.length}`}>
        {CASES.map((entry, index) => (
          <i key={entry.answer} data-on={index <= at} />
        ))}
      </div>
      <Pick
        key={at}
        prompt={current.text}
        onRight={() => {
          solved.current = Math.max(solved.current, at + 1);
          if (solved.current === CASES.length) onGoal();
        }}
        options={["Stock", "Bond", "Commodity", "ETF"].map((label) => ({
          label,
          right: label === current.answer,
          why: label === current.answer ? current.why : `Not quite. A ${label.toLowerCase()} is ${ASSETS.find((asset) => asset.name === label)?.buying.toLowerCase()}.`,
        }))}
      />
      <div className="deck-pair">
        <Act quiet onClick={() => setAt(at - 1)} disabled={at === 0}>
          Previous
        </Act>
        <Act quiet onClick={() => setAt(at + 1)} disabled={at === CASES.length - 1}>
          Next situation
        </Act>
      </div>
    </div>
  );
}
