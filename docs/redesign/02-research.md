# FINTIX redesign — 02 Research

Stage 3, time-boxed (about 20 minutes of browsing in the built-in browser, 20 Oct 2026). Principles only: no layout, colour or component arrangement is copied from any reference.

## What was opened

| Source | Result |
|---|---|
| linear.app | Opened (home page and its product fragment). |
| tradingview.com/chart | Opened; crosshair and legend behaviour checked by hovering the chart. |
| invstr.com | Opened (redirects to app.invstr.com landing). |
| Tiny Tower | NimbleBit's game not playable here; read the Wikipedia article. |
| HUD conventions | Wikipedia "HUD (video games)"; Wikipedia "Cities: Skylines" (gameplay). |
| gameuidatabase.com | **Blocked** by a Cloudflare bot check; not bypassed. No principle taken. |
| mobbin.com | **Blocked** (403). No principle taken. |
| godly.website | Redirects to recent.design (a thumbnail gallery). Nothing specific taken beyond the chrome-recedes observation below. |
| awwwards.com sites of the day | Index opened; thumbnails lazy-loaded and no individual site was studied inside the time box. **No principle taken.** |
| supercell.com Brawl Stars | Opened; the page shows key art and a phone screenshot only. Button and reward *response* could not be observed there; the row below rests on how the game's buttons are widely known to behave, and is marked as such. |

## Principles

| Reference | Principle that makes it work | FINTIX problem it solves | How FINTIX adapts it in its own way |
|---|---|---|---|
| TradingView chart | The chart is the canvas: no frame around the plot; the price axis on the right carries the last price as a tag; the crosshair labels its own price on the axis and its date on the time axis; the hovered candle's O/H/L/C sits in a legend line at the chart's top-left, so no readout ever covers a candle. | The desk's floating readout box covers the candles it describes; uneven ticks; chart boxed in. | FINTIX's own SVG chart gets a legend line inside its top edge (the hovered or forming candle, with its simulated day and time), a dashed crosshair with a price tag on the axis and a time tag on the base, round ticks, and no frame. Keyboard arrows drive the same crosshair. |
| TradingView watchlist / symbol box | Price and change share one line in tabular figures with true minus signs; the selected symbol is an outline, everything else stays quiet. | Weak data readability; hyphens for negatives. | One shared en-IN formatter with U+2212 minus and signed percentages; selection as FINTIX's single accent line. |
| Linear | Hierarchy by brightness steps and a little colour, not by boxes; the product itself is the hero; interactions are instant and keyboard-first. | Too many framed panels; generic dashboard grammar. | Navy tone steps instead of frames; one contained surface per screen (the ticket / the asset panel); keyboard support on the switcher, Buy/Sell and quantity; no decorative motion on frequent actions. |
| Invstr | The education layer talks about *your* portfolio in plain words ("up 1.7% today, driven mostly by your technology holdings … a single day rarely tells you much") and never recommends a trade. | The next-lesson block is a generic course card; P/L concepts appear without explanation. | One contextual lesson chosen from what the player holds or just did (concentration → Diversification, a sale → Realised vs unrealised, a buy → Understanding a position), plus short dismissible notes at the moment of decision, each linking an existing lesson; never a recommendation. |
| Tiny Tower (Wikipedia) | The tower *is* the interface: every floor is a business you own, progress is visible as height, a tap on the world opens its details, and the HUD is a thin strip of counters. | The city is one column among equals; the HUD and the world are separate products. | The city fills the first screen; the treasury and holdings sit on its edges as HUD; selecting a building opens its panel; building height keeps meaning "share of your portfolio". |
| HUD (video games) | Static HUD elements live at the screen edges so the world stays visible; a *dynamic* HUD shows information only when it becomes relevant; diegetic information lives in the world itself. | Everything on Home is shown at once at equal weight. | Edge-anchored regions (treasury top-left, market pulse right, dock bottom); the asset panel appears when an asset is chosen and returns to the pulse when closed; share and selection are drawn in the world (height, plate, light). |
| Cities: Skylines (Wikipedia) | The game starts with a plot of land and a starting amount of money; development is visible in the buildings. | The first run shows a void. | The first run draws the empty lot on the ground beside ₹1,00,000 of virtual money, with the first-purchase prompt anchored to it. |
| Brawl Stars (button feel; *not observed on the visited page*) | Buttons are physical: the face drops onto its own edge instantly on press and springs back on release; rewards are reserved for rare moments. | Generic press states (and a layout-shifting press on outline buttons). | FINTIX's key already stands on an edge; the press becomes a transform (face down 2 px, edge absorbed) at 120 ms, with no bounce. No reward animation for trading frequency (the brief rewards understanding). |
| recent.design (Godly) | The work carries the colour; the gallery chrome is small monochrome text. | Colour spread across chrome. | Colour only on data, the one action and ownership. |
