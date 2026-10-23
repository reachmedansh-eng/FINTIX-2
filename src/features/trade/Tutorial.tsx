"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Loader } from "@/features/shell/Loader";
import { execute, maxQty, orderId, useAccount, value, type Account } from "./account";
import { Anatomy, CandleChart, type Bar } from "./charts";
import { assetByTicker, type Asset } from "./engine";
import { useMarketMinute } from "./clock";
import { AssetView, Holdings, Review, Summary, Ticket, Trades, Watchlist, focusOf, parseQty, type PortfolioFocus, type TicketFocus } from "./parts";
import { simProgress, useSimProgress, type TutorialRun } from "./progress";
import { SimShell } from "./SimShell";
import { Glyph, NeoLine, inr, type Mood } from "./ui";
import { asset as publicFile } from "@/lib/asset";

/* ------------------------------------------------------------------ */
/* Teaching material: fixed, so the numbers Neo quotes are always true  */
/* ------------------------------------------------------------------ */

/** A short example chart: [open, high, low, close]. */
const EXAMPLE: Bar[] = (
  [
    [100, 104, 98, 103],
    [103, 108, 102, 107],
    [107, 109, 101, 102],
    [102, 106, 100, 105],
    [105, 112, 104, 111],
    [111, 113, 106, 108],
    [108, 110, 103, 104],
    [104, 109, 103, 108],
    [108, 116, 107, 115],
    [115, 118, 110, 112],
    [112, 114, 105, 106],
    [106, 111, 105, 110],
    [110, 117, 109, 116],
    [116, 119, 112, 113],
  ] as const
).map(([open, high, low, close]) => ({ open, high, low, close }));

/** The candle the player is asked to read: it opened at 112 and closed at 106, so the price fell. */
const CHECK = 10;
const GREEN: Bar = { open: 100, high: 125, low: 95, close: 120 };
const RED: Bar = { open: 200, high: 210, low: 175, close: 180 };

/* ------------------------------------------------------------------ */
/* The steps                                                            */
/* ------------------------------------------------------------------ */

type Stage =
  | { kind: "intro" }
  | { kind: "chart" }
  | { kind: "anatomy"; focus: "all" | "body" | "upper" | "lower"; show: ("open" | "close" | "high" | "low")[] }
  | { kind: "pair" }
  | { kind: "check" }
  | { kind: "market" }
  | { kind: "ticket"; reveal: number; focus: TicketFocus }
  | { kind: "review" }
  | { kind: "result" }
  | { kind: "portfolio"; focus: PortfolioFocus }
  | { kind: "done" };

/** What must happen before the player can move on. */
type Need = "answer" | "asset" | "qty" | "review" | "trade";

type Step = { moment: number; title: string; mood: Mood; stage: Stage; need?: Need; say: (context: Context) => ReactNode };

type Context = { asset: Asset | null; run: TutorialRun; account: Account; minute: number };

