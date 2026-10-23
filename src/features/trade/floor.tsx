"use client";

import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { value as valueOf, type Account } from "./account";
import { ASSETS, assetByTicker, dayChange } from "./engine";
import type { Lesson } from "./parts";
import { Figure, Glyph, Mark, inr, portion, rupees, signedInr, signedPercent, tone } from "./ui";

/* ------------------------------------------------------------------ */
/* The skyline switcher                                                 */
/* ------------------------------------------------------------------ */

/**
 * The eight assets across the top of the trading floor, each with its
 * sector icon (the same mark Home uses). Each shows its ticker and name, the
 * simulated price and today's signed change; the chosen one carries the
 * accent line, and the player's own assets the gold pixel of ownership. A
 * tab list: arrow keys move along it and choose (instantly; a keyboard
 * choice never animates), Home and End jump to the ends.
 */
export function SkylineSwitcher({
  minute,
  selected,
  owned,
  onSelect,
  instant,
}: {
  minute: number;
  selected: string;
  owned: Set<string>;
  onSelect: (ticker: string, via: "pointer" | "keyboard") => void;
  /** The last choice came from the keyboard: the line jumps instead of sliding. */
  instant?: boolean;
}) {
  const chosenIndex = Math.max(0, ASSETS.findIndex((asset) => asset.ticker === selected));
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const keys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = ASSETS.length - 1;
    const next = event.key === "ArrowRight" ? (index + 1) % ASSETS.length : event.key === "ArrowLeft" ? (index + last) % ASSETS.length : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    onSelect(ASSETS[next].ticker, "keyboard");
    tabs.current[next]?.focus();
  };
  return (
    <div className="sim-switch" role="tablist" aria-label="Assets in this market, simulated prices" data-instant={instant || undefined}>
      {ASSETS.map((asset, index) => {
        const day = dayChange(asset, minute);
        const chosen = asset.ticker === selected;
        return (
          <button
            key={asset.ticker}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`sim-tab-${asset.ticker}`}
            aria-selected={chosen}
            aria-controls="desk-asset"
            tabIndex={chosen ? 0 : -1}
            onClick={() => onSelect(asset.ticker, "pointer")}
            onKeyDown={(event) => keys(event, index)}
          >
            <Mark asset={asset} size={16} />
            <span className="sim-switch-id">
              <b className="sim-hud">{asset.ticker}</b>
              <small>
                {asset.name}
                {owned.has(asset.ticker) ? <i className="sim-own" aria-label=", you own this" /> : null}
              </small>
            </span>
            <span className="sim-switch-price">
              <b>{rupees(day.price)}</b>
              <small data-tone={tone(day.percent)}>{signedPercent(day.percent)}</small>
            </span>
          </button>
        );
      })}
      {/* One accent line under the chosen asset, sliding from the last choice to the new one. */}
      <i className="sim-switch-mark" aria-hidden="true" style={{ transform: `translateX(${chosenIndex * 100}%)` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A note at the moment of decision                                     */
/* ------------------------------------------------------------------ */

/**
 * A "?" beside a figure that opens a short explanation under its row, never
 * over the figure it explains, with the lesson that covers it. The toggle
 * and the note are placed separately (the note spans the row); they share
 * one state from useExplain(). Escape or the close button puts the note away
 * and returns focus to the "?".
 */
export function useExplain() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return { open, setOpen, id };
}

type ExplainState = ReturnType<typeof useExplain>;

export function ExplainToggle({ state, label }: { state: ExplainState; label: string }) {
  return (
    <button id={`${state.id}-toggle`} type="button" className="sim-explain" aria-expanded={state.open} aria-controls={state.id} aria-label={label} onClick={() => state.setOpen(!state.open)}>
      ?
    </button>
  );
}

export function ExplainNote({ state, lesson, children }: { state: ExplainState; lesson: Lesson; children: ReactNode }) {
  if (!state.open) return null;
  const close = () => {
    state.setOpen(false);
    document.getElementById(`${state.id}-toggle`)?.focus();
  };
  return (
    <div
      id={state.id}
      className="sim-explain-note"
      role="note"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <p>{children}</p>
      <Link className="sim-link" data-go href={lesson.href}>
        {lesson.label} <Glyph name="arrow" size={12} />
      </Link>
      <button type="button" className="sim-explain-close" aria-label="Close this note" onClick={close}>
        <Glyph name="close" size={12} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The position, under the chart it is measured against                 */
/* ------------------------------------------------------------------ */

/** The player's position in the chosen asset: shares, average cost, value, unrealised P/L and share of holdings. Figures a trade changes count to their new value. */
export function PositionStrip({ account, minute, ticker, cause }: { account: Account; minute: number; ticker: string; cause?: string }) {
  const asset = assetByTicker(ticker);
  const valuation = valueOf(account, minute);
  const position = valuation.positions.find((each) => each.ticker === ticker);
  if (!asset) return null;
  if (!position) {
    return (
      <section className="desk-position" aria-labelledby="desk-position-title">
        <h2 id="desk-position-title" className="sim-hud">
          Your position
        </h2>
        <p className="desk-position-none">
          You don&apos;t own any {asset.name} yet. You have {inr(account.cash)} of virtual cash; a buy order opens a position here.
        </p>
      </section>
    );
  }
  const percent = position.cost ? (position.unrealised / position.cost) * 100 : 0;
  const share = valuation.invested ? position.value / valuation.invested : 0;
  return <PositionFigures position={position} percent={percent} share={share} cause={cause} />;
}

function PositionFigures({ position, percent, share, cause }: { position: { qty: number; average: number; value: number; unrealised: number }; percent: number; share: number; cause?: string }) {
  const note = useExplain();
  return (
    <section className="desk-position" aria-labelledby="desk-position-title">
      <h2 id="desk-position-title" className="sim-hud">
        Your position
      </h2>
      <dl>
        <div>
          <dt>Shares</dt>
          <dd>
            <Figure value={position.qty} kind="count" cause={cause} />
          </dd>
        </div>
        <div>
          <dt>Average cost</dt>
          <dd>{inr(Math.round(position.average))}</dd>
        </div>
        <div>
          <dt>Value now</dt>
          <dd>
            <Figure value={position.value} cause={cause} />
          </dd>
        </div>
        <div>
          <dt>
            Unrealised P/L <ExplainToggle state={note} label="What is unrealised P/L?" />
          </dt>
          <dd data-tone={tone(position.unrealised)}>
            {signedInr(position.unrealised)} <small>({signedPercent(percent)})</small>
          </dd>
        </div>
        <div>
          <dt>Share of holdings</dt>
          <dd>{portion(share)}</dd>
        </div>
      </dl>
      <ExplainNote state={note} lesson={{ href: "/learn/what-is-trading/unrealized-vs-realized", label: "Realised vs unrealised P/L" }}>
        Unrealised P/L is the gain or loss on shares you still own: their value now minus what they cost you. It moves with the price, and becomes realised only when you sell.
      </ExplainNote>
    </section>
  );
}
