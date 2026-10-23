"use client";

import { useSyncExternalStore } from "react";

/**
 * Where the player is with the simulator: the levels, and the tutorial they
 * are in the middle of. Separate from the account, so replaying the tutorial
 * can never touch cash, holdings or trades.
 */

export type TutorialRun = {
  step: number;
  /** Asset the player picked during the tutorial. */
  ticker: string | null;
  /** The quantity they typed. */
  qty: number | null;
  /** The order being prepared, and the trade it became. */
  orderId: string | null;
  tradeId: string | null;
  /** The candle check was answered correctly. */
  checked: boolean;
};

export type SimProgress = {
  version: 1;
  run: TutorialRun;
  /** Finished the walkthrough, including the candle check and a first trade. */
  tutorialDone: boolean;
  /** Chose to skip: the tutorial no longer opens by itself. */
  tutorialSkipped: boolean;
  beginnerDone: boolean;
  intermediateDone: boolean;
};

const KEY = "fintix.sim.progress.v1";
export const FRESH_RUN: TutorialRun = { step: 0, ticker: null, qty: null, orderId: null, tradeId: null, checked: false };
const FRESH: SimProgress = { version: 1, run: FRESH_RUN, tutorialDone: false, tutorialSkipped: false, beginnerDone: false, intermediateDone: false };

let cache: SimProgress | null = null;
const listeners = new Set<() => void>();

function read(): SimProgress {
  if (cache) return cache;
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    cache = stored && stored.version === 1 && stored.run ? { ...FRESH, ...stored, run: { ...FRESH_RUN, ...stored.run } } : FRESH;
  } catch {
    cache = FRESH;
  }
  return cache as SimProgress;
}

function write(next: SimProgress) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full disk: progress lasts for this visit only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const useSimProgress = () => useSyncExternalStore(subscribe, read, () => null);

export const simProgress = {
  read,
  updateRun(change: Partial<TutorialRun>) {
    const now = read();
    write({ ...now, run: { ...now.run, ...change } });
  },
  /** Start the walkthrough from the beginning. The account is not touched. */
  replay() {
    write({ ...read(), run: FRESH_RUN });
  },
  skip() {
    write({ ...read(), tutorialSkipped: true, run: FRESH_RUN });
  },
  /** The walkthrough is finished: Beginner is complete, and Intermediate opens. */
  finish() {
    write({ ...read(), tutorialDone: true, beginnerDone: true });
  },
};

export type Level = { id: "beginner" | "intermediate" | "advanced"; name: string; state: "open" | "unlocked-soon" | "locked"; note: string };

/** The three simulator levels. Only Beginner can be played in this version. */
export function levels(progress: SimProgress | null): Level[] {
  const beginnerDone = !!progress?.beginnerDone;
  return [
    {
      id: "beginner",
      name: "Beginner",
      state: "open",
      note: beginnerDone ? "Completed. Keep trading, or replay the tutorial any time." : "Learn to read a chart and make your first trade, with Neo as your guide.",
    },
    {
      id: "intermediate",
      name: "Intermediate",
      state: beginnerDone ? "unlocked-soon" : "locked",
      note: beginnerDone ? "Unlocked. This level is still being built and will open in a later version." : "Unlocks when you complete Beginner.",
    },
    { id: "advanced", name: "Advanced", state: "locked", note: "Unlocks when you complete Intermediate." },
  ];
}
