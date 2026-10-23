"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "@/features/onboarding/ui/Glyphs";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { Ambient } from "./Ambient";
import { auth, rules, type AuthField, type Session } from "./authClient";
import { ROOM, framesFor, glassIn } from "./frame";
import { Market } from "./Market";
import "./credentials.css";
import "./live.css";
import { asset } from "@/lib/asset";

gsap.registerPlugin(useGSAP);

/** Where an authenticated visitor goes. */
export const AFTER_AUTH_ROUTE = "/home";

type Mode = "signin" | "create";
type Busy = "signin" | "create" | "google" | "reset" | null;
type Values = { name: string; email: string; password: string; confirm: string };
type Errors = Partial<Record<keyof Values, string>>;
type Notice = { tone: "info" | "error"; text: string } | null;

const EMPTY: Values = { name: "", email: "", password: "", confirm: "" };

const COPY = {
  heading: "Sign in to FINTIX",
  tag: ["ENTER THE MARKET.", "BUILD YOUR KNOWLEDGE."],
  tabs: { signin: "SIGN IN", create: "CREATE ACCOUNT" },
  submit: { signin: "SIGN IN", create: "CREATE ACCOUNT" },
  working: { signin: "SIGNING IN", create: "CREATING" },
  google: "Continue with Google",
  forgot: "Forgot password?",
  testLabel: "TEST ACCOUNT",
  testNote: "Look around without signing up.",
  testAction: "ENTER TEST ACCOUNT",
  granted: "ACCESS GRANTED",
} as const;

function validate(mode: Mode, values: Values): Errors {
  const errors: Errors = {};
  const set = (field: keyof Values, message: string) => {
    if (message) errors[field] = message;
  };
  if (mode === "create") set("name", rules.name(values.name));
  set("email", rules.email(values.email));
  set("password", mode === "create" ? rules.newPassword(values.password) : rules.password(values.password));
  if (mode === "create") set("confirm", rules.confirm(values.confirm, values.password));
  return errors;
}

