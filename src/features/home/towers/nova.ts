import type * as Three from "three";
import type { Building, Kit } from "../architecture";
import { FLOOR, HORIZONTAL, PIER, RECESS, VERTICAL, studio, type Rhythm } from "./kit";

/**
 * NOVA, technology: the benchmark. A blue-glass shaft, its front corner cut
 * back into a lit notch, sheared off by a glass roof that rises left to
 * right and carried on above the peak as a glass blade. A mid-rise wing on
 * the sunlit side carries the mark; a low wing sits at its foot. The two
 * halves of the shaft differ: vertical fins on the sunlit face, ledges on
 * the other. A recessed sky lobby breaks the shaft at two thirds.
 */
export function nova(kit: Kit, options: { ticker: string; height: number; footprint: number }): Building {
  const s = studio(kit, options, { glass: 0x4a7bd8, frame: 0x5b6680, metal: 0xbac5dd, accent: 0x52c8ff, roof: 0x9cbcff });
  const { THREE, f, height } = s;

  const crown = Math.min(1.3, Math.max(0.22, height * 0.21));
  const shaft = Math.max(0.36, height - crown);
  const wing = Math.max(Math.min(shaft, 0.32), shaft * 0.54);
  const low = Math.max(Math.min(shaft * 0.62, 0.26), shaft * 0.22);

  const A = { x0: -0.36 * f, x1: 0.14 * f, z0: -0.36 * f, z1: 0.14 * f };
  const notch = 0.12 * f;
  const nx = A.x1 - notch;
  const nz = A.z1 - notch;

  /* ---- Shaft ---- */
  const skyLobby = shaft > 2.2 ? Math.max(wing + FLOOR, Math.round((shaft * 0.64) / FLOOR) * FLOOR) : 0;
  const shaftMass = (x0: number, x1: number, z0: number, z1: number, rhythm: Rhythm) => {
    if (!skyLobby) return s.mass(x0, x1, z0, z1, 0, shaft, ["+x", "+z"], rhythm, { parapet: false });
    s.mass(x0, x1, z0, z1, 0, skyLobby, ["+x", "+z"], rhythm, { parapet: false });
    const above = s.skyBreak(x0, x1, z0, z1, skyLobby, ["+x", "+z"]);
    return s.mass(x0, x1, z0, z1, above, shaft, ["+x", "+z"], rhythm, { parapet: false });
  };
  const right = shaftMass(A.x0, A.x1, A.z0, nz, VERTICAL);
  const left = shaftMass(A.x0, nx, nz, A.z1, HORIZONTAL);
  s.at("frame", (nx + A.x1) / 2, shaft - 0.03, (nz + A.z1) / 2, notch, 0.06, notch);
  if (shaft > 1) {
    const from = s.lobbyHeight + 0.2;
    s.at("accent", nx + 0.016, (from + shaft) / 2, nz + 0.016, 0.026, shaft - 0.06 - from, 0.026);
  }

  /* ---- Wing with the mark ---- */
  const B = { x0: A.x1, x1: 0.46 * f, z0: -0.3 * f, z1: 0.06 * f };
  const wingTop = s.mass(B.x0, B.x1, B.z0, B.z1, 0, wing, ["+x", "+z"], { finEvery: 4, ledgeEvery: 4 }).top;
  s.at("frame", B.x0 + (B.x1 - B.x0) * 0.4, wingTop + 0.05, B.z0 + (B.z1 - B.z0) * 0.35, (B.x1 - B.x0) * 0.42, 0.1, (B.z1 - B.z0) * 0.4);
  if (wing >= 0.45) {
    const size = Math.min((B.z1 - B.z0) * 0.62, wing * 0.32);
    s.glyph("N", "+x", B.x1 + 0.02, wing - size / 2 - 0.12, (B.z0 + B.z1) / 2, size);
  }

  /* ---- Low wing ---- */
  s.mass(-0.44 * f, -0.04 * f, A.z1, 0.44 * f, 0, low, ["+x", "+z"], { finEvery: 99, ledgeEvery: 99 });

  /* ---- Crown ---- */
  const rise = { back: crown * 0.55, right: crown, left: crown * 0.1, front: crown * 0.55 };
  const roofAt = (x: number, z: number) => {
    const u = (x - A.x0) / (A.x1 - A.x0);
    const v = (z - A.z0) / (A.z1 - A.z0);
    return shaft + rise.back * (1 - u) * (1 - v) + rise.right * u * (1 - v) + rise.left * (1 - u) * v + rise.front * u * v;
  };
  const point = (x: number, z: number) => new THREE.Vector3(x, roofAt(x, z), z);
  const peak = { back: point(A.x0, A.z0), right: point(A.x1, A.z0), left: point(A.x0, A.z1), front: point(A.x1, A.z1) };
  const centre = new THREE.Vector3((A.x0 + A.x1) / 2, shaft, (A.z0 + A.z1) / 2);

  // The visible sides carry the curtain wall on up to the roof, on the shaft's grid.
  const walls = s.surface(centre);
  const wall = (a: [number, number], b: [number, number], bay: number, floor: number, start: number, outward: Three.Vector3) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const base = [new THREE.Vector3(a[0], shaft, a[1]), new THREE.Vector3(b[0], shaft, b[1])];
    const top = [new THREE.Vector3(a[0], roofAt(a[0], a[1]), a[1]), new THREE.Vector3(b[0], roofAt(b[0], b[1]), b[1])];
    const uvOf = (each: Three.Vector3, u: number) => [u / bay / 8, (each.y - start) / floor / 8];
    walls.tri([base[0], base[1], top[1]], [uvOf(base[0], 0), uvOf(base[1], length), uvOf(top[1], length)], outward);
    walls.tri([base[0], top[1], top[0]], [uvOf(base[0], 0), uvOf(top[1], length), uvOf(top[0], 0)], outward);
  };
  wall([A.x1 - RECESS, A.z0], [A.x1 - RECESS, A.z1], right.bayZ, right.floor, right.start, new THREE.Vector3(1, 0, 0));
  wall([A.x0, A.z1 - RECESS], [A.x1, A.z1 - RECESS], left.bayX, left.floor, left.start, new THREE.Vector3(0, 0, 1));
  walls.build(s.materials.glass);
  for (let index = 1; A.z0 + index * right.bayZ < A.z1 - 0.02; index += 1) {
    const z = A.z0 + index * right.bayZ;
    s.mullion("+x", A.x1, z, shaft, roofAt(A.x1, z) - 0.02, index % VERTICAL.finEvery === 0);
  }
  for (let index = 1; A.x0 + index * left.bayX < A.x1 - 0.02; index += 1) {
    const x = A.x0 + index * left.bayX;
    s.mullion("+z", A.z1, x, shaft, roofAt(x, A.z1) - 0.02, false);
  }
  for (const corner of [peak.right, peak.front, peak.left, peak.back]) {
    const up = corner.y - shaft;
    s.at("frame", corner.x + (corner.x > centre.x ? -PIER / 2 : PIER / 2), shaft + up / 2, corner.z + (corner.z > centre.z ? -PIER / 2 : PIER / 2), PIER, up, PIER);
  }

  const roof = s.surface(centre);
  const up = new THREE.Vector3(0, 1, 0);
  roof.tri([peak.left, peak.right, peak.front], undefined, up);
  roof.tri([peak.left, peak.back, peak.right], undefined, up);
  for (const [a, b, outward] of [
    [peak.left, peak.back, new THREE.Vector3(-1, 0, 0)],
    [peak.back, peak.right, new THREE.Vector3(0, 0, -1)],
  ] as const) {
    const [low0, low1] = [a.clone().setY(shaft), b.clone().setY(shaft)];
    roof.tri([low0, low1, b], undefined, outward);
    roof.tri([low0, b, a], undefined, outward);
  }
  roof.build(s.materials.roofGlass);
  for (const [a, b] of [
    [peak.back, peak.right],
    [peak.back, peak.left],
    [peak.right, peak.front],
    [peak.left, peak.front],
  ])
    s.bar("metal", a, b, 0.024);
  for (let index = 1; A.z0 + index * right.bayZ < A.z1 - 0.02; index += 1) {
    const z = A.z0 + index * right.bayZ;
    s.bar("metal", new THREE.Vector3(A.x0, roofAt(A.x0, z) + 0.004, z), new THREE.Vector3(A.x1, roofAt(A.x1, z) + 0.004, z), 0.012);
  }
  for (let index = 1; A.x0 + index * left.bayX < A.x1 - 0.02; index += 1) {
    const x = A.x0 + index * left.bayX;
    s.bar("metal", new THREE.Vector3(x, roofAt(x, A.z0) + 0.004, A.z0), new THREE.Vector3(x, roofAt(x, A.z1) + 0.004, A.z1), 0.012);
  }

  // The blade: the sunlit face carried on above the peak as a glass sail.
  const blade = crown * 0.5;
  const reach = (A.z1 - A.z0) * 0.62;
  const edgeAt = (z: number) => roofAt(A.x1, z);
  const sail = s.own(
    new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, edgeAt(A.z0)), new THREE.Vector2(0, edgeAt(A.z0) + blade), new THREE.Vector2(-reach, edgeAt(A.z0 + reach))]), { depth: 0.04, bevelEnabled: false }),
  );
  sail.setAttribute("color", new THREE.Float32BufferAttribute(new Array(sail.getAttribute("position").count * 3).fill(1), 3));
  const sailMesh = s.mesh(sail, s.materials.roofGlass);
  sailMesh.rotation.y = Math.PI / 2;
  sailMesh.position.set(A.x1 - 0.04, 0, A.z0);
  const tip = new THREE.Vector3(A.x1 - 0.02, edgeAt(A.z0) + blade, A.z0);
  s.bar("accent", new THREE.Vector3(A.x1 + 0.006, edgeAt(A.z0), A.z0 + 0.012), new THREE.Vector3(A.x1 + 0.006, edgeAt(A.z0) + blade, A.z0 + 0.012), 0.02);
  s.bar("metal", tip, new THREE.Vector3(A.x1 - 0.02, edgeAt(A.z0 + reach), A.z0 + reach), 0.02);

  return s.finish(shaft + crown + blade);
}

