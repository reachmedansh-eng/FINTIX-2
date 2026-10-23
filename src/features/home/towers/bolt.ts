import type { Building, Kit } from "../architecture";
import { BANDED, HORIZONTAL, VERTICAL, studio } from "./kit";

/**
 * BOLT, electric vehicles: three interlocking cyan-glass slabs stepping down
 * from left to right across the view like a staircase, every visible corner
 * lit like a charging strip, and a zigzag of light struck down the tallest
 * slab. An open frame crowns the top; the mark is on the middle slab.
 */
export function bolt(kit: Kit, options: { ticker: string; height: number; footprint: number }): Building {
  const s = studio(kit, options, { glass: 0x2a9ad8, frame: 0x27324c, frameMetalness: 0.55, metal: 0x92dcff, accent: 0x2fd4ff, roof: 0xa8e8ff });
  const { THREE, f, height } = s;

  const slabs = [
    { x0: -0.46, x1: -0.08, z0: 0.04, z1: 0.42, to: 0.92, rhythm: VERTICAL },
    { x0: -0.2, x1: 0.18, z0: -0.18, z1: 0.2, to: 0.64, rhythm: BANDED },
    { x0: 0.06, x1: 0.44, z0: -0.46, z1: -0.08, to: 0.36, rhythm: HORIZONTAL },
  ].map((slab) => ({ ...slab, x0: slab.x0 * f, x1: slab.x1 * f, z0: slab.z0 * f, z1: slab.z1 * f }));
  const tops: number[] = [];
  slabs.forEach((slab, index) => {
    const top = Math.max(0.3 + (2 - index) * 0.16, height * slab.to);
    s.mass(slab.x0, slab.x1, slab.z0, slab.z1, 0, top, ["+x", "+z"], slab.rhythm);
    s.edgeLights(slab.x0, slab.x1, slab.z0, slab.z1, 0, top);
    tops.push(top);
  });

  // The strike: a zigzag of light down the tallest slab's left face, above the middle slab.
  const tall = slabs[0];
  const clear = tops[1] + 0.2;
  if (tops[0] - clear > 0.8) {
    const z = tall.z1 + 0.012;
    const xs = [tall.x0 + 0.2 * (tall.x1 - tall.x0), tall.x0 + 0.7 * (tall.x1 - tall.x0), tall.x0 + 0.32 * (tall.x1 - tall.x0), tall.x0 + 0.82 * (tall.x1 - tall.x0)];
    const span = tops[0] - 0.15 - clear;
    const ys = [tops[0] - 0.15, tops[0] - 0.15 - span * 0.42, tops[0] - 0.15 - span * 0.5, clear];
    for (let index = 0; index < 3; index += 1) s.bar("accent", new THREE.Vector3(xs[index], ys[index], z), new THREE.Vector3(xs[index + 1], ys[index + 1], z), 0.03);
  }

  // An open frame crowning the tallest slab.
  const crown = Math.max(0.18, height * 0.07);
  const cy = tops[0] + 0.05;
  for (const [x, z] of [
    [tall.x0 + 0.04, tall.z0 + 0.04],
    [tall.x1 - 0.04, tall.z0 + 0.04],
    [tall.x0 + 0.04, tall.z1 - 0.04],
    [tall.x1 - 0.04, tall.z1 - 0.04],
  ])
    s.at("metal", x, cy + crown / 2, z, 0.03, crown, 0.03);
  s.rim(tall.x0 + 0.02, tall.x1 - 0.02, tall.z0 + 0.02, tall.z1 - 0.02, cy + crown, "accent", 0.02);

  const mid = slabs[1];
  const size = Math.min((mid.z1 - mid.z0) * 0.6, (tops[1] - tops[2]) * 0.6);
  if (size > 0.14) s.glyph("B", "+x", mid.x1 + 0.02, tops[2] + (tops[1] - tops[2]) * 0.5, (mid.z0 + mid.z1) / 2 - 0.04, size);
  return s.finish(cy + crown + 0.02);
}
