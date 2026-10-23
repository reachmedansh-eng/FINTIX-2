import type { Building, Kit } from "../architecture";
import { HORIZONTAL, studio } from "./kit";

/**
 * AERO, aviation: a round violet-glass tower on a low podium, a helipad on
 * its roof and a swept tail fin standing off its side, its leading edge lit
 * and the mark on the fin like a livery.
 */
export function aero(kit: Kit, options: { ticker: string; height: number; footprint: number }): Building {
  const s = studio(kit, options, { glass: 0x6c5ce0, frame: 0x4f4b7e, metal: 0xcbc4f2, accent: 0xa98bff, roof: 0xb9aaff });
  const { THREE, f, height } = s;

  const podium = Math.min(0.55, Math.max(0.22, height * 0.12));
  s.mass(-0.44 * f, 0.44 * f, -0.44 * f, 0.44 * f, 0, podium, ["+x", "+z"], HORIZONTAL);

  const radius = 0.3 * f;
  const cx = -0.04 * f;
  const cz = -0.04 * f;
  const drumTop = Math.max(podium + 0.3, height * 0.9);
  const cap = s.drum(cx, cz, radius, podium, drumTop, { finEvery: 3, ledgeEvery: 3 });

  // The helipad: a disc on a short neck, ringed in light, its H lying on the deck.
  const neck = 0.08;
  s.part("drum", "metal", cx, cap + neck / 2, cz, radius * 1.2, neck, radius * 1.2);
  const pad = cap + neck;
  s.part("drum", "accent", cx, pad + 0.006, cz, radius * 2 + 0.1, 0.012, radius * 2 + 0.1);
  s.part("drum", "frame", cx, pad + 0.03, cz, radius * 2 + 0.06, 0.036, radius * 2 + 0.06);
  if (radius > 0.3) s.glyph("H", "+y", cx, pad + 0.048, cz, radius * 1.1, false);

  // The tail fin stands off the drum towards the viewer's right, its broad side to the viewer, and sweeps up past the roof.
  const root = Math.max(podium + 0.1, height * 0.42);
  const head = drumTop - 0.05;
  const tipX = radius + 0.3 * f;
  const tipY = head + Math.max(0.2, height * 0.1);
  const turn = Math.PI / 4;
  const along = new THREE.Vector3(Math.cos(turn), 0, -Math.sin(turn));
  const out = new THREE.Vector3(Math.sin(turn), 0, Math.cos(turn));
  const onFin = (x: number, y: number, lift = 0) => new THREE.Vector3(cx + along.x * x + out.x * lift, y, cz + along.z * x + out.z * lift);
  const fin = s.own(
    new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(radius - 0.08, root), new THREE.Vector2(radius - 0.08, head), new THREE.Vector2(tipX, tipY)]), { depth: 0.05, bevelEnabled: false }),
  );
  fin.setAttribute("color", new THREE.Float32BufferAttribute(new Array(fin.getAttribute("position").count * 3).fill(1), 3));
  const finMesh = s.mesh(fin, s.materials.roofGlass);
  finMesh.rotation.y = turn;
  finMesh.position.copy(onFin(0, 0, -0.025));
  s.bar("accent", onFin(radius - 0.05, root, 0.03), onFin(tipX, tipY, 0.03), 0.022);
  s.bar("metal", onFin(radius - 0.08, head, 0.028), onFin(tipX, tipY, 0.028), 0.018);

  // The mark sits on the fin where it is widest, facing the viewer.
  const markY = root + (head - root) * 0.7;
  const width = (tipX - radius) * ((markY - root) / (tipY - root));
  const size = Math.min(width * 1.1, (head - root) * 0.3);
  if (size > 0.14) {
    const spot = onFin(radius + width * 0.42, markY, 0.026);
    s.glyph("A", turn, spot.x, spot.y, spot.z, size);
  }

  return s.finish(tipY);
}
