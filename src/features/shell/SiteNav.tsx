"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { auth } from "@/features/auth/authClient";
import { requestTour } from "@/features/tour/Tour";
import "./site-nav.css";
import { asset } from "@/lib/asset";

export type Area = "home" | "learn" | "trade";

const AREAS: { area: Area; href: string; label: string }[] = [
  { area: "home", href: "/home", label: "Home" },
  { area: "learn", href: "/learn", label: "Learn" },
  { area: "trade", href: "/trade", label: "Trade" },
];

/** The profile shown until someone signs in. */
export const DEMO_USER = "Medansh";

const never = () => () => {};

/** The first name of whoever is signed in. Before sign-in, the demo profile. */
export const useFirstName = () =>
  useSyncExternalStore(
    never,
    () => auth.getSession()?.name.split(" ")[0] || DEMO_USER,
    () => DEMO_USER,
  );

/**
 * FINTIX's navigation bar: the wordmark, the three areas, and the account.
 * Every signed-in screen renders this one component, so the bar never changes
 * between Home, Learn and Trade.
 */
export function SiteNav({
  active,
  children,
}: {
  active: Area | null;
  /** Extra account-menu entries, supplied by the area that owns them. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const name = useFirstName();
  const [menu, setMenu] = useState(false);
  const account = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Retropix is only crisp on whole device pixels; the type scale needs the real ratio.
    const sync = () => document.documentElement.style.setProperty("--dpr", String(window.devicePixelRatio || 1));
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !account.current?.contains(event.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  return (
    <header className="nav">
      <Link className="nav-mark" href="/home" aria-label="FINTIX — Home">
        {/* eslint-disable-next-line @next/next/no-img-element -- the supplied wordmark, shown as it is */}
        <img src={asset("/brand/fintix-wordmark.png")} width={790} height={316} alt="" />
      </Link>
      <nav className="nav-areas" aria-label="FINTIX">
        {AREAS.map((entry) => (
          <Link key={entry.area} className="nav-area" data-area={entry.area} href={entry.href} aria-current={entry.area === active ? "page" : undefined}>
            {entry.label}
          </Link>
        ))}
      </nav>
      <div className="nav-account" ref={account}>
        <button type="button" className="nav-user" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu(!menu)}>
          <i aria-hidden="true" />
          <span>{name}</span>
        </button>
        {menu ? (
          <div className="nav-menu" role="menu" onClick={(event) => (event.target as HTMLElement).closest("[role=menuitem]") && setMenu(false)}>
            {children}
            {/* Home runs the tour where it is; from anywhere else, Home opens with it. */}
            <button type="button" role="menuitem" onClick={() => (active === "home" ? requestTour() : router.push("/home?tour"))}>
              Tour FINTIX with Neo
            </button>
            <Link role="menuitem" href="/">
              Replay the intro
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                auth.signOut();
                router.push("/enter");
              }}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
