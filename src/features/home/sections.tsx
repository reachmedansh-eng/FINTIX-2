"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { MODULES, lessonsDone, moduleBySlug, isUnlocked } from "@/features/learn/curriculum";
import { useProgress } from "@/features/learn/progress";
import { STARTING_CASH, type Account, type Trade } from "@/features/trade/account";
import { CandleChart } from "@/features/trade/charts";
import { OrderFlow } from "@/features/trade/order";
import { AssetHeading, PositionFacts, Segments } from "@/features/trade/parts";
import { FRAMES, assetByTicker, candlesFor, clockLabel, priceAt, recentEvents, stamp, type Asset, type FrameId } from "@/features/trade/engine";
import { Glyph, Mark, count, inr, rupees, signedInr, signedPercent, tone } from "@/features/trade/ui";
import { Glitch, useReveal, type BootMode } from "./boot";
import { ago, lessonsFor, nextMilestone, pulse, type Holding } from "./portfolio";

/** Links into the simulator, opening a given asset or tab. */
export const tradeLink = (ticker?: string, tab?: "trades") => `/trade/beginner${ticker ? `?asset=${ticker}` : tab ? `?tab=${tab}` : ""}`;

/* ------------------------------------------------------------------ */
/* The chosen asset: the one panel on Home                              */
/* ------------------------------------------------------------------ */

/**
 * The chosen asset, and the place to act on it: identity and price, a
 * compact chart, the player's position if they hold one, and Buy or Sell,
 * which turn the panel into the desk's own order ticket on the same account
 * rules, so a decision is made beside the city that shows its result.
 */
