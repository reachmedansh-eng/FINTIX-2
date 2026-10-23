import type { Building, Kit } from "../architecture";
import { HORIZONTAL, VERTICAL, studio } from "./kit";

/**
 * KRON, energy: an art-deco spire. Three setbacks on a broad base, gold
 * pilasters running the full height of each tier, a band of gold light at
 * every setback, a stepped crown and a spire. The mark is on the middle tier.
 */
export function kron(kit: Kit, options: { ticker: string; height: number; footprint: number }): Building {
  const s = studio(kit, options, {
    glass: 0x5a5470,
    frame: 0x2f2b38,
    frameMetalness: 0.5,
    frameRoughness: 0.45,
    metal: 0xf2c25c,
    metalMetalness: 0.7,
    accent: 0xffb733,
    roof: 0xffd890,
  });
  const { f, height } = s;

  const tiers = [
    { half: 0.44, to: 0.24, rhythm: HORIZONTAL },
    { half: 0.32, to: 0.58, rhythm: VERTICAL },
    { half: 0.22, to: 0.8, rhythm: VERTICAL },
  ];
  let y = 0;
  let mid = { start: 0, top: 0 };
  tiers.forEach((tier, index) => {
    const top = Math.max(y + 0.2, height * tier.to);
    const h = tier.half * f;
    s.mass(-h, h, -h, h, y, top, ["+x", "+z"], tier.rhythm, { parapet: false });
    // Deco banding: gold light along the top of every setback.
    s.rim(-h, h, -h, h, top, "metal", 0.05);
    s.rim(-h - 0.004, h + 0.004, -h - 0.004, h + 0.004, top + 0.05, "accent", 0.018);
    if (index === 1) mid = { start: y, top };
    y = top + 0.068;
  });

  // The crown: two short gold-clad steps, then the spire.
  const steps = [0.15, 0.09];
  for (const half of steps) {
    const h = half * f;
    const tall = Math.max(0.1, height * 0.045);
    s.at("metal", 0, y + tall / 2, 0, h * 2, tall, h * 2);
    s.at("accent", 0, y + tall + 0.008, 0, h * 2 + 0.01, 0.016, h * 2 + 0.01);
    y += tall + 0.016;
  }
  const spire = Math.max(0.25, height * 0.16);
  s.at("metal", 0, y + spire / 2, 0, 0.05, spire, 0.05);
  s.at("accent", 0, y + spire + 0.02, 0, 0.04, 0.04, 0.04);

  const size = Math.min(0.32 * f, (mid.top - mid.start) * 0.32);
  if (size > 0.14) s.glyph("K", "+x", 0.32 * f + 0.02, mid.start + size * 0.75 + 0.1, 0, size);
  return s.finish(y + spire + 0.04);
}
