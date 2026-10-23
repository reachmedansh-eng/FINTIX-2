"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** The window's inner height, live. 0 on the server. For sizes that must be known in script (a chart drawn to fill the screen). */
export const useViewportHeight = () =>
  useSyncExternalStore(
    subscribe,
    () => window.innerHeight,
    () => 0,
  );
