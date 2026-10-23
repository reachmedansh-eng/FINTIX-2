import type { Building, Kit } from "../architecture";
import { BANDED, PLAIN, VERTICAL, studio } from "./kit";

/**
 * LUMA, banking: four lilac boxes stacked like a vault's deposit drawers,
 * each pulled out a little in a different direction, each top edge lit.
 * Dark recessed joints separate them; the mark is on the second box.
 */
export function luma(kit: Kit, options: { ticker: string; height: number; footprint: number }): Building {
  const s = studio(kit, options, {
    glass: 0x7c5ccc,
    frame: 0x8c7ab8,
    frameMetalness: 0.2,
    frameRoughness: 0.6,
    metal: 0xe4d6ff,
    accent: 0xd88cff,
    roof: 0xdcc8ff,
  });
  const { f, height } = s;

  const boxes = [
    { x0: -0.44, x1: 0.3, z0: -0.44, z1: 0.3, share: 0.28, rhythm: BANDED },
    { x0: -0.3, x1: 0.44, z0: -0.42, z1: 0.22, share: 0.24, rhythm: VERTICAL },
    { x0: -0.42, x1: 0.22, z0: -0.26, z1: 0.42, share: 0.22, rhythm: VERTICAL },
    { x0: -0.26, x1: 0.24, z0: -0.32, z1: 0.18, share: 0.18, rhythm: PLAIN },
  ];
  const joint = 0.07;
  let y = 0;
  let second = { start: 0, top: 0, x1: 0, z: 0 };
  boxes.forEach((box, index) => {
    const x0 = box.x0 * f;
    const x1 = box.x1 * f;
    const z0 = box.z0 * f;
    const z1 = box.z1 * f;
    const top = y + Math.max(0.22, height * box.share);
    const made = s.mass(x0, x1, z0, z1, y, top, ["+x", "+z"], box.rhythm, { parapet: false, lobby: index === 0 });
    // A lit edge round the top of each box, then a dark recessed joint before the next.
    s.rim(x0, x1, z0, z1, top, "frame", 0.04);
    s.rim(x0 - 0.004, x1 + 0.004, z0 - 0.004, z1 + 0.004, top + 0.04, "accent", 0.016);
    if (index === 1) second = { start: made.start, top, x1, z: (z0 + z1) / 2 };
    if (index < boxes.length - 1) s.at("frame", (x0 + x1) / 2 - 0.04, top + 0.056 + joint / 2, (z0 + z1) / 2 - 0.04, (x1 - x0) * 0.7, joint, (z1 - z0) * 0.7);
    y = top + 0.056 + (index < boxes.length - 1 ? joint : 0);
  });

  const size = Math.min(0.36 * f, (second.top - second.start) * 0.6);
  if (size > 0.14) s.glyph("L", "+x", second.x1 + 0.02, (second.start + second.top) / 2, second.z, size);
  return s.finish(y);
}
