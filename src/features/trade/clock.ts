"use client";

import { useSyncExternalStore } from "react";
import { EPOCH, MINUTE_MS, currentMinute } from "./engine";

/* The market clock, for components. Kept apart from the engine so the engine stays usable on the server. */

function subscribe(onTick: () => void) {
  let timer = 0;
  const next = () => {
    const wait = MINUTE_MS - ((Date.now() - EPOCH) % MINUTE_MS) + 5;
    timer = window.setTimeout(() => {
      onTick();
      next();
    }, wait);
  };
  next();
  return () => window.clearTimeout(timer);
}

/**
 * The current market minute, updating as the market moves. Null during the
 * server render: the server's clock is not the visitor's, so prices are only
 * drawn once the page is running in the browser.
 */
export const useMarketMinute = () => useSyncExternalStore(subscribe, currentMinute, () => null);
