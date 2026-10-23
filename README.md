# FINTIX — The Financial Simulator

FINTIX teaches teenagers how financial markets work through interactive lessons, a simulated market and a
city that grows from your own portfolio. Every rupee is virtual and every price is simulated: no real money,
no live markets.

**Live site:** https://reachmedansh-eng.github.io/FINTIX-2/

## What's inside

- **Onboarding**: a scroll journey through the FINTIX world, then sign-in (a local test account is available).
- **Home**: your portfolio as a 3D city on a turning plaza, the treasury, the market pulse, simulated news,
  your next lesson and a ledger of every trade.
- **Learning Hub**: five modules of short lessons and challenges.
- **Trading floor**: a beginner trading simulator with a guided tutorial, candle charts and an order ticket.

Everything runs in the browser: the account and progress are kept in your browser's local storage.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Deploying

Every push to `main` builds a static export and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`). On GitHub, Settings → Pages → Source must be set to "GitHub Actions".

Built with Next.js, React, TypeScript and Three.js.
