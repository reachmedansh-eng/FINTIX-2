# 005 — One sliding indicator for segmented choices and Buy/Sell

- **Status**: DONE (executed in this session; see commits d19af99 and 1a523d6)
- **Commit**: e4f7ca8
- **Severity**: LOW (missed opportunity)
- **Category**: Missed opportunities / Interruptibility
- **Estimated scope**: `parts.tsx` (`Segments`), the new ticket side switch, `trade.css`

## Problem

Segmented choices (candle size, range, movers) mark the chosen option with a per-button `::after` underline that scales in from its own centre (`trade.css` ≈ line 339), and the Buy/Sell tabs swap an underline colour (≈ line 927). The selection teleports; nothing shows where it moved from.

## Target

A single indicator element per control, positioned with `transform: translateX(<index × 100%>)` and sized to one option (equal-width options), transitioning `transform var(--t-base) var(--ease-out)` (240 ms, strong ease-out, no overshoot):

```css
.sim-seg { position: relative; display: inline-grid; grid-auto-flow: column; grid-auto-columns: 1fr; }
.sim-seg-mark {
  position: absolute; left: 0; bottom: 0; height: 2px;
  width: calc(100% / var(--count));
  transform: translateX(calc(var(--index) * 100%));
  background: var(--accent-line);
  transition: transform var(--t-base) var(--ease-out);
}
@media (prefers-reduced-motion: reduce) { .sim-seg-mark { transition: none; } }
```

`--index` and `--count` are set as inline style on the indicator element itself (not on the parent, so children don't recalc). Buy/Sell uses the same mechanism with a filled block in the side colour.

## Steps

1. In `Segments`, render `<i className="sim-seg-mark" style={{"--index": i, "--count": n}} aria-hidden="true" />` after the buttons; make buttons equal width.
2. Remove the per-button `::after` selection rule (keep a hover hint inside the fine-pointer media query).
3. Build the ticket's side switch the same way.

## Verification

- **Feel check**: click 5m → 1D: the line slides across in ~240 ms and stops without overshoot; clicking quickly 5m → 1h → 15m retargets mid-flight (transition, not keyframe). Keyboard arrows on Buy/Sell move it too (it is a selection change, not a typed value). Reduced motion: it jumps.
- **Done when**: no per-option selection underline remains; one indicator per control.
