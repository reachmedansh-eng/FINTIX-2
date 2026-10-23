"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader } from "@/features/shell/Loader";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useViewportHeight } from "@/lib/useViewportHeight";
import { STARTING_CASH, useAccount, useUnsaved, value, type Account } from "./account";
import { CandleChart } from "./charts";
import { ASSETS, FRAMES, assetByTicker, candlesFor, clockLabel, stamp, type Asset, type FrameId } from "./engine";
import { useMarketMinute } from "./clock";
import { PositionStrip, SkylineSwitcher } from "./floor";
import { OrderFlow } from "./order";
import { AssetHeading, Holdings, News, Segments, Trades, UnsavedNotice } from "./parts";
import { simProgress, useSimProgress } from "./progress";
import { SimShell } from "./SimShell";
import { Figure, Glyph, NeoLine, signedInr, signedPercent, tone } from "./ui";

/** The Beginner trading floor: the market's skyline, the chosen asset's chart, one order ticket and the portfolio, all reading one market clock and one account. */
export function Simulator() {
  const router = useRouter();
  const progress = useSimProgress();
  const account = useAccount();
  const minute = useMarketMinute();
  // A first visit starts with Neo's walkthrough; once finished or skipped, it only returns when asked for.
  const firstVisit = !!progress && !progress.tutorialDone && !progress.tutorialSkipped;

  useEffect(() => {
    if (firstVisit) router.replace("/trade/beginner/tutorial");
  }, [firstVisit, router]);

  if (!progress || !account || minute === null || firstVisit) {
    return (
      <SimShell>
        <div className="sim-wait">
          <Loader />
        </div>
      </SimShell>
    );
  }
  return <Desk account={account} minute={minute} />;
}

/** The chart, the floor's work surface: candle size top right, the plot sized to fill the screen it has. */
function FloorChart({ asset, minute, height }: { asset: Asset; minute: number; height: number }) {
  const [frame, setFrame] = useState<FrameId>("5m");
  const candles = useMemo(() => candlesFor(asset, frame, minute, 48), [asset, frame, minute]);
  const label = FRAMES.find((entry) => entry.id === frame)?.label ?? "";
  return (
    <div className="desk-chart">
      <div className="desk-chart-bar">
        <p>
          {label} candles <span>simulated, the last one still forming</span>
        </p>
        <Segments label="Candle size" options={FRAMES} value={frame} onChange={setFrame} />
      </div>
      <CandleChart
        candles={candles}
        height={height}
        label={`${asset.name}, ${label} candles, simulated prices`}
        stampFor={(index) => stamp(candles[index].start, frame)}
        tickFor={(index) => clockLabel(candles[index].start, frame)}
      />
    </div>
  );
}

