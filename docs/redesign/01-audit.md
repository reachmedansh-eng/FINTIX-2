# FINTIX redesign — 01 Audit

Stage 1 of the redesign brief (`FINTIX_REDESIGN_BRIEF.md`), written from the code, not from route names.
Baseline commit: `e4f7ca8` (the repository was not under git; it was initialised for this brief so every stage can be reverted).

## 1. Stack, routing, structure

| | Verified in `package.json` / code |
|---|---|
| Framework | Next.js **16.3.6** (App Router, Turbopack dev), React **19.2.8**, TypeScript 5 |
| 3D | three **0.186.1** (dynamic `import("three")` inside `City.tsx`) |
| Animation libraries | gsap **3.15**, @gsap/react **2.1.2**, motion **14** — used **only** by onboarding and sign-in (`src/features/onboarding`, `src/features/auth`). Home and the simulator use CSS transitions and one `requestAnimationFrame` loop in `City.tsx`. |
| Styling | Plain CSS per feature (`home.css`, `trade.css`), tokens in `src/app/globals.css`. Class prefixes are unique per stylesheet (`hm-`, `sim-`, `desk-`, `tut-`, `lvl-`) because route CSS stays loaded after client navigation. |
| Tests | None (no test script, no runner). |
| Backend | None. Account, sim progress and learning progress live in `localStorage`. |

Routes that matter here: `/home` → `features/home/Dashboard.tsx`; `/trade` → `Levels.tsx`; `/trade/beginner` → `Simulator.tsx` (redirects to the tutorial on a first visit); `/trade/beginner/tutorial` → `Tutorial.tsx`; `/learn/[module]/[lesson]` lessons.

Shared shell: `features/shell/SiteNav.tsx` (wordmark, Home/Learn/Trade, account menu; **locked**), rendered by `Dashboard` and by `trade/SimShell.tsx`.

### Files behind the two screens

- **Home**: `home/Dashboard.tsx` (layout, overview, ledger), `home/sections.tsx` (AssetPanel, MarketToday, NextStep, RecentTrades), `home/portfolio.ts` (holdings, `worthAt`, ranges, movers, milestones), `home/City.tsx` (Three.js scene), `home/architecture.ts` + `home/towers/*.ts` (eight approved towers on a shared kit), `home/home.css`.
- **Simulator**: `trade/Simulator.tsx` (desk layout), `trade/parts.tsx` (Watchlist, AssetHeading, PositionFacts, Segments, AssetView, Ticket, Review, Receipt, Summary, Holdings, Trades, News), `trade/order.tsx` (OrderFlow state machine), `trade/charts.tsx` (SVG CandleChart, Anatomy), `trade/ui.tsx` (money formatters, tower `Mark`, `Glyph`, Neo), `trade/engine.ts` (market), `trade/account.ts` (account), `trade/clock.ts`, `trade/progress.ts`, `trade/Tutorial.tsx`, `trade/Levels.tsx`, `trade/trade.css` (2,412 lines; also styles the tutorial and level picker).

### Fonts

- **Retropix**: `public/fonts/retropix.woff2` (2.8 KB), `@font-face` in `globals.css`, preloaded in `layout.tsx`. Drawn on a 12-unit grid; `--snap = 12px / --dpr` keeps sizes on whole device pixels (`--dpr` written by an inline script). Measured in the browser: it **has** digits, `, . % + - / : ( ) ? ! &` and both cases; it **lacks** `₹ − × · ▲ ▼ →`. Its digits are proportional (`1` = 13.8 px, others 21.8 px at 48 px), so a Retropix figure needs fixed digit cells to stay steady.
- **Space Grotesk**: `src/app/fonts/SpaceGrotesk-Variable.woff2` via `next/font/local` (`--font-grotesk`). `font-variant-numeric: tabular-nums` **does** change its digit widths (ten 1s: 167 px proportional → 248 px tabular), so tabular figures are real.

## 2. City (3D) implementation

