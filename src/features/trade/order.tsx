"use client";

import { useRef, useState, type ReactNode } from "react";
import { execute, orderId, type Account, type Trade } from "./account";
import type { Asset } from "./engine";
import { Receipt } from "./parts";
import { OrderTicket, readQty, type Side } from "./ticket";

/**
 * One order, from first keystroke to receipt, the same on Home and the
 * trading floor:
 *
 * 1. Editing: Buy or Sell and a quantity; the ticket shows, as it is typed,
 *    the cost, cash and shares before and after, and the city after it.
 * 2. Confirm: the order is filled at once, at the price of the minute the
 *    button is pressed (no animation stands between the press and the
 *    trade). A second press while it is being placed does nothing, and the
 *    same order keeps its id, so it can never be filled twice.
 * 3. Done: a receipt of what actually happened, read from the filled trade.
 *    Refused (the price moved, cash changed): the ticket stays, says why,
 *    and the button offers to try again. A refused order changes nothing.
 */
type Step = { step: "edit"; error?: string } | { step: "done"; trade: Trade; saved: boolean; held: number };

export function OrderFlow({
  asset,
  account,
  minute,
  side: firstSide = "buy",
  onFilled,
  onDone,
  doneLabel = "New order",
  consequence,
  more,
}: {
  asset: Asset;
  account: Account;
  minute: number;
  side?: Side;
  onFilled?: (trade: Trade) => void;
  /** After the receipt; without it the flow simply starts a new order. */
  onDone?: () => void;
  doneLabel?: string;
  /** A line on the receipt about what the trade did elsewhere (the city). Given the trade and the shares held before it. */
  consequence?: (trade: Trade, heldBefore: number) => string | undefined;
  /** Extra receipt actions. */
  more?: ReactNode;
}) {
  const [side, setSide] = useState<Side>(firstSide);
  const [qty, setQty] = useState("");
  const [state, setState] = useState<Step>({ step: "edit" });
  const [busy, setBusy] = useState(false);
  // The id for the order on the ticket now: kept while side and quantity stay the same, so a retry is the same order.
  const pending = useRef<{ id: string; key: string } | null>(null);
  const placing = useRef(false);
  // Set once this ticket's order is filled, until a new order is started: a second press that arrives before the screen
  // has redrawn (two clicks in one moment) finds it set and does nothing.
  const filled = useRef(false);

  const confirm = () => {
    if (placing.current || filled.current) return;
    const count = readQty(qty).qty;
    if (!count) return;
    const key = `${side}:${count}`;
    if (!pending.current || pending.current.key !== key) pending.current = { id: orderId(), key };
    placing.current = true;
    setBusy(true);
    const held = account.holdings[asset.ticker]?.qty ?? 0;
    const fill = execute({ id: pending.current.id, side, ticker: asset.ticker, qty: count });
    placing.current = false;
    setBusy(false);
    if (!fill.ok) {
      setState({ step: "edit", error: fill.reason });
      return;
    }
    filled.current = true;
    pending.current = null;
    setQty("");
    setState({ step: "done", trade: fill.trade, saved: fill.saved, held });
    onFilled?.(fill.trade);
  };

  if (state.step === "edit")
    return (
      <OrderTicket
        asset={asset}
        account={account}
        minute={minute}
        side={side}
        onSide={(next) => {
          setSide(next);
          setQty("");
          setState({ step: "edit" });
        }}
        qty={qty}
        onQty={(next) => {
          setQty(next);
          if (state.error) setState({ step: "edit" });
        }}
        onConfirm={confirm}
        busy={busy}
        error={state.error}
      />
    );

  const stillHeld = account.holdings[asset.ticker]?.qty ?? 0;
  return (
    <Receipt
      trade={state.trade}
      asset={asset}
      account={account}
      minute={minute}
      saved={state.saved}
      consequence={consequence?.(state.trade, state.held)}
      actions={
        <>
          <button
            type="button"
            className="sim-button"
            onClick={() => {
              filled.current = false;
              if (!stillHeld) setSide("buy");
              setState({ step: "edit" });
              onDone?.();
            }}
          >
            {doneLabel}
          </button>
          {more}
        </>
      }
    />
  );
}