const STEPS: Step[] = [
  { moment: 1, title: "Meet Neo", mood: "wave", stage: { kind: "intro" }, say: () => null },
  {
    moment: 2,
    title: "What is a price chart?",
    mood: "explain",
    stage: { kind: "chart" },
    say: () => "This is a price chart. It shows how an asset's price changes over time. Each candle covers one period, such as five minutes or one day.",
  },
  {
    moment: 3,
    title: "What is a candlestick?",
    mood: "explain",
    stage: { kind: "anatomy", focus: "all", show: ["open", "close", "high", "low"] },
    say: () => "One candle sums up four prices for its period: where it opened, where it closed, and the highest and lowest prices in between.",
  },
  {
    moment: 4,
    title: "The body",
    mood: "explain",
    stage: { kind: "anatomy", focus: "body", show: ["open", "close"] },
    say: () => "The thick part is the body. It runs between the opening and closing prices. On this green candle the open is the bottom edge, ₹100, and the close is the top edge, ₹120.",
  },
  {
    moment: 5,
    title: "The wicks",
    mood: "explain",
    stage: { kind: "anatomy", focus: "upper", show: ["high"] },
    say: () => "The thin line above the body is the upper wick. Its tip marks the highest price reached during the period: ₹125.",
  },
  {
    moment: 5,
    title: "The wicks",
    mood: "explain",
    stage: { kind: "anatomy", focus: "lower", show: ["low"] },
    say: () => "The line below the body is the lower wick. Its tip marks the lowest price reached: ₹95.",
  },
  {
    moment: 5,
    title: "The whole candle",
    mood: "neutral",
    stage: { kind: "anatomy", focus: "all", show: ["open", "close", "high", "low"] },
    say: () => "Put together: the body shows the open and close, and the wicks reach the high and the low.",
  },
  {
    moment: 6,
    title: "Green and red candles",
    mood: "explain",
    stage: { kind: "pair" },
    say: () => "A green candle closed higher than it opened, so its open is at the bottom of the body. A red candle closed lower, so its open is at the top. The colour shows what happened in that period, not what happens next.",
  },
  { moment: 7, title: "Read a candle yourself", mood: "think", stage: { kind: "check" }, need: "answer", say: () => "Your turn. Look at the highlighted candle. Did the price rise or fall during that period?" },
  {
    moment: 8,
    title: "Choose an asset",
    mood: "explain",
    stage: { kind: "market" },
    need: "asset",
    say: ({ asset }) =>
      asset
        ? `That's ${asset.name}'s chart. The price at the top is what one share costs now, and the change shows how far it has moved today. These prices are simulated and move every few seconds.`
        : "These are the assets in this market: shares in eight made-up companies. Each shows its current price and how much it has moved today. Pick one to see its chart.",
  },
  {
    moment: 9,
    title: "Prepare your first trade",
    mood: "explain",
    stage: { kind: "ticket", reveal: 1, focus: "asset" },
    say: ({ asset }) => `Let's buy some ${asset?.name ?? "shares"}. This is your order. At the top is the asset and its current price for one share.`,
  },
  {
    moment: 9,
    title: "Prepare your first trade",
    mood: "explain",
    stage: { kind: "ticket", reveal: 2, focus: "qty" },
    need: "qty",
    say: ({ asset, account, minute }) =>
      asset && maxQty(account, "buy", asset.ticker, minute) < 1
        ? `Your cash doesn't cover one share of ${asset.name} right now. Go back and pick a cheaper asset.`
        : "Now choose how many shares to buy. Type a number, or use the + and − buttons.",
  },
  { moment: 9, title: "Prepare your first trade", mood: "explain", stage: { kind: "ticket", reveal: 3, focus: "value" }, say: () => "The estimated cost is the price of one share multiplied by the number of shares." },
  { moment: 9, title: "Prepare your first trade", mood: "explain", stage: { kind: "ticket", reveal: 4, focus: "cash" }, say: () => "This is your available cash: virtual money for practising. An order can't cost more than you have." },
  { moment: 9, title: "Prepare your first trade", mood: "neutral", stage: { kind: "ticket", reveal: 5, focus: "review" }, need: "review", say: () => "When you're happy with the order, press Review buy order." },
  { moment: 10, title: "Review and confirm", mood: "explain", stage: { kind: "review" }, need: "trade", say: () => "Check the details. Press Edit to change anything, or Confirm buy to place the order. Nothing is bought until you confirm." },
  {
    moment: 11,
    title: "Trade complete",
    mood: "celebrate",
    stage: { kind: "result" },
    say: ({ asset, account, run }) => {
      const trade = account.trades.find((entry) => entry.id === run.tradeId);
      return trade
        ? `Nice work! You bought ${trade.qty} ${asset?.name ?? ""} share${trade.qty === 1 ? "" : "s"} for ${inr(trade.total)}. Your cash went down by exactly that, and the shares are now yours. Their value counts towards your portfolio at the current price.`
        : "Your trade is complete.";
    },
  },
  { moment: 12, title: "Your portfolio", mood: "explain", stage: { kind: "portfolio", focus: "cash" }, say: () => "This is your portfolio. Available cash is the money you have left to spend." },
  {
    moment: 12,
    title: "Your portfolio",
    mood: "explain",
    stage: { kind: "portfolio", focus: "holdings" },
    say: () => "Holdings lists what you own: how many shares, the average price you paid, today's price, and what they're worth now.",
  },
  { moment: 12, title: "Your portfolio", mood: "explain", stage: { kind: "portfolio", focus: "total" }, say: () => "Total portfolio value is your cash plus the current value of your holdings." },
  {
    moment: 12,
    title: "Your portfolio",
    mood: "think",
    stage: { kind: "portfolio", focus: "unrealised" },
    say: () => "Unrealised P/L is how much your holdings have gained or lost since you bought them. It's close to zero now, because you've only just bought at today's price. It moves as the price moves.",
  },
  {
    moment: 12,
    title: "Your portfolio",
    mood: "explain",
    stage: { kind: "portfolio", focus: "realised" },
    say: () => "When you sell shares, the gain or loss on them becomes realised: it's locked in, and the money returns to your cash.",
  },
  { moment: 12, title: "Your portfolio", mood: "explain", stage: { kind: "portfolio", focus: "trades" }, say: () => "Every buy and sell is recorded in your transactions, with its price and time." },
  {
    moment: 13,
    title: "All done",
    mood: "celebrate",
    stage: { kind: "done" },
    say: () => "That's the walkthrough! Explore on your own now: check other assets, buy more, or try selling. If you need me, press Ask Neo.",
  },
];