export function AssetPanel({
  asset,
  minute,
  reason,
  onClose,
  owned: ownedFlag,
  account,
  onFilled,
}: {
  asset: Asset;
  minute: number;
  reason: string;
  onClose: () => void;
  /** It shows one of the player's own buildings, so it carries the gold edge of ownership. */
  owned?: boolean;
  account: Account;
  /** Called with the filled trade, so the page can follow it (the city marks the building that changed). */
  onFilled?: (trade: Trade) => void;
}) {
  const [frame, setFrame] = useState<FrameId>("5m");
  const [trading, setTrading] = useState<"buy" | "sell" | null>(null);
  const candles = useMemo(() => candlesFor(asset, frame, minute, 36), [asset, frame, minute]);
  const label = FRAMES.find((entry) => entry.id === frame)?.label ?? "";
  const owned = account.holdings[asset.ticker]?.qty ?? 0;

  return (
    <aside className="hm-panel" aria-labelledby="hm-panel-title" data-mode={trading ? "order" : "inspect"} data-owned={ownedFlag || undefined}>
      <div className="hm-panel-top">
        <p className="hm-panel-why">{trading ? `${trading === "buy" ? "Buy" : "Sell"} order` : reason}</p>
        <button type="button" className="sim-link" data-go="back" onClick={trading ? () => setTrading(null) : onClose}>
          <Glyph name={trading ? "back" : "close"} size={12} /> {trading ? "Back to details" : "Close"}
        </button>
      </div>
      {trading ? (
        <>
          <h2 id="hm-panel-title" className="sr-only">
            Trade {asset.name}
          </h2>
          <OrderFlow
            asset={asset}
            account={account}
            minute={minute}
            side={trading}
            onFilled={onFilled}
            onDone={() => setTrading(null)}
            doneLabel="Done"
            consequence={(trade, before) => {
              const after = account.holdings[asset.ticker]?.qty ?? 0;
              if (trade.side === "buy") return before ? `${asset.name}’s building has grown with its larger share.` : `${asset.name} is now a building in your city.`;
              return after ? `${asset.name}’s building has shrunk with its smaller share.` : `You no longer own ${asset.name}, so its building has come down.`;
            }}
            more={
              <Link className="sim-button" data-tone="quiet" href={tradeLink(asset.ticker)}>
                Open on the desk
              </Link>
            }
          />
        </>
      ) : (
        <>
          <AssetHeading asset={asset} minute={minute} owned={owned} id="hm-panel-title" />
          <div className="hm-panel-chart">
            <CandleChart
              candles={candles}
              height={168}
              label={`${asset.name}, ${label} candles, simulated prices`}
              stampFor={(index) => stamp(candles[index].start, frame)}
              tickFor={(index) => clockLabel(candles[index].start, frame)}
            />
            <Segments label="Candle size" options={FRAMES} value={frame} onChange={setFrame} />
          </div>
          {owned ? (
            <div className="hm-panel-position">
              <h3 className="hm-label">Your position</h3>
              <PositionFacts account={account} minute={minute} ticker={asset.ticker} />
            </div>
          ) : (
            <p className="hm-panel-none">You don&apos;t own {asset.name} yet. You have {inr(account.cash)} of virtual cash to spend.</p>
          )}
          <div className="hm-panel-actions">
            <button type="button" className="sim-button" data-tone="buy" onClick={() => setTrading("buy")}>
              Buy {asset.name}
            </button>
            <button type="button" className="sim-button" data-tone="sell-line" onClick={() => setTrading("sell")} disabled={!owned} aria-describedby={owned ? undefined : "hm-sell-why"}>
              Sell
            </button>
          </div>
          {owned ? null : (
            <p id="hm-sell-why" className="hm-why">
              Selling opens once you own some {asset.name}.
            </p>
          )}
          <Link className="sim-link hm-panel-desk" data-go href={tradeLink(asset.ticker)}>
            Full chart on the trading floor <Glyph name="arrow" size={12} />
          </Link>
        </>
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* A band below the city                                                */
/* ------------------------------------------------------------------ */

/**
 * A section of the page below the city: its title in Retropix on a rule. The
 * first time it is reached on a first visit, the rule draws across, the title
 * glitches into place and the content settles; never again after that.
 */
function Band({ id, title, note, mode, className, children, action }: { id: string; title: string; note?: string; mode: BootMode; className: string; children: ReactNode; action?: ReactNode }) {
  const { ref, reveal, shownAt } = useReveal(mode);
  return (
    <section ref={ref} id={id} className={`hm-band ${className}`} data-reveal={reveal} aria-labelledby={`${id}-title`}>
      <header className="hm-band-head">
        <h2 id={`${id}-title`} className="px">
          <Glitch text={title} play={mode === "full" && shownAt !== null} start={shownAt} duration={460} variant="title" />
        </h2>
        {note ? <p>{note}</p> : null}
        {action}
      </header>
      <div className="hm-band-body">{children}</div>
    </section>
  );
}

/** The asset one place points at, so the other can answer: a market column lights its news, a story lights its column. */
export type Focus = { ticker: string | null; onFocus: (ticker: string | null) => void };

/* ------------------------------------------------------------------ */
/* Market pulse: the market's horizon                                   */
/* ------------------------------------------------------------------ */

/** Round scale tops for the horizon, in percent: the first one at or above the day's largest move. */
const SCALE = [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];

/**
 * Today's market as a horizon: all eight assets from the day's biggest gain
 * to its biggest fall, each a column of pixel blocks rising above the 0% line
 * (up, green) or hanging below it (down, red), on one round scale named at the
 * left. Each bar carries its own signed change at its end; under it, the
 * asset's icon, ticker and price, with a gold line under the ones the player
 * owns. Choosing a column opens that asset beside the city; pointing at one
 * lights its stories in the news.
 */
export function MarketPulse({ minute, owned, onPick, mode, focus }: { minute: number; owned: Set<string>; onPick: (ticker: string) => void; mode: BootMode; focus: Focus }) {
  const list = [...pulse(minute)].sort((first, second) => second.percent - first.percent);
  const widest = Math.max(...list.map((entry) => Math.abs(entry.percent)), 0.01);
  const top = SCALE.find((step) => step >= widest) ?? Math.ceil(widest / 10) * 10;
  const rising = list.filter((entry) => tone(entry.percent) === "up").length;
  const falling = list.filter((entry) => tone(entry.percent) === "down").length;
  const flat = list.length - rising - falling;
  return (
    <Band
      id="hm-market"
      className="hm-market"
      title="Market pulse"
      mode={mode}
      note="Change over the last simulated day"
      action={
        owned.size ? (
          <p className="hm-own-legend">
            <i aria-hidden="true" /> You own it
          </p>
        ) : null
      }
    >
      <p className="hm-breadth">
        <b data-tone="up">{rising} rising</b>
        <b data-tone="down">{falling} falling</b>
        {flat ? <b data-tone="flat">{flat} flat</b> : null}
      </p>
      <div className="hm-chart" data-focus={focus.ticker ?? undefined}>
        <p className="hm-axis" aria-hidden="true">
          <span data-at="top">+{top}%</span>
          <span data-at="zero">0%</span>
          <span data-at="bottom">−{top}%</span>
        </p>
        <ol className="hm-horizon" aria-label="Every asset, from today's biggest gain to its biggest fall" onPointerLeave={() => focus.onFocus(null)}>
          {list.map((entry, index) => {
            const share = tone(entry.percent) === "flat" ? 0 : Math.max(0.03, Math.abs(entry.percent) / top);
            const mine = owned.has(entry.asset.ticker);
            return (
              <li key={entry.asset.ticker} style={{ "--i": index } as CSSProperties}>
                <button
                  type="button"
                  data-tone={tone(entry.percent)}
                  data-own={mine || undefined}
                  data-match={focus.ticker === entry.asset.ticker || undefined}
                  onClick={() => onPick(entry.asset.ticker)}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") focus.onFocus(entry.asset.ticker);
                  }}
                  onFocus={() => focus.onFocus(entry.asset.ticker)}
                  onBlur={() => focus.onFocus(null)}
                  aria-label={`${entry.asset.name}, ${entry.asset.sector}, ${rupees(entry.price)}, ${signedPercent(entry.percent)} today${mine ? ", you own this" : ""}`}
                >
                  <span className="hm-col" style={{ "--h": share.toFixed(3) } as CSSProperties} aria-hidden="true">
                    <i />
                    <b className="hm-col-value">{signedPercent(entry.percent)}</b>
                  </span>
                  <span className="hm-col-id">
                    <Mark asset={entry.asset} size={16} />
                    <b className="sim-hud">{entry.asset.ticker}</b>
                  </span>
                  <span className="hm-col-price">{rupees(entry.price)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* Market news                                                          */
/* ------------------------------------------------------------------ */

/** "Day 5,871, 07:06" as its day and its time, for a time column. */
const splitStamp = (minute: number) => {
  const [day, time] = stamp(minute).split(", ");
  return { day, time };
};

/**
 * The price of an asset from a story's minute to now, sampled evenly: the
 * evidence beside the story. A line from the story's price (the dashed level)
 * to now, in the colour of the move since; dots at both ends.
 */
function ImpactTrace({ asset, from, to }: { asset: Asset; from: number; to: number }) {
  const points = 48;
  const prices = Array.from({ length: points }, (_, index) => priceAt(asset, Math.round(from + ((to - from) * index) / (points - 1))));
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const span = high - low || 1;
  const width = 320;
  const height = 72;
  const x = (index: number) => (index / (points - 1)) * width;
  const y = (price: number) => 6 + (1 - (price - low) / span) * (height - 12);
  const since = tone(prices[points - 1] - prices[0]);
  return (
    <svg className="hm-trace" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" data-tone={since} aria-hidden="true">
      <line x1={0} x2={width} y1={y(prices[0])} y2={y(prices[0])} className="hm-trace-level" />
      <polyline points={prices.map((price, index) => `${x(index).toFixed(1)},${y(price).toFixed(1)}`).join(" ")} />
    </svg>
  );
}

/**
 * The simulated news as a feed: the latest story as the lead (its asset, when
 * it broke, the headline at reading size, which way it pushed the price, and
 * the price's path since, drawn from the market), then the earlier stories
 * down a timeline, each with its time, asset, headline, push and move since.
 * Choosing a story opens its asset beside the city; pointing at one lights
 * its column in the market pulse.
 */
export function MarketNews({ minute, owned, onPick, mode, focus }: { minute: number; owned: Set<string>; onPick: (ticker: string) => void; mode: BootMode; focus: Focus }) {
  const stories = recentEvents(minute, 5).flatMap((story) => {
    const asset = assetByTicker(story.ticker);
    return asset ? [{ story, asset }] : [];
  });
  const since = (asset: Asset, at: number) => (priceAt(asset, minute) / priceAt(asset, at) - 1) * 100;
  const hover = (ticker: string) => ({
    onPointerEnter: (event: { pointerType: string }) => {
      if (event.pointerType === "mouse") focus.onFocus(ticker);
    },
    onFocus: () => focus.onFocus(ticker),
    onBlur: () => focus.onFocus(null),
  });
  const [lead, ...rest] = stories;
  return (
    <Band id="hm-news" className="hm-news" title="Market news" mode={mode} note="Simulated stories, newest first, and how each price has moved since">
      {lead ? (
        <div className="hm-feed" data-focus={focus.ticker ?? undefined} onPointerLeave={() => focus.onFocus(null)}>
          <button type="button" className="hm-lead" data-match={focus.ticker === lead.asset.ticker || undefined} onClick={() => onPick(lead.asset.ticker)} {...hover(lead.asset.ticker)}>
            <span className="hm-lead-meta">
              <span className="hm-lead-asset">
                <Mark asset={lead.asset} size={32} />
                <span>
                  <b className="sim-hud">{lead.asset.ticker}</b>
                  <small>
                    {lead.asset.name}, {lead.asset.sector}
                    {owned.has(lead.asset.ticker) ? <em>You own it</em> : null}
                  </small>
                </span>
              </span>
              <span className="hm-lead-time">
                <b>{splitStamp(lead.story.minute).time}</b>
                <small>{splitStamp(lead.story.minute).day}</small>
              </span>
            </span>
            <b className="hm-lead-headline">{lead.story.headline}</b>
            <span className="hm-lead-impact">
              <span className="hm-push" data-tone={lead.story.effect > 0 ? "up" : "down"}>
                <Glyph name={lead.story.effect > 0 ? "up" : "down"} size={12} /> The story pushed the price {lead.story.effect > 0 ? "up" : "down"}
              </span>
              <ImpactTrace asset={lead.asset} from={lead.story.minute} to={minute} />
              <span className="hm-moved">
                <b data-tone={tone(since(lead.asset, lead.story.minute))}>{signedPercent(since(lead.asset, lead.story.minute))}</b>
                <small>since the story, now {rupees(priceAt(lead.asset, minute))}</small>
              </span>
            </span>
          </button>

          <ol className="hm-wire">
            {rest.map(({ story, asset }) => {
              const moved = since(asset, story.minute);
              const when = splitStamp(story.minute);
              return (
                <li key={story.id}>
                  <button type="button" data-match={focus.ticker === asset.ticker || undefined} onClick={() => onPick(asset.ticker)} {...hover(asset.ticker)}>
                    <span className="hm-wire-time">
                      <b>{when.time}</b>
                      <small>{when.day}</small>
                    </span>
                    <span className="hm-wire-dot" data-tone={story.effect > 0 ? "up" : "down"} aria-hidden="true" />
                    <span className="hm-wire-body">
                      <span className="hm-wire-asset">
                        <Mark asset={asset} size={16} />
                        <b className="sim-hud">{asset.ticker}</b>
                        {owned.has(asset.ticker) ? <i className="hm-own-dot" aria-label="You own this" /> : null}
                      </span>
                      <b className="hm-wire-headline">{story.headline}</b>
                    </span>
                    <span className="hm-wire-impact">
                      <small data-tone={story.effect > 0 ? "up" : "down"}>
                        <Glyph name={story.effect > 0 ? "up" : "down"} size={12} /> Pushed {story.effect > 0 ? "up" : "down"}
                      </small>
                      <b data-tone={tone(moved)}>{signedPercent(moved)}</b>
                      <small>since the story</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <p className="hm-empty">No stories yet today.</p>
      )}
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* The ledger: every virtual trade                                      */
/* ------------------------------------------------------------------ */

/**
 * The transaction ledger, newest first: when, what (bought or sold, how many
 * of which asset), at what price, what it did to cash, any profit or loss it
 * locked in, and the cash left after it, replayed from the ₹1,00,000 start so
 * the column ends on the account's cash. The latest trade is marked; a trade
 * made on this visit arrives once.
 */
export function Ledger({ trades, fresh, mode }: { trades: Trade[]; fresh?: string; mode: BootMode }) {
  const after = useMemo(() => {
    const balance = new Map<string, number>();
    let cash = STARTING_CASH;
    for (const trade of [...trades].reverse()) {
      cash += trade.side === "buy" ? -trade.total : trade.total;
      balance.set(trade.id, cash);
    }
    return balance;
  }, [trades]);
  const shown = trades.slice(0, 6);
  return (
    <Band
      id="hm-ledger"
      className="hm-ledger"
      title="Ledger"
      mode={mode}
      note={trades.length ? `${count(trades.length)} virtual ${trades.length === 1 ? "trade" : "trades"}, newest first` : "Virtual trades, newest first"}
      action={
        trades.length > shown.length ? (
          <Link className="sim-link" data-go href={tradeLink(undefined, "trades")}>
            Full history ({count(trades.length)}) <Glyph name="arrow" size={12} />
          </Link>
        ) : null
      }
    >
      {shown.length ? (
        <table className="hm-table">
          <colgroup>
            <col className="hm-c-when" />
            <col className="hm-c-order" />
            <col className="hm-c-price" />
            <col className="hm-c-cash" />
            <col className="hm-c-real" />
            <col className="hm-c-after" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Order</th>
              <th scope="col" className="hm-num">
                Price
              </th>
              <th scope="col" className="hm-num">
                Cash in or out
              </th>
              <th scope="col" className="hm-num">
                Realised P/L
              </th>
              <th scope="col" className="hm-num">
                Cash after
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((trade, index) => {
              const asset = assetByTicker(trade.ticker);
              const when = splitStamp(trade.minute);
              const cash = trade.side === "buy" ? -trade.total : trade.total;
              return (
                <tr key={trade.id} data-latest={index === 0 || undefined} data-new={trade.id === fresh || undefined}>
                  <td className="hm-when">
                    <b>
                      {ago(trade.at)}
                      {index === 0 ? <span className="hm-latest">Latest</span> : null}
                    </b>
                    <small>
                      {when.day}, {when.time}
                    </small>
                  </td>
                  <td className="hm-order">
                    <span className="hm-side-tag" data-side={trade.side}>
                      {trade.side === "buy" ? "Bought" : "Sold"}
                    </span>
                    {asset ? <Mark asset={asset} size={16} /> : null}
                    <b>
                      {count(trade.qty)} {asset?.name ?? trade.ticker}
                    </b>
                  </td>
                  <td className="hm-num" data-label="Price">
                    {inr(trade.price)}
                  </td>
                  <td className="hm-num hm-cash" data-label="Cash" data-tone={cash > 0 ? "up" : undefined}>
                    {signedInr(cash)}
                  </td>
                  <td className="hm-num hm-real" data-label="Realised P/L">
                    {trade.realised !== undefined ? (
                      <span data-tone={tone(trade.realised)}>{signedInr(trade.realised)}</span>
                    ) : (
                      <span className="hm-na" title="A purchase locks in no profit or loss">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">None, a purchase</span>
                      </span>
                    )}
                  </td>
                  <td className="hm-num hm-after" data-label="Cash after">
                    {inr(after.get(trade.id) ?? 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="hm-empty">No trades yet. Your first order will be written here: what you bought, at what price, and the cash left after it.</p>
      )}
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* The next lesson                                                      */
/* ------------------------------------------------------------------ */

/**
 * One lesson from the Learning Hub, chosen for what the player holds or just
 * did: the module's own artwork from the Hub, the lesson as the link, why it
 * fits, and the module's progress as one pixel step per lesson, in gold.
 */
export function NextLesson({ account, holdings, mode }: { account: Account; holdings: Holding[]; mode: BootMode }) {
  const state = useProgress();
  const done = (slug: string, lesson: string) => state.lessons.includes(`${slug}/${lesson}`);
  const fitting = lessonsFor(account, holdings).find((pick) => !done(pick.module, pick.lesson));
  const milestone = nextMilestone(account.trades, account);
  const { ref, reveal } = useReveal(mode);

  let title = "";
  let href = "/learn";
  let reason = "";
  let course = MODULES[0];
  if (fitting) {
    course = moduleBySlug(fitting.module) ?? MODULES[0];
    title = course.lessons.find((entry) => entry.slug === fitting.lesson)?.title ?? "";
    href = `/learn/${fitting.module}/${fitting.lesson}`;
    reason = fitting.reason;
  }
  if (!title) {
    // Nothing specific to the portfolio left: the next unfinished lesson in the course, as the Learning Hub orders them.
    const index = MODULES.findIndex((entry, position) => isUnlocked(position, state) && !state.challenges.includes(entry.slug));
    course = MODULES[Math.max(0, index)];
    const lesson = course.lessons.find((entry) => !done(course.slug, entry.slug));
    title = index < 0 ? "Every module is complete" : (lesson?.title ?? "Final challenge");
    href = index < 0 ? "/learn" : lesson ? `/learn/${course.slug}/${lesson.slug}` : `/learn/${course.slug}/challenge`;
    reason = index < 0 ? "Revisit any lesson whenever you like." : "Next in the course.";
  }
  const finished = lessonsDone(course, state);
  const [x, y, w, h] = course.art.tile;
  return (
    <section ref={ref} className="hm-lesson" data-reveal={reveal} aria-labelledby="hm-lesson-title">
      <span className="hm-lesson-art" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- the Learning Hub's supplied pixel art, shown as drawn */}
        <img
          src={course.art.src}
          width={course.art.width}
          height={course.art.height}
          alt=""
          draggable={false}
          style={{ width: `${(course.art.width / w) * 100}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }}
        />
      </span>
      <div className="hm-lesson-body">
        <h2 className="hm-lesson-head" id="hm-lesson-title">
          <span className="px">Next lesson</span>
          <span>{course.title}</span>
        </h2>
        <Link className="hm-lesson-link" href={href}>
          <b>{title}</b>
          <Glyph name="arrow" size={16} />
        </Link>
        <p className="hm-lesson-why">{reason}</p>
      </div>
      <div className="hm-lesson-foot">
        <span className="hm-steps" role="progressbar" aria-valuemin={0} aria-valuemax={course.lessons.length} aria-valuenow={finished} aria-label={`Lessons finished in ${course.title}`}>
          {course.lessons.map((lesson, index) => (
            <i key={lesson.slug} data-done={index < finished || undefined} />
          ))}
        </span>
        <small>
          {finished} of {course.lessons.length} lessons finished
        </small>
        {milestone ? (
          <p className="hm-milestone">
            Next milestone: <b>{milestone.title}</b>{" "}
            <small>
              ({milestone.done} of {milestone.total})
            </small>
          </p>
        ) : null}
      </div>
    </section>
  );
}
