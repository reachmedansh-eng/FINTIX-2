"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Loader } from "@/features/shell/Loader";
import { SiteNav, useFirstName } from "@/features/shell/SiteNav";
import { Tour } from "@/features/tour/Tour";
import { STARTING_CASH, useAccount, useUnsaved, type Account, type Trade } from "@/features/trade/account";
import { useMarketMinute } from "@/features/trade/clock";
import { assetByTicker, stamp } from "@/features/trade/engine";
import { ExplainNote, ExplainToggle, useExplain } from "@/features/trade/floor";
import { LESSONS, Segments, UnsavedNotice } from "@/features/trade/parts";
import { Figure, Glyph, Mark, PixelNumber, inr, portion, signedInr, signedPercent, tone } from "@/features/trade/ui";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { BOOT_AT, BootTerminal, Glitch, useBootMode, useBootStart, type BootMode } from "./boot";
import { City } from "./City";
import { RANGES, biggestEffect, holdings as holdingsOf, portfolioSummary, type Holding, type RangeId } from "./portfolio";
import { AssetPanel, Ledger, MarketNews, MarketPulse, NextLesson, tradeLink } from "./sections";
import "@/features/trade/trade.css";
import "./home.css";
import "./sections.css";

/**
 * Home is the player's city and its treasury. The first screen is the world:
 * the city on its plaza, turning slowly, with the heads-up display at its
 * edges (on the left what the city is worth, how far that is from the
 * ₹1,00,000 it started with, and how it splits into invested money and cash;
 * on the right the buildings themselves, as holdings, or the asset chosen).
 * Below the city, one section after another: the market's pulse, the news and
 * the next lesson, and the ledger of every trade. Everything reads the
 * simulator's one market clock and one account.
 */
export function Dashboard() {
  const account = useAccount();
  const minute = useMarketMinute();

  return (
    <div className="sim hm">
      <SiteNav active="home" />
      <main className="hm-main">
        {account && minute !== null ? (
          <World account={account} minute={minute} />
        ) : (
          <div className="hm-wait">
            <h1 className="sr-only">Your city</h1>
            <Loader label="Opening your city" />
          </div>
        )}
      </main>
    </div>
  );
}

/** What is chosen: a building or holding row (the city), or an asset from the market or the news. */
type Pick = { ticker: string; from: "city" | "market" } | null;

