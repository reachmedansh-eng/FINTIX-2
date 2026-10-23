"use client";

import { useSyncExternalStore } from "react";

/**
 * Learning progress, kept in this browser only. Like the prototype sign-in,
 * it sits behind a small surface (read, mark, reset) so a real backend can
 * take over later without the screens changing.
 */

export type Progress = {
  /** "module-slug/lesson-slug" for every lesson finished. */
  lessons: string[];
  /** Module slugs whose final challenge has been passed. */
  challenges: string[];
  /** Preview switch: opens every module without completing the ones before. */
  preview: boolean;
};

const KEY = "fintix.learn.v1";
const EMPTY: Progress = { lessons: [], challenges: [], preview: false };

let cache: Progress | null = null;
const listeners = new Set<() => void>();

function read(): Progress {
  if (cache) return cache;
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    cache = stored && Array.isArray(stored.lessons) && Array.isArray(stored.challenges) ? { ...EMPTY, ...stored } : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache as Progress;
}

function write(next: Progress) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full disk: progress then lasts for this visit only.
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

export const useProgress = () => useSyncExternalStore(subscribe, read, () => EMPTY);

export const progress = {
  finishLesson(module: string, lesson: string) {
    const key = `${module}/${lesson}`;
    const now = read();
    if (!now.lessons.includes(key)) write({ ...now, lessons: [...now.lessons, key] });
  },
  passChallenge(module: string) {
    const now = read();
    if (!now.challenges.includes(module)) write({ ...now, challenges: [...now.challenges, module] });
  },
  setPreview(preview: boolean) {
    write({ ...read(), preview });
  },
  reset() {
    write({ ...EMPTY, preview: read().preview });
  },
};