- Orthographic isometric camera from the +x/+z corner (`VIEW {1, 0.72, 1}`), fitted to the lots in use plus the tallest possible building; the city stands at the foot of its box.
- One building per holding; height `0.9 + 5.5 × (share/largest)^0.6`; placement by value, largest at the back; positions glide when the set of holdings changes.
- Lighting: hemisphere + warm key light with PCF shadows (2048 map), cool fill and rim, a gold spotlight over the selected building, PMREM night-sky environment, neutral tone mapping, distance fog.
- Labels are real HTML buttons projected over the roofs every frame (keyboard and screen-reader access); hover tooltip; click selects; empty click / Escape deselects.
- **Performance**: frames are drawn only while something moves (rise, glide, pulse, pan); nothing renders at rest. A WebGL failure shows a text fallback.
- **Motion**: price ticks ease heights in 260 ms; trades rise/shrink over 900 ms with a 1.2 s accent pulse; reduced motion makes every change instant. No ambient life and no hover response on buildings (cursor + tooltip only).
- The canvas exists only inside the middle grid column (`.hm-city-wrap`, min-height 560 px).

## 3. Data flow

| Flow | Where | Notes |
|---|---|---|
| Price simulation | `engine.ts` | Pure function of (asset, minute). One market minute = 3 s real time from 2026-01-01 UTC. Layered noise + scheduled news events. 5-paise tick. |
| Clock | `clock.ts` `useMarketMinute()` | `useSyncExternalStore`, ticks on the minute boundary; null on the server. |
| Account | `account.ts` | Whole paise. `quote()` is the single pricing/validation function (ticket estimate, review, fill). `execute()` re-quotes at the confirm minute, rejects reused order ids. `value()` gives positions, invested, unrealised, realised, cash, total. Identity verified from the code: `total − ₹1,00,000 = unrealised + realised` (no fees). |
| Persistence | `localStorage` `fintix.sim.account.v1`, `fintix.sim.progress.v1`, `fintix.learn.v1`; `sessionStorage` `fintix.city.seen.v1` | Storage refusal is surfaced by `useUnsaved()`. |
| Asset selection | Desk: local state, seeded from `?asset=`; Home: `pick` state, one selection shared by ledger, city and panel. |
| Order placement | `order.tsx` OrderFlow: edit → review (id minted) → placing (320 ms, 0 with reduced motion) → done / error. |
| History | `account.trades` newest first; Home shows 3, desk lists all. |
| Learning links | `parts.tsx` `LESSONS` (market order, position, realised); Home `useLesson()` picks the next unfinished lesson; lesson pages open directly whatever the module locks. |

## 4. Motion audit (improve-animations, recon + vetted findings)

Recon: plain CSS transitions on tokens `--t-quick 120ms`, `--t-base 200ms`, `--t-event 800ms`, `--ease-out cubic-bezier(0.2,0.7,0.2,1)`, `--ease-in-out cubic-bezier(0.6,0,0.3,1)`, used only by `home.css` and `trade.css`. Personality: a crisp tool. Frequency map: price ticks every 3 s (thousands a day), list/tab/segment selection (tens a day), trades (occasional), tutorial (rare).

| # | Severity | Category | Location | Finding | Fix summary |
|---|---|---|---|---|---|
| 1 | MEDIUM | Physicality / performance | `trade.css` `.sim-button:active` (≈ line 178) | Press feedback changes `margin-top`, `min-height` and `border-bottom-width`. On `quiet`/`sell-line` variants only `min-height` shrinks, so the button loses 2 px and anything below it jumps. | Press with `transform: translateY(2px)` and the edge colour; no layout properties. |
| 2 | MEDIUM | Accessibility | `trade.css` reduced-motion block (≈ line 2405) and `globals.css` | Reduced motion forces `animation: none` and `transition-duration: 1ms` on everything and zeroes every token: all colour/opacity feedback disappears too. | Keep opacity/colour transitions; drop transforms and travel. |
| 3 | MEDIUM | Accessibility | `.sim-seg button:hover::after`, `.sim-link[data-go]:hover .sim-glyph` | Hover-only motion (underline reveal, arrow nudge) is not gated; touch devices keep it stuck after a tap. | Gate behind `@media (hover: hover) and (pointer: fine)`. |
| 4 | LOW | Easing & tokens | `globals.css` motion tokens | Curves weaker than the house targets; the city's JS easing is a separate cubic. | `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`, add `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`. |
| 5 | LOW | Purpose / frequency | `[data-flash]` keyed remounts | Consequence cue is a background pulse on a remounted element; the figure itself jumps to the new value. | Count the figure on trade-caused changes only, with a short highlight; ticks stay instant. |

