"use client";

import { useSyncExternalStore } from "react";

/** Follows a CSS media query, live. False on the server. For sizes that must be known in script (a chart's drawn height). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
