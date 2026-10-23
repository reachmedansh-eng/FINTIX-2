import type { ComponentType } from "react";

export type NeoMood = "celebrate" | "think" | "explain" | "wave" | "neutral";

/** Every interactive receives one callback: call it once the learner has done the thing the lesson asks. */
export type LabProps = { onGoal: () => void };

export type Lesson = {
  slug: string;
  title: string;
  /** One or two sentences. The interaction carries the rest. */
  lede: string;
  /** Vocabulary the lesson introduces: term, then meaning. */
  terms?: [term: string, meaning: string][];
  formula?: string;
  /** What the learner is asked to try in the interactive. */
  goal: string;
  takeaway: string;
  /** Neo only appears where he has something to add. */
  neo?: { mood: NeoMood; line: string; done?: string };
  Lab: ComponentType<LabProps>;
};

export type Question =
  | { kind: "number"; prompt: string; answer: number; unit?: "₹" | "%" | "shares" | "×"; hint: string; explain: string }
  | { kind: "choice"; prompt: string; options: string[]; answer: number; hint: string; explain: string }
  | { kind: "order"; prompt: string; steps: string[]; hint: string; explain: string };

export type Challenge = {
  /** The situation, as short lines. */
  scenario: string[];
  /** Figures the learner may need, laid out beside the questions. */
  facts?: [label: string, value: string][];
  book?: { bids: number[]; asks: number[] };
  questions: Question[];
  neo: { intro: string; pass: string };
};

export type Module = {
  id: string;
  slug: string;
  title: string;
  /** Short line under the title on the hub. */
  tagline: string;
  description: string;
  /** The module's one illustration, and where the framed tile sits inside the supplied file. */
  art: { src: string; width: number; height: number; tile: [x: number, y: number, width: number, height: number] };
  minutes: number;
  level: string;
  neo: string;
  lessons: Lesson[];
  challenge: Challenge;
  /** What the completion screen says the learner now understands. */
  learned: string[];
};