function Desk({ account, minute }: { account: Account; minute: number }) {
  const reduced = useReducedMotion();
  const viewport = useViewportHeight();
  const narrow = useMediaQuery("(max-width: 899px)");
  const phone = useMediaQuery("(max-width: 640px)");
  // Links from Home can open the floor on an asset or a tab. The floor is only drawn in the browser, so the address can be read directly.
  const [ticker, setTicker] = useState(() => {
    const wanted = new URLSearchParams(window.location.search).get("asset");
    return wanted && assetByTicker(wanted) ? wanted : ASSETS[0].ticker;
  });
  // How the asset last changed: a click crossfades the heading and chart; a keyboard step swaps them at once.
  const [via, setVia] = useState<"pointer" | "keyboard" | null>(null);
  const [tab, setTab] = useState<"holdings" | "trades" | "news">(() => (new URLSearchParams(window.location.search).get("tab") === "trades" ? "trades" : "holdings"));
  const [help, setHelp] = useState(false);
  const unsaved = useUnsaved();
  // The latest trade is the cause of any change worth counting; a trade made on this visit also lights its row in the fills.
  const cause = account.trades[0]?.id;
  const [arrivedWith] = useState(cause);
  const fresh = cause !== arrivedWith ? cause : undefined;

  const asset = assetByTicker(ticker) ?? ASSETS[0];
  const valuation = value(account, minute);
  const owned = useMemo(() => new Set(valuation.positions.map((position) => position.ticker)), [valuation.positions]);
  const pnl = valuation.total - STARTING_CASH;
  // The chart takes the height the screen leaves it.
  const chartHeight = phone ? 248 : narrow ? 300 : Math.max(280, Math.min(520, (viewport || 900) - 440));

  const pick = (next: string, how: "pointer" | "keyboard") => {
    setTicker(next);
    setVia(how);
  };
  /** Picked from the lists below the floor: the view returns to the chart so the choice is seen. */
  const pickFromList = (next: string) => {
    pick(next, "pointer");
    document.getElementById("desk-asset")?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <SimShell>
      <div className="desk">
        <header className="desk-head">
          <div className="desk-title">
            <h1 className="px">Trading floor</h1>
            <p>Beginner level. Prices are simulated and every rupee is virtual.</p>
          </div>
          <dl className="desk-account" aria-label="Your account">
            <div>
              <dt className="sim-cap">Portfolio</dt>
              <dd>
                <Figure value={valuation.total} cause={cause} />
              </dd>
            </div>
            <div>
              <dt className="sim-cap">Cash</dt>
              <dd>
                <Figure value={valuation.cash} cause={cause} />
              </dd>
            </div>
            <div>
              <dt className="sim-cap">Since start</dt>
              <dd data-tone={tone(pnl)}>
                {signedInr(pnl)} <small>({signedPercent((pnl / STARTING_CASH) * 100)})</small>
              </dd>
            </div>
          </dl>
          <div className="desk-tools">
            <Link className="sim-button" data-tone="quiet" data-size="s" href="/trade/beginner/tutorial" onClick={() => simProgress.replay()}>
              Replay tutorial
            </Link>
            <button type="button" className="sim-button" data-tone="quiet" data-size="s" aria-expanded={help} onClick={() => setHelp(!help)}>
              <Glyph name="help" size={12} /> Ask Neo
            </button>
          </div>
        </header>

        {help ? (
          <div className="desk-help">
            <NeoLine
              mood="explain"
              size={96}
              actions={
                <button type="button" className="sim-button" data-tone="quiet" data-size="s" onClick={() => setHelp(false)}>
                  <Glyph name="close" size={12} /> Close
                </button>
              }
            >
              <ul className="desk-help-list">
                <li>Pick an asset from the skyline across the top. Point at (or tap) the chart to read any candle&apos;s open, high, low and close; the arrow keys step through them too.</li>
                <li>To buy, set a quantity. The ticket shows the cost, your cash before and after, your shares before and after, and your city after the order. Nothing happens until you press the button that names your order.</li>
                <li>To sell, choose Sell on an asset you own. The gain or loss on those shares becomes realised.</li>
                <li>Unrealised P/L moves with the price of what you hold. Your portfolio is your cash plus your holdings.</li>
              </ul>
            </NeoLine>
          </div>
        ) : null}

        {unsaved ? <UnsavedNotice /> : null}

        <SkylineSwitcher minute={minute} selected={asset.ticker} owned={owned} onSelect={pick} instant={via === "keyboard"} />

        <div className="desk-floor">
          <section className="desk-main" id="desk-asset" role="tabpanel" aria-labelledby={`sim-tab-${asset.ticker}`} key={asset.ticker} data-swap={via === "pointer" || undefined}>
            <AssetHeading asset={asset} minute={minute} owned={account.holdings[asset.ticker]?.qty ?? 0} size="l" id="desk-asset-title" />
            <FloorChart asset={asset} minute={minute} height={chartHeight} />
            <PositionStrip account={account} minute={minute} ticker={asset.ticker} cause={cause} />
          </section>
          <aside className="desk-ticket" id="desk-order" aria-label={`Trade ${asset.name}`}>
            <OrderFlow key={asset.ticker} asset={asset} account={account} minute={minute} onFilled={() => setTab("trades")} />
          </aside>

          <section className="desk-lower" aria-label="Portfolio details">
            <div className="desk-tabs" role="tablist" aria-label="Portfolio details">
              {(
                [
                  ["trades", "Recent fills", account.trades.length],
                  ["holdings", "Holdings", valuation.positions.length],
                  ["news", "Market news", null],
                ] as const
              ).map(([id, label, count]) => (
                <button key={id} type="button" role="tab" id={`desk-tab-${id}`} aria-selected={tab === id} aria-controls="desk-panel" onClick={() => setTab(id)}>
                  {label}
                  {count !== null ? <small>{count}</small> : null}
                </button>
              ))}
            </div>
            <div id="desk-panel" role="tabpanel" aria-labelledby={`desk-tab-${tab}`}>
              {tab === "holdings" ? <Holdings valuation={valuation} onPick={pickFromList} /> : tab === "trades" ? <Trades trades={account.trades} fresh={fresh} /> : <News minute={minute} onPick={pickFromList} />}
            </div>
          </section>
        </div>
      </div>
    </SimShell>
  );
}
