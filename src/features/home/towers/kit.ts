import type * as Three from "three";
import type { Building, Kit } from "../architecture";

/**
 * The tower kit: one facade system and one set of parts, shared by all eight
 * buildings, so they read as one city while each keeps its own silhouette.
 * Distilled from the NOVA benchmark.
 *
 * - Glass sits recessed behind solid corner piers; slim mullions divide it
 *   into bays; a deeper fin or a ledge marks a rhythm; dark spandrels mark
 *   the floors; about one office in five is lit.
 * - Ground floors open into lit, recessed lobbies under a canopy.
 * - Each asset brings a palette (glass, structure, trim, accent) and a
 *   pixel-grid letter mark in the identity's own light.
 * - Repeated parts are instanced: one mesh per (shape, material) pair.
 *
 * Plan coordinates are passed in scene units; designs work in fractions of
 * the footprint so a tower keeps its proportions at any size.
 */

export const FLOOR = 0.3;
export const BAY = 0.16;
/** Solid corner piers, and how far glass sits behind their face. */
export const PIER = 0.05;
export const RECESS = 0.04;
export const PARAPET = 0.05;

export type Face = "+x" | "+z";
/** A facade's rhythm: a deeper fin every few bays (vertical emphasis), a ledge every few floors (horizontal). */
export type Rhythm = { finEvery: number; ledgeEvery: number };
export const VERTICAL: Rhythm = { finEvery: 2, ledgeEvery: 99 };
export const HORIZONTAL: Rhythm = { finEvery: 99, ledgeEvery: 2 };
export const PLAIN: Rhythm = { finEvery: 99, ledgeEvery: 99 };
export const BANDED: Rhythm = { finEvery: 4, ledgeEvery: 4 };

export type Palette = {
  /** Curtain-wall glass tint (multiplied by the pane pattern). */
  glass: number;
  glassMetalness?: number;
  /** Structure: piers, mullions, parapets, canopies. */
  frame: number;
  frameMetalness?: number;
  frameRoughness?: number;
  /** Trim: fins, ledges, edges, masts. */
  metal: number;
  metalMetalness?: number;
  /** The identity's light. */
  accent: number;
  /** Roof glazing and sails. */
  roof?: number;
  /** Warm light behind lobby glass. */
  lobby?: number;
};

type Shape = "box" | "drum";
type Finish = "frame" | "metal" | "accent";

/** 5 × 7 pixel letters for the identity marks, top row first. */
const GLYPHS: Record<string, string[]> = {
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  V: ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
};

export type Studio = ReturnType<typeof studio>;

