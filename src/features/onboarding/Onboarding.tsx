"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { COPY, PRODUCT_ROUTE, SCENES } from "./content";
import { type Journey, buildJourney } from "./journey";
import { ChevronDown } from "./ui/Glyphs";
import { Scenes } from "./ui/Scenes";
import { WorldCanvas } from "./world/WorldCanvas";
import "./onboarding.css";
import { asset } from "@/lib/asset";

gsap.registerPlugin(ScrollTrigger, useGSAP);
// Mobile browsers resize the viewport as their toolbars hide; that should not restart the journey.
ScrollTrigger.config({ ignoreMobileResize: true });

/** The supplied wordmark file, and the width of the visible artwork inside its transparent padding. */
const WORDMARK = { src: asset("/brand/fintix-wordmark.png"), width: 790, height: 316, artWidth: 573 };

/** The push into the HQ lasts 1.4 s; past this the visitor is taken on whether or not it has finished. */
const ENTER_LIMIT_MS = 1800;

/**
 * The wordmark, drawn from the supplied file and never re-created. The file
 * has transparent padding, so it sits inside a frame the size of its visible
 * artwork (the frame's width is the CSS variable --w).
 */
function Wordmark({ className }: { className: string }) {
  return (
    <span className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the file must be shown pixel for pixel, never resampled by an optimiser */}
      <img src={WORDMARK.src} width={WORDMARK.width} height={WORDMARK.height} alt="" draggable={false} />
    </span>
  );
}

