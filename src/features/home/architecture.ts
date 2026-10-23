import type * as Three from "three";
import { aero } from "./towers/aero";
import { bolt } from "./towers/bolt";
import { kron } from "./towers/kron";
import { luma } from "./towers/luma";
import { medix } from "./towers/medix";
import { nova } from "./towers/nova";
import { terra } from "./towers/terra";
import { vanta } from "./towers/vanta";

/**
 * The city's buildings. Every asset has its own hand-designed tower (see
 * ./towers), built from one shared kit so the eight read as one city. This
 * file holds what all of them share: the geometry and textures made once per
 * scene, the Building record the city drives, and the lookup from asset to
 * design.
 */

/** Geometry and textures shared by every building. */
export type Kit = {
  THREE: typeof Three;
  box: Three.BoxGeometry;
  /** A smooth cylinder, for round parts (AERO's floor rings and helipad). */
  drum: Three.CylinderGeometry;
  blob: Three.Texture;
  /** Curtain-wall glass: per-pane tint with dark spandrels (map), and the offices that are lit (glow). One cell per bay and floor. */
  facade: { map: Three.Texture; glow: Three.Texture };
};

export function makeKit(THREE: typeof Three): Kit {
  return {
    THREE,
    box: new THREE.BoxGeometry(1, 1, 1),
    drum: new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
    blob: new THREE.CanvasTexture(paintBlob()),
    facade: paintFacade(THREE),
  };
}

export function disposeKit(kit: Kit) {
  kit.box.dispose();
  kit.drum.dispose();
  kit.blob.dispose();
  kit.facade.map.dispose();
  kit.facade.glow.dispose();
}

/**
 * An 8 × 8 grid of curtain-wall cells, each one bay wide and one floor high.
 * The map varies each pane's tone a little and darkens a spandrel band at the
 * foot of every floor; the glow lights about one office in five, most of them
 * warm, a few cool, some only partly (blinds half down).
 */
function paintFacade(THREE: typeof Three) {
  const size = 128;
  const cell = size / 8;
  const tone = document.createElement("canvas");
  const glow = document.createElement("canvas");
  tone.width = tone.height = glow.width = glow.height = size;
  const paint = tone.getContext("2d");
  const light = glow.getContext("2d");
  if (paint && light) {
    light.fillStyle = "#000";
    light.fillRect(0, 0, size, size);
    let seed = 7;
    const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const x = column * cell;
        const y = row * cell;
        const value = Math.round(200 + random() * 55);
        paint.fillStyle = `rgb(${value - 8}, ${value - 3}, ${value})`;
        paint.fillRect(x, y, cell, cell);
        // The spandrel: the floor slab seen through the glass.
        paint.fillStyle = "rgb(70, 76, 96)";
        paint.fillRect(x, y + cell - 4, cell, 4);
        const chance = random();
        if (chance < 0.78) continue;
        const blinds = random() < 0.35 ? Math.round(cell * 0.45) : 1;
        light.fillStyle = chance > 0.95 ? "#9cc4ff" : chance > 0.88 ? "#ffe2b8" : "#ffc98e";
        light.fillRect(x + 1, y + blinds, cell - 2, cell - 4 - blinds);
      }
    }
  }
  const texture = (canvas: HTMLCanvasElement) => {
    const made = new THREE.CanvasTexture(canvas);
    made.wrapS = made.wrapT = THREE.RepeatWrapping;
    made.colorSpace = THREE.SRGBColorSpace;
    made.anisotropy = 4;
    return made;
  };
  return { map: texture(tone), glow: texture(glow) };
}

/** A soft dark pool: contact shading where a building meets the ground. */
function paintBlob() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const fade = context.createRadialGradient(64, 64, 10, 64, 64, 64);
  fade.addColorStop(0, "rgba(0, 0, 10, 0.75)");
  fade.addColorStop(0.55, "rgba(0, 0, 10, 0.4)");
  fade.addColorStop(1, "rgba(0, 0, 10, 0)");
  context.fillStyle = fade;
  context.fillRect(0, 0, 128, 128);
  return canvas;
}

export type Building = {
  group: Three.Group;
  /** Everything a pointer can hit. */
  solids: Three.Object3D[];
  /** The materials the selection look recolours; each remembers its own colour in userData.base. */
  materials: { glass: Three.MeshStandardMaterial; frame: Three.MeshStandardMaterial; metal: Three.MeshStandardMaterial; accent: Three.MeshStandardMaterial };
  /** Every glass surface, for dimming and highlighting. */
  panes: Three.MeshStandardMaterial[];
  textures: Three.Texture[];
  /** Height the model was built at; live changes scale it, and it is rebuilt if they stray far. */
  built: number;
  /** Highest point, at the built height. */
  top: number;
  dispose: () => void;
};

type Design = (kit: Kit, options: { ticker: string; height: number; footprint: number }) => Building;

/** Each asset's tower. The keys are the market's tickers (Vanta is VNTA, Medix MEDX, Terra TERA). */
const DESIGNS: Record<string, Design> = { NOVA: nova, AERO: aero, VNTA: vanta, KRON: kron, MEDX: medix, TERA: terra, BOLT: bolt, LUMA: luma };

export function buildTower(kit: Kit, options: { ticker: string; tone: string; height: number; footprint: number }): Building {
  // The market has exactly these eight assets; anything else borrows the benchmark's design rather than failing.
  const design = DESIGNS[options.ticker] ?? nova;
  return design(kit, { ticker: options.ticker, height: options.height, footprint: options.footprint });
}
