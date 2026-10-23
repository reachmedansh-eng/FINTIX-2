import Link from "next/link";
import type { ReactNode } from "react";
import { SiteNav, type Area } from "./SiteNav";
import "./not-built.css";

/** A screen that is linked to but not built yet: the navigation bar, and a short, honest note. */
export function NotBuilt({ area, title, children }: { area: Area | null; title: string; children: ReactNode }) {
  return (
    <div className="nb">
      <SiteNav active={area} />
      <main className="nb-main">
        <section className="nb-card">
          <p className="nb-kicker">Not built yet</p>
          <h1 className="px">{title}</h1>
          <p>{children}</p>
          <Link className="nb-back" href="/home">
            Back to Home
          </Link>
        </section>
      </main>
    </div>
  );
}
