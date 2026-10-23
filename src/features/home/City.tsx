"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type * as Three from "three";
import { Loader } from "@/features/shell/Loader";
import { rupees, signedPercent } from "@/features/trade/ui";
import { buildTower, disposeKit, makeKit, type Building, type Kit } from "./architecture";
import type { Holding } from "./portfolio";

/**
 * The portfolio city: one building per holding, drawn with Three.js in an
 * isometric view, standing on a round, stepped plaza like a model city on its
 * display stand. A building's height is its share of the portfolio's market
 * value (the largest holding is the tallest); its architecture comes from the
 * asset (see architecture.ts). Labels are real buttons laid over the scene, so
 * every building can be reached by keyboard and screen reader as well as by
 * pointer, and they step out of each other's way as the city turns.
 *
 * Motion follows the simulation, in two kinds: price ticks ease a building
 * quickly to its new height; a trade is a consequence, shown once and slowly
 * (a building rises for a new holding, grows or shrinks, comes down when sold
 * out, glides to a new place when the set of holdings changes, and its accents
 * light for a moment). Around that, one ambient motion: the plaza turns through
 * a full circle every four minutes, slowing to a stop while a building is
 * pointed at or chosen, and pausing whenever the city can't be seen. With
 * reduced motion the city stands still at its designed angle and every change
 * happens instantly.
 *
 * A building is rebuilt only when its height has moved far enough to change
 * its floor count.
 */

/** Height of the largest holding, in scene units. */
const TALLEST = 6.4;
/** The smallest a building is drawn, so a small holding can still be read and picked. */
const SHORTEST = 0.9;
/**
 * Height from portfolio share. Monotonic (a larger share is always taller)
 * and compressed (exponent 0.6) so a small position next to a large one stays
 * readable; the exact share is printed on every building's tag.
 */
const heightFor = (weight: number, largest: number) => (largest > 0 ? SHORTEST + (TALLEST - SHORTEST) * Math.pow(Math.max(0, weight) / largest, 0.6) : SHORTEST);
/** A building's footprint grows a little with its share. */
const footprintFor = (weight: number) => 1.45 + Math.sqrt(Math.max(0, weight)) * 0.6;
/** Timing, matching the CSS motion tokens: a state change, and a consequence. */
const QUICK = 260;
const EVENT = 900;
/** A change smaller than this share of a building's height is a price tick, not an event. */
const TICK = 0.05;
/** Where the city's last settled heights are kept, so a return to Home can show what changed while away. */
const SEEN = "fintix.city.seen.v1";

/** One full turn of the plaza, in milliseconds: slow enough to read as life, never as movement to follow. */
export const SPIN_MS = 240_000;
/** How quickly the turn slows to a stop (a building pointed at or chosen) and picks up again. */
const SPIN_SETTLE = 260;
/** While the turn is the only thing moving, frames are drawn at about 30 a second: at this speed a frame moves a twentieth of a degree. */
const AMBIENT_FRAME = 32;
/** The city coming out of the dark on a first visit: exposure and a small settle of the camera. */
const BOOT_MS = 1600;
/** The plaza is never framed smaller than this radius, so one building alone doesn't fill the screen. */
const MIN_FRAME = 4.6;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
type Tween = { from: number; to: number; start: number; duration: number };
type Glide = { fromX: number; fromZ: number; toX: number; toZ: number; start: number; duration: number };

function readSeen(): Record<string, number> | null {
  try {
    return JSON.parse(window.sessionStorage.getItem(SEEN) ?? "null");
  } catch {
    return null;
  }
}
/** The view: from the corner, looking down at about 27 degrees. */
const VIEW = { x: 1, y: 0.72, z: 1 };
/** How far the camera stands from the city's centre, along the view. */
const CAMERA_DISTANCE = 120;
/** How far a building may stretch from the height it was built at before it is rebuilt. */
const REBUILD_AT = 0.14;

type Block = {
  ticker: string;
  tone: string;
  footprint: number;
  height: number;
  target: number;
  building: Building;
  slot: Three.Group;
  /** A footprint outline on the ground, shown only while the building is selected. */
  ring: Three.LineLoop;
  ringMaterial: Three.LineBasicMaterial;
  /** Shares held when last drawn: a change means a trade, and lights the building once. */
  qty: number;
  rise: Tween | null;
  glide: Glide | null;
  /** When the building's accents were last lit by a trade. */
  pulse: number;
  /** Sold out: it comes down, then it is removed. */
  leaving: boolean;
  /** The accent's resting glow, set by the selection look. */
  accentRest: number;
  /** 0–1: how far the pointer's hover light has come up on this building (eased in the frame loop). */
  hoverMix: number;
};

type World = {
  THREE: typeof Three;
  kit: Kit;
  renderer: Three.WebGLRenderer;
  scene: Three.Scene;
  camera: Three.OrthographicCamera;
  sun: Three.DirectionalLight;
  /** A warm light over the selected building: gold is FINTIX's colour for what is yours. */
  spot: Three.SpotLight;
  /** The faint pool of light the plaza stands in. */
  glow: Three.Texture;
  /** The plaza's paving, painted for its size; replaced when the plaza changes size. */
  paving: Three.Texture | null;
  /** A soft dark patch under each building where it meets the ground, shared by all of them. */
  contact: { geometry: Three.PlaneGeometry; material: Three.MeshBasicMaterial; texture: Three.Texture };
  /** Everything that turns: the plaza and the buildings on it. */
  turntable: Three.Group;
  /** The plaza itself (rebuilt when the set of holdings changes). */
  plate: Three.Group;
  /** The plaza's edge lights, which come up last when the city boots. */
  rims: { material: Three.MeshBasicMaterial; rest: number }[];
  blocks: Map<string, Block>;
  raycaster: Three.Raycaster;
  frame: number;
  last: number;
  lastRender: number;
  /** The plaza's turn: its angle, its speed (0 stopped, 1 full) and whether it can be seen at all. */
  spin: { angle: number; speed: number; visible: boolean };
  /** First visit: when the city started coming out of the dark. */
  boot: { start: number } | null;
  /** Radius the camera frames (the plaza, never less than MIN_FRAME), and the radius the buildings stand within. */
  frameRadius: number;
  lotRadius: number;
  /** The tallest a building on the ring may stand (with room for its label), for framing; the centre one is always TALLEST. */
  ringTop: number;
  look: { selected: string | null; hovered: string | null };
  /** How far each label has stepped up out of another's way, eased between frames. */
  lift: Map<string, number>;
  /** The frame fitted to the city, and the small pan towards the selected building added to it. */
  view: View;
  /** A reframe in progress (the HUD opened or closed beside the city): from where, and when it started. */
  reframe: { from: View; to: View; start: number } | null;
  pan: { x: number; y: number };
  /** False until the first set of buildings is placed: buildings present on arrival don't rise. */
  placed: boolean;
  /** Shaders are compiled before the first frame (in parallel where the GPU allows), so the page isn't held up by it. */
  compiled: "no" | "pending" | "yes";
  /** The first frame with the buildings in it has been drawn and announced. */
  announced: boolean;
  draw: () => void;
  /** Frame the city inside the area the HUD leaves free; `glide` eases there instead of jumping. */
  fit: (glide?: boolean) => void;
};

