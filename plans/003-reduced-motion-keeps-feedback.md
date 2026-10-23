# 003 — Reduced motion keeps colour and opacity feedback

- **Status**: DONE (executed in this session; see commits d19af99 and 1a523d6)
- **Commit**: e4f7ca8
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 2 files (`trade.css`, `home.css`), ~20 lines

## Problem

```css
/* src/features/trade/trade.css ≈ line 2405 — current */
@media (prefers-reduced-motion: reduce) {
  .sim *, .sim *::before, .sim *::after {
    animation: none !important;
    transition-duration: 1ms !important;
  }
}
```

Every transition and animation is removed, including colour and opacity changes that explain state (a selected tab brightening, a disabled key fading). Reduced motion should mean fewer and gentler animations, not none.

## Target

```css
@media (prefers-reduced-motion: reduce) {
  /* Travel and counting stop; colour and opacity still change, briefly. */
  .sim *, .sim *::before, .sim *::after {
    animation-duration: 120ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
  .sim [data-moves] { transform: none !important; }
}
```

and every keyframe used for entrances gains a reduced-motion variant that animates opacity only (`@keyframes …-fade { from { opacity: 0 } }`). Transform-based indicators switch instantly (their `transition-property` drops `transform`).

## Steps

1. Replace the blanket block in `trade.css` with the target; give the busy dots (`.sim-busy i`) `animation: none; opacity: 1` (a loader with steps is still motion).
2. For each entrance keyframe (receipt, panel, route enter), add a reduced-motion rule that swaps to an opacity-only keyframe.
3. For sliding indicators and pressed keys, add `transition-property: opacity, color, background-color, border-color` under reduced motion so they jump in place instead of travelling.

## Boundaries

- Do NOT remove focus rings or hover colours under reduced motion.

## Verification

- **Feel check**: emulate `prefers-reduced-motion: reduce` (DevTools Rendering). Switch Buy/Sell: the indicator appears under the new side at once, the label colour still eases. Place an order: the receipt fades in without moving; numbers update without counting.
- **Done when**: no rule sets `transition-duration: 1ms` globally; every travelling animation has an opacity-only or instant variant.
