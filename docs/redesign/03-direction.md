# FINTIX redesign — 03 Direction

## Thesis

**Your city is the portfolio; the HUD is its treasury.** Home is a world view: the city fills the first screen and the financial HUD sits on its edges, the way a city-builder shows funds and alerts around the map. The desk is a **trading floor inside that city**: the chart is the work surface, the ticket is the one console you act from, and before you confirm, the ticket shows what the order will do to your city.

Idea sentence (Taste Skill): *On the desk, the player's skyline becomes the order ticket's consequence preview: the traded asset's tower drawn at its share before and after the order.* Competitor test: no other trading simulator has this city, so the sentence fails for them.

## Plan review against the generic default

| First instinct | Why it's the default | Revised to |
|---|---|---|
| Hero value in bold Space Grotesk with a green delta pill | Every fintech home | The treasury counter in **Retropix at 48 px** (4× its grid) with fixed digit cells, a signed change that names its baseline, no pill |
| Cash / Invested / P&L as three KPI rows | KPI strip | A **pixel split meter** (50 blocks, 2% each) of invested vs cash, and P/L as unrealised + realised that sum to the hero change |
| Market movers as a card with gainers/fallers tabs | News-card dashboard | **Market pulse**: all eight assets ranked by today's move, a diverging bar each, owned assets marked |
| Asset tabs as pills | Brokerage kit | The **skyline switcher**: each asset as its own tower mark, one accent line under the chosen one |
| Review screen before confirm | Brokerage kit | One ticket with live consequences and a confirm button that states the order |

## Layouts

### Home (`/home`)

```
≥1180 px                                                     navbar (locked)
┌────────────────────────────────────────────────────────────────────────┐
│ YOUR CITY (px h1)                                    MARKET PULSE (px)  │
│ ₹99,366.20  (Retropix 48)                            story · 8 rows    │
│ ▼ −₹633.80 (−0.63%) since ₹1,00,000                  diverging bars     │
│ today ▲ +₹266.50 · 1D 1W 1M 3M 1Y          CITY      ── or, when an     │
│ [■■■■■■■■■■■■■■■□□□□□□□…] invested │ cash    (full   asset is chosen ─ │
│ P/L  unrealised −₹623.80 + realised −₹10.00 stage)   ASSET PANEL       │
│ HOLDINGS (px)  6 rows, linked to the city             (the one surface) │
├────────────────────────────────────────────────────────────────────────┤
│ dock: ACTIVITY last 3 fills · Full history │ NEXT LESSON one contextual │
└────────────────────────────────────────────────────────────────────────┘
```

- **Dominant**: the city (canvas under the whole stage; camera fitted into the area the HUD leaves free).
- **Secondary**: treasury (top-left), holdings (left), pulse / asset panel (right).
- **Contextual**: the asset panel (appears on selection), lesson notes, the first-run prompt.
- **761–1179**: left HUD + city; pulse moves into the dock; the asset panel opens as a drawer over the city's right side when an asset is chosen (the camera reframes so the chosen building stays visible).
- **≤760**: city band (≈56% of the screen) with the treasury over its sky → split meter and P/L → holdings → asset panel (in flow) → pulse → activity → lesson.

### Desk (`/trade/beginner`)

```
≥1100 px
┌────────────────────────────────────────────────────────────────────────┐
│ TRADING FLOOR (px h1) · prices simulated   Portfolio ₹… Cash ₹…  tools │
│ [▙ NOVA ₹262.45 +1.96%] [▟ AERO …] … eight towers = the skyline switcher│
│ NOVA (px 36)  Technology · you own 14         ₹262.45 (40)  ▲ +₹5.05 … │
│ ┌ legend: Day 5,853 21:35  O H L C  +0.35 ──────── 5m 15m 1h 1D ┐ ┌────┐│
│ │                    chart, no frame, crosshair + axis tags      │ │TICK││
│ │                                                       axis →   │ │-ET ││
│ └ time axis ──────────────────────────────────────────────────── ┘ └────┘│
│ YOUR POSITION 14 sh · avg ₹240.45 · value · unrealised · 12.5% of city  │
│ Recent fills · Holdings · Market news (tabs)                           │
└────────────────────────────────────────────────────────────────────────┘
```

- **Dominant**: chart (≥ a third of the first screen at 1440, visible at 1024).
- **Contained**: the ticket (sticky).
- **Telemetry**: switcher, position strip, tabs.
- **≤1099**: switcher scrolls sideways; ticket under the chart.
- **≤640**: chart 240 px, ticket in flow, tables become two-line rows.

## Tokens

Established FINTIX values win over the brief's table where they conflict (conflicts noted):