type View = { left: number; right: number; top: number; bottom: number };

/** How long the camera takes to reframe when the HUD beside the city changes: an on-screen move, so ease-in-out. */
const REFRAME = 420;
/** Ambient life: an office light changes every few seconds and the low sun drifts a few degrees over minutes. */
const AMBIENT_EVERY = 4200;

/**
 * Where each building stands, in the holdings' order (largest first): the
 * largest at the centre of the plaza, the rest on one ring around it, spaced
 * so no two footprints come closer than a street's width. The next largest
 * start either side of the back of the view and the smaller ones work round to the front,
 * so on arrival the tall ones never hide the short ones; as the plaza turns,
 * every building comes round to the front in its turn.
 */
function layout(weights: number[]) {
  if (!weights.length) return [];
  const halves = weights.map((weight) => footprintFor(weight) / 2);
  const ring = weights.length - 1;
  if (!ring) return [{ x: 0, z: 0 }];
  const widest = Math.max(...halves.slice(1));
  const street = 0.95;
  // Clear of the centre building, and wide enough that neighbours on the ring keep a street between them.
  const radius = Math.max(halves[0] + widest + street, ring > 1 ? (widest * 2 + street) / (2 * Math.sin(Math.PI / ring)) : 0);
  const back = Math.atan2(-1, -1);
  const step = (Math.PI * 2) / ring;
  return weights.map((_, index) => {
    if (index === 0) return { x: 0, z: 0 };
    // Either side of the back, half a step off it so none stands straight behind the centre: ±½, ±1½, ±2½ steps.
    const turn = ring === 1 ? 0 : (index % 2 === 1 ? 1 : -1) * (Math.ceil(index / 2) - 0.5);
    const angle = back + turn * step;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
  });
}

/**
 * The tallest any building off the centre stands, plus a fifth for price moves, for framing. With `blocks`, only
 * buildings actually standing off the centre count (placement is kept between layouts, so the largest holding may no
 * longer be the one in the middle).
 */
function ringTopFor(list: Holding[], blocks?: Map<string, Block>) {
  const largest = Math.max(...list.map((holding) => holding.weight), 0);
  const ring = blocks ? list.filter((holding) => { const block = blocks.get(holding.asset.ticker); return block && Math.hypot(block.slot.position.x, block.slot.position.z) > 0.1; }) : list.slice(1);
  if (!ring.length) return 0;
  return Math.min(TALLEST, Math.max(...ring.map((holding) => heightFor(holding.weight, largest))) * 1.2);
}

/** Highlight the selected building and step the others back. Colours return exactly to each material's own. */
function lookOf(world: World, block: Block) {
  const { selected } = world.look;
  const picked = selected === block.ticker;
  const dimmed = selected !== null && !picked;
  const shade = dimmed ? 0.58 : 1;
  const { panes, materials } = block.building;
  for (const pane of panes) {
    pane.color.setHex(pane.userData.base as number).multiplyScalar(shade);
    pane.emissiveIntensity = dimmed ? 0.22 : picked ? 0.7 : 0.46;
  }
  for (const material of [materials.frame, materials.metal, materials.accent]) material.color.setHex(material.userData.base as number).multiplyScalar(shade);
  materials.accent.emissive.setHex(materials.accent.userData.base as number).multiplyScalar(shade);
  block.accentRest = picked ? 1.8 : dimmed ? 0.3 : 0.9;
  materials.accent.emissiveIntensity = block.accentRest + 0.7 * block.hoverMix;
  block.ringMaterial.opacity = picked ? 0.85 : 0.35 * block.hoverMix;
}

/** A sold-out building starts coming down; the frame loop removes it once it has. */
function retire(block: Block, now: number) {
  if (block.leaving) return;
  block.leaving = true;
  block.rise = { from: block.height, to: 0, start: now, duration: EVENT * 0.8 };
  block.target = 0;
}

function disposeBlock(block: Block) {
  block.building.dispose();
  block.ring.geometry.dispose();
  block.ringMaterial.dispose();
}

/**
 * The environment the glass reflects: a night sky, deep navy overhead and
 * lighter blue haze at the horizon, over a dim city glow. In this downward
 * view the walls reflect the band below the horizon and roofs and crown facets
 * the sky, so each face takes its own tone.
 */