const MOMENTS = 13;
const QTY_STEP = STEPS.findIndex((step) => step.need === "qty");
const RESULT_STEP = STEPS.findIndex((step) => step.stage.kind === "result");

/* ------------------------------------------------------------------ */
/* The controller                                                       */
/* ------------------------------------------------------------------ */

export function Tutorial() {
  const progress = useSimProgress();
  const account = useAccount();
  const minute = useMarketMinute();

  if (!progress || !account || minute === null) {
    return (
      <SimShell>
        <div className="sim-wait">
          <Loader />
        </div>
      </SimShell>
    );
  }
  return <Walkthrough run={progress.run} account={account} minute={minute} />;
}

function Walkthrough({ run, account, minute }: { run: TutorialRun; account: Account; minute: number }) {
  const router = useRouter();
  const [wrong, setWrong] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const index = Math.min(Math.max(0, run.step), STEPS.length - 1);
  const step = STEPS[index];
  const asset = run.ticker ? (assetByTicker(run.ticker) ?? null) : null;
  const context: Context = { asset, run, account, minute };
  const qty = run.qty === null ? "" : String(run.qty);
  const count = parseQty(qty);
  const affordable = asset ? maxQty(account, "buy", asset.ticker, minute) : 0;

  const met = (need?: Need) => {
    if (need === "answer") return run.checked;
    if (need === "asset") return !!asset;
    if (need === "qty") return count !== null && count >= 1 && count <= affordable;
    if (need === "review") return false;
    if (need === "trade") return false;
    return true;
  };

  const go = (to: number) => {
    setWrong(null);
    setError(null);
    simProgress.updateRun({ step: Math.min(Math.max(0, to), STEPS.length - 1) });
    if (to === STEPS.length - 1) simProgress.finish();
  };

  const skip = () => {
    simProgress.skip();
    router.push("/trade/beginner");
  };

  const answer = (choice: "rose" | "fell" | "same") => {
    if (choice === "fell") {
      setWrong(null);
      simProgress.updateRun({ checked: true });
      return;
    }
    setWrong(
      choice === "rose"
        ? "Not quite. This candle is red: it opened at the top of the body, ₹112, and closed lower, at the bottom, ₹106. Have another look and try again."
        : "Not quite. The open and close aren't the same here: the body runs from ₹112 down to ₹106. Which way did the price go?",
    );
  };

  const review = () => {
    simProgress.updateRun({ orderId: orderId(), step: index + 1 });
  };

  const confirm = () => {
    if (!asset || count === null || !run.orderId) return;
    const fill = execute({ id: run.orderId, side: "buy", ticker: asset.ticker, qty: count });
    if (!fill.ok) {
      setError(fill.reason);
      return;
    }
    setError(null);
    simProgress.updateRun({ tradeId: fill.trade.id, step: RESULT_STEP });
  };

  /* ---- Opening scene: the supplied room, with Neo already at his desk ---- */
  if (step.stage.kind === "intro") {
    return (
      <SimShell bleed>
        <section className="tut-intro" aria-labelledby="tut-intro-title">
          <div className="tut-intro-art">
            {/* eslint-disable-next-line @next/next/no-img-element -- the supplied opening scene, shown as drawn */}
            <img src={publicFile("/trade/neo-room.png")} width={1672} height={941} alt="Neo, the FINTIX assistant robot, sitting at his desk in front of a night-time city view" />
            <div className="tut-intro-card">
              <p className="tut-kicker">Beginner simulator</p>
              <h1 id="tut-intro-title" className="px">
                Hey there! I&apos;m Neo.
              </h1>
              <p>I&apos;ll guide you through your first trades. You&apos;ll practise with virtual money in a simulated market, so you can learn by doing without risking real money.</p>
              <div className="tut-intro-actions">
                <button type="button" className="sim-button" data-tone="buy" onClick={() => go(1)}>
                  Let&apos;s begin <Glyph name="arrow" />
                </button>
                <button type="button" className="tut-skip" onClick={skip}>
                  Skip tutorial
                </button>
              </div>
            </div>
          </div>
        </section>
      </SimShell>
    );
  }

  const canNext = met(step.need);
  const lastStep = index === STEPS.length - 1;
  const mood: Mood = step.stage.kind === "check" ? (run.checked ? "celebrate" : wrong ? "think" : step.mood) : step.mood;
  const text =
    step.stage.kind === "check"
      ? run.checked
        ? "Yes! It's red: it opened at ₹112 and closed lower, at ₹106, so the price fell during that period."
        : (wrong ?? step.say(context))
      : step.say(context);

  return (
    <SimShell>
      <div className="tut">
        <header className="tut-head">
          <div>
            <p className="tut-kicker">
              Step {step.moment} of {MOMENTS}
            </p>
            <h1 className="px">{step.title}</h1>
          </div>
          <ol className="tut-dots" aria-label={`Step ${step.moment} of ${MOMENTS}`}>
            {Array.from({ length: MOMENTS }, (_, moment) => (
              <li key={moment} data-state={moment + 1 < step.moment ? "done" : moment + 1 === step.moment ? "now" : "todo"} />
            ))}
          </ol>
          {lastStep ? null : (
            <button type="button" className="tut-skip" onClick={skip}>
              Skip tutorial
            </button>
          )}
        </header>

        <div className="tut-stage" data-kind={step.stage.kind}>
          <StageView step={step} index={index} context={context} qty={qty} wrong={!!wrong} error={error} onAnswer={answer} onReview={review} onConfirm={confirm} onEdit={() => go(QTY_STEP)} />
        </div>

        <NeoLine
          mood={mood}
          actions={
            <>
              {index >= 1 && index !== RESULT_STEP && !lastStep ? (
                <button type="button" className="sim-button" data-tone="quiet" onClick={() => go(index - 1)}>
                  <Glyph name="back" /> Back
                </button>
              ) : null}
              {lastStep ? (
                <>
                  <button
                    type="button"
                    className="sim-button"
                    data-tone="quiet"
                    onClick={() => {
                      simProgress.replay();
                    }}
                  >
                    Replay tutorial
                  </button>
                  <Link className="sim-button" data-tone="buy" href="/trade/beginner">
                    Explore simulator <Glyph name="arrow" />
                  </Link>
                </>
              ) : step.need === "review" || step.need === "trade" ? null : (
                <button type="button" className="sim-button" data-tone="buy" onClick={() => go(index + 1)} disabled={!canNext}>
                  Next <Glyph name="arrow" />
                </button>
              )}
            </>
          }
        >
          <p>{text}</p>
        </NeoLine>
      </div>
    </SimShell>
  );
}

