/**
 * The room, quietly running.
 *
 * Nothing here touches the artwork: these are separate, tiny layers laid over
 * it in the artwork's own pixel coordinates, each one only adding a little
 * light to something the painting already contains: a window that is already
 * lit, the water's existing reflections, the lamp, the monitor's own LEDs.
 * They share the artwork's transform, so they stay registered at every size.
 */

/** Lit windows in the skyline, with the colour each already has in the artwork. */
const WINDOWS: [x: number, y: number, colour: string][] = [
  [1255, 245, "#fd73ff"],
  [1248, 275, "#41ffff"],
  [1423, 207, "#d766f0"],
  [1595, 230, "#9affff"],
  [1486, 253, "#eda2ff"],
  [1416, 277, "#6cf0ff"],
  [1530, 299, "#03e5ff"],
  [1323, 303, "#d579e9"],
  [1602, 332, "#15f7fe"],
  [1375, 342, "#ff5afc"],
  [1490, 345, "#ffdbff"],
  [1418, 351, "#1ddffe"],
  [1508, 370, "#f280b5"],
  [1349, 385, "#8ce7fe"],
  [1544, 397, "#02f1ff"],
  [1494, 420, "#ffbc52"],
  [401, 173, "#ff7bc7"],
  [453, 211, "#14d0fe"],
  [398, 285, "#ffffdf"],
  [455, 333, "#ff9bf6"],
  [602, 150, "#ffa1ff"],
  [650, 193, "#39c2ff"],
  [1199, 150, "#16cdf7"],
];

/** Open water seen through the window, as rectangles that avoid the monitor and the plants. */
const WATER: [x: number, y: number, width: number, height: number][] = [
  [400, 458, 62, 140],
  [1224, 458, 40, 190],
  [1312, 458, 316, 78],
  [1312, 536, 110, 112],
];

/** The monitor's status lights, on its lower bezel. */
const LEDS: [x: number, y: number, size: number][] = [
  [1153, 661, 3],
  [1186, 661, 2],
];

export function Ambient() {
  return (
    <div className="auth-ambient" aria-hidden="true">
      <span className="amb-lamp" />
      {WATER.map(([x, y, width, height], index) => (
        <span key={`water-${index}`} className="amb-water" style={{ left: x, top: y, width, height }} />
      ))}
      {WINDOWS.map(([x, y, colour], index) => (
        <span
          key={`window-${index}`}
          className="amb-window"
          style={{
            left: x - 1,
            top: y - 1,
            background: colour,
            // Each window keeps its own slow, unrelated rhythm.
            animationDuration: `${7 + ((index * 37) % 11)}s`,
            animationDelay: `${-((index * 53) % 17)}s`,
          }}
        />
      ))}
      {LEDS.map(([x, y, size], index) => (
        <span key={`led-${index}`} className="amb-led" data-led={index} style={{ left: x, top: y, width: size, height: size }} />
      ))}
    </div>
  );
}