export function Onboarding() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const journey = useRef<Journey | null>(null);
  const entering = useRef(false);
  const router = useRouter();
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [scene, setScene] = useState(0);

  const onWorldReady = useCallback(() => setReady(true), []);

  // Pixel type and the wordmark both need to know the size of a device pixel.
  useEffect(() => {
    const update = () => {
      const ratio = window.devicePixelRatio || 1;
      const style = document.documentElement.style;
      style.setProperty("--dpr", String(ratio));

      // The wordmark is pixel art, so each of its pixels is shown as a whole number of
      // device pixels: the nearest whole scale to the size we want that still fits.
      const portrait = window.innerWidth < window.innerHeight;
      const device = window.innerWidth * ratio;
      let scale = Math.max(1, Math.round(((portrait ? 0.8 : 0.46) * device) / WORDMARK.artWidth));
      while (scale > 1 && scale * WORDMARK.artWidth > device * (portrait ? 0.92 : 0.7)) scale--;
      style.setProperty("--mark-k", String(scale / ratio));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useGSAP(
    () => {
      if (!ready || !root.current || !stage.current || !track.current) return;
      const built = buildJourney({
        root: root.current,
        stage: stage.current,
        track: track.current,
        reduced,
        onScene: setScene,
      });
      journey.current = built;
      if (process.env.NODE_ENV !== "production") {
        // Development only: lets a scene be inspected without scrolling to it.
        Object.assign(window, { __fintix: built, __gsap: gsap });
      }
      return () => {
        built.dispose();
        journey.current = null;
      };
    },
    { scope: root, dependencies: [ready, reduced] },
  );

  // Leaving mid-transition must never leave the page unable to scroll.
  useEffect(
    () => () => {
      document.documentElement.style.overflow = "";
    },
    [],
  );

  // Sign-in is the only way on, so it is fetched ahead and the hand-off doesn't wait on it.
  useEffect(() => {
    // A sign-in answer (Google, or a reset link) that the auth server sent to the site's front door belongs to the credentials page.
    const answer = new URLSearchParams(window.location.search);
    if (answer.has("code") || answer.has("error_description")) router.replace(`${PRODUCT_ROUTE}${window.location.search}${window.location.hash}`);
  }, [router]);

  useEffect(() => {
    router.prefetch(PRODUCT_ROUTE);
  }, [router]);

  const enter = async (event: MouseEvent<HTMLAnchorElement>) => {
    // Modified clicks (new tab, new window) are left to the browser.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (entering.current) return;
    entering.current = true;
    document.documentElement.style.overflow = "hidden";
    // The push runs on animation frames, which stall in a background tab or on a busy main thread,
    // so the way on is never held hostage by it: whichever ends first, the animation or the timer.
    await Promise.race([journey.current?.enter(), new Promise((done) => window.setTimeout(done, ENTER_LIMIT_MS))]);
    router.push(PRODUCT_ROUTE);
  };

  const current = SCENES[scene];

  return (
    <main ref={root} className="onb" data-ready={ready ? "" : undefined}>
      <Link href={PRODUCT_ROUTE} className="onb-skip">
        {COPY.skip}
      </Link>

      {/* The same story in plain reading order, for anyone not travelling through it visually. */}
      <div className="sr-only">
        <h1>{COPY.wordmarkAlt}</h1>
        <h2>{COPY.understand.title.join(" ")}</h2>
        <p>{COPY.understand.body}</p>
        <h2>{COPY.learn.title.join(" ")}</h2>
        <ul>
          {COPY.learn.concepts.map((concept) => (
            <li key={concept.word}>
              {concept.word}: {concept.note}
            </li>
          ))}
        </ul>
        <h2>{COPY.capital.title.join(" ")}</h2>
        <p>{COPY.capital.body}</p>
        <h2>{COPY.explore.title.join(" ")}</h2>
        <p>{COPY.explore.body}</p>
        <h2>{COPY.simulate.title.join(" ")}</h2>
        <p>{COPY.simulate.body}</p>
        <h2>{COPY.build.title.join(" ")}</h2>
        <p>{COPY.build.body}</p>
        <h2>{COPY.arrive.title.join(" ")}</h2>
        <p>{COPY.arrive.note}</p>
      </div>

      <div ref={stage} className="onb-stage">
        <WorldCanvas onReady={onWorldReady} />

        <div className="onb-scenes">
          {/* 01 FINTIX: the wordmark, and nothing else but a way onward. */}
          <div className="onb-title-card" aria-hidden="true">
            <Wordmark className="onb-mark" />
          </div>
          <div className="onb-cue" aria-hidden="true">
            <span className="onb-cue-in">
              <span className="px">{COPY.scroll}</span>
              <ChevronDown className="onb-cue-arrow" />
            </span>
          </div>

          {/* 02 to 08. This layer leans slightly against the pointer, so the words sit in front of the world. */}
          <div className="onb-float">
            <Scenes onEnter={enter} />
          </div>
        </div>

        {/* The editorial layer: corner mark, scene marker, progress rail. */}
        <div className="onb-hud">
          <Wordmark className="onb-hud-mark" />

          <div className="onb-marker px" aria-hidden="true">
            <span className="onb-marker-index">{String(scene + 1).padStart(2, "0")}</span>
            <span className="onb-marker-total">/{String(SCENES.length).padStart(2, "0")}</span>
            <span className="onb-marker-name">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={current.id}
                  initial={reduced ? { opacity: 0 } : { y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduced ? { opacity: 0 } : { y: "-100%", opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  {current.name}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>

          <nav className="onb-rail" aria-label="Scenes">
            <span className="onb-rail-line" aria-hidden="true">
              <span className="onb-rail-fill" data-rail-fill />
            </span>
            {SCENES.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className="onb-rail-stop"
                data-active={i === scene ? "" : undefined}
                data-passed={i < scene ? "" : undefined}
                style={{ top: `${item.rest}%` }}
                data-name={item.name}
                aria-label={`Go to scene ${i + 1}: ${item.name.toLowerCase()}`}
                aria-current={i === scene ? "step" : undefined}
                onClick={() => journey.current?.goTo(i)}
              />
            ))}
          </nav>
        </div>
      </div>

      <div ref={track} className="onb-track" />
    </main>
  );
}
