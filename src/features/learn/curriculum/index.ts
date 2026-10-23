import type { Progress } from "../progress";
import type { Module } from "../types";
import { whatIsTrading } from "./m1";
import { makingATrade } from "./m2";
import { howMarketsMove } from "./m3";
import { understandingAssets } from "./m4";
import { risk } from "./m5";

/** The five modules, in the order a learner meets them. */
export const MODULES: Module[] = [whatIsTrading, makingATrade, howMarketsMove, understandingAssets, risk];

export const moduleBySlug = (slug: string) => MODULES.find((entry) => entry.slug === slug);

/** A module opens once the one before it is complete (or when preview is on). */
export const isUnlocked = (index: number, state: Progress) => index === 0 || state.preview || state.challenges.includes(MODULES[index - 1].slug);

export const lessonsDone = (entry: Module, state: Progress) => entry.lessons.filter((lesson) => state.lessons.includes(`${entry.slug}/${lesson.slug}`)).length;

/** Share of a module finished, counting the final challenge as one more step. */
export const moduleProgress = (entry: Module, state: Progress) =>
  Math.round(((lessonsDone(entry, state) + (state.challenges.includes(entry.slug) ? 1 : 0)) / (entry.lessons.length + 1)) * 100);