export function Credentials() {
  const root = useRef<HTMLElement>(null);
  const view = useRef({ near: 0, push: 0 });
  const leaving = useRef(false);
  const router = useRouter();
  const reduced = useReducedMotion();
  const id = useId();

  const [mode, setMode] = useState<Mode>("signin");
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [granted, setGranted] = useState<Session | null>(null);
  const [reveal, setReveal] = useState(false);

  /** Writes the artwork's position and the monitor's glass to CSS, from the current view. */
  const frame = useCallback(() => {
    const element = root.current;
    if (!element) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const { inside, room, desk } = framesFor(width, height);
    const { near, push } = view.current;
    const mix = (from: number, to: number) => from + (to - from) * near;

    // The push on entry magnifies about the centre of the monitor.
    const scale = mix(room.scale, desk.scale) * (1 + push * 0.55);
    const grown = scale / mix(room.scale, desk.scale);
    const centreX = mix(room.x, desk.x) + (ROOM.screen.x + ROOM.screen.width / 2) * mix(room.scale, desk.scale);
    const centreY = mix(room.y, desk.y) + (ROOM.screen.y + ROOM.screen.height / 2) * mix(room.scale, desk.scale);
    const x = centreX - (centreX - mix(room.x, desk.x)) * grown;
    const y = centreY - (centreY - mix(room.y, desk.y)) * grown;

    const glass = glassIn(desk, width, height);
    const style = element.style;
    style.setProperty("--art-x", `${x.toFixed(2)}px`);
    style.setProperty("--art-y", `${y.toFixed(2)}px`);
    style.setProperty("--art-s", scale.toFixed(5));
    style.setProperty("--glass-x", `${glass.left.toFixed(1)}px`);
    style.setProperty("--glass-y", `${glass.top.toFixed(1)}px`);
    style.setProperty("--glass-w", `${glass.width.toFixed(1)}px`);
    style.setProperty("--glass-h", `${glass.height.toFixed(1)}px`);
    style.setProperty("--k", inside ? "1" : Math.min(1.3, Math.max(0.94, glass.width / 640)).toFixed(3));
    document.documentElement.style.setProperty("--dpr", String(window.devicePixelRatio || 1));
    element.dataset.inside = String(inside);
  }, []);

  useEffect(() => {
    frame();
    // Development only: lets the arrival be stepped through by hand when inspecting the page.
    if (process.env.NODE_ENV !== "production") (window as unknown as { __gsap?: typeof gsap }).__gsap = gsap;
    window.addEventListener("resize", frame);
    return () => window.removeEventListener("resize", frame);
  }, [frame]);

  // Arrival: the room comes up out of the dark, the view settles on the desk, the monitor wakes.
  useGSAP(
    () => {
      const veil = root.current?.querySelector(".auth-veil");
      const ui = root.current?.querySelector(".auth-ui");
      if (!veil || !ui) return;
      const wake = () => root.current?.setAttribute("data-on", "true");
      if (reduced) {
        view.current.near = 1;
        frame();
        gsap.to(veil, { autoAlpha: 0, duration: 0.4, onComplete: wake });
        return;
      }
      gsap
        .timeline()
        .to(veil, { autoAlpha: 0, duration: 0.9, ease: "power1.out" })
        .to(view.current, { near: 1, duration: 1.15, ease: "power2.inOut", onUpdate: frame }, 0.45)
        .add(wake, ">-0.25");
    },
    { scope: root, dependencies: [reduced, frame] },
  );

  // Depth: the room stays put, the interface leans a pixel or two against the pointer, the feed a little more.
  useEffect(() => {
    const element = root.current;
    if (reduced || !element || !window.matchMedia("(pointer: fine)").matches) return;
    const layers = (
      [
        [".auth-ui", 1.5],
        [".auth-market", 2],
      ] as const
    ).map(([selector, reach]) => ({
      reach,
      x: gsap.quickTo(selector, "x", { duration: 0.9, ease: "power3.out" }),
      y: gsap.quickTo(selector, "y", { duration: 0.9, ease: "power3.out" }),
    }));
    const lean = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * -2;
      const y = (event.clientY / window.innerHeight - 0.5) * -2;
      for (const layer of layers) {
        layer.x(x * layer.reach);
        layer.y(y * layer.reach * 0.6);
      }
    };
    window.addEventListener("pointermove", lean, { passive: true });
    return () => window.removeEventListener("pointermove", lean);
  }, [reduced]);

  // Home is where every way out of this page leads, so it is fetched ahead.
  useEffect(() => {
    router.prefetch(AFTER_AUTH_ROUTE);
  }, [router]);

  /** The way out: the view pushes into the monitor and the frame goes to ink. */
  const leave = useCallback(
    (hold: number) => {
      if (leaving.current) return;
      leaving.current = true;
      const veil = root.current?.querySelector(".auth-veil") ?? null;
      let gone = false;
      const go = () => {
        if (gone) return;
        gone = true;
        router.push(AFTER_AUTH_ROUTE);
      };
      // The push runs on animation frames, which stall in a background tab or on a busy main thread,
      // so a timer set to the push's length (plus a little) takes the visitor on if it hasn't ended.
      window.setTimeout(go, (hold + (reduced ? 0.3 : 0.8)) * 1000 + 400);
      const timeline = gsap.timeline({ delay: hold, onComplete: go });
      if (!reduced) timeline.to(view.current, { push: 1, duration: 0.8, ease: "power3.in", onUpdate: frame }, 0);
      timeline.to(veil, { autoAlpha: 1, duration: reduced ? 0.3 : 0.45, ease: "none" }, reduced ? 0 : 0.35);
    },
    [frame, reduced, router],
  );

  const locked = busy !== null || granted !== null;

  const change = (field: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    if (notice?.tone === "error") setNotice(null);
  };

  const switchTo = (next: Mode) => {
    if (locked || next === mode) return;
    setMode(next);
    setErrors({});
    setNotice(null);
  };

  const focusField = (field: AuthField) => {
    if (field === "form") return;
    // After the next paint: a field that was locked while working cannot take focus until it is released.
    requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus());
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (locked) return;
    const found = validate(mode, values);
    setErrors(found);
    setNotice(null);
    const first = (["name", "email", "password", "confirm"] as const).find((field) => found[field]);
    if (first) return focusField(first);

    setBusy(mode);
    const result =
      mode === "signin"
        ? await auth.signIn({ email: values.email, password: values.password })
        : await auth.signUp({ name: values.name, email: values.email, password: values.password });
    setBusy(null);

    if (result.ok) {
      setGranted(result.session);
      leave(0.95);
    } else if (result.field === "form") {
      setNotice({ tone: "error", text: result.message });
    } else {
      setErrors({ [result.field]: result.message });
      focusField(result.field);
    }
  };

  const google = async () => {
    if (locked) return;
    setNotice(null);
    setBusy("google");
    const result = await auth.signInWithGoogle();
    setBusy(null);
    if (result.ok) {
      setGranted(result.session);
      leave(0.95);
    } else {
      setNotice({ tone: "info", text: result.message });
    }
  };

  const forgot = async () => {
    if (locked) return;
    const problem = rules.email(values.email);
    if (problem) {
      setErrors({ email: values.email.trim() ? problem : "Enter your email first." });
      return focusField("email");
    }
    setNotice(null);
    setBusy("reset");
    const result = await auth.requestPasswordReset(values.email);
    setBusy(null);
    setNotice({ tone: "info", text: result.message });
  };

  const test = () => {
    if (locked) return;
    setGranted(auth.signInAsTest());
    leave(0);
  };

  // Two fields share a row when creating an account, which leaves no room beside a label:
  // there the first problem is spelled out under the form instead.
  const inline = mode === "signin";
  const firstError = (Object.keys(EMPTY) as (keyof Values)[]).map((name) => errors[name]).find(Boolean);
  const shown: Notice = notice ?? (!inline && firstError ? { tone: "error", text: firstError } : null);

  const field = (name: keyof Values, label: string, type: string, autoComplete: string, extra?: React.ReactNode) => (
    <div className="auth-field" data-invalid={errors[name] ? "true" : undefined}>
      <div className="auth-field-top">
        <label htmlFor={`${id}-${name}`}>{label}</label>
        {errors[name] && inline ? (
          <span className="auth-error" id={`${id}-${name}-error`}>
            {errors[name]}
          </span>
        ) : (
          extra
        )}
      </div>
      <input
        id={`${id}-${name}`}
        name={name}
        type={type}
        value={values[name]}
        autoComplete={autoComplete}
        autoCapitalize={name === "name" ? "words" : "none"}
        spellCheck={false}
        disabled={locked}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? (inline ? `${id}-${name}-error` : `${id}-notice`) : undefined}
        onChange={(event) => change(name, event.target.value)}
      />
    </div>
  );

  const passwordType = reveal ? "text" : "password";
  const firstName = granted?.name.split(" ")[0];

  return (
    <main ref={root} className="auth" data-mode={mode} data-granted={granted ? "true" : undefined}>
      <div className="auth-room" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- the supplied artwork, drawn as it is and never resampled by an optimiser */}
        <img className="auth-art" src={ROOM.src} width={ROOM.width} height={ROOM.height} alt="" draggable={false} />
        <Ambient />
      </div>

      <div className="auth-glass">
        <div className="auth-ui" aria-busy={busy !== null}>
          <section className="auth-brand">
            <h1 className="sr-only">{COPY.heading}</h1>
            <span className="auth-mark">
              {/* eslint-disable-next-line @next/next/no-img-element -- the supplied wordmark, never re-created */}
              <img src={asset("/brand/fintix-wordmark.png")} width={790} height={316} alt="FINTIX" draggable={false} />
            </span>
            <p className="auth-tag px">
              <span>{COPY.tag[0]}</span>
              <span>{COPY.tag[1]}</span>
            </p>
            <Market animate={!reduced} />

          </section>

          <section className="auth-panel">
            {granted ? (
              <div className="auth-granted" role="status">
                <p className="auth-granted-line px">{COPY.granted}</p>
                <p className="auth-granted-name">Welcome, {firstName}. Opening FINTIX.</p>
                <span className="auth-granted-bar" />
              </div>
            ) : (
              <>
                <div className="auth-tabs" role="tablist" aria-label="Account">
                  {(["signin", "create"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      id={`${id}-tab-${tab}`}
                      aria-selected={mode === tab}
                      aria-controls={`${id}-form`}
                      className="auth-tab px"
                      disabled={locked}
                      onClick={() => switchTo(tab)}
                    >
                      {COPY.tabs[tab]}
                    </button>
                  ))}
                </div>

                <form
                  key={mode}
                  id={`${id}-form`}
                  className="auth-form"
                  role="tabpanel"
                  aria-labelledby={`${id}-tab-${mode}`}
                  noValidate
                  onSubmit={submit}
                >
                  <div className="auth-fields">
                    {mode === "create" && field("name", "Full name", "text", "name")}
                    {field("email", "Email", "email", "email")}
                    {field(
                      "password",
                      "Password",
                      passwordType,
                      mode === "create" ? "new-password" : "current-password",
                      <button type="button" className="auth-mini" onClick={() => setReveal((shown) => !shown)} aria-pressed={reveal}>
                        {reveal ? "Hide" : "Show"}
                      </button>,
                    )}
                    {mode === "create" && field("confirm", "Confirm password", passwordType, "new-password")}
                  </div>

                  <button type="submit" className="auth-submit px" disabled={locked} data-busy={busy === mode ? "true" : undefined}>
                    {busy === mode ? (
                      <>
                        {COPY.working[mode]}
                        <span className="auth-dots" aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        {COPY.submit[mode]}
                        <ArrowRight className="auth-arrow" />
                      </>
                    )}
                  </button>

                  <button type="button" className="auth-google" onClick={google} disabled={locked} data-busy={busy === "google" ? "true" : undefined}>
                    {busy === "google" ? <span className="auth-spin" aria-hidden="true" /> : <GoogleMark />}
                    {busy === "google" ? "Contacting Google" : COPY.google}
                  </button>

                  <div className="auth-foot">
                    <p className="auth-notice" id={`${id}-notice`} role="status" data-tone={shown?.tone}>
                      {shown?.text}
                    </p>
                    {mode === "signin" && (
                      <button type="button" className="auth-mini auth-forgot" onClick={forgot} disabled={locked}>
                        {busy === "reset" ? "Checking" : COPY.forgot}
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </section>

          <div className="auth-test">
            <p className="auth-test-label px">{COPY.testLabel}</p>
            <p className="auth-test-note">{COPY.testNote}</p>
            <button type="button" className="auth-test-go px" onClick={test} disabled={locked}>
              {COPY.testAction}
              <ArrowRight className="auth-arrow" />
            </button>
          </div>
        </div>
      </div>

      <div className="auth-veil" aria-hidden="true" />
    </main>
  );
}

/** Google's "G", as its sign-in guidelines require it to be shown. */
function GoogleMark() {
  return (
    <svg className="auth-g" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
