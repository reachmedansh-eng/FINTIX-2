# FINTIX — Game experience reconstruction

Working record for the game-experience overhaul: what exists, what is weak and why,
what the references taught, the design rules adopted, the plan, and a change log.
Observations are marked **[seen]** (in the running app) or **[code]** (read from source).

---

## 1. System map

| Area | Route | Rendering | Motion | State |
|---|---|---|---|---|
| Opening journey | `/` | DOM + 2D pixel-art world (`WorldCanvas`) | GSAP timelines, `motion/react` (`AnimatePresence` only) | none |
| Sign in | `/enter` | DOM over room artwork | GSAP (push-in exit) | `authClient` (local only, no backend) |
| Home: Living Portfolio | `/home` | DOM + **Three.js** city (`City.tsx`, `architecture.ts`, `nova.ts`) | CSS transitions; the city's own on-demand rAF loop | account, market clock, learning progress |
| Trading desk | `/trade/beginner` (+ `/tutorial`) | DOM, SVG candle chart | CSS transitions/keyframes | account, market clock, sim progress |
| Learning Hub | `/learn/...` | DOM, artwork, SVG labs | CSS | learning progress |
| Holding pages | `/market`, `/activity` | `NotBuilt` | — | — |

**Stack.** Next.js 16 App Router (Turbopack), React 19 (React Compiler lint rules), TypeScript, npm.
Dependencies: `three` 0.186, `gsap` + `@gsap/react`, `motion`. No test runner, no visual-regression tooling.

**One source of truth per concern.**
- *Market*: `trade/engine.ts`. Pure; a price is a function of (asset, market minute); 1 minute = 3 s. Eight assets: NOVA, AERO, VNTA (Vanta), KRON, MEDX (Medix), TERA (Terra), BOLT, LUMA. The brief's VANTA/MEDIX/TERRA are these assets' **names**; the tickers stay as they are, because they are the persisted state contract.
- *Clock*: `trade/clock.ts` (`useMarketMinute`, a `useSyncExternalStore`).
- *Account*: `trade/account.ts`. Paise integers, `localStorage` `fintix.sim.account.v1`, `useSyncExternalStore`, cross-tab `storage` sync. `execute(order)` validates (unknown asset, duplicate id, quantity, cash, shares held) and fills at the confirm-minute price. Average-cost basis; realised P&L on sale.
- *Learning progress*: `learn/progress.ts` (`fintix.learn.v1`). *Sim progress*: `trade/progress.ts`.

**Animation systems.** GSAP (opening and sign-in), `motion/react` (one `AnimatePresence` in the opening), CSS (everything else), Three.js rAF (city). No new animation library is introduced; new DOM motion uses CSS with shared tokens, new 3D motion lives in the city's existing loop.

---

## 2. Baseline (2026-10-19, 1536×830 desktop)

Journey walked: opening → sign in (test account) → empty Home → tutorial → skip → desk → invalid buy → valid buy (120 Nova) → Home (populated) → Learn.

