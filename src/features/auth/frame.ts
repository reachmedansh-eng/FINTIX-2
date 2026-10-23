import { asset } from "@/lib/asset";

/**
 * The workstation artwork and how a viewport looks at it.
 *
 * The supplied file is drawn whole and unaltered. Where the screen is large
 * enough, the entire room is visible and the sign-in sits inside the monitor.
 * Where it is not, the view moves closer to the monitor instead of shrinking
 * the interface: the viewport adapts to the artwork, never the reverse.
 */

export const ROOM = {
  src: asset("/auth/workstation.png"),
  width: 1671,
  height: 941,
  /** The blank monitor's glass, in artwork pixels. */
  screen: { x: 476, y: 231, width: 729, height: 418 },
} as const;

/** The smallest the monitor's glass may be on screen for the interface to sit inside it comfortably. */
const NEEDS = { width: 640, height: 366 };

export type Frame = { scale: number; x: number; y: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Places the artwork at a scale: centred if it fits, otherwise held on the monitor without showing past its edges. */
function place(scale: number, viewWidth: number, viewHeight: number): Frame {
  const width = ROOM.width * scale;
  const height = ROOM.height * scale;
  const focusX = (ROOM.screen.x + ROOM.screen.width / 2) * scale;
  const focusY = (ROOM.screen.y + ROOM.screen.height / 2) * scale;
  return {
    scale,
    x: width <= viewWidth ? (viewWidth - width) / 2 : clamp(viewWidth / 2 - focusX, viewWidth - width, 0),
    y: height <= viewHeight ? (viewHeight - height) / 2 : clamp(viewHeight / 2 - focusY, viewHeight - height, 0),
  };
}

export function framesFor(viewWidth: number, viewHeight: number) {
  /** Upright and small screens go all the way in: the monitor's glass becomes the whole view. */
  const inside = viewWidth < 720 || viewWidth / viewHeight < 1.1;
  const whole = Math.min(viewWidth / ROOM.width, viewHeight / ROOM.height);
  const close = inside
    ? Math.max(viewWidth / ROOM.screen.width, viewHeight / ROOM.screen.height) * 1.04
    : Math.max(whole, Math.min(NEEDS.width, viewWidth - 32) / ROOM.screen.width, Math.min(NEEDS.height, viewHeight - 24) / ROOM.screen.height);
  return {
    inside,
    /** The whole room, as the visitor arrives. */
    room: place(whole, viewWidth, viewHeight),
    /** Where the view rests while signing in. Identical to `room` on large screens. */
    desk: place(close, viewWidth, viewHeight),
  };
}

/** The monitor's glass in viewport pixels for a frame, kept inside the viewport. */
export function glassIn(frame: Frame, viewWidth: number, viewHeight: number) {
  const left = Math.max(0, frame.x + ROOM.screen.x * frame.scale);
  const top = Math.max(0, frame.y + ROOM.screen.y * frame.scale);
  const right = Math.min(viewWidth, frame.x + (ROOM.screen.x + ROOM.screen.width) * frame.scale);
  const bottom = Math.min(viewHeight, frame.y + (ROOM.screen.y + ROOM.screen.height) * frame.scale);
  return { left, top, width: right - left, height: bottom - top };
}