/* ------------------------------------------------------------------ */
/* What each step shows                                                 */
/* ------------------------------------------------------------------ */

function StageView({
  step,
  context,
  qty,
  wrong,
  error,
  onAnswer,
  onReview,
  onConfirm,
  onEdit,
}: {
  step: Step;
  index: number;
  context: Context;
  qty: string;
  wrong: boolean;
  error: string | null;
  onAnswer: (choice: "rose" | "fell" | "same") => void;
  onReview: () => void;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const { asset, run, account, minute } = context;
  const stage = step.stage;

  switch (stage.kind) {
    case "chart":
      return (
        <div className="tut-panel tut-wide">
          <CandleChart candles={EXAMPLE} height={340} label="Example price chart with 14 candles" stampFor={(index) => `Period ${index + 1}`} axis={["Earlier", "", "Later"]} />
          <p className="sim-note">An example chart. Point at any candle to see its four prices.</p>
        </div>
      );
    case "anatomy":
      return (
        <div className="tut-panel tut-candle">
          <Anatomy bar={GREEN} focus={stage.focus} show={stage.show} />
        </div>
      );
    case "pair":
      return (
        <div className="tut-pair">
          <div className="tut-panel">
            <Anatomy bar={GREEN} show={["open", "close", "high", "low"]} />
            <p className="tut-pair-title" data-tone="up">
              Green candle
            </p>
            <p className="sim-note">Closed higher than it opened: the price rose during this period.</p>
          </div>
          <div className="tut-panel">
            <Anatomy bar={RED} show={["open", "close", "high", "low"]} />
            <p className="tut-pair-title" data-tone="down">
              Red candle
            </p>
            <p className="sim-note">Closed lower than it opened: the price fell during this period.</p>
          </div>
        </div>
      );
    case "check":
      return (
        <div className="tut-check">
          <div className="tut-panel tut-wide">
            <CandleChart candles={EXAMPLE} height={320} highlight={CHECK} readout={run.checked} label="Example chart with one candle highlighted" stampFor={(index) => `Period ${index + 1}`} />
          </div>
          <div className="tut-panel tut-quiz">
            <p className="tut-quiz-q">What happened during the highlighted period?</p>
            <div className="tut-quiz-options" role="group" aria-label="Your answer">
              {(
                [
                  ["rose", "The price rose"],
                  ["fell", "The price fell"],
                  ["same", "It stayed the same"],
                ] as const
              ).map(([choice, label]) => (
                <button key={choice} type="button" onClick={() => onAnswer(choice)} disabled={run.checked} data-correct={run.checked && choice === "fell"}>
                  {label}
                </button>
              ))}
            </div>
            {wrong ? (
              <div className="tut-quiz-hint">
                <Anatomy bar={EXAMPLE[CHECK]} focus="body" show={["open", "close"]} />
              </div>
            ) : null}
          </div>
        </div>
      );
    case "market":
      return (
        <div className="tut-market">
          <Watchlist minute={minute} selected={run.ticker} onSelect={(ticker) => simProgress.updateRun({ ticker, qty: null, orderId: null })} focus={asset ? undefined : "on"} />
          {asset ? (
            <AssetView asset={asset} minute={minute} height={300} />
          ) : (
            <div className="sim-block tut-placeholder">
              <p>Pick an asset from the list to see its chart here.</p>
            </div>
          )}
        </div>
      );
    case "ticket":
      return asset ? (
        <div className="tut-narrow">
          <Ticket asset={asset} minute={minute} account={account} side="buy" qty={qty} onQty={(text) => simProgress.updateRun({ qty: text === "" ? null : Number(text) })} onReview={onReview} reveal={stage.reveal} focus={stage.focus} />
        </div>
      ) : (
        <MissingAsset />
      );
    case "review": {
      const count = parseQty(qty);
      return asset && count ? (
        <div className="tut-narrow">
          <Review asset={asset} minute={minute} account={account} side="buy" qty={count} onEdit={onEdit} onConfirm={onConfirm} error={error} />
        </div>
      ) : (
        <MissingAsset />
      );
    }
    case "result": {
      const trade = account.trades.find((entry) => entry.id === run.tradeId);
      if (!trade || !asset) return <MissingAsset />;
      return (
        <div className="tut-narrow">
          <section className="sim-block tut-result">
            <p className="tut-result-mark" aria-hidden="true">
              <Glyph name="check" size={22} />
            </p>
            <h2 className="px">Trade successful</h2>
            <p>
              You bought {trade.qty} share{trade.qty === 1 ? "" : "s"} of {asset.name} at {inr(trade.price)} each.
            </p>
            <dl className="sim-review-lines">
              <div>
                <dt>Total cost</dt>
                <dd>{inr(trade.total)}</dd>
              </div>
              <div>
                <dt>Cash before</dt>
                <dd>{inr(account.cash + trade.total)}</dd>
              </div>
              <div>
                <dt>Cash now</dt>
                <dd>{inr(account.cash)}</dd>
              </div>
              <div>
                <dt>{asset.name} shares you own</dt>
                <dd>{account.holdings[asset.ticker]?.qty ?? trade.qty}</dd>
              </div>
            </dl>
          </section>
        </div>
      );
    }
    case "portfolio": {
      const valuation = value(account, minute);
      return (
        <div className="tut-portfolio">
          <Summary valuation={valuation} focus={stage.focus} />
          <Holdings valuation={valuation} focus={focusOf(stage.focus, "holdings")} />
          <Trades trades={account.trades} limit={4} focus={focusOf(stage.focus, "trades")} />
        </div>
      );
    }
    case "done": {
      const valuation = value(account, minute);
      return (
        <div className="tut-portfolio">
          <Summary valuation={valuation} />
        </div>
      );
    }
    default:
      return null;
  }
}

function MissingAsset() {
  return (
    <div className="sim-block tut-placeholder">
      <p>Go back a step and pick an asset first.</p>
    </div>
  );
}