| # | Where | Finding | Kind |
|---|---|---|---|
| B1 | Home city | Console: `PCFSoftShadowMap has been removed` (Three r186). | [seen] defect, minor |
| B2 | Opening/sign-in | Console: 8× `GSAP target not found`. | [seen] noise |
| B3 | Desk | Buy validation, review, fill and persistence all correct: 120 × ₹268.60 = ₹32,232; cash ₹67,768; the review showed ₹268.65 and the fill used the confirm-minute price, as the review warns. | [seen] works |
| B4 | Home ↔ Desk | **Trading means leaving the world.** "Trade Nova" navigates to the desk; the city never shows the consequence of a decision. You come back to a city that was simply rebuilt. | [seen] experience, critical |
| B5 | Home | **Selection diverges.** Picking an owned asset in Market Today shows it in the panel but does not mark its building (`selected` only honours picks from the city). | [code]+[seen] defect |
| B6 | Home | Selecting a building opens a chip over the city *and* re-points the panel: the same figures twice, and the chip covers buildings. | [seen] hierarchy |
| B7 | Home city | Seven of eight buildings are generic procedural styles; only NOVA meets the benchmark. Buildings do not match the approved reference sheet's identities. | [seen] art direction |
| B8 | Home city | Height is linear in share relative to the largest holding (min clamp 0.55): a 2 % position next to a 60 % one is a stub. | [code] readability |
| B9 | Home city | New holdings appear and sold ones vanish instantly; slots jump when the set of holdings changes. No consequential motion. | [code] feedback |
| B10 | Trade | **Persistence failure is silent.** `write()` swallows a storage error and `execute` still reports success, so a trade that will be lost on reload looks saved. | [code] defect, integrity |
| B11 | Desk | After a fill only a text line appears; the summary figures that changed (cash, value) are not drawn attention to. | [seen] feedback |
| B12 | All | Transition timings are ad hoc (100–220 ms, plain `ease`), no shared tokens; Home has no reduced-motion rules. | [code] consistency |
| B13 | Learn ↔ Trade | Lessons and actions are linked only from Home's "Your next step". The review screen says "market order" without linking the lesson that explains it. | [seen] learning integration |
| B14 | Sign-in exit | Seemed slow in the pane; the code is a hold + 0.8 s push. The pane throttles hidden tabs, so this is not a product defect. | [seen] not a defect |

---

## 3. Capability gate

| Need | Available? | Decision |
|---|---|---|
| Run app, screenshots, DOM/console inspection | Built-in browser pane | Used throughout. Pane is ~800 px wide: 1536 px layouts are screenshotted downscaled; true-pixel checks use a canvas capture (see memory notes). |
| Three.js authoring | Yes (library in repo); no dedicated Three.js skill | Procedural modelling in code, as NOVA proved. |
| 3D modelling tool | Blender MCP is listed but needs a running Blender with the add-on | Not needed: procedural geometry meets the benchmark and keeps buildings data-driven. |
| Design guidance | `frontend-design`, `impeccable`, `ui-ux-pro-max` skills (guidance only) | Not loaded; the identity is already established and approved. |
| Visual regression / e2e | Not installed | Optional. Fixed-viewport screenshots + scripted state checks instead. Playwright would need approval. |
| Sound | No audio assets in the repo | Proposal only (§7). Needs assets or a sound tool; not added. |
| Building references | The approved eight-building sheet (supplied 2026-10-19) | Used as the identity source for all eight. |

No essential capability is missing.

---

## 4. Reference matrix

| Ref | Evidence (source, type) | Observed pattern | Principle | Applied to FINTIX (weakness) |
|---|---|---|---|---|
| Invstr | Canstar founder interview; Finder/SmartAsset reviews (secondary; app not accessed) | Academy (bite-sized lessons) and Fantasy Finance (virtual portfolio) presented as one path; beginners start with no knowledge; mistakes are safe | Learning and practice must sit side by side, and a beginner should meet the explanation at the moment of the action | Contextual lesson links at the decision points (review, receipt) — B13 |
| Linear | linear.app/now "How we redesigned the Linear UI" (official, read) | Reduce chrome noise, align everything, one set of component behaviours documented and reused across views; contrast tuned for content | Consistency comes from shared rules, not per-screen styling; restraint over addition | Shared motion and state tokens; one order component used in both Home and Desk — B12, B6 |
| Brawl Stars | Pratt IxD critique (secondary); official site (marketing only) | One dominant action; confirmation screen with a before/after resource comparison before an irreversible upgrade; immediate, legible feedback on input | Feed-forward before commitment, unmistakable confirmation after it; feedback hierarchy follows the action's weight | Review shows before → after; receipt states what actually happened; the city answers a trade — B4, B11 |
| Tiny Tower | Wikipedia; GDC 2011 coverage (secondary; game not played) | The tower *is* the progress: every floor is a visible, themed record of what you built | The world should be the portfolio, and change only when the portfolio changes | Buildings rise/settle/demolish only on real trades; distinct identities per asset — B7, B9 |
| TradingView | Public symbol page (seen directly); Supercharts help (official) | Price, absolute + % change and a timestamp lead; a one-row strip of period returns; news tied to the asset; "Full chart" for depth | Progressive disclosure: the summary answers "what is it doing", depth is one step away | Home panel stays a summary with a link to the desk's full chart; the order flow keeps price and change visible — B4 |

