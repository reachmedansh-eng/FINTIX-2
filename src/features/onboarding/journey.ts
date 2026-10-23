import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CAMERA_PATH, SCENES } from "./content";
import { baseWindow, camera, track } from "./world/camera";

/** Text colours the timeline animates between. They mirror the CSS tokens. */
const INK = {
  muted: "#5c6392",
  rest: "#8c93bd",
  white: "#f4f2ec",
  cyan: "#2fc0ff",
  gold: "#f4b63a",
} as const;

/** Where in the artwork the camera pushes when the visitor enters: the corner of the HQ. */
const DOOR = { column: 276, row: 1866 };

type Options = {
  root: HTMLElement;
  stage: HTMLElement;
  track: HTMLElement;
  reduced: boolean;
  onScene: (index: number) => void;
};

/**
 * Builds the whole journey: one timeline, scrubbed by scroll, that moves the
 * camera down the artwork and brings each scene's words in and out with it.
 * Must be called inside a GSAP context (useGSAP) so it is reverted on unmount.
 */
export function buildJourney({ root, stage, track: trackElement, reduced, onScene }: Options) {
  const all = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
  const within = (scene: HTMLElement, selector: string) => Array.from(scene.querySelectorAll<HTMLElement>(selector));
  const sceneOf = (id: string) => root.querySelector<HTMLElement>(`[data-scene="${id}"]`)!;

  /** Scroll position on the 0 → 100 timeline. */
  const state = { at: 0 };
  /** The arrival: the world comes up out of black, very slightly pushed in. */
  const veil = { dark: 1, zoom: reduced ? 1 : 1.06 };
  /** The entry: the camera pushes into the HQ and the frame goes to ink. */
  const portal = { pull: 0, zoom: 1, dark: 0 };

  let rowAt = (at: number) => at * 0;
  let columnAt = (at: number) => at * 0;
  const railFill = root.querySelector<HTMLElement>("[data-rail-fill]");
  let scene = -1;

  const apply = () => {
    const at = state.at;
    camera.cy = rowAt(at) + (DOOR.row - rowAt(at)) * portal.pull;
    camera.cx = columnAt(at) + (DOOR.column - columnAt(at)) * portal.pull;
    camera.zoom = veil.zoom * portal.zoom;
    camera.dim = 1 - (1 - veil.dark) * (1 - portal.dark);

    let index = 0;
    for (let i = 0; i < SCENES.length; i++) if (at >= SCENES[i].at) index = i;
    if (index !== scene) {
      scene = index;
      onScene(index);
    }
    if (railFill) railFill.style.transform = `scaleY(${(at / 100).toFixed(4)})`;
  };

  // Camera stops are framed by anchor, so they are worked out for this screen's shape.
  const layout = () => {
    const base = baseWindow(stage.clientWidth, stage.clientHeight);
    rowAt = track(CAMERA_PATH.map((stop) => ({ at: stop.at, value: stop.row + (0.5 - stop.anchor) * base.height })));
    columnAt = track(CAMERA_PATH.map((stop) => ({ at: stop.at, value: stop.column })));
    apply();
  };
  layout();
  const observer = new ResizeObserver(layout);
  observer.observe(stage);

  const timeline = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: trackElement,
      start: "top top",
      end: "bottom bottom",
      // The lag is what makes the camera feel weighted. Reduced motion follows the scroll exactly.
      scrub: reduced ? true : 0.9,
      // Distances measured from the viewport are worked out again when it changes size.
      invalidateOnRefresh: true,
    },
  });

  timeline.to(state, { at: 100, duration: 100, onUpdate: apply }, 0);

  /* ---------------------------------------------------------------- */
  /* Scene building blocks                                             */
  /* ---------------------------------------------------------------- */

  const rise = reduced ? 0 : 1;

  /** Brings a scene's block on screen. */
  const open = (scene: HTMLElement, at: number) => {
    timeline.fromTo(scene, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, at);
    timeline.fromTo(within(scene, ".onb-shade"), { opacity: 0 }, { opacity: 1, duration: 2.6 }, at);
  };

  /** Headline lines rise out of their own baseline, one after another. */
  const lines = (scene: HTMLElement, at: number, each = 0.75) => {
    timeline.fromTo(
      within(scene, ".onb-line-in"),
      { yPercent: 104 * rise, opacity: rise ? 1 : 0 },
      { yPercent: 0, opacity: 1, duration: 2.4, stagger: each, ease: "power3.out" },
      at,
    );
  };

  /** Words go from muted to lit, in reading order, as the scroll passes. */
  const ink = (words: HTMLElement[], at: number, span: number, colour: string = INK.white) => {
    if (!words.length) return;
    timeline.fromTo(
      words,
      { color: INK.muted },
      { color: colour, duration: Math.max(0.5, (span / words.length) * 1.5), stagger: span / words.length },
      at,
    );
  };

  const body = (scene: HTMLElement, at: number) => {
    timeline.fromTo(
      within(scene, ".onb-body"),
      { autoAlpha: 0, y: 20 * rise },
      { autoAlpha: 1, y: 0, duration: 2.2, ease: "power2.out" },
      at,
    );
  };

  /** A scene leaves a little faster than the world moves, so it reads as nearer than the art. */
  const close = (scene: HTMLElement, at: number) => {
    timeline.to(scene, { autoAlpha: 0, y: () => -0.07 * window.innerHeight * rise, duration: 2.4, ease: "power1.in" }, at);
  };

  /* ---------------------------------------------------------------- */
  /* 01 FINTIX                                                         */
  /* ---------------------------------------------------------------- */

  timeline.fromTo(
    all(".onb-title-card"),
    { autoAlpha: 1, y: 0 },
    { autoAlpha: 0, y: () => -0.12 * window.innerHeight * rise, duration: 5, ease: "power1.in", immediateRender: false },
    1,
  );
  timeline.fromTo(all(".onb-cue"), { autoAlpha: 1 }, { autoAlpha: 0, duration: 1.6, immediateRender: false }, 0.4);
  timeline.fromTo(all(".onb-hud"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 2 }, 5.5);

  /* ---------------------------------------------------------------- */
  /* 02 UNDERSTAND                                                     */
  /* ---------------------------------------------------------------- */
  {
    const scene = sceneOf("understand");
    const [first, second] = within(scene, ".onb-line");
    open(scene, 8.2);
    lines(scene, 8.4);
    ink(within(first, ".onb-word"), 9.6, 2);
    ink(within(second, ".onb-word"), 11.8, 2.2, INK.cyan);
    body(scene, 11);
    close(scene, 17.4);
  }

  /* ---------------------------------------------------------------- */
  /* 03 LEARN: the concepts surface one at a time                      */
  /* ---------------------------------------------------------------- */
  {
    const scene = sceneOf("learn");
    const concepts = within(scene, ".onb-concept");
    const first = 23.2;
    const step = 2.55;
    open(scene, 20.4);
    lines(scene, 20.6);
    ink(within(scene, ".onb-title .onb-word"), 21.4, 1.8);
    // The whole field drifts up slowly, as if it were hanging in the water.
    timeline.fromTo(
      within(scene, ".onb-concepts"),
      { y: () => 0.035 * window.innerHeight * rise },
      { y: () => -0.035 * window.innerHeight * rise, duration: 16 },
      21,
    );
    concepts.forEach((concept, i) => {
      const at = first + i * step;
      const word = within(concept, ".onb-concept-word");
      const note = within(concept, ".onb-concept-note");
      timeline.fromTo(concept, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7 }, at);
      timeline.fromTo(word, { color: INK.muted }, { color: INK.white, duration: 0.8 }, at + 0.25);
      timeline.fromTo(note, { autoAlpha: 0, y: 8 * rise }, { autoAlpha: 1, y: 0, duration: 0.8 }, at + 0.7);
      if (i < concepts.length - 1) {
        // Hand over to the next concept: this one drops back into the dark.
        timeline.to(word, { color: INK.muted, duration: 0.9 }, at + step);
        timeline.to(note, { autoAlpha: 0, duration: 0.6 }, at + step - 0.1);
      }
    });
    close(scene, 36.2);
  }

  /* ---------------------------------------------------------------- */
  /* 04 CAPITAL                                                        */
  /* ---------------------------------------------------------------- */
  {
    const scene = sceneOf("capital");
    const [first, second] = within(scene, ".onb-line");
    open(scene, 40.6);
    lines(scene, 40.8);
    ink(within(first, ".onb-word"), 42, 1.2);
    ink(within(second, ".onb-word"), 43.4, 1.8, INK.gold);
    body(scene, 43.6);
    close(scene, 49.4);
  }

  /* ---------------------------------------------------------------- */
  /* 05 EXPLORE                                                        */
  /* ---------------------------------------------------------------- */
  {
    const scene = sceneOf("explore");
    open(scene, 53);
    lines(scene, 53.2, 1.1);
    ink(within(scene, ".onb-title .onb-word"), 54.6, 4.4);
    body(scene, 56.4);
    timeline.fromTo(
      within(scene, ".onb-fragment"),
      { autoAlpha: 0, x: 14 * rise },
      { autoAlpha: 1, x: 0, duration: 1.4, stagger: 0.9, ease: "power2.out" },
      55,
    );
    close(scene, 62);
  }

  /* ---------------------------------------------------------------- */
  /* 06 SIMULATE                                                       */
  /* ---------------------------------------------------------------- */
  {
    const scene = sceneOf("simulate");
    const [first, second] = within(scene, ".onb-line");
    open(scene, 65.2);
    lines(scene, 65.4);
    ink(within(first, ".onb-word"), 66.6, 1.4);
    ink(within(second, ".onb-word"), 68.2, 1.8, INK.cyan);
    body(scene, 68);
    close(scene, 71.8);
  }

  /* ---------------------------------------------------------------- */
  /* 07 BUILD                                                          */
  /* ---------------------------------------------------------------- */
  {
    const scene = sceneOf("build");
    open(scene, 75.4);
    lines(scene, 75.6);
    ink(within(scene, ".onb-title .onb-word"), 77, 4.2);
    body(scene, 79.4);
    close(scene, 85.2);
  }

  /* ---------------------------------------------------------------- */
  /* 08 ARRIVE: the words stay; the action is the last thing to land   */
  /* ---------------------------------------------------------------- */
  {
    const scene = sceneOf("arrive");
    // The city is the last statement: the editorial layer steps back and leaves it alone.
    timeline.to(all(".onb-hud"), { autoAlpha: 0, duration: 2.4 }, 89.6);
    open(scene, 91.6);
    lines(scene, 91.8, 0.9);
    ink(within(scene, ".onb-title .onb-word"), 93, 3.6);
    timeline.fromTo(
      within(scene, ".onb-enter"),
      { autoAlpha: 0, y: 16 * rise },
      { autoAlpha: 1, y: 0, duration: 1.6, ease: "power2.out" },
      96.4,
    );
    timeline.fromTo(within(scene, ".onb-enter-note"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4 }, 97.6);
  }

  /* ---------------------------------------------------------------- */
  /* Depth: the words lean a few pixels against the pointer, so they   */
  /* read as a layer in front of the world rather than printed on it   */
  /* ---------------------------------------------------------------- */

  const words = root.querySelector<HTMLElement>(".onb-float");
  let onPointer: ((event: PointerEvent) => void) | null = null;
  if (words && !reduced && window.matchMedia("(pointer: fine)").matches) {
    const leanX = gsap.quickTo(words, "x", { duration: 1.1, ease: "power3.out" });
    const leanY = gsap.quickTo(words, "y", { duration: 1.1, ease: "power3.out" });
    onPointer = (event) => {
      leanX(-((event.clientX / window.innerWidth) * 2 - 1) * 10);
      leanY(-((event.clientY / window.innerHeight) * 2 - 1) * 6);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
  }

  /* ---------------------------------------------------------------- */
  /* Arrival: plays once, on its own clock                             */
  /* ---------------------------------------------------------------- */

  const arrival = gsap.timeline({ delay: 0.1 });
  arrival.to(veil, { dark: 0, duration: reduced ? 0.4 : 1.9, ease: "power2.out", onUpdate: apply }, 0);
  if (!reduced) arrival.to(veil, { zoom: 1, duration: 3.8, ease: "power3.out", onUpdate: apply }, 0);
  if (reduced) {
    arrival.fromTo(all(".onb-mark"), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.1);
  } else {
    // A restrained power-on flicker: a handful of hard steps, then it holds.
    arrival.fromTo(
      all(".onb-mark"),
      { opacity: 0 },
      {
        keyframes: { opacity: [0, 0.55, 0.12, 0.8, 0.45, 1, 0.78, 1], easeEach: "none" },
        duration: 0.95,
        ease: "steps(7)",
      },
      0.55,
    );
  }
  arrival.fromTo(all(".onb-cue-in"), { opacity: 0 }, { opacity: 1, duration: 0.8 }, reduced ? 0.4 : 2.1);

  /* ---------------------------------------------------------------- */
  /* Controls handed back to the component                             */
  /* ---------------------------------------------------------------- */

  const trigger = timeline.scrollTrigger as ScrollTrigger;

  return {
    /** Scrolls to where a scene is fully on screen. */
    goTo(index: number) {
      const top = trigger.start + (SCENES[index].rest / 100) * (trigger.end - trigger.start);
      window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    },
    /** Jumps straight to a timeline position (0 → 100) with no easing. For inspection. */
    seek(at: number) {
      window.scrollTo({ top: trigger.start + (at / 100) * (trigger.end - trigger.start), behavior: "auto" });
      ScrollTrigger.update();
      trigger.getTween()?.progress(1);
      arrival.progress(1);
    },
    /** The camera pushes into the HQ and the frame goes to ink; resolves when it is dark. */
    enter() {
      return new Promise<void>((resolve) => {
        const push = gsap.timeline({ onComplete: resolve });
        if (reduced) {
          push.to(portal, { dark: 1, duration: 0.35, ease: "none", onUpdate: apply });
          return;
        }
        push.to(portal, { pull: 1, duration: 0.9, ease: "power2.inOut", onUpdate: apply }, 0);
        push.to(portal, { zoom: 7, duration: 1.35, ease: "power3.in", onUpdate: apply }, 0);
        push.to(portal, { dark: 1, duration: 0.6, ease: "steps(6)", onUpdate: apply }, 0.8);
        push.to(all(".onb-scenes, .onb-hud"), { autoAlpha: 0, duration: 0.3, ease: "none" }, 0);
      });
    },
    dispose() {
      observer.disconnect();
      if (onPointer) window.removeEventListener("pointermove", onPointer);
    },
  };
}

export type Journey = ReturnType<typeof buildJourney>;
