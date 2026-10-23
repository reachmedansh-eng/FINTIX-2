# 002 — Press the key with a transform, not with layout properties

- **Status**: DONE (executed in this session; see commits d19af99 and 1a523d6)
- **Commit**: e4f7ca8
- **Severity**: MEDIUM
- **Category**: Physicality & origin / Performance
- **Estimated scope**: 1 file (`src/features/trade/trade.css`), ~25 lines

## Problem

```css
/* src/features/trade/trade.css ≈ line 178 — current */
.sim-button:active:not(:disabled) {
  margin-top: 2px;
  min-height: calc(var(--fx-key-h) - 2px);
  border-bottom-width: 1px;
}
.sim-button[data-tone="quiet"]:active:not(:disabled),
.sim-button[data-tone="sell-line"]:active:not(:disabled) {
  min-height: calc(var(--fx-key-h) - 2px);
  border-bottom-width: 1px;
  background: var(--fx-lift);
}
```

Press feedback changes margin, min-height and border width (layout). On the outline variants only `min-height` shrinks, so the button loses 2 px and content below it jumps on every press.

## Target

```css
.sim-button {
  transition:
    transform var(--t-press) var(--ease-out),
    background-color var(--t-quick) ease,
    border-color var(--t-quick) ease,
    color var(--t-quick) ease;
}
/* The face drops onto its edge: the edge takes the face colour, the whole key moves 2px. */
.sim-button:active:not(:disabled) {
  transform: translateY(2px);
  border-bottom-color: var(--key);
}
.sim-button[data-tone="quiet"]:active:not(:disabled),
.sim-button[data-tone="sell-line"]:active:not(:disabled) {
  transform: translateY(1px);
  background: var(--fx-lift);
}
```

## Steps

1. Replace both `:active` rules with the target rules; add `transform` to the `.sim-button` transition list.
2. Do the same for `[data-size="s"]:active` (delete its `min-height` rule).

## Boundaries

- Do NOT change the resting look (fill, 3 px edge, heights). Do NOT add `scale()`; the key's own press is the sink.

## Verification

- **Feel check**: press and hold "Replay tutorial" (outline) in a column of buttons: nothing below it moves. Press the Buy key: its face drops 2 px and the edge disappears into it in about 120 ms; release snaps back.
- In DevTools Animations at 10%: only `transform` animates; no layout in the Performance panel on press.
- **Done when**: no `margin`/`min-height`/`border-*-width` change on `:active` anywhere in `trade.css`.
