import type { Building, Kit } from "../architecture";
import { BANDED, HORIZONTAL, PLAIN, studio } from "./kit";

/**
 * MEDIX, healthcare: a white clinic. A broad banded base, a teal-glass slab
 * tower with a helipad on its roof, a side wing, and a large green cross on
 * the tower's sunlit face.
 */
export function medix(kit: Kit, options: { ticker: string; height: number; footprint: number }): Building {
  const s = studio(kit, options, {
    glass: 0x2f9a8e,
    frame: 0xd6e2de,
    frameMetalness: 0.05,
    frameRoughness: 0.7,
    metal: 0xa6dccd,
    accent: 0x3ef0a6,
    roof: 0xb6f0de,
    lobby: 0xd0b088,
  });
  const { f, height } = s;

  const base = Math.min(0.9, Math.max(0.24, height * 0.3));
  s.mass(-0.46 * f, 0.46 * f, -0.12 * f, 0.46 * f, 0, base, ["+x", "+z"], HORIZONTAL);

  const T = { x0: -0.34 * f, x1: 0.18 * f, z0: -0.46 * f, z1: -0.04 * f };
  const towerTop = Math.max(base + 0.3, height * 0.92);
  const tower = s.mass(T.x0, T.x1, T.z0, T.z1, 0, towerTop, ["+x", "+z"], PLAIN, { parapet: false });
  const wingTop = Math.max(base + 0.15, height * 0.56);
  s.mass(T.x1, 0.44 * f, -0.4 * f, -0.08 * f, 0, wingTop, ["+x", "+z"], BANDED);

  // The helipad: a white deck on a lit rim, a green cross lying on it.
  const deck = tower.top;
  s.at("frame", (T.x0 + T.x1) / 2, deck + 0.02, (T.z0 + T.z1) / 2, T.x1 - T.x0 + 0.04, 0.04, T.z1 - T.z0 + 0.04);
  s.at("accent", (T.x0 + T.x1) / 2, deck - 0.004, (T.z0 + T.z1) / 2, T.x1 - T.x0 + 0.05, 0.012, T.z1 - T.z0 + 0.05);
  s.glyph("+", "+y", (T.x0 + T.x1) / 2, deck + 0.04, (T.z0 + T.z1) / 2, Math.min(T.x1 - T.x0, T.z1 - T.z0) * 0.8, false);

  // The cross on the tower's face, above the wing.
  const free = towerTop - wingTop;
  const size = Math.min((T.z1 - T.z0) * 0.8, free * 0.6);
  if (size > 0.14) s.glyph("+", "+x", T.x1 + 0.02, wingTop + free * 0.52, (T.z0 + T.z1) / 2, size);
  return s.finish(deck + 0.06);
}
