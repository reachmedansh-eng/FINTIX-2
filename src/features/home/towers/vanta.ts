import type { Building, Kit } from "../architecture";
import { BANDED, VERTICAL, studio } from "./kit";

/**
 * VANTA, consumer: twin oxblood towers of unequal height on a shared podium,
 * the cleft between them read as a V, joined by a glass sky bridge. Red light
 * runs up their corners; the mark is on the podium.
 */
export function vanta(kit: Kit, options: { ticker: string; height: number; footprint: number }): Building {
  const s = studio(kit, options, {
    glass: 0x8a4a5c,
    frame: 0x6e3542,
    frameMetalness: 0.05,
    frameRoughness: 0.8,
    metal: 0xe0aab2,
    accent: 0xff4d63,
    roof: 0xffb0b8,
  });
  const { THREE, f, height } = s;

  const podium = Math.min(0.75, Math.max(0.24, height * 0.22));
  s.mass(-0.46 * f, 0.46 * f, -0.46 * f, 0.46 * f, 0, podium, ["+x", "+z"], BANDED);

  // Left tower (seen on the left), shorter; right tower, taller. The gap between them faces the viewer.
  const L = { x0: -0.44 * f, x1: -0.14 * f, z0: -0.1 * f, z1: 0.42 * f };
  const R = { x0: -0.1 * f, x1: 0.42 * f, z0: -0.44 * f, z1: -0.14 * f };
  const leftTop = Math.max(podium + 0.25, height * 0.78);
  const rightTop = Math.max(podium + 0.3, height * 0.96);
  const left = s.mass(L.x0, L.x1, L.z0, L.z1, podium, leftTop, ["+x", "+z"], VERTICAL, { lobby: false });
  const right = s.mass(R.x0, R.x1, R.z0, R.z1, podium, rightTop, ["+x", "+z"], VERTICAL, { lobby: false });
  s.edgeLights(L.x0, L.x1, L.z0, L.z1, podium, leftTop);
  s.edgeLights(R.x0, R.x1, R.z0, R.z1, podium, rightTop);
  // Rooftop plant boxes.
  s.at("frame", (L.x0 + L.x1) / 2 - 0.05, left.top + 0.06, (L.z0 + L.z1) / 2 - 0.05, (L.x1 - L.x0) * 0.45, 0.12, (L.z1 - L.z0) * 0.4);
  s.at("frame", (R.x0 + R.x1) / 2 - 0.05, right.top + 0.08, (R.z0 + R.z1) / 2 - 0.05, (R.x1 - R.x0) * 0.4, 0.16, (R.z1 - R.z0) * 0.45);

  // The sky bridge, across the cleft at about two thirds of the shorter tower.
  if (leftTop - podium > 0.9) {
    const y = podium + (leftTop - podium) * 0.62;
    const from = new THREE.Vector3(L.x1 - 0.02, y, (L.z0 + L.z1) / 2 - 0.08 * f);
    const to = new THREE.Vector3((R.x0 + R.x1) / 2 - 0.08 * f, y, R.z1 - 0.02);
    const span = to.clone().sub(from);
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(span.x, span.z));
    const middle = from.clone().add(to).multiplyScalar(0.5);
    s.at("frame", middle.x, middle.y - 0.11, middle.z, 0.22, 0.04, span.length(), turn);
    s.at("frame", middle.x, middle.y + 0.11, middle.z, 0.24, 0.04, span.length(), turn);
    const glass = s.own(new s.THREE.BoxGeometry(0.18, 0.18, span.length()));
    const tube = s.mesh(glass, s.materials.lobbyGlass);
    tube.position.copy(middle);
    tube.quaternion.copy(turn);
    s.at("accent", middle.x, middle.y - 0.135, middle.z, 0.02, 0.012, span.length(), turn);
  }

  const size = Math.min(0.42 * f, podium * 0.62);
  if (size > 0.14) s.glyph("V", "+x", 0.46 * f + 0.02, podium * 0.55, 0.2 * f, size);
  return s.finish(rightTop + 0.16);
}
