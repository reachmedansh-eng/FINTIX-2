"use client";

import { useSyncExternalStore } from "react";

/**
 * Short explanations shown at the moment of a decision (one holding
 * outweighing the rest, a large order, a sale that locks in a result). Each
 * can be dismissed, and stays dismissed in this browser, so a note teaches
 * once and never nags. Kept apart from the account: dismissing a note can't
 * touch money.
 */

export type NoteKind = "concentration" | "size" | "realise";

const KEY = "fintix.sim.notes.v1";
const EMPTY: NoteKind[] = [];
let cache: NoteKind[] | null = null;
const listeners = new Set<() => void>();

function read(): NoteKind[] {
  if (cache) return cache;
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(stored) ? (stored as NoteKind[]) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
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

/** The notes this player has dismissed. Empty on the server. */
export const useDismissedNotes = () => useSyncExternalStore(subscribe, read, () => EMPTY);

export function dismissNote(kind: NoteKind) {
  const next = [...new Set([...read(), kind])];
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full disk: the note stays dismissed for this visit only.
  }
  listeners.forEach((listener) => listener());
}