function World({ account, minute }: { account: Account; minute: number }) {
  const reduced = useReducedMotion();
  const phone = useMediaQuery("(max-width: 760px)");
  const mode = useBootMode(reduced);
  const { start, go, begin } = useBootStart(mode);
  const name = useFirstName();
  const [range, setRange] = useState<RangeId>("1D");
  const [pick, setPick] = useState<Pick>(null);
  // A holding pointed at in one place answers in the other: its row lights its building, its building lights its row.
  const [rowHover, setRowHover] = useState<string | null>(null);
  const [cityHover, setCityHover] = useState<string | null>(null);
  // An asset pointed at in the market pulse lights its stories in the news, and the other way round.
  const [marketFocus, setMarketFocus] = useState<string | null>(null);
  const focus = { ticker: marketFocus, onFocus: setMarketFocus };

  const holdings = useMemo(() => holdingsOf(account, minute), [account, minute]);
  const summary = portfolioSummary(account, minute, range);
  const owned = useMemo(() => new Set(holdings.map((holding) => holding.asset.ticker)), [holdings]);
  // One selection everywhere: an owned asset is marked in the city and the holdings however it was chosen.
  const selected = pick && owned.has(pick.ticker) ? pick.ticker : null;
  const unsaved = useUnsaved();
  // The latest trade is the cause of any change worth counting: figures it changed count to their new value once.
  const cause = account.trades[0]?.id;
  const [arrivedWith] = useState(cause);
  // Profit or loss since the start: everything is measured against the virtual money the player began with.
  const pnl = summary.total - STARTING_CASH;

  useEffect(() => {
    const leave = (event: KeyboardEvent) => {
      // Escape inside the panel (an order being entered) or a field belongs to that control, not to the selection.
      if (event.target instanceof Element && event.target.closest(".hm-panel, input, textarea, select")) return;
      if (event.key === "Escape") setPick(null);
    };
    window.addEventListener("keydown", leave);
    return () => window.removeEventListener("keydown", leave);
  }, []);

  const choose = (ticker: string | null, from: "city" | "market" = "city") => {
    setPick(ticker ? { ticker, from } : null);
    if (!ticker) return;
    // The chosen asset opens beside the city: from further down the page, the city comes back into view first.
    const target = phone ? "hm-side" : from === "market" ? "hm-stage" : null;
    if (target) requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }));
  };
  // The asset traded from the panel stays chosen, and its building is marked as it changes.
  const followTrade = (trade: Trade) => setPick((current) => (current?.ticker === trade.ticker ? current : { ticker: trade.ticker, from: "city" }));
  const focusAsset = pick ? assetByTicker(pick.ticker) : undefined;
  const reason = pick ? (owned.has(pick.ticker) ? (pick.from === "city" ? "Your building" : "From the market, you own this") : pick.from === "city" ? "No longer in your city" : "From the market") : "";

  return (
    <div className="hm-world" data-boot={mode} data-go={go || undefined}>
      {unsaved ? <UnsavedNotice /> : null}
      <section className="hm-stage" id="hm-stage" data-panel={focusAsset ? "open" : undefined} aria-labelledby="hm-title">
        <City
          holdings={holdings}
          selected={selected}
          onSelect={(ticker) => choose(ticker)}
          reduced={reduced}
          frame={focusAsset ? "panel" : "rest"}
          highlight={rowHover}
          onHover={setCityHover}
          onFirstFrame={begin}
          lightsAt={start}
          boot={mode === "full" ? "full" : "quiet"}
        />

        {/* The dark start: the system's lines type out over the unlit city, then collapse as its lights come up. */}
        <BootTerminal
          play={mode === "full"}
          start={start}
          lines={[
            "FINTIX simulator",
            `${name}'s city`,
            `Market ${stamp(minute)}`,
            `${holdings.length} ${holdings.length === 1 ? "building" : "buildings"}, ${inr(summary.invested)} invested`,
            `${inr(summary.cash)} cash, all virtual`,
          ]}
        />

        <Treasury summary={summary} pnl={pnl} mode={mode} start={start} name={name} />

        <Balance summary={summary} cause={cause} range={range} onRange={setRange} mode={mode} start={start} />

        <Holdings holdings={holdings} selected={selected} lit={cityHover} onSelect={(ticker) => choose(ticker)} onHover={setRowHover} />

        {focusAsset ? (
          <div className="hm-side" id="hm-side">
            <AssetPanel key={focusAsset.ticker} asset={focusAsset} minute={minute} reason={reason} onClose={() => setPick(null)} owned={owned.has(focusAsset.ticker)} account={account} onFilled={followTrade} />
          </div>
        ) : null}

        {holdings.length === 0 ? (
          <div className="hm-first" role="note">
            <p className="sim-hud">Your first lot</p>
            <p>Every asset you buy becomes a building on this plaza. The taller it stands, the larger its share of your city. Choose an asset from the market below to buy it.</p>
          </div>
        ) : null}

        <a
          className="hm-cue"
          href="#hm-market"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById("hm-market")?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
          }}
        >
          Market, news and your ledger <Glyph name="down" size={12} />
        </a>
      </section>

      <MarketPulse minute={minute} owned={owned} onPick={(ticker) => choose(ticker, "market")} mode={mode} focus={focus} />

      <div className="hm-duo">
        <MarketNews minute={minute} owned={owned} onPick={(ticker) => choose(ticker, "market")} mode={mode} focus={focus} />
        <NextLesson account={account} holdings={holdings} mode={mode} />
      </div>

      <Ledger trades={account.trades} fresh={cause !== arrivedWith ? cause : undefined} mode={mode} />

      {/* A first visit: once the opening has played, Neo shows the player around. */}
      <Tour ready={mode !== "full" || go} context={{ name, holdings: holdings.length }} />
    </div>
  );
}

/**
 * The treasury: what the city is worth (the largest figure on the page, in
 * the world's own letters) and how far that is from the starting ₹1,00,000.
 * On a first visit the figure decodes into place.
 */
