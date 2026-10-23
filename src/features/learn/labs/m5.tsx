"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LineChart } from "../charts";
import type { LabProps } from "../types";
import { Act, Segmented, Slider, Stat, inr, signedInr, signedPct, toneOf } from "../ui";
import { Deck, Pick, Read, Says, SizeCompare, Stage } from "./shared";

/* ------------------------------------------------------------------ */
/* 01 — The same trade, many possible results                          */
/* ------------------------------------------------------------------ */

export function Outcomes({ onGoal }: LabProps) {
  const [runs, setRuns] = useState<number[][]>([]);
  const latest = runs[runs.length - 1];
  const results = runs.map((run) => Math.round(run[run.length - 1] - 100) * 10);
  const losses = results.filter((result) => result < 0).length;

  const run = () => {
    const path = [100];
    for (let i = 1; i < 30; i++) path.push(Math.max(60, path[i - 1] + (Math.random() + Math.random() - 1) * 4.2));
    const next = [...runs, path].slice(-12);
    setRuns(next);
    if (next.length >= 5) onGoal();
  };

  return (
    <div className="lab" data-layout="side">
      <Stage title="Buy 10 shares at ₹100, then wait" tag={runs.length ? `Run ${runs.length}` : "Not run yet"}>
        <LineChart data={latest ?? [100, 100]} min={70} max={130} height={220} tone={!latest ? "cyan" : results[results.length - 1] >= 0 ? "up" : "down"} label="One possible path for the trade" levels={[{ value: 100, label: "Entry ₹100", tone: "gold" }]} />
        <div className="dots" aria-label="Results so far">
          {results.map((result, index) => (
            <span key={index} data-tone={toneOf(result)}>
              {signedInr(result)}
            </span>
          ))}
          {results.length === 0 ? <span data-empty="true">Results will collect here</span> : null}
        </div>
      </Stage>
      <Deck title="Run the same trade again">
        <Act tone="gold" onClick={run}>
          {runs.length ? "Run it again" : "Run the trade"}
        </Act>
        <Read columns={2}>
          <Stat label="Times run" value={runs.length} />
          <Stat label="Ended in a loss" value={losses} tone={losses ? "down" : "flat"} />
        </Read>
        <Says tone="gold">
          {runs.length < 3
            ? "Same asset, same entry, same size. Run it a few times."
            : "Nothing about your decision changed between runs, and the results did. Risk does not mean a loss will happen. It means a loss is possible."}
        </Says>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — How much of your capital is in one trade                       */
/* ------------------------------------------------------------------ */

export function CapitalAtStake({ onGoal }: LabProps) {
  const CAPITAL = 10000;
  const [share, setShare] = useState(100);
  const [fall, setFall] = useState(30);
  const moved = useRef(false);
  const staked = (CAPITAL * share) / 100;
  const loss = (staked * fall) / 100;
  return (
    <div className="lab" data-layout="side" data-flip="true">
      <Deck title="You have ₹10,000">
        <Slider
          label="Placed into this one trade"
          value={share}
          min={10}
          max={100}
          step={10}
          format={(v) => `${v}% · ${inr((CAPITAL * v) / 100)}`}
          tone="gold"
          onChange={(value) => {
            setShare(value);
            moved.current = true;
            onGoal();
          }}
        />
        <Slider label="An unexpected event: price falls" value={fall} min={0} max={60} step={5} format={(v) => `${v}%`} tone="down" onChange={setFall} />
        <p className="deck-note">You cannot choose the fall. You can choose how much is exposed to it.</p>
      </Deck>
      <Stage title="What is left of your capital">
        <div className="split-bar" data-tall="true" role="img" aria-label="Capital kept and capital lost">
          <i data-kind="safe" style={{ "--size": `${100 - share}%` } as CSSProperties} />
          <i data-kind="open" style={{ "--size": `${share - (loss / CAPITAL) * 100}%` } as CSSProperties} />
          <i data-kind="cost" style={{ "--size": `${(loss / CAPITAL) * 100}%` } as CSSProperties} />
        </div>
        <ul className="legend">
          <li data-kind="safe">Not in the trade</li>
          <li data-kind="open">In the trade, still there</li>
          <li data-kind="cost">Lost</li>
        </ul>
        <Read columns={2}>
          <Stat label="Loss" value={-loss} format={signedInr} tone={loss ? "down" : "flat"} />
          <Stat label="Capital remaining" value={CAPITAL - loss} format={inr} size="l" />
        </Read>
        <Says tone="gold">{`The same ${fall}% fall costs ${inr(loss)} here, ${signedPct((-loss / CAPITAL) * 100, 0)} of everything you have. Risk management is choosing that number before the market does.`}</Says>
      </Stage>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — Position size and risk (shared interactive)                    */
/* ------------------------------------------------------------------ */

export const SizeRisk = (props: LabProps) => <SizeCompare {...props} small={10} large={100} start={-10} />;

/* ------------------------------------------------------------------ */
/* 04 — Risk against reward                                            */
/* ------------------------------------------------------------------ */

export function RiskReward({ onGoal }: LabProps) {
  const ENTRY = 100;
  const SHARES = 50;
  const [stop, setStop] = useState(90);
  const [target, setTarget] = useState(110);
  const risk = (ENTRY - stop) * SHARES;
  const reward = (target - ENTRY) * SHARES;
  const ratio = reward / risk;
  const at = (value: number) => `${((value - 70) / 80) * 100}%`;
  const check = (s: number, t: number) => {
    if ((t - ENTRY) / (ENTRY - s) >= 2) onGoal();
  };
  return (
    <div className="lab" data-layout="side">
      <Stage title="Plan the trade before you take it · 50 shares at ₹100" tag={`Risk : Reward = 1 : ${ratio.toFixed(ratio % 1 ? 1 : 0)}`}>
        <div className="rr" style={{ "--stop": at(stop), "--entry": at(ENTRY), "--target": at(target) } as CSSProperties}>
          <i data-zone="risk" />
          <i data-zone="reward" />
          <span data-pin="stop">
            <b>{inr(stop)}</b>Exit if wrong
          </span>
          <span data-pin="entry">
            <b>{inr(ENTRY)}</b>Entry
          </span>
          <span data-pin="target">
            <b>{inr(target)}</b>Exit if right
          </span>
        </div>
        <Read columns={3}>
          <Stat label="Potential loss" value={-risk} format={signedInr} tone="down" />
          <Stat label="Potential profit" value={reward} format={signedInr} tone="up" />
          <Stat label="Risk : Reward" value={`1 : ${ratio.toFixed(ratio % 1 ? 1 : 0)}`} size="l" />
        </Read>
        <Says tone="gold">
          {ratio >= 2
            ? "You could gain at least twice what you are risking. That says nothing about whether the trade will work, only what each outcome would cost or pay."
            : ratio >= 1
              ? "You are risking about as much as you could gain."
              : "You are risking more than you could gain."}
        </Says>
      </Stage>
      <Deck title="Set your exits">
        <Slider
          label="Potential loss: exit at"
          value={stop}
          min={75}
          max={98}
          format={inr}
          tone="down"
          onChange={(value) => {
            setStop(value);
            check(value, target);
          }}
        />
        <Slider
          label="Potential profit: exit at"
          value={target}
          min={102}
          max={145}
          format={inr}
          tone="up"
          onChange={(value) => {
            setTarget(value);
            check(stop, value);
          }}
        />
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 — A stop-loss, in a normal market and a fast one                 */
/* ------------------------------------------------------------------ */

type Fall = { path: number[]; step: number; stop: number; fast: boolean; use: boolean };

function falling(fast: boolean, stop: number) {
  const path = [100];
  for (let i = 1; i < 34; i++) {
    const previous = path[i - 1];
    // A fast market skips straight through the stop level in one move.
    const gap = fast && previous > stop && previous - 1.6 <= stop + 1.5 ? -6.5 : 0;
    path.push(previous - 0.75 + (Math.random() - 0.5) * 1.5 + gap);
  }
  return path;
}

export function StopLoss({ onGoal }: LabProps) {
  const SHARES = 10;
  const [stop, setStop] = useState(90);
  const [use, setUse] = useState<"stop" | "none">("stop");
  const [fast, setFast] = useState<"normal" | "fast">("normal");
  const [fall, setFall] = useState<Fall | null>(null);

  const running = fall !== null && fall.step < fall.path.length - 1;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setFall((now) => (now ? { ...now, step: now.step + 1 } : now)), 100);
    return () => window.clearInterval(timer);
  }, [running]);

  const hit = fall && fall.use ? fall.path.findIndex((price) => price <= fall.stop) : -1;
  const exited = fall !== null && hit !== -1 && fall.step >= hit;
  const seen = fall ? fall.path.slice(0, (exited ? hit : fall.step) + 1) : [100, 100];
  const exitPrice = exited && fall ? Math.round(fall.path[hit] * 10) / 10 : null;
  const now = fall ? fall.path[fall.step] : 100;
  const pnl = ((exitPrice ?? now) - 100) * SHARES;

  return (
    <div className="lab" data-layout="side">
      <Stage title="You bought 10 shares at ₹100. The market turns." tag={exited ? "Stopped out" : running ? "Falling" : fall ? "End of session" : "Ready"}>
        <LineChart
          data={seen.length > 1 ? seen : [100, 100]}
          min={68}
          max={104}
          height={230}
          tone="down"
          label="Falling price with a stop-loss level"
          levels={[{ value: 100, label: "Entry ₹100", tone: "gold" }, ...((fall ? fall.use : use === "stop") ? [{ value: fall?.stop ?? stop, label: `Stop-loss ₹${fall?.stop ?? stop}`, tone: "down" as const }] : [])]}
        />
        <Says tone={fall ? "down" : "flat"}>
          {!fall
            ? "Set a stop-loss, then let the market run."
            : exited && exitPrice !== null
              ? exitPrice < fall.stop - 1
                ? `The price jumped past ₹${fall.stop} in one move. The stop triggered, and the best available exit was ${inr(exitPrice, 1)}. A stop limits a loss; it does not guarantee the price.`
                : `The stop triggered near ₹${fall.stop} and the position was closed. The loss stopped at ${signedInr(pnl)}.`
              : running
                ? "No exit yet. The position is taking the whole fall."
                : `Without a stop, the position rode the fall to ${inr(now, 1)}.`}
        </Says>
      </Stage>
      <Deck title="Your protection">
        <Segmented
          label="Stop-loss"
          value={use}
          onChange={setUse}
          options={[
            { value: "stop", label: "Stop-loss on" },
            { value: "none", label: "No stop" },
          ]}
        />
        {use === "stop" ? <Slider label="Stop-loss level" value={stop} min={82} max={97} format={inr} tone="down" onChange={setStop} /> : null}
        <Segmented
          label="Market speed"
          value={fast}
          onChange={setFast}
          options={[
            { value: "normal", label: "Normal market" },
            { value: "fast", label: "Fast market" },
          ]}
        />
        <Act
          tone="gold"
          disabled={running}
          onClick={() => {
            setFall({ path: falling(fast === "fast", stop), step: 0, stop, fast: fast === "fast", use: use === "stop" });
            if (fast === "fast" && use === "stop") onGoal();
          }}
        >
          {running ? "Market running…" : "Run the market"}
        </Act>
        <Read columns={2}>
          <Stat label={exited ? "Exit price" : "Price"} value={exitPrice ?? now} format={(v) => inr(v, 1)} size="s" />
          <Stat label={exited ? "Realized loss" : "P&L"} value={pnl} format={signedInr} tone={toneOf(pnl)} />
        </Read>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 — Leverage multiplies both directions                            */
/* ------------------------------------------------------------------ */

export function Leverage({ onGoal }: LabProps) {
  const CAPITAL = 10000;
  const [times, setTimes] = useState(1);
  const [move, setMove] = useState(10);
  const position = CAPITAL * times;
  const pnl = (position * move) / 100;
  const onCapital = (pnl / CAPITAL) * 100;
  const wiped = CAPITAL + pnl <= 0;
  const check = (t: number, m: number) => {
    if (t >= 2 && m < 0) onGoal();
  };
  return (
    <div className="lab" data-layout="side" data-flip="true">
      <Deck title="Your own capital: ₹10,000">
        <Slider
          label="Leverage"
          value={times}
          min={1}
          max={5}
          format={(v) => (v === 1 ? "None (1×)" : `${v}×`)}
          tone="gold"
          onChange={(value) => {
            setTimes(value);
            check(value, move);
          }}
        />
        <Slider
          label="The asset's price moves"
          value={move}
          min={-30}
          max={30}
          format={(v) => signedPct(v, 0)}
          tone={toneOf(move)}
          onChange={(value) => {
            setMove(value);
            check(times, value);
          }}
        />
        <p className="deck-note">Leverage is not used in the basic FINTIX trading experience. It is here so you understand it first.</p>
      </Deck>
      <Stage title="Exposure" tag={times === 1 ? "No leverage" : `${times}× leverage`}>
        <div className="lever" style={{ "--times": times } as CSSProperties}>
          <div className="lever-own">
            <span>Your capital</span>
            <b>{inr(CAPITAL)}</b>
          </div>
          <div className="lever-all">
            <span>Position you control</span>
            <b>{inr(position)}</b>
          </div>
        </div>
        <Read columns={3}>
          <Stat label="Price move" value={move} format={(v) => signedPct(v, 0)} size="s" />
          <Stat label="P&L" value={pnl} format={signedInr} tone={toneOf(pnl)} />
          <Stat label="Effect on your capital" value={onCapital} format={(v) => signedPct(v, 0)} tone={toneOf(pnl)} size="l" />
        </Read>
        <Says tone={wiped ? "down" : "gold"}>
          {wiped
            ? "The loss is as large as all of your own capital, or larger. Some leveraged products can lose more than you put in."
            : times === 1
              ? "Without leverage, your capital moves exactly as much as the price does."
              : `A ${signedPct(move, 0)} price move became ${signedPct(onCapital, 0)} on your own money. More leverage means greater exposure, in both directions.`}
        </Says>
      </Stage>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 — Diversification, tested                                        */
/* ------------------------------------------------------------------ */

const HOLDINGS = ["TechCo", "Gold", "Govt bond", "Broad ETF"] as const;
const SHOCKS = [
  { name: "TechCo falls 40%", moves: [-40, 0, 0, -3], note: "One company had a terrible day." },
  { name: "Whole market falls", moves: [-22, -4, -2, -18], note: "A major event. Many assets fall together." },
  { name: "TechCo rises 40%", moves: [40, 0, 0, 3], note: "One company had a great day." },
];

export function Diversify({ onGoal }: LabProps) {
  const TOTAL = 10000;
  const [mix, setMix] = useState<"one" | "spread">("one");
  const [shock, setShock] = useState<number | null>(null);
  const tried = useRef(new Set<string>());
  const weights = mix === "one" ? [100, 0, 0, 0] : [25, 25, 25, 25];
  const moves = shock === null ? [0, 0, 0, 0] : SHOCKS[shock].moves;
  const result = weights.reduce((sum, weight, index) => sum + (TOTAL * weight * moves[index]) / 10000, 0);
  const other = (mix === "one" ? [25, 25, 25, 25] : [100, 0, 0, 0]).reduce((sum, weight, index) => sum + (TOTAL * weight * moves[index]) / 10000, 0);

  const mark = (nextMix: string, nextShock: number | null) => {
    if (nextShock === null) return;
    tried.current.add(nextMix);
    if (tried.current.size === 2) onGoal();
  };

  return (
    <div className="lab" data-layout="side">
      <Stage title="Your ₹10,000" tag={mix === "one" ? "Concentrated" : "Diversified"}>
        <div className="folio">
          {HOLDINGS.map((name, index) => (
            <div key={name} className="folio-slot" data-empty={weights[index] === 0} data-tone={toneOf(weights[index] ? moves[index] : 0)} style={{ "--weight": weights[index] } as CSSProperties}>
              <span>{name}</span>
              <b>{inr((TOTAL * weights[index]) / 100)}</b>
              <em>{weights[index] ? signedPct(moves[index], 0) : "not held"}</em>
            </div>
          ))}
        </div>
        <Read columns={2}>
          <Stat label="Portfolio result" value={result} format={signedInr} tone={toneOf(result)} size="l" />
          <Stat label={mix === "one" ? "If you had spread it" : "If it were all in TechCo"} value={other} format={signedInr} tone={toneOf(other)} />
        </Read>
        <Says tone="gold">
          {shock === null
            ? "Choose how the money is held, then send an event through the market."
            : shock === 1
              ? "Everything fell together. Spreading the money softened the loss, and did not remove it. Diversification spreads risk; it does not eliminate it."
              : mix === "one"
                ? "All of your money is in the one asset that moved, so you took the whole move."
                : "Only a quarter of your money was in the asset that moved, so only a quarter of you felt it. That cuts both ways."}
        </Says>
      </Stage>
      <Deck title="Allocation">
        <Segmented
          label="Allocation"
          value={mix}
          options={[
            { value: "one", label: "All in TechCo" },
            { value: "spread", label: "Spread across 4" },
          ]}
          onChange={(value) => {
            setMix(value);
            mark(value, shock);
          }}
        />
        <h3 className="deck-title">Market event</h3>
        {SHOCKS.map((entry, index) => (
          <Act
            key={entry.name}
            quiet={shock !== index}
            tone={entry.moves[0] < 0 ? "down" : "up"}
            onClick={() => {
              setShock(index);
              mark(mix, index);
            }}
          >
            {entry.name}
          </Act>
        ))}
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 — The way back from a loss                                       */
/* ------------------------------------------------------------------ */

export function Drawdown({ onGoal }: LabProps) {
  const PEAK = 10000;
  const [loss, setLoss] = useState(20);
  const left = PEAK * (1 - loss / 100);
  const needed = (loss / (100 - loss)) * 100;
  const curve = Array.from({ length: 19 }, (_, index) => ((index * 5) / (100 - index * 5)) * 100);
  return (
    <div className="lab" data-layout="side">
      <Stage title="Gain needed to get back to where you started" tag="It is not symmetrical">
        <LineChart data={curve} min={0} max={950} height={220} tone="gold" prefix="" tag={false} label="Gain required to recover from a loss" marks={[{ index: Math.round(loss / 5), label: `${loss}% loss`, tone: "down" }]} />
        <div className="climb" style={{ "--down": `${loss}%`, "--left": `${100 - loss}%` } as CSSProperties}>
          <span data-part="left">{inr(left)} left</span>
          <span data-part="gone">-{inr(PEAK - left)}</span>
        </div>
      </Stage>
      <Deck title="Account peaked at ₹10,000">
        <Slider
          label="Then it falls by"
          value={loss}
          min={5}
          max={90}
          step={5}
          format={(v) => `${v}%`}
          tone="down"
          onChange={(value) => {
            setLoss(value);
            if (value === 50) onGoal();
          }}
        />
        <Read columns={2}>
          <Stat label="Drawdown" value={-(PEAK - left)} format={signedInr} tone="down" />
          <Stat label="Gain needed to recover" value={needed} format={(v) => signedPct(v, 1)} tone="up" size="l" />
        </Read>
        <Says tone="gold">{`After a ${loss}% loss, ${inr(left)} has to grow by ${needed.toFixed(1)}% to become ₹10,000 again. The deeper the fall, the steeper the climb. This is why protecting capital comes first.`}</Says>
      </Deck>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 — Risk belongs to the trade, not just the asset                  */
/* ------------------------------------------------------------------ */

const FACTORS = [
  { key: "size", name: "Position size", low: "Small", high: "Large", weight: 3 },
  { key: "asset", name: "Asset", low: "Government bond", high: "Cryptocurrency", weight: 3 },
  { key: "leverage", name: "Leverage", low: "None", high: "3×", weight: 3 },
  { key: "liquidity", name: "Liquidity", low: "High", high: "Low", weight: 2 },
  { key: "conditions", name: "Market conditions", low: "Calm", high: "Turbulent", weight: 2 },
] as const;

export function RiskFactors({ onGoal }: LabProps) {
  const [high, setHigh] = useState<Record<string, boolean>>({ asset: true });
  const seen = useRef({ low: false, high: false });
  const score = FACTORS.reduce((sum, factor) => sum + (high[factor.key] ? factor.weight : 0), 0);
  const total = FACTORS.reduce((sum, factor) => sum + factor.weight, 0);
  const level = score <= 3 ? "Lower" : score <= 7 ? "Moderate" : score <= 10 ? "High" : "Very high";
  return (
    <div className="lab" data-layout="side" data-flip="true">
      <Deck title="Build a trade">
        {FACTORS.map((factor) => (
          <div className="ticket-line" key={factor.key}>
            <span className="ctl-label">{factor.name}</span>
            <Segmented
              label={factor.name}
              value={high[factor.key] ? "high" : "low"}
              options={[
                { value: "low", label: factor.low },
                { value: "high", label: factor.high },
              ]}
              onChange={(value) => {
                const next = { ...high, [factor.key]: value === "high" };
                setHigh(next);
                const nextScore = FACTORS.reduce((sum, entry) => sum + (next[entry.key] ? entry.weight : 0), 0);
                if (nextScore >= 11) seen.current.high = true;
                if (nextScore <= 3) seen.current.low = true;
                if (seen.current.high && seen.current.low) onGoal();
              }}
            />
          </div>
        ))}
      </Deck>
      <Stage title="Risk of this particular trade" tag={level}>
        <div className="gauge" style={{ "--level": score / total } as CSSProperties} data-level={level} role="img" aria-label={`Risk level: ${level}`}>
          <i />
        </div>
        <Read columns={2}>
          <Stat label="Risk level" value={level} size="l" tone={score > 7 ? "down" : "flat"} />
          <Stat label="Factors raising risk" value={`${FACTORS.filter((factor) => high[factor.key]).length} of ${FACTORS.length}`} />
        </Read>
        <Says tone="gold">
          {high.asset && score <= 3
            ? "A volatile asset, held small, with no leverage, in a calm and liquid market. The asset is the same; the trade is far less risky."
            : !high.asset && score >= 8
              ? "A stable asset, held very large with leverage in a thin market. A “safe” asset does not make a safe trade."
              : "“Is this asset risky?” is not enough. The better question: how much risk am I taking with this particular trade?"}
        </Says>
      </Stage>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10 — Think it through before the trade                              */
/* ------------------------------------------------------------------ */

export function PreTrade({ onGoal }: LabProps) {
  const right = useRef(new Set<number>());
  const solve = (index: number) => {
    right.current.add(index);
    if (right.current.size === 3) onGoal();
  };
  return (
    <div className="lab" data-layout="stack">
      <p className="sheet-story">A friend messages you: “This coin is definitely going up this week. Put your whole ₹10,000 in.” You are interested in the trade. Work through it first.</p>
      <div className="trio">
        <Pick
          prompt="How large is the position?"
          onRight={() => solve(0)}
          options={[
            { label: "All ₹10,000", why: "Then one bad move in one volatile asset reaches all of your capital." },
            { label: "A part you could afford to see fall", right: true, why: "Position size is the first thing you control. A smaller position means a smaller effect from the same move." },
            { label: "₹10,000 with 3× leverage", why: "That triples the exposure. A 34% fall would take everything you have." },
          ]}
        />
        <Pick
          prompt="How much could you lose, and what then?"
          onRight={() => solve(1)}
          options={[
            { label: "It will go up, so nothing", why: "Nobody knows where a market will go. Certainty is the warning sign." },
            { label: "Decide a level to exit, before entering", right: true, why: "Setting your maximum acceptable loss in advance, with a stop-loss, is the plan for being wrong." },
            { label: "Decide once it starts falling", why: "In a fast fall there is little time to think, and decisions made under pressure are rarely good ones." },
          ]}
        />
        <Pick
          prompt="Is the possible gain worth the possible loss?"
          onRight={() => solve(2)}
          options={[
            { label: "Compare potential reward with potential risk", right: true, why: "Risk-to-reward does not predict the result. It tells you what each outcome would cost or pay." },
            { label: "Only the gain matters", why: "A gain that needs a far larger risk to reach it is a poor trade, even if it works once." },
            { label: "It cannot be known, so skip the question", why: "The outcome cannot be known. The amounts at stake can, and those are what you control." },
          ]}
        />
      </div>
    </div>
  );
}
