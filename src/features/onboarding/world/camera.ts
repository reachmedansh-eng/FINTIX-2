import { asset } from "@/lib/asset";

/**
 * The world and the camera that travels through it.
 *
 * The supplied artwork is one tall image. The viewport is a window onto it,
 * described here in the artwork's own pixels, so nothing depends on how large
 * the file is: a higher-resolution copy only needs WORLD's numbers updated.
 */

export const WORLD = {
  src: asset("/onboarding/world.png"),
  width: 561,
  height: 2048,
} as const;

/**
 * The most rows of the artwork a viewport may show at once. Landscape screens
 * show the art edge to edge; anything narrower crops the sides instead of
 * shrinking the world, so a scene still fills a phone held upright.
 */
const MAX_ROWS = 381;

/** Camera state. The scroll timeline writes it; the renderer reads it. */
export const camera = {
  /** Centre of the view, in artwork pixels. */
  cx: WORLD.width / 2,
  cy: 0,
  /** 1 is the base framing; above 1 magnifies about the centre. */
  zoom: 1,
  /** 0 shows the artwork exactly as supplied, 1 is black. Only the fade in on arrival and the fade out on entry use it. */
  dim: 1,
};

export type View = { left: number; top: number; width: number; height: number };

/** Size of the base window (zoom 1) for a viewport, in artwork pixels. */
export function baseWindow(viewWidth: number, viewHeight: number) {
  const aspect = viewWidth / Math.max(1, viewHeight);
  const width = Math.min(WORLD.width, MAX_ROWS * aspect);
  return { width, height: width / aspect };
}

/** The rectangle of artwork currently on screen, kept inside the art's edges. */
export function currentView(viewWidth: number, viewHeight: number): View {
  const base = baseWindow(viewWidth, viewHeight);
  const width = base.width / camera.zoom;
  const height = base.height / camera.zoom;
  const left = clamp(camera.cx - width / 2, 0, WORLD.width - width);
  const top = clamp(camera.cy - height / 2, 0, WORLD.height - height);
  return { left, top, width, height };
}

export const clamp = (value: number, min: number, max: number) => (value < min ? min : value > max ? max : value);

/* ------------------------------------------------------------------ */
/* Tracks: smooth curves through keyframes                             */
/* ------------------------------------------------------------------ */

export type Key = { at: number; value: number };

/**
 * A curve through keyframes that never overshoots (monotone cubic). Two keys
 * with the same value make a true hold; everything else eases between them
 * with continuous speed, so the camera slows into a scene and out of it
 * without ever stopping dead.
 */
export function track(keys: Key[]) {
  const n = keys.length;
  const xs = keys.map((k) => k.at);
  const ys = keys.map((k) => k.value);
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) slopes.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));

  const tangents: number[] = new Array(n).fill(0);
  tangents[0] = slopes[0] ?? 0;
  tangents[n - 1] = slopes[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i++) {
    tangents[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  }
  // Fritsch–Carlson: rein in tangents that would make the curve overshoot.
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const length = a * a + b * b;
    if (length > 9) {
      const scale = 3 / Math.sqrt(length);
      tangents[i] = scale * a * slopes[i];
      tangents[i + 1] = scale * b * slopes[i];
    }
  }

  return (at: number) => {
    if (at <= xs[0]) return ys[0];
    if (at >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (at > xs[i + 1]) i++;
    const span = xs[i + 1] - xs[i];
    const t = (at - xs[i]) / span;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * span * tangents[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * span * tangents[i + 1]
    );
  };
}
