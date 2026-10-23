# Motion plans (improve-animations)

Written from the motion audit in `docs/redesign/01-audit.md` §4, at commit `e4f7ca8`.

| # | Plan | Severity | Status |
|---|---|---|---|
| 001 | Strong motion tokens and a full duration scale | LOW | DONE |
| 002 | Key press with a transform, not layout | MEDIUM | DONE |
| 003 | Reduced motion keeps colour and opacity | MEDIUM | DONE |
| 004 | Gate hover-only motion to fine pointers | MEDIUM | DONE |
| 005 | One sliding indicator for segmented choices and Buy/Sell | LOW | DONE |

Order: 001 first (every other plan uses its tokens), then 002–004 (independent), then 005 (needs 001 and the reduced-motion rule from 003).

All five were executed during the redesign itself (stage 5 commit `d19af99`, motion pass `1a523d6`) rather than by a separate agent, and checked in the browser: press without layout shift, colour/opacity kept under reduced motion, hover motion gated, one sliding line per segmented control. See `docs/redesign/04-verification.md`.