export function studio(kit: Kit, options: { ticker: string; height: number; footprint: number }, palette: Palette) {
  const { THREE } = kit;
  const { ticker, height, footprint: f } = options;
  const group = new THREE.Group();
  const solids: Three.Object3D[] = [];
  const geometries: Three.BufferGeometry[] = [];
  const extraMaterials: Three.Material[] = [];

  /* ---- Materials ---- */
  const glass = new THREE.MeshStandardMaterial({
    color: palette.glass,
    map: kit.facade.map,
    vertexColors: true,
    metalness: palette.glassMetalness ?? 0.4,
    roughness: 0.24,
    emissive: 0xffffff,
    emissiveMap: kit.facade.glow,
    emissiveIntensity: 0.55,
  });
  const frame = new THREE.MeshStandardMaterial({ color: palette.frame, metalness: palette.frameMetalness ?? 0.35, roughness: palette.frameRoughness ?? 0.5 });
  const metal = new THREE.MeshStandardMaterial({ color: palette.metal, metalness: palette.metalMetalness ?? 0.3, roughness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: palette.accent, emissive: palette.accent, emissiveIntensity: 1.1, roughness: 0.4 });
  const roofGlass = new THREE.MeshStandardMaterial({ color: palette.roof ?? 0x9cbcff, vertexColors: true, metalness: 0.92, roughness: 0.1, emissive: 0x000000 });
  const lobbyGlass = new THREE.MeshStandardMaterial({ color: 0x101a33, metalness: 0.3, roughness: 0.3, emissive: palette.lobby ?? 0xc98a52, emissiveIntensity: 0.55 });
  for (const material of [glass, frame, metal, accent, roofGlass, lobbyGlass]) material.userData.base = material.color.getHex();
  const finishes: Record<Finish, Three.MeshStandardMaterial> = { frame, metal, accent };

  /* ---- Instanced parts ---- */
  const parts = new Map<string, { shape: Shape; finish: Finish; list: Three.Matrix4[] }>();
  const upright = new THREE.Quaternion();
  const part = (shape: Shape, finish: Finish, x: number, y: number, z: number, w: number, h: number, d: number, turn = upright) => {
    const key = `${shape}:${finish}`;
    if (!parts.has(key)) parts.set(key, { shape, finish, list: [] });
    parts.get(key)!.list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), turn, new THREE.Vector3(w, h, d)));
  };
  /** A box part centred at (x, y, z). */
  const at = (finish: Finish, x: number, y: number, z: number, w: number, h: number, d: number, turn = upright) => part("box", finish, x, y, z, w, h, d, turn);
  /** A box from one point to another: edges, diagonals, glyph strokes. */
  const bar = (finish: Finish, from: Three.Vector3, to: Three.Vector3, thickness: number) => {
    const along = to.clone().sub(from);
    const turn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), along.clone().normalize());
    const middle = from.clone().add(to).multiplyScalar(0.5);
    at(finish, middle.x, middle.y, middle.z, thickness, along.length(), thickness, turn);
  };

  const mesh = (geometry: Three.BufferGeometry, material: Three.Material, shadows = true) => {
    const object = new THREE.Mesh(geometry, material);
    object.castShadow = shadows;
    object.receiveShadow = true;
    object.userData.ticker = ticker;
    group.add(object);
    solids.push(object);
    return object;
  };
  const own = <T extends Three.BufferGeometry>(geometry: T) => {
    geometries.push(geometry);
    return geometry;
  };

  /** Glass shades from a darker foot to a brighter head, like a reflected sky. */
  const shadeAt = (y: number) => 0.6 + 0.4 * Math.min(1, Math.max(0, y / Math.max(height, 1)));

  let variant = 0;
  /** A glass box whose window cells line up with its bays and floors, offset so the lit offices never repeat. */
  const skin = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, bayX: number, bayZ: number, floor: number, material = glass, inset = RECESS) => {
    const w = x1 - x0 - inset * 2;
    const d = z1 - z0 - inset * 2;
    const h = y1 - y0;
    const geometry = own(new THREE.BoxGeometry(w, h, d));
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const uv = geometry.getAttribute("uv");
    const colours = new Float32Array(position.count * 3);
    const shift = (variant += 3) / 8;
    for (let index = 0; index < position.count; index += 1) {
      const px = position.getX(index);
      const py = position.getY(index);
      const pz = position.getZ(index);
      const across = Math.abs(normal.getX(index)) > 0.5 ? (pz + d / 2) / bayZ : (px + w / 2) / bayX;
      if (Math.abs(normal.getY(index)) > 0.5) uv.setXY(index, 0.03, 0.01);
      else uv.setXY(index, across / 8 + shift, (py + h / 2) / floor / 8 + shift * 0.5);
      const shade = shadeAt(y0 + py + h / 2);
      colours.set([shade, shade, shade], index * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    mesh(geometry, material).position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2);
  };

  /** Warm-lit glass set deep behind the facade line, divided by mullions on its visible faces. */
  const litRecess = (cx: number, y0: number, cz: number, w: number, h: number, d: number, faces: Face[]) => {
    const recess = new THREE.Mesh(kit.box, lobbyGlass);
    recess.scale.set(w, h, d);
    recess.position.set(cx, y0 + h / 2, cz);
    recess.userData.ticker = ticker;
    recess.receiveShadow = true;
    group.add(recess);
    solids.push(recess);
    for (const face of faces) {
      const length = face === "+x" ? d : w;
      const count = Math.max(2, Math.round(length / (BAY * 1.2)));
      for (let index = 1; index < count; index += 1) {
        const along = (face === "+x" ? cz - d / 2 : cx - w / 2) + (index * length) / count;
        if (face === "+x") at("frame", cx + w / 2, y0 + h / 2, along, 0.02, h, 0.016);
        else at("frame", along, y0 + h / 2, cz + d / 2, 0.016, h, 0.02);
      }
    }
  };

  /** A mullion, or (deeper, in trim) a fin, standing on a face from y0 to y1. */
  const mullion = (face: Face, plane: number, along: number, y0: number, y1: number, fin: boolean) => {
    const depth = fin ? RECESS + 0.05 : RECESS - 0.006;
    const thick = fin ? 0.026 : 0.018;
    const y = (y0 + y1) / 2;
    if (face === "+x") at(fin ? "metal" : "frame", plane - RECESS + depth / 2, y, along, depth, y1 - y0, thick);
    else at(fin ? "metal" : "frame", along, y, plane - RECESS + depth / 2, thick, y1 - y0, depth);
  };

  const lobbyHeight = Math.min(0.28, Math.max(0.1, height * 0.05));

  /**
   * One curtain-walled mass from (x0, z0) to (x1, z1), rising from y0 to y1.
   * Visible faces get mullions, and fins or ledges by the rhythm; every mass
   * gets corner piers. A mass on the ground opens into a lit lobby. Returns
   * its grid, so a crown can carry it on.
   */
  const mass = (
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    y0: number,
    y1: number,
    faces: Face[],
    rhythm: Rhythm,
    { parapet = true, lobby = y0 === 0, material = glass }: { parapet?: boolean; lobby?: boolean; material?: Three.MeshStandardMaterial } = {},
  ) => {
    const w = x1 - x0;
    const d = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const hasLobby = lobby && y1 - y0 > lobbyHeight * 3;
    const start = hasLobby ? y0 + lobbyHeight + 0.035 : y0;
    if (hasLobby) {
      litRecess(cx, y0, cz, w - 0.14, lobbyHeight, d - 0.14, faces);
      at("frame", cx, y0 + lobbyHeight + 0.0175, cz, w + 0.03, 0.035, d + 0.03);
    }
    const floors = Math.max(1, Math.round((y1 - start) / FLOOR));
    const floor = (y1 - start) / floors;
    const bayX = w / Math.max(2, Math.round(w / BAY));
    const bayZ = d / Math.max(2, Math.round(d / BAY));
    skin(x0, x1, z0, z1, start, y1, bayX, bayZ, floor, material);
    for (const px of [x0 + PIER / 2, x1 - PIER / 2]) for (const pz of [z0 + PIER / 2, z1 - PIER / 2]) at("frame", px, (y0 + y1) / 2, pz, PIER, y1 - y0, PIER);
    for (const face of faces) {
      const length = face === "+x" ? d : w;
      const bay = face === "+x" ? bayZ : bayX;
      for (let index = 1; index < Math.round(length / bay); index += 1) mullion(face, face === "+x" ? x1 : z1, (face === "+x" ? z0 : x0) + index * bay, start, y1, index % rhythm.finEvery === 0);
    }
    for (let index = rhythm.ledgeEvery; index < floors; index += rhythm.ledgeEvery) at("metal", cx, start + index * floor, cz, w + 0.02, 0.022, d + 0.02);
    if (parapet) rim(x0, x1, z0, z1, y1);
    return { top: y1 + (parapet ? PARAPET : 0), start, floor, bayX, bayZ };
  };

  /** A parapet around a roof deck. */
  const rim = (x0: number, x1: number, z0: number, z1: number, y: number, finish: Finish = "frame", tall = PARAPET) => {
    const w = x1 - x0;
    const d = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const width = RECESS + 0.03;
    const middle = y + tall / 2;
    at(finish, cx, middle, z1 - width / 2 + 0.01, w + 0.02, tall, width);
    at(finish, cx, middle, z0 + width / 2 - 0.01, w + 0.02, tall, width);
    at(finish, x1 - width / 2 + 0.01, middle, cz, width, tall, d + 0.02);
    at(finish, x0 + width / 2 - 0.01, middle, cz, width, tall, d + 0.02);
  };

  /** A recessed, lit sky lobby breaking a tall mass, its piers carrying on through. */
  const skyBreak = (x0: number, x1: number, z0: number, z1: number, y: number, faces: Face[]) => {
    const tall = FLOOR * 0.9;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    for (const level of [y + 0.0125, y + tall - 0.0125]) at("frame", cx, level, cz, x1 - x0 + 0.03, 0.025, z1 - z0 + 0.03);
    litRecess(cx, y, cz, x1 - x0 - 0.16, tall, z1 - z0 - 0.16, faces);
    for (const px of [x0 + PIER / 2, x1 - PIER / 2]) for (const pz of [z0 + PIER / 2, z1 - PIER / 2]) at("frame", px, y + tall / 2, pz, PIER, tall, PIER);
    return y + tall;
  };

  /** Lit edges up the visible corners of a mass: the identity's light drawn along the structure. */
  const edgeLights = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, corners: ("front" | "left" | "right")[] = ["front", "left", "right"]) => {
    const t = 0.022;
    const spots = { front: [x1, z1], left: [x0, z1], right: [x1, z0] } as const;
    for (const corner of corners) {
      const [x, z] = spots[corner];
      at("accent", x + (x > (x0 + x1) / 2 ? t / 2 - 0.004 : -t / 2 + 0.004), (y0 + y1) / 2, z + (z > (z0 + z1) / 2 ? t / 2 - 0.004 : -t / 2 + 0.004), t, y1 - y0, t);
    }
  };

  /**
   * A pixel-grid letter in the identity's light, on a dark panel standing
   * off a face, or lying on a roof ("+y"). A face is +x, +z, or any upright
   * plane given by its turn about the vertical (0 faces +z, a quarter turn
   * faces +x, an eighth faces the viewer).
   */
  const glyph = (letter: string, face: Face | "+y" | number, cx: number, cy: number, cz: number, size: number, panel = true) => {
    const rows = GLYPHS[letter];
    if (!rows) return;
    const pixel = size / 9;
    if (face === "+y") {
      if (panel) at("frame", cx, cy, cz, size * 0.8, 0.03, size);
      rows.forEach((row, r) => [...row].forEach((on, c) => on === "1" && at("accent", cx + (c - 2) * pixel, cy + 0.02, cz - (3 - r) * pixel, pixel * 0.86, 0.012, pixel * 0.86)));
      return;
    }
    const angle = face === "+x" ? Math.PI / 2 : face === "+z" ? 0 : face;
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    // The face's own right (as the viewer reads it) and outward normal.
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(turn);
    const out = new THREE.Vector3(0, 0, 1).applyQuaternion(turn);
    if (panel) at("frame", cx, cy, cz, size * 0.8, size, 0.04, turn);
    rows.forEach((row, r) => {
      [...row].forEach((on, c) => {
        if (on !== "1") return;
        const u = (c - 2) * pixel;
        const v = (3 - r) * pixel;
        at("accent", cx + right.x * u + out.x * 0.024, cy + v, cz + right.z * u + out.z * 0.024, pixel * 0.86, pixel * 0.86, 0.012, turn);
      });
    });
  };

  /** Triangles for a custom surface, each wound to face `outward` (or away from `centre`). */
  const surface = (centre: Three.Vector3) => {
    const position: number[] = [];
    const uv: number[] = [];
    const colour: number[] = [];
    return {
      tri(points: Three.Vector3[], uvs: number[][] = [[0, 0], [0, 0], [0, 0]], outward?: Three.Vector3) {
        const [a, b, c] = points;
        const normal = b.clone().sub(a).cross(c.clone().sub(a));
        const away = outward ?? a.clone().add(b).add(c).divideScalar(3).sub(centre);
        const order = normal.dot(away) >= 0 ? [0, 1, 2] : [0, 2, 1];
        for (const index of order) {
          const each = points[index];
          position.push(each.x, each.y, each.z);
          uv.push(...uvs[index]);
          const shade = shadeAt(each.y);
          colour.push(shade, shade, shade);
        }
      },
      build(material: Three.Material) {
        const geometry = own(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colour, 3));
        geometry.computeVertexNormals();
        return mesh(geometry, material);
      },
    };
  };

  /** A round glass drum (AERO), with window cells wrapped round it and mullions on the side facing the viewer. */
  const drum = (cx: number, cz: number, radius: number, y0: number, y1: number, { finEvery = 3, ledgeEvery = 2 } = {}) => {
    const h = y1 - y0;
    const segments = 28;
    const geometry = own(new THREE.CylinderGeometry(radius - RECESS, radius - RECESS, h, segments, 1, true));
    const circumference = Math.PI * 2 * radius;
    const bays = Math.max(8, Math.round(circumference / BAY));
    const floors = Math.max(1, Math.round(h / FLOOR));
    const uv = geometry.getAttribute("uv");
    const position = geometry.getAttribute("position");
    const colours = new Float32Array(position.count * 3);
    const shift = (variant += 3) / 8;
    for (let index = 0; index < uv.count; index += 1) {
      uv.setXY(index, (uv.getX(index) * bays) / 8 + shift, (uv.getY(index) * floors) / 8);
      const shade = shadeAt(y0 + position.getY(index) + h / 2);
      colours.set([shade, shade, shade], index * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    mesh(geometry, glass).position.set(cx, y0 + h / 2, cz);
    // Mullions round the half that faces the viewer, a deeper fin every few.
    for (let index = 0; index < bays; index += 1) {
      const angle = (index / bays) * Math.PI * 2;
      const nx = Math.sin(angle);
      const nz = Math.cos(angle);
      if (nx + nz < -0.35) continue;
      const fin = index % finEvery === 0;
      const depth = fin ? RECESS + 0.045 : RECESS - 0.004;
      const reach = radius - RECESS + depth / 2;
      const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      at(fin ? "metal" : "frame", cx + nx * reach, y0 + h / 2, cz + nz * reach, fin ? 0.026 : 0.018, h, depth, turn);
    }
    // Floor rings every few floors, and a cap.
    for (let floor = ledgeEvery; floor < floors; floor += ledgeEvery) part("drum", "metal", cx, y0 + (floor * h) / floors, cz, radius * 2 + 0.03, 0.022, radius * 2 + 0.03);
    part("drum", "frame", cx, y1 + PARAPET / 2, cz, radius * 2 + 0.02, PARAPET, radius * 2 + 0.02);
    return y1 + PARAPET;
  };

  /** Close the model: instanced parts, contact shading, and the Building record the city drives. */
  const finish = (top: number): Building => {
    for (const { shape, finish: name, list } of parts.values()) {
      const instanced = new THREE.InstancedMesh(shape === "box" ? kit.box : kit.drum, finishes[name], list.length);
      list.forEach((each, index) => instanced.setMatrixAt(index, each));
      instanced.castShadow = name !== "accent";
      instanced.receiveShadow = true;
      instanced.userData.ticker = ticker;
      group.add(instanced);
      solids.push(instanced);
    }
    const blob = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: kit.blob, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.scale.set(f * 1.7, f * 1.7, 1);
    blob.position.y = 0.004;
    blob.renderOrder = 1;
    group.add(blob);
    extraMaterials.push(blob.material);
    const materials = { glass, frame, metal, accent };
    return {
      group,
      solids,
      materials,
      panes: [glass, roofGlass, lobbyGlass],
      textures: [],
      built: height,
      top,
      dispose: () => {
        group.traverse((object) => {
          if ((object as Three.InstancedMesh).isInstancedMesh) (object as Three.InstancedMesh).dispose();
        });
        geometries.forEach((geometry) => geometry.dispose());
        [glass, frame, metal, accent, roofGlass, lobbyGlass, ...extraMaterials].forEach((material) => material.dispose());
      },
    };
  };

  return {
    THREE,
    f,
    height,
    ticker,
    group,
    materials: { glass, frame, metal, accent, roofGlass, lobbyGlass },
    lobbyHeight,
    at,
    bar,
    part,
    mesh,
    own,
    skin,
    mass,
    rim,
    mullion,
    litRecess,
    skyBreak,
    edgeLights,
    glyph,
    surface,
    drum,
    shadeAt,
    finish,
  };
}