---

## 5. Design specification

**Hierarchy of motion** (each category has its own budget and never competes with another):

| Layer | Purpose | Timing | Examples |
|---|---|---|---|
| Ambient | Atmosphere | none on Home; the city is still until something happens | — |
| Interaction | Acknowledge input, show state | `--t-quick` 120 ms (press, hover), `--t-base` 200 ms (state change) | button press, selection ring, panel mode switch |
| Consequence | Represent a real simulation event | `--t-event` 700–900 ms, once, then still | a building rising for a first buy, growing/shrinking after a trade, lowering on a full sale; changed figures flashing once |

Easing: `--ease-out` `cubic-bezier(.2,.7,.2,1)` for things arriving; `--ease-in-out` for things moving between two places. No overshoot or bounce on financial figures. Reduced motion: every consequence still happens, instantly; flashes become a static outline.

**Rules.**
1. A financial figure is never animated before the state that produces it exists. Consequence motion is driven by the account changing, not by the button press.
2. One selection, everywhere: building, tag, list row, panel and market pick always name the same asset.
3. Feedback states what happened (fill price, quantity, total, cash after, realised P&L), not what was intended.
4. Failure says so: validation in place, execution errors in an alert, a storage failure as a persistent warning.
5. City: no props. Distinct silhouettes per asset, one shared facade system (piers, recessed glass, mullions, spandrels, sparse lit offices), restrained tone accents, pixel-grid letter marks. Form must read with emissive light reduced.
6. Height mapping: `h = 0.9 + (6.4 − 0.9) × (share / largest share)^0.6`. Monotonic (larger share is always taller), compressed so a small position stays readable; the exact share is always printed on the building's tag. The key says "taller = larger share".
7. Camera: fixed isometric; selection eases the view ≤ 0.6 units towards the building. No orbiting, no zoom jumps.

**Preserve:** navbar and wordmark, palette, Retropix/Space Grotesk usage, engine and account rules, desk layout, tutorial, Learning Hub, opening and sign-in.
**Refine:** Home panel (adds an in-place order flow), desk feedback, city lighting and selection.
**Reconstruct:** the seven non-NOVA buildings; consequence motion in the city.
**Retire:** the selection chip (its figures move into the panel), the generic style set.

**Acceptance criteria (checked in the running app).**
- A1 Selecting a building, its tag, its list row or an owned asset in Market Today marks the same building and shows the same asset in the panel.
- A2 A buy or sell made from the Home panel produces a trade identical in effect to one made on the desk (same validation, same fill rule, same storage).
- A3 After a fill: cash, invested, total, holding, allocation, unrealised P&L and Recent Trades all reflect the trade, and the city changes accordingly (new building rises / grows / shrinks / lowers and is removed).
- A4 Invalid quantity, insufficient cash, overselling and duplicate submission are refused with a message; nothing changes.
- A5 If storage fails, the trade is kept for the visit and the player is told it won't survive a reload.
- A6 Reload preserves the account and the city.
- A7 Eight assets have eight recognisably different silhouettes at 1536×830; every building reads with emissive light at its dimmed level.
- A8 Keyboard: every control reachable, visible focus, Escape clears selection; reduced motion removes all eased motion.
- A9 No console errors or warnings from Home.

---

## 6. Plan

