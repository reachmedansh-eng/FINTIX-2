# 001 — Replace the motion tokens with strong curves and a full duration scale

- **Status**: DONE (executed in this session; see commits d19af99 and 1a523d6)
- **Commit**: e4f7ca8
- **Severity**: LOW
- **Category**: Easing & duration / Cohesion & tokens
- **Estimated scope**: 1 file (`src/app/globals.css`), ~15 lines

## Problem

`src/app/globals.css` (motion block, ≈ lines 56–60) defines weak curves and only three durations:

```css
--t-quick: 120ms;
--t-base: 200ms;
--t-event: 800ms;
--ease-out: cubic-bezier(0.2, 0.7, 0.2, 1);
--ease-in-out: cubic-bezier(0.6, 0, 0.3, 1);
```

The curves lack the punch of a deliberate UI ease-out, and there is no token for press feedback, panels or counting figures, so later work would hand-type values.

## Target

```css
--t-press: 120ms;   /* key press */
--t-quick: 160ms;   /* hover, focus, colour */
--t-base: 240ms;    /* selection change, sliding indicator */
--t-panel: 300ms;   /* panel / drawer / route enter (exit uses --t-quick + 40ms) */
--t-count: 450ms;   /* a figure counting after a trade */
--t-event: 800ms;   /* a consequence in the city */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

## Repo conventions to follow

Tokens live in `:root` of `src/app/globals.css`; only `src/features/home/home.css` and `src/features/trade/trade.css` read them (verified with grep).

## Steps

1. Replace the five motion lines in `:root` with the target block.
2. In the `prefers-reduced-motion` block of `globals.css`, keep `--t-quick` and `--t-base` at `120ms` (colour/opacity still transition) and set `--t-press`, `--t-panel`, `--t-count`, `--t-event` to `0ms`.

## Boundaries

- Do NOT touch onboarding, auth or learn styles. Do NOT add dependencies.

## Verification

- **Mechanical**: `npx tsc --noEmit` and `npx eslint` clean; `next build` passes.
- **Feel check**: hover a segmented option and a list row: colour settles in about 160 ms with a quick start, no lag at the beginning. With reduced motion emulated, colours still change smoothly; nothing travels.
- **Done when**: no hand-typed cubic-bezier remains in `home.css` / `trade.css`.
