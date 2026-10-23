# 004 — Gate hover-only motion to fine pointers

- **Status**: DONE (executed in this session; see commits d19af99 and 1a523d6)
- **Commit**: e4f7ca8
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 2 files, ~15 lines

## Problem

```css
/* src/features/trade/trade.css — current */
.sim-seg button:hover::after { transform: scaleX(1); }               /* ≈ line 356 */
.sim-link[data-go]:hover .sim-glyph { transform: translateX(2px); }  /* ≈ line 299 */
```

On touch screens a tap leaves `:hover` applied, so an option shows a half-selected underline and arrows stay nudged after the finger lifts.

## Target

```css
@media (hover: hover) and (pointer: fine) {
  .sim-seg button:hover::after { transform: scaleX(1); }
  .sim-link[data-go]:hover .sim-glyph { transform: translateX(2px); }
}
```

Same for any new hover transforms (building plates, switcher items, rows).

## Steps

1. Move each hover rule that changes `transform` (or reveals an indicator) inside the media query. Colour-only hovers may stay outside.

## Verification

- **Feel check**: in DevTools device mode (touch), tap a candle-size option and a "View all" link: no leftover underline or nudged arrow after release. With a mouse, hover still previews.
- **Done when**: `grep -n ":hover" trade.css home.css` shows no ungated rule that sets `transform`.
