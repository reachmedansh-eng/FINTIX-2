import type { ReactNode } from "react";
import { SiteNav } from "@/features/shell/SiteNav";
import "./trade.css";

/** Every simulator screen: FINTIX's navigation bar with Trade active, and the page below it. */
export function SimShell({ children, bleed }: { children: ReactNode; /** Edge to edge, for the opening scene. */ bleed?: boolean }) {
  return (
    <div className="sim">
      <SiteNav active="trade" />
      <main className="sim-main" data-bleed={bleed || undefined}>
        {children}
      </main>
    </div>
  );
}