| Stage | Scope | Files | Untouched |
|---|---|---|---|
| 1. Foundation | Motion tokens; storage-failure reporting; selection consistency; shadow-map warning | `globals.css`, `account.ts`, `Dashboard.tsx`, `City.tsx` | engine rules |
| 2. Representative journey | Order flow in the Home panel (reusing the desk's `Ticket`/`Review`), receipt, city consequence motion, retire chip | `sections.tsx`, `Dashboard.tsx`, `City.tsx`, `home.css` | desk |
| 3. City reconstruction | Shared tower kit from NOVA; seven new buildings from the reference sheet; pixel letter marks; height mapping; selection framing | `nova.ts` → `towers/*`, `architecture.ts`, `City.tsx` | data contracts |
| 4. Desk feedback and learning | Changed-figure flash, receipt with actual fill, storage warning, contextual lesson links | `Simulator.tsx`, `parts.tsx`, `trade.css` | tutorial, Learn |
| 5. Verification | A1–A9 at 1536×830 and 390 px; empty, single, eight holdings; reduced motion; build | — | — |

---

## 7. Sound (proposal, not implemented)

Restrained, off by default with a visible toggle: a soft tick on selection, a two-note confirmation on a fill (rising for buy, falling for sell), a muted thud for a refused order. Nothing ambient, nothing on price moves. Needs licensed short UI sounds or a sound-design tool; none are in the repo.

---

## 8. Change log

| Stage | Change | Fixes | Files |
|---|---|---|---|
| 1 | Motion tokens (`--t-quick` 120 ms, `--t-base` 200 ms, `--t-event` 800 ms, two easings), zeroed under reduced motion | B12 | `app/globals.css` |
| 1 | `write()` reports failure; `Fill` carries `saved`; `useUnsaved()`; one persistent warning on Home and the desk | B10 | `trade/account.ts`, `trade/parts.tsx` |
| 1 | One selection: an owned asset picked anywhere marks its building | B5 | `home/Dashboard.tsx` |
| 1 | `PCFShadowMap` + radius replaces the removed soft variant | B1 | `home/City.tsx` |
| 2 | Buy/Sell in the Home panel, reusing the desk's `Ticket` and `Review`, ending in a shared `Receipt` (actual fill, total, realised P&L, cash, position, consequence line, lesson link) | B4, B11, B13 | `home/sections.tsx`, `trade/parts.tsx`, `trade/trade.css`, `home/home.css` |
| 2 | City consequence motion: rise for a new holding, timed grow/shrink, come-down and removal on a full sale, glide to new places, a one-second accent and footprint pulse on the traded building; quick settle for price ticks; a return to Home animates from the last-seen heights | B9 | `home/City.tsx` |
| 2 | The city stays mounted with no holdings (empty-state message laid over it), so a first purchase rises in place and a last sale is seen | B9 | `home/Dashboard.tsx`, `home/City.tsx` |
| 2 | Figures changed by a trade made on the page flash once (Home value, invested, cash; desk summary) | B11 | `home/Dashboard.tsx`, `trade/parts.tsx` |
| 2 | Selection chip hidden where the panel sits beside the city (≥1101 px); kept on narrow layouts where the panel is below | B6 | `home/home.css` |
| 2 | Small pan (≤ 0.6 units) towards the selected building; none under reduced motion | spec 7 | `home/City.tsx` |
| 3 | Tower kit distilled from NOVA (facade system, palettes, instanced parts per shape/finish, sky lobbies, lit edges, pixel-grid letter marks, glass drum) | B7 | `home/towers/kit.ts` |
| 3 | Seven new towers from the approved sheet: AERO (drum, helipad, tail fin with A), VANTA (twin towers, sky bridge, red edges, V), KRON (deco setbacks, gold pilasters and bands, spire, K), MEDIX (white clinic, helipad, green cross), TERRA (sandstone terraces, deep balconies, T), BOLT (stepped slabs, lit edges, lightning stroke, B), LUMA (stacked cantilevered boxes, lit edges, L); NOVA ported unchanged except its mark | B7 | `home/towers/*.ts`, `home/architecture.ts` |
| 3 | Height mapping `0.9 + 5.5 × (share / largest)^0.6`; key reads "Taller building = larger share" | B8 | `home/City.tsx`, `home/Dashboard.tsx` |
| 3 | Narrow cities show ticker-only tags (container query) | label occlusion | `home/home.css` |
| 4 | Desk ends a fill with the shared receipt; review links the market-order lesson; summary flashes; storage warning | B10, B11, B13 | `trade/Simulator.tsx` |
| 4 | Escape inside the panel or a field no longer clears the selection (it was discarding a half-entered order) | found in testing | `home/Dashboard.tsx` |

**Removed:** the generic style set and old `home/nova.ts` (superseded by `towers/`), the desk's text-only success line.

## 9. Verification (2026-10-19)

| Check | Result |
|---|---|
| A1 selection consistency (building click, tag via keyboard Enter, market pick of an owned asset, Escape) | Pass |
| A2/A3 Home buy 40 Nova: ₹67,768 − 40 × ₹256.35 = ₹57,514; cost basis ₹42,486; flash; building selected and pulsed | Pass |
| A3 Home buy into a new asset (Kron) — building rises, tag appears; sell all 30: proceeds ₹9,498, realised +₹3.00, cash ₹57,517, building comes down, tag removed, Nova glides back | Pass |
| A3 first purchase from an empty portfolio rises in the city; empty message disappears | Pass |
| A3 desk buy: receipt with actual fill, summary flash, Transactions tab | Pass |
| A4 oversell (45 of 30) and over-cash orders refused with a message; duplicate ids refused by `execute` | Pass |
| A5 storage refused (simulated): trade kept for the visit, storage unchanged, warning shown | Pass |
| A6 reload keeps account and city | Pass |
| A7 eight distinct silhouettes at 1536×830; all eight legible at 2 % share; form reads dimmed | Pass |
| A8 keyboard selection, visible focus styles unchanged | Pass. Reduced motion: code paths verified (tweens skipped, tokens zeroed); not emulated in the browser |
| A9 Home console | Clean |
| Layout | 1536×830, 1024×768, 375×812: no horizontal overflow |
| Performance | 8 buildings: 138 draw calls incl. shadow pass, ~19.6k triangles, ~4.7 ms median frame (GPU-synchronised, DPR 1.25); frames only while moving |
| Build | `tsc`, `eslint`, `next build` pass |

**Not done / limits.** Reduced motion was not emulated in the browser pane. Real touch devices were not tested. Mid-animation frames could not be captured reliably because the pane pauses hidden tabs; the rise/come-down were seen partly in progress. Two console warnings remain on the opening/sign-in routes (GSAP "target not found"), left untouched as out of scope. Sound is proposed only.

---

## 10. Home & Simulator UI/UX refinement (2026-10-19, second pass)

**Problems found (baseline at 1536×864 and 390×844).**
- Home did not answer "am I making money overall?" (no total P&L since the start) or "what do I own?" without switching to a hidden List view; the left column ended half-way down the page.
- The asset panel lacked the ticker and the holding's value; the selection chip repeated the panel.
- Desk: four equal summary cards; no ticker, no current-price reference on the chart; the ticket showed no consequences until review; Home and the desk each ran their own copy of the order state machine.
- Desk on phones: summary cards (~400 px) and the full market list came first; the chart started at ~1,190 px and the order at ~1,790 px.
- Order preview figures were computed in the review component, separately from execution.

**Changes.**
| Area | Change | Files |
|---|---|---|
| Engine | `quote()` prices and checks an order (field, reason, fix) and returns cash and shares before/after, holding value and realised P&L; `execute()` now fills via the same quote, so preview and fill cannot disagree | `trade/account.ts` |
| Shared order flow | `OrderFlow`: edit → review → placing (both actions disabled; leaving cancels) → receipt, or error with Edit / Try again. Used by Home and the desk | `trade/order.tsx` |
| Ticket | Validation from the engine with fix hints; `Max`/`All` shortcut; "After: cash · shares" estimate; Sell disabled with a stated reason; Enter reviews | `trade/parts.tsx` |
| Review | Estimate labelled as such; cash and shares before → after; holding value after; estimated realised P&L for sales | `trade/parts.tsx` |
| Shared parts | `AssetHeading` (name, ticker, sector, ownership, price, arrowed change), `PositionFacts` (shares, value, average cost, unrealised P&L, share), `Segments` (every period/size picker) | `trade/parts.tsx` |
| Chart | Current-price line and axis tag (the price the ticket quotes); tap and arrow-key inspection; grouped price labels; fallback when history is missing | `trade/charts.tsx` |
| Desk | Compact account strip (5 figures, no cards); chart in the centre with the position beneath; sticky order panel; market list becomes a horizontal asset strip below 1240 px; phones: shorter chart, "Place an order" jump, position after the order, table trimmed to four columns | `trade/Simulator.tsx`, `trade/trade.css`, `lib/useMediaQuery.ts` |
| Home | Overview: value, change with period control, cash and total P&L since the start, invested; holdings ledger (value, P&L %, weight; selects in step with the city); city; asset panel with heading, chart, position and Buy/Sell in place; City/List switch and chip retired | `home/Dashboard.tsx`, `home/sections.tsx`, `home/home.css` |
| City | Depth fog sized to the city, cool ground glow, rim light on roofs, gentler dimming, warm gold light over the selected building, gold footprint and tag (gold = selected, as in the ledger) | `home/City.tsx` |

**Verified.** Home buy (10 Kron): cash ₹37,440 → ₹34,437, Kron 40 → 50, cost ₹15,323, review estimate = fill. Double-clicked Confirm: one trade. Cash removed mid-review: review re-quotes, explains, blocks Confirm; restored, re-enabled. Desk sell (20 Terra): proceeds ₹1,298, realised −₹102 (estimate = fill), cost ₹5,600, total realised ₹150 → ₹48. Validation messages for over-cash, zero and oversell. Selection consistent across ledger, city tag, building and panel. Tutorial reaches its order step with the shared ticket. Layouts at 1536×864, 1024×768, 390×844, 360×800: no page overflow (the holdings table scrolls inside its own frame). Order panel on a 360 px phone starts at 1,073 px (was ~1,790). Console clean on Home. `tsc`, `eslint`, `next build` pass.

**Limits.** Reduced motion verified in code only. Real touch devices not tested. "Placing order…" is a deliberate 320 ms pause (0 with reduced motion); execution itself is instant and local.

## 11. Premium refinement with the Taste Skill (2026-10-20, third pass)

Run with the installed `design-taste-frontend` skill, following `references/app-screens.md` (app screens, not the page run). Before shots and reports: `.taste-skill/before/{home,home-empty,trade}/`. The inspector opens a fresh browser, so a wrapper (`inspect-seeded.mjs`, in the session scratchpad) put a test account in storage first: six holdings bought through the real engine's past prices, ₹69,907.40 cash, ₹26.50 realised.

### 11.1 Critique of the before (inspector + screenshots)

Inspector: Home 2 FAIL / 5 WARN, desk 3 FAIL / 4 WARN, source lint 3 FAIL / 23 WARN.

1. **Every label is a tracked uppercase kicker** (FAIL `micro-label`, 8 on Home, 10 on the desk): "PORTFOLIO VALUE", "CASH AVAILABLE", "YOUR HOLDINGS", plus an eyebrow over the desk title. The labels shout louder than the figures they name.
2. **Gradient grounds** (FAIL `gradient`): a radial blue wash behind every simulator page and another behind the city.
3. **One card for everything.** The market list, the chart, the order ticket, the asset panel and the three support blocks are all the same navy box with a bright 6:1 blue border (WARN `heavy-borders`). An asset selector, a chart and an order ticket look like one component with different contents.
4. **Colour on chrome, not on data.** Filled blue segmented controls (ranges, candle sizes, gainers/fallers), a filled Buy tab, Buy and Sell both filled side by side on Home (two primaries), a rainbow of asset hues on ledger weight bars, and green or red on almost every number.
5. **Letter-in-a-square asset marks** (WARN `icon-chips`): the commonest generated-dashboard tell, and the product has something far better (each asset is a building).
6. **The desk's figures have no lead**: five account figures at one size, the asset price at 30px, nothing deciding what is read first.
7. **Home's support row is the stock three-up card row**, below the fold (WARN `below-fold`: 2 of 5 blocks on the first 1440×900 screen) with 150-222px voids inside two cards (WARN `panel-void`).
8. **The desk's columns end ragged** by 224-257px (WARN `ragged-row`), because every column is a framed card of a different height.
9. **States are thin**: the disabled Review button is a dim blue slab with no reason beside it; the busy state is only a label change.
10. **City tags are oversized** (13px rounded *up* to the next pixel-font step renders 24px at a 1.0 pixel ratio) and cover the roofs; the ground glow is a saturated blue disc that reads as a platform.

### 11.2 Direction

Style dealt: **`data-terminal`** (seed 323655143), chosen over `true-black-flat` because FINTIX is an instrument worked in for long sessions and keeps a navy foundation. **The move kept intact: every selection is the same accent line** on the nearest edge (tabs, ranges, candle sizes, the selected asset's row, the panel of the selected building), numbers carry their sign in the text. The accent line is **FINTIX gold** (the coin in the wordmark), already the selection colour of the city.

Not taken from the sheet, with reasons: the icon-rail shell (it would replace the navbar, which is out of scope); Public Sans and a monospace (`--keep type`: Space Grotesk and Retropix are the brand's two faces); the sheet's greys and blue (`--keep palette`: mapped onto the style's roles below).

- **Home's question:** "What is my portfolio worth now, and what is it made of?" The biggest block is the city (each holding drawn at its share); the biggest figure is the portfolio value. **Finding:** the holding that moved the portfolio most today, stated under the value.
- **Desk's question:** "What is this asset doing, and what will my order do to my account?" The biggest block is the chart; the biggest figure is the asset price; the order console is always in view.
- **Face:** the gold selection line, and **every asset drawn as its own building**: a pixel silhouette of its approved tower is its mark in every list, so a row, a tag and a building are one object.
- **Signature element:** the portfolio city with its ledger, and on the desk the order's consequence for that building (its share of holdings before and after).

### 11.3 Plan

1. Tokens in `globals.css`: spacing scale, type scale, surfaces by tone step (sunk, ground, panel, raised), three line strengths, text tiers at 4.5:1 or more, accent roles (select, buy, sell, up, down), one radius (square, the pixel heritage), elevation only for what floats, motion as before.
2. Control system in `trade.css`, shared by Home, the desk and the tutorial: primary key (flat fill, a darker key edge that presses down), secondary outline, tertiary text link, icon button, side switch, segmented and tabs (gold line), inset quantity well, selectable rows, disabled-with-reason, busy, success and error.
3. Surfaces by role: open (lists, the account strip, support band, the desk's lower tabs), framed instrument (the chart), layered console (the order), integrated (position facts inside the chart panel), one framed panel on Home (the selected asset).
4. Home: visible h1, 40px value with the finding, a three-row key list, open ledger with silhouettes, city on the ground, panel with one primary (Buy) and a secondary Sell, support band as three open columns on the first screen.
5. Desk: header without eyebrow, strip with a lead figure, open watchlist, framed chart, layered console, open lower tabs; review adds share of holdings before and after (from `quote()`).
6. City: smaller tags, a quieter neutral pool, a contact shadow under every building, more controlled emissive, tighter framing.
7. Inspect after into `.taste-skill/after/`, compare, fix the worst three, at most three rounds; verify flows and the four sizes; tsc, eslint, build.

### 11.4 Change log

- **Tokens** (`globals.css`): spacing `--sp-*` (4px base), type `--fs-*` (12/13/14/15/16/20/30/40), surfaces `--fx-sunk/ground/panel/raised/lift`, lines `--fx-rule/line/control/control-hi`, text `--fx-text/muted/faint` (all at least 4.5:1 on every surface), accent roles (`--fx-select` gold, buy, sell, up, down and their tints), control heights, `--fx-float` (the only shadow). Button fills moved one shade deeper (#1d6ae0, #7a45f0) so white labels pass 4.5:1; brand blue stays on lines and data.
- **Marks** (`ui.tsx`): every asset's mark is now a 16-pixel silhouette of its approved tower (Nova's sheared roof and blade, Aero's drum and fin, Vanta's twins and bridge, Kron's spire, Medix's slab and cross, Terra's terraces, Bolt's staircase and strike, Luma's drawers), replacing the letter in a tinted square.
- **Controls** (`trade.css`, rebuilt): primary key with a darker edge that presses down; outline secondary; `sell-line` secondary; `data-size="s"` tools; `.sim-link` tertiary with a moving arrow; segmented choices and tabs marked by the gold line; the buy/sell switch underlined in its side's colour; a sunk quantity well with a two-pixel cyan focus ring and a red error ring; disabled keys legible with the reason printed under them; a three-pixel busy indicator while an order is placed; inline error and success blocks.
- **Desk** (`Simulator.tsx`): noun title with one plain sentence (no eyebrow); account strip with the total leading; open market list; framed chart with the position read in one row straight under the price; raised order console (sticky); lower tabs with counts, lists open on the ground. 861–1240px: the market becomes a 4×2 grid of tiles; ≤860px: one column, order straight after the chart, a sideways strip of assets. Phone holdings table becomes two-line rows.
- **Order lifecycle**: review carries its side and adds **share of holdings before → after** (`quote().share`, computed in `account.ts`); the confirm key shows a busy state; a disabled review key explains itself.
- **Home** (`Dashboard.tsx`, `sections.tsx`, `home.css`, rebuilt): visible h1, 40px value, the day's finding (`biggestEffect()` in `portfolio.ts`: the holding with the largest weighted move, stated as its move and share, never as an attributed rupee amount), cash / invested / total P&L as a ruled key list with the percentage stacked under the figure, open ledger with silhouettes and a grey share bar (gold when selected), city on the page ground, one framed panel with a gold top edge when it shows the selected building, Buy as the key and Sell as a purple outline, support row as three open columns separated by rules.
- **City** (`City.tsx`): neutral, fainter ground pool; a contact shadow under every building; emissive windows 0.55 → 0.46 at rest (0.7 selected, 0.22 dimmed) and accents 1.1 → 0.9 so facades keep their material; tighter framing, the city stood at the foot of its box with the spare height as sky, the front ground margin (only needed for shadows, which fall away from the viewer) framed closer; nameplates at the pixel grid's 12px step (they had been rounding up to 24px at a 1.0 pixel ratio).
- **Tutorial and levels**: carried onto the tokens; "Step 03" and "01" lose their zero padding; the level picker loses its eyebrow.

### 11.5 Verification (2026-10-20)

- **Taste Skill inspector** (`--app`, seeded account): Home 2 FAIL / 5 WARN → 0 FAIL / 1 WARN; desk 3 FAIL / 4 WARN → 0 FAIL / 1 WARN; Home first run 2 FAIL / 4 WARN → 0 FAIL / 1 WARN; tutorial 0 FAIL / 2 WARN. The remaining warning on every screen is `palette-cream` for `--white` #f4f2ec, the brand's white from the supplied wordmark artwork, kept on purpose. The tutorial's extra `colour-sprawl` is the supplied Neo room picture.
- **Taste Skill lint**: 3 FAIL / 23 WARN → 0 FAIL / 3 WARN: zero-padding in the market clock (a time, which the rule allows) and two context lines above tutorial titles (the step counter and the intro). Three shadows that are floating overlays or the 3D sun carry `taste-skill-ignore` with the reason.
- **Order lifecycle, real pixels** (`.taste-skill/after/states/`): Home buy of 5 Medix at ₹530.30: cost ₹2,651.50, cash ₹69,907.40 → ₹67,255.90, 12 → 17 shares, cost basis 616,140 + 265,150 = 881,290 paise, share 20.3% → 26.5% in both review and receipt; Confirm clicked twice placed one trade. Desk sale of 5 Terra at ₹69.60: proceeds ₹348.00, realised +₹17.50 (34,800 − 33,050 paise) in estimate and fill, realised total ₹26.50 → ₹44.00, the tab moved to Transactions; after a reload the strip read ₹70,255.40 + ₹31,057.70 = ₹1,01,313.10. Over-cash and over-holding orders were refused beside the field with the key disabled and the reason printed.
- **Sizes** 1536×864, 1024×768, 390×844, 360×800 on both screens: no page overflow, no clipped figure; city plates and tertiary links raised to the 24px minimum target after the first run flagged them.
- **Keyboard and motion**: a real Tab walk reaches every control in reading order with a 2px cyan ring (the quantity well rings as a whole); with reduced motion the motion tokens are 0s, transitions 1ms, and an order goes straight to its receipt with no animation.
- `tsc --noEmit`, `eslint src` and `next build` pass.
- Not verified: real touch devices and screen readers (accessible names were read from the DOM only).