function Treasury({ summary, pnl, mode, start, name }: { summary: ReturnType<typeof portfolioSummary>; pnl: number; mode: BootMode; start: number | null; name: string }) {
  const play = mode === "full";
  const total = inr(summary.total);
  const since = `${signedInr(pnl)} (${signedPercent((pnl / STARTING_CASH) * 100)})`;
  return (
    <section className="hm-treasury" aria-labelledby="hm-title">
      {/* The city carries its owner's name, like a save in a city-builder. */}
      <h1 id="hm-title" className="px">
        <Glitch text={`${name}'s city`} play={play} start={start} delay={BOOT_AT.title} duration={520} variant="title" />
      </h1>
      <p className="hm-value">
        <span className="sr-only">Worth </span>
        <Glitch text={total} play={play} start={start} delay={BOOT_AT.value} duration={1150} variant="hero" pixel>
          <PixelNumber text={total} />
        </Glitch>
      </p>
      <p className="hm-since" data-tone={tone(pnl)}>
        {pnl ? <Glyph name={pnl > 0 ? "up" : "down"} size={12} /> : null}
        <b>
          <Glitch text={since} play={play} start={start} delay={BOOT_AT.metrics} duration={550} />
        </b>
        <span>since your {inr(STARTING_CASH, 0)} start</span>
      </p>
      <p className="hm-sim-note">Virtual money at simulated prices</p>
    </section>
  );
}

/**
 * How the total splits into money invested (what you own, in gold) and cash,
 * as one large meter with both ends labelled, the change over a chosen period,
 * and the profit or loss in its two parts, which add up to the change since
 * the start. Figures a trade changes count to their new value.
 */
function Balance({ summary, cause, range, onRange, mode, start }: { summary: ReturnType<typeof portfolioSummary>; cause?: string; range: RangeId; onRange: (range: RangeId) => void; mode: BootMode; start: number | null }) {
  const share = summary.total ? summary.invested / summary.total : 0;
  const note = useExplain();
  const play = mode === "full";
  const period = `${signedInr(summary.change)} (${signedPercent(summary.percent)})`;
  return (
    <section className="hm-balance" aria-label="Invested money, cash and profit or loss">
      <div className="hm-period">
        <p data-tone={tone(summary.change)}>
          <b>
            <Glitch text={period} play={play} start={start} delay={BOOT_AT.metrics + 80} duration={550} />
          </b>{" "}
          <span>{summary.words}</span>
        </p>
        <Segments label="Change over" options={RANGES} value={range} onChange={onRange} />
      </div>

      <div className="hm-split">
        <p className="hm-split-key">
          <span>
            <i className="hm-key-own" aria-hidden="true" /> Invested <b>{portion(share)}</b>
          </span>
          <span>
            Cash <b>{portion(1 - share)}</b> <i className="hm-key-cash" aria-hidden="true" />
          </span>
        </p>
        <SplitMeter share={share} fill={play} armAt={start} />
        <dl className="hm-split-figures">
          <div>
            <dt className="sr-only">Invested</dt>
            <dd>
              <Glitch text={inr(summary.invested)} play={play} start={start} delay={BOOT_AT.split} duration={500}>
                <Figure value={summary.invested} cause={cause} />
              </Glitch>
            </dd>
          </div>
          <div>
            <dt className="sr-only">Cash</dt>
            <dd>
              <Glitch text={inr(summary.cash)} play={play} start={start} delay={BOOT_AT.split + 80} duration={500}>
                <Figure value={summary.cash} cause={cause} />
              </Glitch>
            </dd>
          </div>
        </dl>
      </div>

      <dl className="hm-pl" aria-label="Profit and loss since the start">
        <div>
          <dt>
            Unrealised P/L <ExplainToggle state={note} label="What do unrealised and realised P/L mean?" />
          </dt>
          <dd data-tone={tone(summary.unrealised)}>
            <Glitch text={signedInr(summary.unrealised)} play={play} start={start} delay={BOOT_AT.split + 120} duration={450} />
          </dd>
          <dd className="hm-pl-note">on what you still own</dd>
        </div>
        <div>
          <dt>Realised P/L</dt>
          <dd data-tone={tone(summary.realised)}>
            <Glitch text={signedInr(summary.realised)} play={play} start={start} delay={BOOT_AT.split + 180} duration={450} />
          </dd>
          <dd className="hm-pl-note">locked in by selling</dd>
        </div>
      </dl>
      <ExplainNote state={note} lesson={LESSONS.realised}>
        Unrealised P/L is the gain or loss on what you still own, and it moves with every price. Selling turns it into realised P/L, which stays as it is. Together they make the change since your ₹1,00,000 start.
      </ExplainNote>
    </section>
  );
}