| Brief role | Brief hex | FINTIX value used | Conflict / reason |
|---|---|---|---|
| bg-0 | #080D1A | `--ink #02031a` | Established ground (supplied artwork is the colour authority) |
| bg-1 | #0D1426 | `--fx-panel #070b24` | Established step |
| surface | #141D31 | `--fx-raised #0e1536`, `--fx-lift #141d45` | Established steps |
| accent | #4388FF | lines/text `--blue #2a7cf6`; key fill `#1d6ae0` | White on #4388FF is 3.38:1 (fails AA); #1d6ae0 is 5.01:1 |
| accent-2 | #8865F7 | `--purple #8f5bff`; sell fill `#7a45f0` | White on #8865F7 is 4.0:1 (fails); #7a45f0 is 5.33:1 |
| gold | #F4C76A | `--gold #f4b63a` | Wordmark gold |
| text-1/2/3 | #F4F6FC / #A0ABC0 / #69758C | `#f4f2ec` / `#aab2d4` / `#8089b4` | #69758C is 3.95:1 on bg-1 (fails 4.5) |
| up / down | #43C98B / #F16C79 | **adopted** `#43c98b` / `#f16c79` | Not brand-locked; calmer than the old #2fd38f; 8.45 / 6.07:1 on raised |
| control outline | — | `#4d5ea6` (was #34427e) | Old value 2.16:1, under the 3:1 for a field boundary |

Colour jobs:
- **Accent blue** marks every interface selection (2 px line), the focus ring and the primary key.
- **Gold** means *yours*: the invested share, the selected holding (row, plate, ring, light), progression.
- **Purple** means selling.
- **Green and red** mean gained and lost, always with a sign.

Type:
- **Retropix** at grid multiples via `round(down, N, var(--snap))`:
  - 12 for region titles, plates and tickers;
  - 24 for screen titles;
  - 36 for the desk asset name;
  - 48 for the treasury.
- **Space Grotesk**:
  - 11 / 600 / +0.08em uppercase for figure labels only (the brief's rule; never above a heading);
  - 13 for meta;
  - 14 for body and rows;
  - 16 for names;
  - 20 for figures;
  - 40 / 600 for the desk price.
- Tabular figures on every number.

Spacing is on a 4 px base: 4 / 8 / 12 / 16 / 24 / 32 / 48. The HUD inset is 24 px (16 on a phone). Corners are square.

## Motion tokens

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | enter, press, indicator |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | on-screen moves (camera reframe) |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | panel / drawer |
| `--t-press` | 120 ms | key press |
| `--t-quick` | 160 ms | hover, focus, colour |
| `--t-base` | 240 ms | selection change, sliding indicator |
| `--t-panel` | 300 ms (exit 200) | panel / drawer / route enter |
| `--t-count` | 450 ms | figure counting after a trade |
| `--t-event` | 800 ms | city consequence |

Reduced motion keeps opacity and colour (shortened) and removes travel, counting and ambient city motion.

## Components

**Create**:
- `OrderTicket` (side switch, quantity field, quick fill, consequences, city-impact skyline, decision notes, confirm states)
- `SkylineSwitcher`
- `PriceChart` upgrades (legend line, crosshair, ticks)
- `Treasury`
- `SplitMeter`
- `MarketPulse`
- `ActivityStrip`
- `NextLesson` (contextual)
- `Explain` (inline dismissible note)
- `Figure` (counts on trade-caused changes)
- `PixelNumber` (Retropix digits in fixed cells)
- notes store (`hints.ts`)

**Refactor**:
- `OrderFlow` (edit + confirm in one ticket, then receipt)
- `AssetHeading`
- `AssetPanel`
- `City` (inset-aware camera, view tween, hover response, ambient window lights, empty lot)
- `Segments` (sliding indicator)
- formatters (Intl en-IN, U+2212)

**Retire from the desk and Home**: `Watchlist`, `Summary` strip, `Review` and the old `Ticket`. All four stay in the tutorial, which still teaches the review step.

## Three biggest structural changes

- **Home**:
  1. The city becomes the stage under a HUD.
  2. The treasury models value = cash + invested and P/L = unrealised + realised.
  3. The lower row becomes the market pulse (right) and the activity / lesson dock (bottom).
- **Desk**:
  1. The chart moves up and loses its frame (skyline switcher on top, account line in the header).
  2. One ticket with live consequences replaces ticket + review.
  3. The ticket previews the order's effect on the city.

## As built (changes made during the build and the two refinement loops)

- Home ≥1180: the next lesson sits at the foot of the right column under the market pulse, and the dock carries only the activity strip, so Home fits 1440 × 900 exactly. The pulse gained a breadth line.
- Home 761–1179: the chosen asset's panel takes the left HUD's slot while it is open, instead of a right-hand drawer; the city keeps its framing. The pulse is a 4 × 2 grid in the dock.
- The city carries its owner's name: "Medansh's city" (the signed-in first name), in Retropix.
- The floor: fills, holdings and news sit in the chart's column, beside a ticket that stays in view down the whole column.
- The review step is gone from the floor and Home: the ticket shows every consequence before confirming, and the press fills the order with no delay before the trade. The tutorial keeps its review step, because it teaches it.
- Milestones no longer include "Complete 3 trades": the brief rewards understanding, not trading frequency. "Hold 3 different assets" and "Make your first sale" remain.
