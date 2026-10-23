/**
 * The onboarding in one place: its scenes, its words, and the camera's path
 * through the artwork. Timeline positions are percentages of the whole scroll.
 */

/** Where "Enter FINTIX" leads. */
export const PRODUCT_ROUTE = "/enter";

/** Height of the scroll track, in viewport heights. More is slower. */
export const SCROLL_LENGTH = { landscape: 1000, portrait: 880 } as const;

export type SceneId =
  | "fintix"
  | "understand"
  | "learn"
  | "capital"
  | "explore"
  | "simulate"
  | "build"
  | "arrive";

/**
 * The eight scenes. `at` is where each one takes over the scene marker, and
 * `rest` is the point where it is fully on screen (where the marker jumps to).
 */
export const SCENES: { id: SceneId; name: string; at: number; rest: number }[] = [
  { id: "fintix", name: "FINTIX", at: 0, rest: 0 },
  { id: "understand", name: "UNDERSTAND", at: 6, rest: 15 },
  { id: "learn", name: "LEARN", at: 20, rest: 35 },
  { id: "capital", name: "CAPITAL", at: 39, rest: 47.5 },
  { id: "explore", name: "EXPLORE", at: 52, rest: 61 },
  { id: "simulate", name: "SIMULATE", at: 64.5, rest: 71 },
  { id: "build", name: "BUILD", at: 74, rest: 83.5 },
  { id: "arrive", name: "ARRIVE", at: 88.5, rest: 100 },
];

export const COPY = {
  wordmarkAlt: "FINTIX — The Financial Simulator",
  scroll: "SCROLL",
  skip: "Skip intro",
  understand: {
    title: ["UNDERSTAND THE MARKET.", "BEFORE YOU TRADE IT."],
    body: "FINTIX is where teenagers learn how financial markets work: through interactive lessons, open market exploration and decisions made in simulation.",
  },
  learn: {
    title: ["LEARN WHAT MOVES", "A MARKET."],
    concepts: [
      { word: "RISK", note: "What a decision could cost you." },
      { word: "RETURN", note: "What it could give back." },
      { word: "VOLATILITY", note: "How sharply a price swings." },
      { word: "DIVERSIFICATION", note: "Spreading out, so one fall can't sink you." },
      { word: "MARKET BEHAVIOUR", note: "How buyers and sellers move a price." },
    ],
  },
  capital: {
    title: ["START WITH", "VIRTUAL CAPITAL."],
    body: "FINTIX hands you virtual capital, so every decision is practice. Explore, experiment and learn without risking real money.",
  },
  explore: {
    title: ["EXPLORE.", "ANALYSE.", "UNDERSTAND."],
    body: "Look into assets, watch how prices move and learn to read the conditions behind them. Analysis is a skill, and this is where you build it.",
    fragments: [
      { label: "EQUITY", value: "+0.84%", up: true },
      { label: "GOLD", value: "+0.31%", up: true },
      { label: "BOND", value: "-0.12%", up: false },
      { label: "INDEX", value: "+1.06%", up: true },
    ],
  },
  simulate: {
    title: ["PRACTISE BEFORE", "IT BECOMES REAL."],
    body: "Simulate decisions, observe outcomes and learn how market movements affect your portfolio. Some will go well. Some won't. Both teach you.",
  },
  build: {
    title: ["FINANCIAL", "KNOWLEDGE,", "BUILT ONE DECISION", "AT A TIME."],
    body: "FINTIX turns complex financial ideas into something you can explore, test and actually understand.",
  },
  arrive: {
    title: ["YOUR MARKET.", "YOUR DECISIONS.", "YOUR JOURNEY."],
    action: "ENTER FINTIX",
    note: "Simulated markets. Virtual capital. No real money.",
  },
} as const;

/* ------------------------------------------------------------------ */
/* Camera path                                                         */
/* ------------------------------------------------------------------ */

/**
 * One stop on the camera's way down the artwork.
 *  - `row` is a row of the artwork, and `anchor` is where on the screen that
 *    row should sit (0 top, 0.5 middle, 1 bottom). Framing by anchor keeps a
 *    subject in the same place on every screen shape.
 *  - `column` is the artwork column to centre on when the screen is too
 *    narrow to show the art edge to edge.
 */
export type Stop = { at: number; row: number; anchor: number; column: number };

export const CAMERA_PATH: Stop[] = [
  // FINTIX: the skyline, from the very top of the artwork.
  { at: 0, row: 0, anchor: 0, column: 291 },
  { at: 4, row: 0, anchor: 0, column: 291 },
  // UNDERSTAND: the waterline rises to the upper third; reflections fill the frame.
  { at: 13, row: 244, anchor: 0.34, column: 291 },
  { at: 19, row: 297, anchor: 0.3, column: 291 },
  // LEARN: down through the water into the dark.
  { at: 28, row: 481, anchor: 0.5, column: 281 },
  { at: 37, row: 625, anchor: 0.55, column: 281 },
  // CAPITAL: the briefcase.
  { at: 44, row: 838, anchor: 0.5, column: 153 },
  { at: 50, row: 852, anchor: 0.5, column: 153 },
  // EXPLORE: the trading floor.
  { at: 57, row: 1145, anchor: 0.5, column: 276 },
  { at: 63, row: 1174, anchor: 0.5, column: 276 },
  // SIMULATE: the dark seam between the trading floor and the bedroom.
  { at: 68, row: 1327, anchor: 0.5, column: 307 },
  { at: 72, row: 1350, anchor: 0.5, column: 307 },
  // BUILD: the bedroom.
  { at: 79, row: 1491, anchor: 0.5, column: 337 },
  { at: 86, row: 1513, anchor: 0.5, column: 337 },
  // ARRIVE: FINTIX city, down to the last row of the artwork.
  { at: 94, row: 2048, anchor: 1, column: 278 },
  { at: 100, row: 2048, anchor: 1, column: 278 },
];