/**
 * Invested money and cash as two parts of one whole: forty pixel blocks, each
 * 2.5% of the city's value, gold for what is invested, navy for cash. A part
 * that isn't zero always shows at least one block. On a first visit the gold
 * fills in from the left, block by block; when a trade changes the split the
 * blocks that change turn in sequence from the boundary.
 */
function SplitMeter({ share, fill, armAt }: { share: number; fill: boolean; armAt: number | null }) {
  const blocks = 40;
  const filled = share <= 0 ? 0 : share >= 1 ? blocks : Math.min(blocks - 1, Math.max(1, Math.round(share * blocks)));
  // On a first visit the meter starts empty and fills once the figures above it have resolved.
  const [armed, setArmed] = useState(!fill);
  useEffect(() => {
    if (armed || armAt === null) return;
    const timer = window.setTimeout(() => setArmed(true), Math.max(0, armAt + BOOT_AT.meter - performance.now()));
    return () => window.clearTimeout(timer);
  }, [armed, armAt]);
  const shown = armed ? filled : 0;
  return (
    <div className="hm-meter" role="img" aria-label={`Invested ${portion(share)}, cash ${portion(1 - share)}`} style={{ "--edge": filled } as CSSProperties}>
      {Array.from({ length: blocks }, (_, index) => (
        <i key={index} data-own={index < shown || undefined} style={{ "--i": index } as CSSProperties} />
      ))}
    </div>
  );
}

/**
 * What the player owns, largest first, each row its building: choosing a row
 * marks the building, choosing a building marks the row, and pointing at
 * either lights the other. The day's finding (the holding that moved the city
 * most) is written under the title.
 */
function Holdings({
  holdings,
  selected,
  lit,
  onSelect,
  onHover,
}: {
  holdings: Holding[];
  selected: string | null;
  lit: string | null;
  onSelect: (ticker: string | null) => void;
  onHover: (ticker: string | null) => void;
}) {
  const effect = biggestEffect(holdings);
  return (
    <section className="hm-holdings" aria-labelledby="hm-holdings-title">
      <header className="hm-hud-head">
        <h2 id="hm-holdings-title" className="sim-hud">
          Your buildings
        </h2>
        <p>{holdings.length ? `${holdings.length} ${holdings.length === 1 ? "holding" : "holdings"}, largest first` : "None yet"}</p>
      </header>
      {effect ? (
        <p className="hm-finding">
          {effect.asset.name} moved your city most today: {portion(effect.weight)} of your holdings, <span data-tone={tone(effect.dayPercent)}>{signedPercent(effect.dayPercent)}</span>.
        </p>
      ) : null}
      {holdings.length ? (
        <ul className="hm-rows" onPointerLeave={() => onHover(null)}>
          {holdings.map((holding, index) => {
            const percent = holding.cost ? (holding.unrealised / holding.cost) * 100 : 0;
            const picked = selected === holding.asset.ticker;
            return (
              <li key={holding.asset.ticker} style={{ "--i": index } as CSSProperties}>
                <button
                  type="button"
                  aria-pressed={picked}
                  data-lit={lit === holding.asset.ticker || undefined}
                  aria-label={`${holding.asset.name}: ${holding.qty} share${holding.qty === 1 ? "" : "s"} worth ${inr(holding.value)}, ${portion(holding.weight)} of your holdings, ${signedPercent(percent)} unrealised`}
                  onClick={() => onSelect(picked ? null : holding.asset.ticker)}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") onHover(holding.asset.ticker);
                  }}
                  onFocus={() => onHover(holding.asset.ticker)}
                  onBlur={() => onHover(null)}
                >
                  <Mark asset={holding.asset} size={16} />
                  <span className="hm-row-name">
                    <b className="sim-hud">{holding.asset.ticker}</b>
                    <small>
                      {holding.asset.name}, {portion(holding.weight)}
                    </small>
                  </span>
                  <span className="hm-row-value">
                    <b>{inr(holding.value)}</b>
                    <small data-tone={tone(percent)}>{signedPercent(percent)}</small>
                  </span>
                  <i className="hm-row-weight" style={{ transform: `scaleX(${holding.weight.toFixed(3)})` }} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="hm-holdings-empty">
          <p>Nothing owned yet. Each asset you buy is listed here with its value and how it&apos;s doing.</p>
          <Link className="sim-link" data-go href={tradeLink()}>
            Browse the market on the trading floor <Glyph name="arrow" size={12} />
          </Link>
        </div>
      )}
    </section>
  );
}