Correct as is (not reported): price ticks and chart redraws are instant (right for a 3 s update); the busy dots use `steps()`; city consequences run only on real account changes and honour reduced motion.

Missed opportunities: (a) Buy/Sell and segmented choices appear in place with no sliding indicator (no spatial continuity); (b) Home ↔ desk navigation teleports; (c) switching asset on the desk swaps header and chart instantly; (d) building hover has no in-world response.

## 5. Responsive behaviour and accessibility (as found)

- Home: 3 columns ≥1181 px, 2 columns + panel below ≤1180, single column ≤760 (value → city → ledger → panel → support).
- Desk: 248 / 1fr / 360 grid; ≤1240 watchlist becomes a 4-column tile grid; ≤860 single column with a sideways strip; ≤640 the holdings table should become two-line rows.
- Focus: visible cyan ring on every control (`.sim` scope); global ring is gold. Labels and `aria-live` on the quantity help are present. Reduced motion handled (too aggressively, finding 2).
- Contrast: every text tier passes 4.5:1. **Control outlines** (`--fx-control #34427e`) are **2.16:1** on the ground — under the 3:1 needed for the quantity field's boundary.

## 6. Screens at 1440, 1024, 390 (before)

Captured with a seeded test account (six holdings, seven trades, built through the real engine prices) and with a fresh account: `docs/redesign/shots/before/` (`*-full.jpg` are full pages; `empty/` is the first run). Measured on the first screen:

| Screen | Width | City / chart share of the first screen | Page height | Retropix on screen |
|---|---|---|---|---|
| Home | 1440 | city 35% | 1,276 px | title, 6 city plates |
| Home | 1024 | city 55% (single column below the overview) | 1,898 px | same |
| Home | 390 | city 34% (starts at y≈540) | 2,864 px | same |
| Desk | 1440 | chart 16% | 1,367 px | title, ticker plate |
| Desk | 1024 | **chart 0% — entirely below the fold** | 1,626 px | same |
| Desk | 390 | chart 8% | 2,371 px | same |

## 7. Diagnosis: symptom → root cause → structural fix

### Home

