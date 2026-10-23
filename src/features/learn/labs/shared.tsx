"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { LineChart, walk } from "../charts";
import type { LabProps } from "../types";
import { Act, Segmented, Slider, Stat, inr, signedInr, toneOf } from "../ui";

/* ------------------------------------------------------------------ */
/* Surfaces. Related, deliberately not identical.                      */
/* ------------------------------------------------------------------ */

/** Where a market is shown: a dark instrument face with a title rail. */
export function Stage({ title, tag = "Simulated", children, flush }: { title: string; tag?: string; children: ReactNode; flush?: boolean }) {
  return (
    <section className="stage" data-flush={flush}>
      <header className="stage-head">
        <h3>{title}</h3>
        <span>{tag}</span>
      </header>
      {children}
    </section>
  );
}

/** Where the learner's hands go. */
export function Deck({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="deck">
      {title ? <h3 className="deck-title">{title}</h3> : null}
      {children}
    </section>
  );
}

/** Results: figures on hairlines, no box. */
export function Read({ children, columns }: { children: ReactNode; columns?: number }) {
  return (
    <div className="read" style={columns ? ({ "--cols": columns } as CSSProperties) : undefined}>
      {children}
    </div>
  );
}

/** One plain sentence that restates what the numbers just did. */
export function Says({ children, tone }: { children: ReactNode; tone?: "up" | "down" | "flat" | "gold" }) {
  return (
    <p className="says" data-tone={tone} aria-live="polite">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* A question with a reason attached to every answer                   */
/* ------------------------------------------------------------------ */

export type Option = { label: string; right?: boolean; why: string };

export function Pick({ prompt, options, onRight }: { prompt: string; options: Option[]; onRight?: () => void }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const solved = chosen !== null && Boolean(options[chosen].right);
  return (
    <fieldset className="pick" data-solved={solved}>
      <legend>{prompt}</legend>
      <div className="pick-options">
        {options.map((option, index) => (
          <button
            key={option.label}
            type="button"
            data-state={chosen === index ? (option.right ? "right" : "wrong") : undefined}
            aria-pressed={chosen === index}
            onClick={() => {
              setChosen(index);
              if (option.right) onRight?.();
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {chosen !== null ? (
        <p className="pick-why" data-right={solved} aria-live="polite">
          {options[chosen].why}
        </p>
      ) : null}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Same move, different size                                           */
/* ------------------------------------------------------------------ */

export function SizeCompare({ onGoal, small = 10, large = 100, start = 5, range = 20 }: LabProps & { small?: number; large?: number; start?: number; range?: number }) {
  const [move, setMove] = useState(start);
  const [a, setA] = useState(small);
  const [b, setB] = useState(large);
  const biggest = range * Math.max(a, b, 1);

  const bar = (shares: number): CSSProperties => ({ "--size": `${(Math.abs(move * shares) / biggest) * 50}%` }) as CSSProperties;

  return (
    <div className="lab" data-layout="side">
      <Stage title="Same price move, two position sizes">
        <div className="versus">
          {(
            [
              ["Trader A", a],
              ["Trader B", b],
            ] as const
          ).map(([name, shares]) => (
            <div className="versus-row" key={name}>
              <div className="versus-who">
                <strong>{name}</strong>
                <span>{shares} shares</span>
              </div>
              <div className="versus-track" data-tone={toneOf(move)} data-side={move < 0 ? "left" : "right"}>
                <i style={bar(shares)} />
              </div>
              <Stat label="P&L" value={move * shares} format={signedInr} tone={toneOf(move)} size="s" />
            </div>
          ))}
        </div>
        <Says tone={toneOf(move)}>
          {move === 0
            ? "No price movement, so neither position has gained or lost."
            : `The price moved ${signedInr(move)} per share for both. Trader B holds ${b > a ? `${(b / Math.max(1, a)).toFixed(b % a ? 1 : 0)}× the shares` : "fewer shares"}, so the same move means ${signedInr(move * b)} instead of ${signedInr(move * a)}.`}
        </Says>
      </Stage>
      <Deck title="Change the trade">
        <Slider
          label="Price change per share"
          value={move}
          min={-range}
          max={range}
          format={signedInr}
          tone={toneOf(move)}
          onChange={(value) => {
            setMove(value);
            if (value !== start) onGoal();
          }}
        />
        <Slider label="Trader A holds" value={a} min={1} max={100} format={(v) => `${v} shares`} onChange={setA} />
        <Slider label="Trader B holds" value={b} min={10} max={500} step={10} format={(v) => `${v} shares`} onChange={setB} />
        <p className="deck-formula">P&amp;L = price change × position size</p>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Market order versus limit order                                     */
/* ------------------------------------------------------------------ */

type Run = { kind: "market" | "limit"; limit: number; path: number[]; step: number };

/** A minute of market after the order is sent. Half the time it dips, half the time it runs away. */
function minute() {
  const dips = Math.random() < 0.55;
  const floor = dips ? 92 + Math.random() * 3 : 97.5 + Math.random() * 2;
  const turn = 10 + Math.floor(Math.random() * 10);
  const path = [100];
  for (let i = 1; i < 36; i++) {
    const target = i <= turn ? 100 - ((100 - floor) * i) / turn : floor + ((dips ? 103 : 108) - floor) * ((i - turn) / (36 - turn));
    path.push(target + (Math.random() - 0.5) * 1.1);
  }
  return path;
}

export function OrderType({ onGoal }: LabProps) {
  const [kind, setKind] = useState<"market" | "limit">("market");
  const [limit, setLimit] = useState(95);
  const [run, setRun] = useState<Run | null>(null);
  const tried = useRef(new Set<string>());

  const running = run !== null && run.step < run.path.length - 1;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setRun((now) => (now ? { ...now, step: Math.min(now.path.length - 1, now.step + 1) } : now)), 110);
    return () => window.clearInterval(timer);
  }, [running]);

  const send = () => {
    setRun({ kind, limit, path: minute(), step: 0 });
    tried.current.add(kind);
    if (tried.current.size === 2) onGoal();
  };

  const seen = run ? run.path.slice(0, run.step + 1) : [100];
  const touch = run && run.kind === "limit" ? run.path.findIndex((price) => price <= run.limit) : -1;
  const filled = run ? (run.kind === "market" ? true : touch !== -1 && run.step >= touch) : false;
  const finished = run !== null && !running;

  let status: ReactNode = "Choose an order type and send it. Then watch what the market does next.";
  let tone: "up" | "down" | "flat" | "gold" = "flat";
  if (run?.kind === "market") {
    status = "Filled straight away at ₹101, the best price a seller was offering. You got the trade; the market chose the price.";
    tone = "up";
  } else if (run && filled) {
    status = `Filled at ₹${run.limit}. The price came down to your limit, so you bought at the price you chose.`;
    tone = "up";
  } else if (run && finished) {
    status = `Not filled. The market never came down to ₹${run.limit}, so you have no position. You kept control of price and gave up certainty.`;
    tone = "down";
  } else if (run) {
    status = `Waiting. Your order sits at ₹${run.limit} until a seller accepts that price.`;
    tone = "gold";
  }

  return (
    <div className="lab" data-layout="side">
      <Stage title="FNTX after you send the order">
        <LineChart
          data={seen.length > 1 ? seen : [100, 100]}
          min={90}
          max={109}
          height={230}
          label="Price after the order is sent"
          levels={run?.kind === "limit" || (!run && kind === "limit") ? [{ value: run?.limit ?? limit, label: `Your limit ₹${run?.limit ?? limit}`, tone: filled ? "up" : "gold" }] : []}
        />
        <Says tone={tone}>{status}</Says>
      </Stage>
      <Deck title="Buy order">
        <Segmented
          label="Order type"
          value={kind}
          onChange={setKind}
          options={[
            { value: "market", label: "Market" },
            { value: "limit", label: "Limit" },
          ]}
        />
        {kind === "limit" ? (
          <Slider label="Buy only at or below" value={limit} min={91} max={99} format={inr} tone="gold" onChange={setLimit} />
        ) : (
          <p className="deck-note">Buys now at the best available price. Sellers are asking ₹101.</p>
        )}
        <Act onClick={send} disabled={running} tone="up">
          {running ? "Order working…" : `Send ${kind} buy`}
        </Act>
        <Read columns={2}>
          <Stat label="Market order" value="Execution first" size="s" />
          <Stat label="Limit order" value="Price first" size="s" />
        </Read>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Walking the order book                                              */
/* ------------------------------------------------------------------ */

export type Book = { name: string; note: string; asks: [price: number, shares: number][] };

/** Match a market buy against the asks, cheapest first. */
function fill(asks: Book["asks"], size: number) {
  let left = size;
  let cost = 0;
  let worst = asks[0][0];
  const taken = asks.map(([price, shares]) => {
    const take = Math.min(left, shares);
    left -= take;
    cost += take * price;
    if (take > 0) worst = price;
    return take;
  });
  return { taken, left, cost, worst };
}

export function BookWalk({ onGoal, books, max = 100 }: LabProps & { books: Book[]; max?: number }) {
  const [which, setWhich] = useState(0);
  const [size, setSize] = useState(10);
  const seen = useRef(new Set<number>([0]));
  const book = books[which];

  const { taken, left, cost, worst } = fill(book.asks, size);
  const got = size - left;
  const average = got ? cost / got : 0;
  const best = book.asks[0][0];
  const deepest = Math.max(...book.asks.map(([, shares]) => shares));

  const reach = (nextSize: number, nextBook: number) => {
    const first = books[nextBook].asks[0][1];
    if (books.length === 1 ? nextSize > first : seen.current.size === books.length) onGoal();
  };

  return (
    <div className="lab" data-layout="side">
      <Stage title="Sellers waiting (asks)" tag={book.name}>
        <ol className="ladder">
          {book.asks.map(([price, shares], index) => (
            <li key={price} data-hit={taken[index] > 0}>
              <span className="ladder-price">{inr(price)}</span>
              <span className="ladder-depth" style={{ "--depth": `${(shares / deepest) * 100}%`, "--taken": `${(taken[index] / shares) * 100}%` } as CSSProperties}>
                <i />
              </span>
              <span className="ladder-size">
                {taken[index] > 0 ? <b>{taken[index]}</b> : 0} / {shares}
              </span>
            </li>
          ))}
        </ol>
        <Says tone={worst > best ? "gold" : "flat"}>
          {left > 0
            ? `Only ${got} shares are for sale here. The rest of your order has nobody to trade with.`
            : worst > best
              ? `The cheapest sellers ran out, so your order kept matching at higher prices, up to ${inr(worst)}.`
              : `Your whole order fits inside the best ask, so every share fills at ${inr(best)}.`}
        </Says>
      </Stage>
      <Deck title="Market buy">
        {books.length > 1 ? (
          <Segmented
            label="Market"
            value={String(which)}
            options={books.map((entry, index) => ({ value: String(index), label: entry.name }))}
            onChange={(value) => {
              const next = Number(value);
              setWhich(next);
              seen.current.add(next);
              reach(size, next);
            }}
          />
        ) : null}
        <Slider
          label="Order size"
          value={size}
          min={5}
          max={max}
          step={5}
          format={(v) => `${v} shares`}
          onChange={(value) => {
            setSize(value);
            reach(value, which);
          }}
        />
        <p className="deck-note">{book.note}</p>
        <Read columns={2}>
          <Stat label="Best ask" value={best} format={inr} size="s" />
          <Stat label="Average fill" value={average} format={(v) => inr(v, 2)} size="s" tone={average > best ? "down" : "flat"} />
          <Stat label="Shares filled" value={got} size="s" />
          <Stat label="Paid above best" value={cost - got * best} format={inr} size="s" tone={cost - got * best > 0 ? "down" : "flat"} />
        </Read>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calm asset, wild asset                                              */
/* ------------------------------------------------------------------ */

export function Swings({
  onGoal,
  calm,
  wild,
  control,
}: LabProps & { calm: { name: string; swing: number }; wild: { name: string; swing: number }; control: "slider" | "rerun" }) {
  const [swing, setSwing] = useState(wild.swing);
  const [seed, setSeed] = useState(3);
  const a = walk(seed * 11 + 1, 60, 100, calm.swing);
  const b = walk(seed * 17 + 5, 60, 100, swing);
  const span = (series: number[]) => Math.max(...series) - Math.min(...series);
  const edge = Math.max(8, ...[...a, ...b].map((value) => Math.abs(value - 100))) * 1.1;

  return (
    <div className="lab" data-layout="stack">
      <div className="duo">
        {(
          [
            [calm.name, a, "cyan"],
            [wild.name, b, "purple"],
          ] as const
        ).map(([name, series, tone]) => (
          <Stage title={name} tag="Start = 100" key={name}>
            <LineChart data={series} min={100 - edge} max={100 + edge} height={190} tone={tone} prefix="" label={`${name} price path`} levels={[{ value: 100, label: "Start", tone: "gold" }]} />
            <Read columns={3}>
              <Stat label="Lowest" value={Math.min(...series)} format={(v) => v.toFixed(1)} size="s" />
              <Stat label="Highest" value={Math.max(...series)} format={(v) => v.toFixed(1)} size="s" />
              <Stat label="Range" value={span(series)} format={(v) => v.toFixed(1)} size="s" tone="flat" />
            </Read>
          </Stage>
        ))}
      </div>
      <div className="deck" data-inline="true">
        {control === "slider" ? (
          <Slider
            label={`How sharply ${wild.name} moves`}
            value={swing}
            min={0.4}
            max={9}
            step={0.2}
            tone="gold"
            format={(v) => (v < 1.5 ? "Calm" : v < 4 ? "Lively" : v < 6.5 ? "Volatile" : "Very volatile")}
            onChange={(value) => {
              setSwing(value);
              if (value >= 6.5) onGoal();
            }}
          />
        ) : null}
        <Act
          quiet={control === "slider"}
          onClick={() => {
            setSeed((now) => now + 1);
            if (control === "rerun") onGoal();
          }}
        >
          Run another period
        </Act>
        <Says tone="gold">
          {`Over the same period ${wild.name} travelled a range ${(span(b) / Math.max(0.1, span(a))).toFixed(1)}× as wide as ${calm.name}. A wider range means bigger possible gains, and bigger possible losses.`}
        </Says>
      </div>
    </div>
  );
}
