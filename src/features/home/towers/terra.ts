import type { Building, Kit } from "../architecture";
import { FLOOR, PLAIN, studio } from "./kit";

/**
 * TERRA, food: a sandstone terrace. Four tiers step down towards the viewer,
 * every floor carried on a deep stone balcony, each terrace edge lit warm.
 * The mark is on the lowest tier.
 */
export function terra(kit: Kit, options: { ticker: string; height: number; footprint: number }): Building {
  const s = studio(kit, options, {
    glass: 0x7a6650,
    frame: 0xc9aa7c,
    frameMetalness: 0.05,
    frameRoughness: 0.85,
    metal: 0xe8d2a4,
    accent: 0xffc56a,
    roof: 0xf0d8a8,
  });
  const { f, height } = s;

  // Each tier keeps its back faces flush and steps in on the two faces the viewer sees.
  const tiers = [
    { front: 0.46, to: 0.3 },
    { front: 0.3, to: 0.55 },
    { front: 0.14, to: 0.78 },
    { front: -0.02, to: 0.95 },
  ];
  const back = -0.46 * f;
  let y = 0;
  let first = { top: 0 };
  for (const tier of tiers) {
    const top = Math.max(y + 0.22, height * tier.to);
    const front = tier.front * f;
    const made = s.mass(back, front, back, front, y, top, ["+x", "+z"], PLAIN, { parapet: false });
    // Deep balconies on every floor of the faces the viewer sees.
    for (let level = made.start + made.floor; level < top - 0.01; level += made.floor) {
      s.at("frame", front + 0.02, level, (back + front) / 2 + 0.02, 0.1, 0.03, front - back + 0.04);
      s.at("frame", (back + front) / 2 + 0.02, level, front + 0.02, front - back + 0.04, 0.03, 0.1);
    }
    // The terrace: a stone parapet with a warm light along its edge.
    s.rim(back, front, back, front, top, "frame", 0.06);
    s.at("accent", front + 0.012, top + 0.03, (back + front) / 2, 0.012, 0.016, front - back);
    s.at("accent", (back + front) / 2, top + 0.03, front + 0.012, front - back, 0.016, 0.012);
    if (y === 0) first = { top };
    y = top;
  }

  const size = Math.min(0.34 * f, first.top * 0.5);
  if (size > 0.14 && first.top > FLOOR) s.glyph("T", "+x", 0.46 * f + 0.07, first.top * 0.52, 0.12 * f, size);
  return s.finish(y + 0.06);
}