1. **Too many separate regions; the city doesn't dominate.** The screen is three columns (overview + ledger | city | framed panel) and a second row of three columns below the fold; the city takes 35% of the first screen at 1440 and is pushed below the figures on a phone. → The layout is a page grid in which the city is one column among equals with a fixed 560 px minimum, and the canvas only exists inside that column. → **Make the city the stage**: one canvas under the whole first screen, the camera fitted into the area the HUD leaves free, HUD regions anchored to its edges, and the lower row folded into a dock on the same screen.
2. **Weak relationship between value, cash, invested and P/L.** Four figures listed as independent rows; nothing shows that value = cash + invested or that the change since start = unrealised + realised. → Figures are KPIs, not a model. → **Treasury block**: the hero value with its signed change since ₹1,00,000; a split meter of invested vs cash with both parts labelled; P/L split into unrealised + realised that visibly sum to the hero change.
3. **Generic three-column lower section.** Market today (news card + gainers/fallers), Your next step (course card + milestone), Recent trades (3 rows), equal widths, below the fold. → One block per data source, not per question. → **Market pulse** as telemetry (all eight assets ranked by today's move, a diverging bar each, latest simulated story on top) in the right HUD column; **recent activity** as a ledger strip in the bottom dock; **one contextual lesson** chosen from what the player holds or just did.
4. **Inconsistent spacing.** 24/32 grid gaps, 12/16/20 inner padding, a city caption floating at the bottom, different left edges per region. → Spacing set per component. → One HUD inset (24 px desktop, 16 px phone) for every edge-anchored region and an 8 px internal rhythm.
5. **First run is a void.** "Your city starts here" text over nothing. → The city draws nothing without holdings. → Draw the empty lot on the ground and anchor the first-run prompt to it, inside the world.
6. **Gold is everywhere.** Gold marks tabs, ranges, segments, rows, plates and the panel edge. → One colour was used for every selection. → Accent line for interface selection; gold only for ownership (the selected holding, the invested share) and progression.
7. **Retropix barely present** (one title and the plates). → **Treasury figure, region titles and the city's name in Retropix**, sized on its grid.

### Simulator

1. **Too many bordered panels competing.** Summary strip with rules, framed chart panel, framed order console, market column; on a phone also a framed position card. → Every block is a `.sim-block`. → Chart on the ground with no frame; **one contained surface, the order ticket**; everything else telemetry rows.
2. **Chart and selected asset aren't dominant.** 16% of the first screen at 1440, **0% at 1024**. → Title, a five-cell summary strip, the position facts and a caption all sit above the chart, and the market column takes 248 px. → Asset switcher as a top strip (the skyline of tower marks), position under the chart, account figures folded into the header line, chart height taken from the viewport.
3. **Generic order controls.** Input and consequences are split across two screens (ticket, then review); Buy/Sell are two tabs; the button says "Review buy order". → The review step holds the consequences. → **One ticket**: sliding Buy/Sell switch, stepper with keyboard arrows and quick-fill, live cost / cash before→after / position before→after / portfolio impact, and a confirm button that states the order ("Buy 15 NOVA · ₹3,936.75").
4. **Weak data readability.** Uneven y ticks (267.40, 265.96 …), three time labels, a floating readout box that covers candles, hyphens for negatives. → Axis values are raw fractions of the range; the readout floats over the plot. → Round ticks, 4–6 time labels, a crosshair with axis tags and an OHLC legend line inside the chart's top edge, true minus signs, tabular figures.
5. **Game identity disappears.** Only the title and ticker plates are pixel type; nothing says "a floor in your city". → Identity was confined to the title. → "Trading floor" screen label, the asset name in Retropix, the switcher as the city's skyline, the ticket's city-impact skyline.
6. **Phone holdings table clipped at the right edge** (390, `desk-390-full.jpg`). → The table keeps its desktop min-width inside a scroll frame. → Two-line rows below 640 px.
7. **Decimal quantities silently change meaning.** Typing `2.5` gives 25 shares: non-digits are stripped as they are typed. → The sanitiser rewrites instead of validating. → Keep what was typed and say "Shares come whole: 2 or 3, not 2.5"; confirm stays disabled.

### Both

- **Unrefined interaction states**: layout-property press (motion finding 1), ungated hover (3), focus ring not in the accent the brief asks for.
- **Purposeless or missing motion**: reduced motion removes all feedback (2); no route transition; asset switches teleport; trade consequences don't count or connect cause to effect.
- **Shallow gamification**: the desk never shows the world; a trade on the desk has no visible consequence until Home is opened.

## 8. Regression checklist (works today; retested at the end)

Home: (1) value = cash + invested; P&L = value − ₹1,00,000. (2) 1D–1Y change replays trades (`worthAt`). (3) Biggest-effect finding. (4) Ledger ↔ city one selection; Escape / empty click deselects. (5) Buildings per holding, height by share, plates are keyboard buttons, hover tip. (6) Trades rise/grow/shrink/remove buildings; returning shows changes since last visit. (7) WebGL failure fallback. (8) Asset panel: pick / largest / top mover, chart frames, position, Buy/Sell in place, desk link. (9) In-panel order to receipt with city consequence line. (10) Market news story and movers select an asset. (11) Lesson link and milestone. (12) Recent trades + "View all" → `/trade/beginner?tab=trades`. (13) Unsaved notice. (14) First-run prompt and empty ledger link.

Desk: (15) First visit → tutorial unless done/skipped. (16) `?asset=` and `?tab=trades`. (17) Asset selection, candle sizes, readout by pointer/keys. (18) Buy/Sell (Sell disabled with reason when not owned), quantity, steppers, Max/All, inline validation (over cash, over holding, zero/empty). (19) Confirm → placing → receipt; refused fill → retry; double click → one trade. (20) Fill at the confirm-minute price; account persists across reload. (21) Account figures update and highlight after a trade. (22) Holdings (pick), Transactions, Market news (pick). (23) Replay tutorial, Ask Neo. (24) Unsaved notice.

Tutorial: (25) Every step to a real first trade, back, skip, replay.

Cross: (26) Navbar links and account menu. (27) Lesson links open lessons. (28) Reduced motion. (29) No horizontal overflow at 1440 / 1024 / 390.

## 9. Skills loaded (Stage 2)

All five were found in the installed skills list (`.claude/skills/` → `.agents/skills/`, and the `frontend-design` plugin) and read in full, including `design-taste-frontend/references/app-screens.md`, `improve-animations/AUDIT.md` + `PLAN-TEMPLATE.md` and `animate/RECIPES.md`.

**frontend-design** (rules applied):
1. Ground every choice in the subject: a city you own and a trading floor inside it, not a generic fintech dashboard.
2. Spend boldness in one place per screen: the city + the Retropix treasury on Home; the chart + the asset name on the desk. Everything else quiet.
3. Plan tokens, type roles and layout in ASCII first, then review the plan against "what I'd produce for any similar page" before coding (done in `03-direction.md`).
4. Copy says exactly what happens: the confirm button names the order; errors name the fix; empty states invite the next action.
5. Motion only answers actions or marks a real event; no scattered entrances.

**design-taste-frontend** (app-screen run; style dealt `data-terminal`, seed **1591973444**, `--keep palette,type`):
1. Each screen answers one question with its biggest block (Home: "What is my city worth and why?"; desk: "What is this asset doing and what will my order do?").
2. The style's move, kept intact: **every interface selection is the same accent line**; numbers carry their sign in the text.
3. Colour on data, status and the one action; no gradients, glows, or icons in tinted squares; one hue on the main data element.
4. Data tells the truth: totals from parts as displayed, every relative figure names its baseline ("since you started with ₹1,00,000", "today"), zeros printed, missing values a grey dash.
5. The face and the signature element: the face is the accent line from FINTIX's own palette; the signature element is the city (Home) and the city-impact skyline in the ticket (desk). The dealt icon-rail shell is **not** taken: the brief locks the navbar.

**emil-design-eng** (rules applied):
1. Frequency decides: price ticks (every 3 s) and keyboard actions never animate; selection changes are fast and subtle; trades (occasional) get the consequence animation.
2. Strong custom curves, never `ease-in`; UI motion under 300 ms.
3. Pressables respond on press; each control type with its own response (the key sinks onto its edge, segments slide, rows tint).
4. Transitions, not keyframes, for anything that can be retriggered; exits faster than entrances.
5. Hover motion gated to fine pointers; reduced motion keeps opacity/colour and drops travel.

**improve-animations**: findings table above (§4); top findings turned into self-contained plans in `plans/` and executed during the build (the skill's executor step was done in this session rather than by a separate agent, because the brief asks for the work to be done here).

**animate** (rules applied while building):
1. Gate first: tier and purpose named for every animation before writing it.
2. Cheapest tool: CSS transitions / `@starting-style` / WAAPI; no Motion or GSAP added to these screens.
3. Only `transform` and `opacity` (plus `clip-path`), never `scale(0)`; the sliding indicator is a transform.
4. Values from the tables: press 100–160 ms, small state 150–200 ms, indicator 200–300 ms, panel 250–350 ms (exit faster), number change 300–500 ms.
5. Reduced motion and hover gating ship with each animation.
