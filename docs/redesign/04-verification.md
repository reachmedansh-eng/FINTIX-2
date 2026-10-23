# FINTIX redesign — 04 Verification and refinement

Everything below was run against the dev server (`next dev`, port 3000) on 21 Oct 2026, in headless Chrome driven over CDP (the Taste Skill's `lib/cdp.mjs`), with a test account built through the real engine prices (six holdings, seven trades) or a fresh account. Scripts lived in the session scratchpad, outside the project.

## Mechanical checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass. The installed agent-skill folders (`.agents/`, `.claude/`, `.taste-skill/`) are now in ESLint's ignores; their own scripts had 6 errors and 14 warnings, none in `src/`. |
| `next build` | Pass, 80/80 pages |
| Taste Skill lint (`--app`, home + trade) | 0 FAIL, 4 WARN: `padStart` in the clock (times) ×2; the tutorial's step counter and intro line ×2 (outside this redesign) |

## Taste Skill inspector (`--app`, seeded account)

| Screen | Start of this brief (end of the previous pass) | Final |
|---|---|---|
| Home | 0 FAIL / 1 WARN | 0 FAIL / 3 WARN with `--allow micro-label` |
| Trading floor | 0 FAIL / 1 WARN | 0 FAIL / 2 WARN with `--allow micro-label` |
| Home, first run | 0 FAIL / 1 WARN | 0 FAIL / 2 WARN with `--allow micro-label` |

- `micro-label` is **allowed, not fixed**. The brief requires figure labels that are "smaller, uppercase and tracked". Without the allowance the inspector fails 4 such labels on Home and 9 on the floor. All of them use one class, `.sim-cap` in `trade.css`, so sentence case is a one-rule change if preferred.
- `palette-cream`: the brand white #f4f2ec from the supplied wordmark (kept, as before).
- `mixed-font-headline`: the treasury figure's ₹ comes from Space Grotesk because Retropix has no ₹ glyph (measured).
- `tiny-text` (46–51% under 13 px): HUD labels and sublines; data rows are 13–15 px.

## Composition (first screen, measured)

| | 1440 before → after | 1024 before → after | 390 before → after |
|---|---|---|---|
| Home: city's share of the first screen | 35% → **93%** | 55% → 91% | 34% → 62% |
| Floor: chart's share of the first screen | 16% → **33%** | **0% (below the fold) → 24%** | 8% → 26% |
| Home at 1440×900: every block on one screen | no (support row below the fold) | **yes** (page height 900) | |

Screens: `docs/redesign/shots/before/` and `docs/redesign/shots/after/` (`*-full.jpg` are full pages, `empty/` first run, `after/states/` selection, tablet panel, live ticket, sell ticket, receipt, first run).

## Regression checklist (from 01-audit §8)

| # | Workflow | How | Result |
|---|---|---|---|
| 1 | Home value = cash + invested; change since start = value − ₹1,00,000 = unrealised + realised | Parsed the displayed figures | Pass, exact to the paisa |
| 2 | Period change (1D–1Y) | Clicked 1W | Pass ("this week", replayed trades) |
| 3 | Biggest-effect finding | Read | Pass |
| 4 | One selection: ledger row ↔ building plate; Escape clears | Clicked row, then plate, then Escape | Pass |
| 5 | Plates are named keyboard buttons | Read roles and names | Pass |
| 6 | A purchase raises a building | Bought 2 Bolt from Home | Pass (plates 6 → 7, "Bolt is now a building in your city") |
| 7 | WebGL failure fallback | — | **Not tested** (code path unchanged) |
| 8 | Asset panel from pulse, city, holdings | Clicked | Pass |
| 9 | Order in the panel to receipt | Scripted | Pass, new fill lit in the dock |
| 10 | Market story selects its asset | Clicked | Pass |
| 11 | Lesson link | Followed the contextual link | Pass (lesson page renders) |
| 12 | Full history → `?tab=trades` | Followed | Pass (Recent fills selected) |
| 13/24 | Storage refused | `setItem` made to throw, then a trade | Pass (warning + receipt note; trade counts for the visit) |
| 14 | First run | Fresh account | Pass (lot drawn, prompt over it) |
| 15 | First visit → tutorial | Fresh progress | Pass |
| 16 | `?asset=` and `?tab=` deep links | Opened | Pass |
| 17 | Asset selection, candle sizes, readout by pointer and keys | Clicked; arrow keys on the skyline (selects and focuses, no animation) | Pass |
| 18 | Buy/Sell, quantity, steppers, quick fills, validation | Scripted: empty, 0, 2.5, −3, letters, 99,999, over-holding | Pass, each with its own sentence |
| 19 | Confirm → receipt; refused fill → retry; double press → one trade | Scripted; clock moved forward between render and press | Pass (see defect 1) |
| 20 | Fill at the press-minute price; persistence across reload | Cash fell by exactly the trade total; reload | Pass |
| 21 | Account figures update after a trade | Sampled the cash figure | Pass (counts 450 ms; instant with reduced motion) |
| 22 | Holdings, fills, news tabs | Clicked | Pass |
| 23 | Replay tutorial, Ask Neo | Clicked | Pass |
| 25 | Tutorial to a real first trade | Scripted all 13 moments | Pass (0 → 1 trade, `tutorialDone`) |
| 26 | Navigation keeps state; navbar and account menu | Client navigation desk → Home | Pass |
| 27 | Lesson links | See 11 | Pass |
| 28 | Reduced motion | Emulated | Pass (route fade only, indicators jump, no counting, receipt immediate, city ambient off by code) |
| 29 | No horizontal overflow at 1440 / 1024 / 390 | Measured on both screens | Pass |

Keyboard: a 34-stop Tab walk on the floor showed the accent focus ring on every control, in order: navbar, header tools, skyline (one stop, roving), candle sizes, chart, position "?", ticket (side, quantity well, steppers, quick fills, confirm when enabled), tabs, list rows. Console: no errors or exceptions in any run.

## Defects found by verification and fixed

1. **Double press placed two trades** when both clicks arrived in one task (the second ran on a stale closure). Fixed with a ref that stays set after a fill until a new order starts; re-tested: 7 → 8 trades.
2. **The count overshot on its first frame** (a frame timestamp earlier than the count's start gave negative progress: ₹70,019 shown above the old ₹69,937). Clamped; re-sampled monotonic.
3. **Tablet market tape reached the screen edge** (inspector `edge-text`): now a 4 × 2 grid with nothing past the edge.
4. **Tablet panel squeezed the city to ≈280 px**: the panel now takes the left HUD's slot while open; the city keeps its framing.
5. **Chart legend wrapped over the plot** on narrow charts: the band grows, and below 420 px the stamp moves to the crosshair's time tag.
6. **Last-price tag touched a tick label**: clearance widened to 20 px.
7. **Home's side column stretched the stage** with an order open (page 924 px): size containment; it scrolls inside the column.
8. **Phone first-run prompt vanished** (grid placement override): fixed.

## Refinement loops

**Round 1** (after the first full build), three most consequential problems:
1. The tablet dock: the tape overflowed and the fills were cramped. The tape became a 4 × 2 grid and the fills stack one per line.
2. Identity: the city had no name, and Retropix was 4% of the floor. The city is now "Medansh's city" (the signed-in first name) in Retropix, and the position heading uses the pixel voice.
3. The desktop dock spread three fills across 1,376 px. Each fill is now held to 360 px.

**Round 2**:
1. The floor's holdings table stretched to 1,376 px, with voids between names and figures. Fills, holdings and news moved into the chart's column, beside the sticky ticket. Source order stays chart → ticket → lists, so the phone's order and focus order match.
2. The market pulse column had a dead band. It gained a breadth line ("2 up, 6 down of 8 assets today", from the same moves) and a roomier row pitch.
3. The ticket's empty "after" values competed with real figures. Missing values are now a quiet grey dash.

## Not verified

- Real phones and tablets: all touch checks were emulated.
- Screen readers: labels, roles and live regions were inspected in the DOM, not heard.
- Safari and Firefox: only Chromium was used.
- The WebGL-failure fallback.
- Frame-rate profiling of the city's ambient loop. By design it draws one frame every 4.2 s, and only while the city is visible and the tab is shown.