function nightSky(THREE: typeof Three) {
  const scene = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: "varying vec3 direction; void main() { direction = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `varying vec3 direction;
        void main() {
          float y = direction.y;
          vec3 zenith = vec3(0.03, 0.05, 0.14);
          vec3 horizon = vec3(0.30, 0.42, 0.78);
          vec3 ground = vec3(0.05, 0.07, 0.16);
          vec3 colour = y > 0.0 ? mix(horizon, zenith, pow(y, 0.55)) : mix(horizon, ground, pow(-y, 0.6));
          // City glow on the key light's side, which the sunlit walls reflect; the shaded walls look into the darker side.
          colour += vec3(0.22, 0.30, 0.55) * pow(max(dot(direction, normalize(vec3(0.75, -0.35, -0.55))), 0.0), 3.0);
          // A warm glow low in the key light's direction.
          colour += vec3(0.9, 0.7, 0.5) * pow(max(dot(direction, normalize(vec3(0.9, 0.35, 0.4))), 0.0), 24.0) * 1.4;
          gl_FragColor = vec4(colour, 1.0);
        }`,
    }),
  );
  scene.add(dome);
  return {
    scene,
    dispose: () => {
      dome.geometry.dispose();
      dome.material.dispose();
    },
  };
}

/** A soft, cool pool of light under the plaza, so it sits in the night instead of on top of it. */
function paintGlow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const fade = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  fade.addColorStop(0, "rgba(96, 124, 214, 0.2)");
  fade.addColorStop(0.45, "rgba(70, 96, 190, 0.08)");
  fade.addColorStop(1, "rgba(40, 60, 150, 0)");
  context.fillStyle = fade;
  context.fillRect(0, 0, 256, 256);
  return canvas;
}

/** Where a building meets the ground: darkest under its walls, gone a little beyond them. Stands in for ambient occlusion. */
function paintContact() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const fade = context.createRadialGradient(64, 64, 16, 64, 64, 64);
  fade.addColorStop(0, "rgba(0, 1, 8, 0.78)");
  fade.addColorStop(0.5, "rgba(0, 1, 8, 0.38)");
  fade.addColorStop(1, "rgba(0, 1, 8, 0)");
  context.fillStyle = fade;
  context.fillRect(0, 0, 128, 128);
  return canvas;
}

/**
 * The plaza's paving: square pixel tiles of a constant size (so a larger
 * plaza has more of them, never bigger ones), joints a step darker, each
 * tile's tone varied a little, the centre lit and the rim falling into shade,
 * and one bright band a tile inside the edge.
 */
function paintPaving(tiles: number) {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.fillStyle = "rgb(9, 13, 34)";
  context.fillRect(0, 0, size, size);
  const cell = size / tiles;
  let seed = 19;
  const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let row = 0; row < tiles; row += 1) {
    for (let column = 0; column < tiles; column += 1) {
      const vary = random() * 7;
      context.fillStyle = `rgb(${Math.round(23 + vary)}, ${Math.round(30 + vary)}, ${Math.round(66 + vary * 1.6)})`;
      context.fillRect(column * cell + 2, row * cell + 2, cell - 4, cell - 4);
    }
  }
  const centre = size / 2;
  const shade = context.createRadialGradient(centre, centre, size * 0.12, centre, centre, size * 0.5);
  shade.addColorStop(0, "rgba(2, 3, 16, 0)");
  shade.addColorStop(1, "rgba(2, 3, 16, 0.58)");
  context.fillStyle = shade;
  context.fillRect(0, 0, size, size);
  context.strokeStyle = "rgba(78, 102, 188, 0.6)";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(centre, centre, size / 2 - cell * 0.9, 0, Math.PI * 2);
  context.stroke();
  return canvas;
}

function disposeTree(root: Three.Object3D) {
  root.traverse((object) => {
    const mesh = object as Three.Mesh;
    mesh.geometry?.dispose();
    (Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []).forEach((material) => material.dispose());
  });
}

export function City({
  holdings,
  selected,
  onSelect,
  reduced,
  frame,
  highlight = null,
  onHover,
  onFirstFrame,
  lightsAt = null,
  boot = "quiet",
}: {
  holdings: Holding[];
  selected: string | null;
  onSelect: (ticker: string | null) => void;
  reduced: boolean;
  /** Changes when the HUD beside the city opens or closes: the camera glides to the new free area. */
  frame?: string;
  /** A holding pointed at elsewhere on the page (its row): its building lights as if pointed at. */
  highlight?: string | null;
  /** Reports the building under the pointer, so its row can answer. */
  onHover?: (ticker: string | null) => void;
  /** Called once, when the first frame with the buildings in it has been drawn: the rest of the opening keys off it. */
  onFirstFrame?: () => void;
  /** When the lights may come up on a first visit (a performance.now() time); until then the city waits in the dark. */
  lightsAt?: number | null;
  /** "full": the first visit of a session, the city comes out of the dark; "quiet": it is simply there. */
  boot?: "full" | "quiet";
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const world = useRef<World | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [hover, setHover] = useState<{ ticker: string; x: number; y: number } | null>(null);
  const latest = useRef({ holdings, selected, reduced, boot, onHover, onFirstFrame, lightsAt });

  useEffect(() => {
    latest.current = { holdings, selected, reduced, boot, onHover, onFirstFrame, lightsAt };
  });

  /* ---- Build the scene once ---- */
  useEffect(() => {
    const element = canvas.current;
    const container = box.current;
    if (!element || !container) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let watcher: IntersectionObserver | null = null;
    let onVisibility: (() => void) | null = null;

    (async () => {
      const THREE = await import("three");
      if (cancelled) return;
      let renderer: Three.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: element, antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        setState("failed");
        return;
      }
      renderer.setClearColor(0x000000, 0);
      // Neutral tone mapping keeps the assets' blues blue (filmic curves push saturated blue towards violet).
      renderer.toneMapping = THREE.NeutralToneMapping;
      // A first visit starts in the dark; the frame loop brings the light up.
      const booting = latest.current.boot === "full" && !latest.current.reduced;
      renderer.toneMappingExposure = booting ? 0.04 : 1;
      renderer.shadowMap.enabled = true;
      // Soft-edged shadows (three r186 folds the old soft variant into PCF with a radius).
      renderer.shadowMap.type = THREE.PCFShadowMap;

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const sky = nightSky(THREE);
      scene.environment = pmrem.fromScene(sky.scene, 0.02).texture;
      scene.environmentIntensity = 1;
      sky.dispose();
      pmrem.dispose();

      // One warm key light from the right casts the shadows; a cool sky fill and a faint fill from the left keep the shaded faces readable without flattening them.
      scene.add(new THREE.HemisphereLight(0x8fa6e6, 0x0a0e24, 0.42));
      const sun = new THREE.DirectionalLight(0xfff0dc, 3);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.02;
      sun.shadow.radius = 3;
      scene.add(sun, sun.target);
      const fill = new THREE.DirectionalLight(0xa9c2ff, 0.25);
      fill.position.set(-4, 6, 10);
      // A cool rim from behind lights only roofs and top edges, separating the skyline from the dark scene.
      const rim = new THREE.DirectionalLight(0x9db8ff, 0.75);
      rim.position.set(-8, 12, -7);
      const spot = new THREE.SpotLight(0xffd28a, 0, 0, 0.34, 0.65, 0);
      scene.add(fill, rim, spot, spot.target);

      const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
      const direction = new THREE.Vector3(VIEW.x, VIEW.y, VIEW.z).normalize();
      camera.position.copy(direction.clone().multiplyScalar(CAMERA_DISTANCE));
      camera.lookAt(0, 0, 0);
      if (booting) camera.zoom = 0.94;

      const turntable = new THREE.Group();
      const plate = new THREE.Group();
      turntable.add(plate);
      scene.add(turntable);

      const current: World = {
        THREE,
        kit: makeKit(THREE),
        renderer,
        scene,
        camera,
        sun,
        spot,
        glow: new THREE.CanvasTexture(paintGlow()),
        paving: null,
        contact: (() => {
          const texture = new THREE.CanvasTexture(paintContact());
          return { geometry: new THREE.PlaneGeometry(1, 1), material: new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }), texture };
        })(),
        turntable,
        plate,
        rims: [],
        blocks: new Map(),
        raycaster: new THREE.Raycaster(),
        frame: 0,
        last: 0,
        lastRender: 0,
        spin: { angle: 0, speed: 0, visible: true },
        boot: booting ? { start: 0 } : null,
        frameRadius: MIN_FRAME,
        lotRadius: 2,
        ringTop: TALLEST,
        look: { selected: null, hovered: null },
        lift: new Map(),
        view: { left: -10, right: 10, top: 10, bottom: -10 },
        reframe: null,
        pan: { x: 0, y: 0 },
        placed: false,
        compiled: "no",
        announced: false,
        draw: () => {},
        fit: () => {},
      };

      const spot3 = new THREE.Vector3();
      /**
       * Place the labels over the building tops, largest holding first. A label
       * that would cover one already placed steps up above it, eased so the
       * plates drift apart rather than jump, with a thin leader down to its roof.
       * Written straight to the DOM: no React render per frame. Returns true
       * while a label is still easing.
       */
      const placeLabels = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        const placed: { x: number; y: number; w: number; h: number }[] = [];
        let settling = false;
        for (const holding of latest.current.holdings) {
          const ticker = holding.asset.ticker;
          const block = current.blocks.get(ticker);
          const label = labels.current.get(ticker);
          if (!block || !label || block.leaving) continue;
          const top = block.building.top * (block.height / block.building.built);
          block.slot.getWorldPosition(spot3);
          spot3.y = top + 0.3;
          spot3.project(camera);
          const anchorX = ((spot3.x + 1) / 2) * width;
          const anchorY = ((1 - spot3.y) / 2) * height;
          const w = label.offsetWidth;
          const h = label.offsetHeight;
          const x = anchorX - w / 2;
          const rest = anchorY - h;
          let y = rest;
          for (let tries = 0; tries < 8; tries += 1) {
            const hit = placed.find((other) => x < other.x + other.w + 4 && x + w + 4 > other.x && y < other.y + other.h + 3 && y + h + 3 > other.y);
            if (!hit) break;
            y = hit.y - h - 3;
          }
          placed.push({ x, y, w, h });
          const target = y - rest;
          const previous = current.lift.get(ticker) ?? target;
          let lift = latest.current.reduced ? target : previous + (target - previous) * 0.22;
          if (Math.abs(target - lift) < 0.5) lift = target;
          else settling = true;
          current.lift.set(ticker, lift);
          label.style.transform = `translate(${Math.round(x)}px, ${Math.round(rest + lift)}px)`;
          label.style.setProperty("--lead", `${Math.max(0, Math.round(-lift))}px`);
        }
        return settling;
      };

      /** Replace a building with one built at its current height, so its floors stay true to scale. */
      const rebuild = (block: Block) => {
        block.slot.remove(block.building.group);
        block.building.dispose();
        block.building = buildTower(current.kit, { ticker: block.ticker, tone: block.tone, height: block.height, footprint: block.footprint });
        block.slot.add(block.building.group);
        lookOf(current, block);
      };

      const step = (time: number) => {
        current.frame = 0;
        const now = performance.now();
        const dt = current.last ? Math.min(64, time - current.last) : 16;
        current.last = time;
        const reduced = latest.current.reduced;
        let moving = false;
        for (const block of [...current.blocks.values()]) {
          // Height: a timed ease towards the target.
          if (block.rise && !reduced) {
            const t = Math.min(1, (now - block.rise.start) / block.rise.duration);
            block.height = block.rise.from + (block.rise.to - block.rise.from) * easeOut(t);
            if (t < 1) moving = true;
            else block.rise = null;
          } else {
            block.rise = null;
            block.height = block.target;
          }
          if (block.leaving && !block.rise) {
            current.turntable.remove(block.slot);
            disposeBlock(block);
            current.blocks.delete(block.ticker);
            current.lift.delete(block.ticker);
            continue;
          }
          if (!block.rise && !block.leaving && Math.abs(block.height / block.building.built - 1) > REBUILD_AT) rebuild(block);
          block.building.group.scale.y = Math.max(0.001, block.height / block.building.built);
          // Place: a glide to a new spot when the set of holdings changes.
          if (block.glide && !reduced) {
            const t = Math.min(1, (now - block.glide.start) / block.glide.duration);
            const k = easeInOut(t);
            block.slot.position.set(block.glide.fromX + (block.glide.toX - block.glide.fromX) * k, 0, block.glide.fromZ + (block.glide.toZ - block.glide.fromZ) * k);
            if (t < 1) moving = true;
            else block.glide = null;
          } else if (block.glide) {
            block.slot.position.set(block.glide.toX, 0, block.glide.toZ);
            block.glide = null;
          }
          // Hover: the pointed building's accents and footprint come up quickly and go down as quickly (about 150 ms).
          const hoverTarget = current.look.hovered === block.ticker && current.look.selected !== block.ticker ? 1 : 0;
          if (reduced) block.hoverMix = hoverTarget;
          else if (Math.abs(hoverTarget - block.hoverMix) > 0.01) {
            block.hoverMix += (hoverTarget - block.hoverMix) * (1 - Math.exp(-dt / 50));
            moving = true;
          } else block.hoverMix = hoverTarget;
          // A trade lights the building's accents and footprint once, fading over a second.
          const lit = block.pulse && !reduced ? Math.max(0, 1 - (now - block.pulse) / 1200) : 0;
          if (lit > 0) moving = true;
          else block.pulse = 0;
          block.building.materials.accent.emissiveIntensity = block.accentRest + 0.7 * block.hoverMix + 2 * lit;
          block.ringMaterial.opacity = Math.max(current.look.selected === block.ticker ? 0.85 : 0, lit * 0.9, 0.35 * block.hoverMix);
        }

        // The boot: the city stays dark until the opening's start (the terminal is typing over it), then the light
        // comes up and the camera settles a few percent; the plaza's edge lights come up last.
        const lightsAt = latest.current.lightsAt;
        if (current.boot && (lightsAt === null || lightsAt === undefined || now < lightsAt) && !reduced) {
          renderer.toneMappingExposure = 0.04;
          moving = true;
        } else if (current.boot) {
          if (!current.boot.start) current.boot.start = lightsAt ?? now;
          const t = reduced ? 1 : Math.min(1, Math.max(0, now - current.boot.start) / BOOT_MS);
          const k = easeOut(t);
          renderer.toneMappingExposure = 0.04 + 0.96 * k;
          camera.zoom = 0.94 + 0.06 * k;
          const edge = easeOut(Math.min(1, Math.max(0, (t - 0.45) / 0.55)));
          for (const rim of current.rims) rim.material.opacity = rim.rest * edge;
          if (t < 1) moving = true;
          else current.boot = null;
        }

        // A reframe eases the whole view to its new place (an on-screen move: ease-in-out); with reduced motion it lands at once.
        if (current.reframe) {
          const t = reduced ? 1 : Math.min(1, (now - current.reframe.start) / REFRAME);
          const k = easeInOut(t);
          const { from, to } = current.reframe;
          current.view = { left: from.left + (to.left - from.left) * k, right: from.right + (to.right - from.right) * k, top: from.top + (to.top - from.top) * k, bottom: from.bottom + (to.bottom - from.bottom) * k };
          if (t < 1) moving = true;
          else current.reframe = null;
        }

        // The turn: on only while the city can be seen and nothing in it is pointed at or chosen; it slows to a stop and picks up again rather than snapping.
        const wanted = !reduced && current.spin.visible && !document.hidden && !current.look.selected && !current.look.hovered ? 1 : 0;
        if (reduced) current.spin.speed = 0;
        else {
          current.spin.speed += (wanted - current.spin.speed) * (1 - Math.exp(-dt / SPIN_SETTLE));
          if (Math.abs(wanted - current.spin.speed) < 0.003) current.spin.speed = wanted;
        }
        const spinning = current.spin.speed > 0;
        if (spinning) current.spin.angle = (current.spin.angle + ((dt * current.spin.speed) / SPIN_MS) * Math.PI * 2) % (Math.PI * 2);

        // When the turn is all that moves, draw about 30 frames a second.
        if (!moving && spinning && time - current.lastRender < AMBIENT_FRAME) {
          current.frame = requestAnimationFrame(step);
          return;
        }
        current.turntable.rotation.y = current.spin.angle;
        current.turntable.updateMatrixWorld();

        // A small pan towards the selected building, so it settles nearer the middle of the view, and a warm light over it.
        const chosen = current.look.selected ? current.blocks.get(current.look.selected) : undefined;
        const where = new THREE.Vector3();
        if (chosen && !chosen.leaving) {
          chosen.slot.getWorldPosition(where);
          const top = chosen.building.top * (chosen.height / chosen.building.built);
          current.spot.position.set(where.x + 2.2, top + 7, where.z + 2.2);
          current.spot.target.position.set(where.x, top * 0.45, where.z);
          current.spot.angle = Math.min(0.6, Math.atan((chosen.footprint * 0.9) / 7) + 0.08 + top * 0.025);
          current.spot.intensity = 2.2;
        } else current.spot.intensity = 0;
        let aimX = 0;
        let aimY = 0;
        if (chosen && !reduced) {
          camera.updateMatrixWorld();
          const local = where.setY(chosen.height * 0.5).applyMatrix4(camera.matrixWorldInverse);
          const limit = 0.6;
          aimX = Math.max(-limit, Math.min(limit, (local.x - (current.view.left + current.view.right) / 2) * 0.15));
          aimY = Math.max(-limit, Math.min(limit, (local.y - (current.view.top + current.view.bottom) / 2) * 0.15));
        }
        const follow = 1 - Math.exp(-dt / 90);
        current.pan.x += (aimX - current.pan.x) * follow;
        current.pan.y += (aimY - current.pan.y) * follow;
        if (Math.abs(aimX - current.pan.x) > 0.002 || Math.abs(aimY - current.pan.y) > 0.002) moving = true;
        else {
          current.pan.x = aimX;
          current.pan.y = aimY;
        }
        camera.left = current.view.left + current.pan.x;
        camera.right = current.view.right + current.pan.x;
        camera.top = current.view.top + current.pan.y;
        camera.bottom = current.view.bottom + current.pan.y;
        camera.updateProjectionMatrix();

        current.lastRender = time;
        renderer.render(scene, camera);
        if (placeLabels()) moving = true;
        if (!current.announced && current.placed) {
          current.announced = true;
          latest.current.onFirstFrame?.();
        }
        if (moving || spinning) current.frame = requestAnimationFrame(step);
        else {
          current.last = 0;
          // The settled city is remembered for this visit, so coming back from the desk shows what changed.
          try {
            window.sessionStorage.setItem(SEEN, JSON.stringify(Object.fromEntries([...current.blocks.values()].map((block) => [block.ticker, block.height]))));
          } catch {
            // Without session storage, a return to Home simply shows the city as it is.
          }
        }
      };

      current.draw = () => {
        if (current.compiled === "yes" && !current.frame) current.frame = requestAnimationFrame(step);
      };

      current.fit = (glide = false) => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (!width || !height) return;
        // The HUD over the city says how much of the canvas it covers (CSS custom properties per layout); the city is framed in what is left.
        const css = getComputedStyle(container);
        const inset = (name: string) => Math.max(0, parseFloat(css.getPropertyValue(name)) || 0);
        const safe = { left: inset("--safe-left"), right: inset("--safe-right"), top: inset("--safe-top"), bottom: inset("--safe-bottom") };
        const safeWidth = Math.max(120, width - safe.left - safe.right);
        const safeHeight = Math.max(120, height - safe.top - safe.bottom);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
        // Frame everything the turn can bring into view: the plaza's rim (top and foot) all the way round, and the tallest
        // possible building anywhere its lots can turn to. The framing never changes as the city turns or a price moves.
        const corners: Three.Vector3[] = [];
        for (let index = 0; index < 48; index += 1) {
          const angle = (index / 48) * Math.PI * 2;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          corners.push(new THREE.Vector3(cos * current.frameRadius, -0.7, sin * current.frameRadius));
          corners.push(new THREE.Vector3(cos * current.frameRadius, 0, sin * current.frameRadius));
          corners.push(new THREE.Vector3(cos * current.lotRadius, current.ringTop + 1.1, sin * current.lotRadius));
        }
        // The largest holding stands at the centre, at the full height.
        corners.push(new THREE.Vector3(0, TALLEST + 1.1, 0));
        camera.updateMatrixWorld();
        const inverse = camera.matrixWorldInverse;
        let left = Infinity;
        let right = -Infinity;
        let top = -Infinity;
        let bottom = Infinity;
        for (const corner of corners) {
          const local = corner.applyMatrix4(inverse);
          left = Math.min(left, local.x);
          right = Math.max(right, local.x);
          bottom = Math.min(bottom, local.y);
          top = Math.max(top, local.y);
        }
        const padX = (right - left) * 0.02;
        const padY = (top - bottom) * 0.03;
        const spanX = right - left + padX * 2;
        const spanY = top - bottom + padY * 2;
        // Scene units per pixel: the city fills the free area's width or height, whichever binds first.
        const scale = Math.min(safeWidth / spanX, safeHeight / spanY);
        // Centred across the free area, and in its height too, so the plaza sits in the middle of the space the HUD leaves.
        const viewLeft = (left + right) / 2 - (safe.left + safeWidth / 2) / scale;
        const viewBottom = (bottom + top) / 2 - (safe.bottom + safeHeight / 2) / scale;
        const next: View = { left: viewLeft, right: viewLeft + width / scale, bottom: viewBottom, top: viewBottom + height / scale };
        if (glide && current.placed && !latest.current.reduced) {
          current.reframe = { from: { ...current.view }, to: next, start: performance.now() };
        } else {
          current.reframe = null;
          current.view = next;
        }
        camera.left = current.view.left + current.pan.x;
        camera.right = current.view.right + current.pan.x;
        camera.top = current.view.top + current.pan.y;
        camera.bottom = current.view.bottom + current.pan.y;
        camera.updateProjectionMatrix();
        current.draw();
      };

      world.current = current;
      // A resize refits at once; only a change of the HUD (the frame prop) glides.
      observer = new ResizeObserver(() => current.fit());
      observer.observe(container);
      // The turn runs only while the city is on screen and the tab is in front.
      watcher = new IntersectionObserver(([entry]) => {
        current.spin.visible = entry.isIntersecting;
        if (entry.isIntersecting) current.draw();
      });
      watcher.observe(container);
      onVisibility = () => {
        if (document.hidden) return;
        current.last = 0;
        current.draw();
      };
      document.addEventListener("visibilitychange", onVisibility);
      if (process.env.NODE_ENV !== "production") {
        // Development only: lets the turn be measured from a test without reading pixels.
        Object.assign(window, { __fintixCity: { angle: () => current.spin.angle, speed: () => current.spin.speed, period: SPIN_MS } });
      }
      setState("ready");
    })().catch(() => {
      if (!cancelled) setState("failed");
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      watcher?.disconnect();
      if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
      const current = world.current;
      world.current = null;
      if (!current) return;
      cancelAnimationFrame(current.frame);
      current.blocks.forEach(disposeBlock);
      disposeTree(current.plate);
      current.scene.environment?.dispose();
      current.glow.dispose();
      current.paving?.dispose();
      current.contact.geometry.dispose();
      current.contact.material.dispose();
      current.contact.texture.dispose();
      disposeKit(current.kit);
      current.renderer.dispose();
    };
  }, []);

  /* ---- The HUD beside the city opened or closed: glide to the new free area ---- */
  useEffect(() => {
    if (state === "ready") world.current?.fit(true);
  }, [frame, state]);

  /*
   * ---- Ambient light ----
   * Restrained, and only while it can be seen: every few seconds one office
   * light in the shared facade pattern switches on or off, and the low sun
   * drifts a few degrees over minutes, so the shadows move the way they do
   * late in the day. Paused when the tab is hidden or the city is scrolled
   * away; off with reduced motion.
   */
  useEffect(() => {
    const current = world.current;
    if (!current || state !== "ready" || reduced) return;
    const glow = current.kit.facade.glow;
    const canvas = glow.image as HTMLCanvasElement;
    const paint = canvas.getContext("2d");
    let phase = 0;
    const timer = window.setInterval(() => {
      if (!current.spin.visible || document.hidden || !paint) return;
      const cell = canvas.width / 8;
      const x = Math.floor(Math.random() * 8) * cell;
      const y = Math.floor(Math.random() * 8) * cell;
      const [red, green, blue] = paint.getImageData(x + cell / 2, y + cell / 2, 1, 1).data;
      paint.fillStyle = "#000";
      paint.fillRect(x, y, cell, cell);
      if (red + green + blue < 60) {
        paint.fillStyle = Math.random() > 0.85 ? "#ffe2b8" : "#ffc98e";
        paint.fillRect(x + 1, y + 1, cell - 2, cell - 5);
      }
      glow.needsUpdate = true;
      phase += (AMBIENT_EVERY / 240000) * Math.PI * 2;
      const angle = Math.sin(phase) * ((5 * Math.PI) / 180);
      const target = current.sun.target.position;
      current.sun.position.set(target.x + 9 * Math.cos(angle) - 4 * Math.sin(angle), 16, target.z + 9 * Math.sin(angle) + 4 * Math.cos(angle));
      current.draw();
    }, AMBIENT_EVERY);
    return () => window.clearInterval(timer);
  }, [state, reduced]);

  /* ---- Reduced motion switched on or off: the turn stops or resumes ---- */
  useEffect(() => {
    if (state === "ready") world.current?.draw();
  }, [reduced, state]);

  /* ---- Keep the buildings in step with the holdings ---- */
  const layoutKey = holdings
    .map((holding) => holding.asset.ticker)
    .sort()
    .join(",");

  useEffect(() => {
    const current = world.current;
    if (!current || state !== "ready") return;
    const { THREE } = current;
    const list = latest.current.holdings;
    const largest = Math.max(...list.map((holding) => holding.weight), 0);
    const now = performance.now();
    // On arrival, buildings start where they stood when Home was last left in this visit (new ones from the ground), so trades made on the desk are seen landing.
    const seen = current.placed ? null : readSeen();

    // Buildings that were sold off come down, then leave.
    for (const [ticker, block] of current.blocks) if (!list.some((holding) => holding.asset.ticker === ticker)) retire(block, now);

    // Placement is decided when the set of holdings changes, largest at the centre, and then kept, so a price move never shuffles the city.
    const spots = layout(list.map((holding) => holding.weight));
    list.forEach((holding, index) => {
      let block = current.blocks.get(holding.asset.ticker);
      if (!block) {
        const footprint = footprintFor(holding.weight);
        const height = heightFor(holding.weight, largest);
        // A building bought into while the city is on screen rises from the ground; one present on arrival stands, unless it changed since Home was last seen.
        const from = current.placed ? 0 : seen ? (seen[holding.asset.ticker] ?? 0) : height;
        const slot = new THREE.Group();
        const half = footprint / 2 + 0.22;
        const ringMaterial = new THREE.LineBasicMaterial({ color: 0xf4b63a, transparent: true, opacity: 0, depthWrite: false });
        const ring = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-half, 0.01, -half), new THREE.Vector3(half, 0.01, -half), new THREE.Vector3(half, 0.01, half), new THREE.Vector3(-half, 0.01, half)]),
          ringMaterial,
        );
        const building = buildTower(current.kit, { ticker: holding.asset.ticker, tone: holding.asset.tone, height, footprint });
        const contact = new THREE.Mesh(current.contact.geometry, current.contact.material);
        contact.rotation.x = -Math.PI / 2;
        contact.scale.set(footprint * 1.85, footprint * 1.85, 1);
        contact.position.y = 0.006;
        contact.renderOrder = 1;
        slot.add(contact, ring, building.group);
        const changed = Math.abs(from - height) > height * TICK;
        block = {
          ticker: holding.asset.ticker,
          tone: holding.asset.tone,
          footprint,
          height: changed ? from : height,
          target: height,
          building,
          slot,
          ring,
          ringMaterial,
          qty: holding.qty,
          rise: changed ? { from, to: height, start: now, duration: EVENT } : null,
          glide: null,
          pulse: changed && current.placed ? now : 0,
          leaving: false,
          accentRest: 1.1,
          hoverMix: 0,
        };
        slot.position.set(spots[index].x, 0, spots[index].z);
        current.turntable.add(slot);
        current.blocks.set(holding.asset.ticker, block);
      } else {
        // An existing building glides to its new place.
        const toX = spots[index].x;
        const toZ = spots[index].z;
        if (Math.abs(block.slot.position.x - toX) > 0.01 || Math.abs(block.slot.position.z - toZ) > 0.01)
          block.glide = { fromX: block.slot.position.x, fromZ: block.slot.position.z, toX, toZ, start: now, duration: EVENT };
      }
    });
    current.placed = true;

    /*
     * The plaza: a round, stepped stand under the whole city, sized to the lots
     * in use. Its paving takes the buildings' shadows and contact shade; a
     * second, wider and darker step sits under it, two faint edge lights trace
     * the steps, and a cool pool of light under it all sinks it into the night.
     */
    disposeTree(current.plate);
    current.plate.clear();
    current.rims = [];
    const widest = Math.max(...list.map((holding) => footprintFor(holding.weight)), 1.6);
    const lots = spots.length ? Math.max(...spots.map((spot) => Math.hypot(spot.x, spot.z))) + widest / 2 : 1.4;
    const radius = Math.max(3.2, lots + 0.9);
    current.lotRadius = Math.max(lots, 1.4);
    current.ringTop = ringTopFor(list);
    current.frameRadius = Math.max(radius + 0.46, MIN_FRAME);

    current.paving?.dispose();
    const paving = new THREE.CanvasTexture(paintPaving(Math.max(8, Math.round((radius * 2) / 0.62))));
    paving.colorSpace = THREE.SRGBColorSpace;
    paving.anisotropy = 8;
    current.paving = paving;
    const deck = new THREE.Mesh(new THREE.CircleGeometry(radius, 96), new THREE.MeshStandardMaterial({ map: paving, roughness: 0.9, metalness: 0.04, envMapIntensity: 0.35 }));
    deck.rotation.x = -Math.PI / 2;
    deck.receiveShadow = true;
    const sideMaterial = new THREE.MeshStandardMaterial({ color: 0x0b1131, roughness: 0.82, metalness: 0.08, envMapIntensity: 0.4 });
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.34, 96, 1, true), sideMaterial);
    upper.position.y = -0.17;
    upper.receiveShadow = true;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.4, radius + 0.46, 0.3, 96), new THREE.MeshStandardMaterial({ color: 0x070b23, roughness: 0.86, metalness: 0.06, envMapIntensity: 0.3 }));
    lower.position.y = -0.49;
    lower.receiveShadow = true;
    const edge = (inner: number, outer: number, y: number, colour: number, rest: number) => {
      const material = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: current.boot ? 0 : rest, depthWrite: false, fog: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96), material);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = y;
      current.rims.push({ material, rest });
      return ring;
    };
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: current.glow, transparent: true, depthWrite: false, fog: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set((radius + 0.46) * 3.4, (radius + 0.46) * 3.4, 1);
    pool.position.y = -0.66;
    pool.renderOrder = -1;
    current.plate.add(pool, lower, upper, deck, edge(radius - 0.05, radius, 0.004, 0x5470e0, 0.5), edge(radius + 0.33, radius + 0.4, -0.338, 0x2a3a8c, 0.55));
    // With no holdings the empty lot is drawn: a dashed outline where the first purchase will rise.
    if (!list.length) {
      const half = 1.35;
      const corners = [
        [-half, -half],
        [half, -half],
        [half, half],
        [-half, half],
      ];
      const points = corners.flatMap(([x, z], index) => {
        const [nextX, nextZ] = corners[(index + 1) % corners.length];
        return [new THREE.Vector3(x, 0.02, z), new THREE.Vector3(nextX, 0.02, nextZ)];
      });
      const lot = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color: 0x6a7bc4, dashSize: 0.24, gapSize: 0.16, transparent: true, opacity: 0.8, depthWrite: false }));
      lot.computeLineDistances();
      current.plate.add(lot);
    }
    // Depth: whatever is further back sinks a little into the night, so the city reads front to back.
    current.scene.fog = new THREE.Fog(0x070d26, CAMERA_DISTANCE - radius, CAMERA_DISTANCE + radius * 9);

    // Shadows cover exactly the plaza, whichever way it has turned.
    const reach = radius + 0.5 + TALLEST * 0.6;
    const shadow = current.sun.shadow.camera; // taste-skill-ignore: the 3D sun's shadow camera, not a CSS shadow
    shadow.left = -reach;
    shadow.right = reach;
    shadow.top = reach;
    shadow.bottom = -reach;
    shadow.near = 0.5;
    shadow.far = 80;
    shadow.updateProjectionMatrix();
    current.sun.target.position.set(0, 0, 0);
    current.sun.position.set(9, 16, 4);
    if (current.compiled === "no") {
      current.compiled = "pending";
      current.renderer
        .compileAsync(current.scene, current.camera)
        .catch(() => {})
        .finally(() => {
          current.compiled = "yes";
          current.draw();
        });
    }
    current.fit();
  }, [layoutKey, state]);

  /* ---- Heights and the selection ---- */
  useEffect(() => {
    const current = world.current;
    if (!current || state !== "ready") return;
    const largest = Math.max(...holdings.map((holding) => holding.weight), 0);
    const now = performance.now();
    current.look.selected = selected;
    for (const holding of holdings) {
      const block = current.blocks.get(holding.asset.ticker);
      if (!block || block.leaving) continue;
      const target = heightFor(holding.weight, largest);
      const traded = holding.qty !== block.qty;
      if (Math.abs(target - block.target) > 0.0005) {
        // A trade, or any change large enough to read, is a consequence; a price tick is a quick settle.
        const event = traded || Math.abs(target - block.height) > block.height * TICK;
        block.rise = { from: block.height, to: target, start: now, duration: event ? EVENT : QUICK };
        block.target = target;
      }
      if (traded) {
        block.qty = holding.qty;
        block.pulse = now;
      }
      lookOf(current, block);
    }
    // A trade can make a building on the ring taller than the framing allowed for: reframe, gliding, so nothing is ever cut off.
    const top = ringTopFor(holdings, current.blocks);
    if (top > current.ringTop + 0.01 || top < current.ringTop - 0.9) {
      current.ringTop = top;
      current.fit(true);
    }
    current.draw();
  }, [holdings, selected, state]);

  /* ---- Hover: the pointed building lights a little (its plate too), whether pointed at here or by its row; the frame loop eases it ---- */
  const hoveredTicker = hover?.ticker ?? null;
  const lit = hoveredTicker ?? highlight;
  useEffect(() => {
    const current = world.current;
    if (!current || state !== "ready") return;
    current.look.hovered = lit;
    current.draw();
  }, [lit, state]);

  useEffect(() => {
    latest.current.onHover?.(hoveredTicker);
  }, [hoveredTicker]);

  /* ---- Pointer: hover for a tooltip, click to select ---- */
  const pick = (event: { clientX: number; clientY: number }) => {
    const current = world.current;
    const element = canvas.current;
    if (!current || !element) return null;
    const bounds = element.getBoundingClientRect();
    const pointer = new current.THREE.Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    // Positions are normally brought up to date by drawing a frame; refresh them here so a click is never tested against stale ones.
    current.scene.updateMatrixWorld();
    current.camera.updateMatrixWorld();
    current.raycaster.setFromCamera(pointer, current.camera);
    const solids = [...current.blocks.values()].filter((block) => !block.leaving).flatMap((block) => block.building.solids);
    const hit = current.raycaster.intersectObjects(solids, false)[0];
    return hit ? ((hit.object.userData.ticker as string) ?? null) : null;
  };

  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType !== "mouse") return;
    const ticker = pick(event);
    const bounds = event.currentTarget.getBoundingClientRect();
    setHover(ticker ? { ticker, x: event.clientX - bounds.left, y: event.clientY - bounds.top } : null);
    event.currentTarget.style.cursor = ticker ? "pointer" : "default";
  };

  const hovered = hover ? holdings.find((holding) => holding.asset.ticker === hover.ticker) : null;

  return (
    <div className="hm-city" ref={box} data-state={state}>
      <canvas ref={canvas} aria-hidden="true" onPointerMove={move} onPointerLeave={() => setHover(null)} onClick={(event) => onSelect(pick(event))} />

      {/* On a first visit the opening's terminal stands in for the loader. */}
      {state === "loading" && boot !== "full" ? (
        <div className="hm-city-note">
          <Loader label="Building your city" />
        </div>
      ) : null}
      {state === "failed" ? (
        <div className="hm-city-note">
          <p>The 3D city can&apos;t be shown on this device. Your holdings are listed beside it, and every figure is unaffected.</p>
        </div>
      ) : null}

      {state === "ready" ? (
        <div className="hm-city-labels" role="group" aria-label="Your holdings as buildings. Select one to see its details.">
          {holdings.map((holding) => (
            <button
              key={holding.asset.ticker}
              ref={(element) => {
                if (element) labels.current.set(holding.asset.ticker, element);
                else labels.current.delete(holding.asset.ticker);
              }}
              type="button"
              className="hm-city-label"
              aria-pressed={selected === holding.asset.ticker}
              aria-label={`${holding.asset.name}: ${(holding.weight * 100).toFixed(1)}% of your portfolio, ${rupees(holding.price)}, ${signedPercent(holding.dayPercent)} today`}
              data-dim={selected !== null && selected !== holding.asset.ticker}
              data-lit={lit === holding.asset.ticker || undefined}
              onClick={() => onSelect(selected === holding.asset.ticker ? null : holding.asset.ticker)}
              onPointerEnter={(event) => {
                const bounds = box.current?.getBoundingClientRect();
                const own = event.currentTarget.getBoundingClientRect();
                if (bounds) setHover({ ticker: holding.asset.ticker, x: own.left - bounds.left + own.width / 2, y: own.top - bounds.top });
              }}
              onPointerLeave={() => setHover(null)}
            >
              <b>{holding.asset.ticker}</b>
              <span>{(holding.weight * 100).toFixed(1)}%</span>
            </button>
          ))}
        </div>
      ) : null}

      {hovered && hover ? (
        <div className="hm-tip" style={{ left: hover.x, top: hover.y }} role="tooltip">
          <b>{hovered.asset.name}</b>
          <span>
            {rupees(hovered.price)} <em data-tone={hovered.dayPercent >= 0 ? "up" : "down"}>{signedPercent(hovered.dayPercent)}</em>
          </span>
        </div>
      ) : null}
    </div>
  );
}
