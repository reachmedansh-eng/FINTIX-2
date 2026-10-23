import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import type { ReactNode } from "react";
import { preload } from "react-dom";
import { asset } from "@/lib/asset";
import "./globals.css";

// Space Grotesk, from the supplied files: the reading face beside Retropix. The .woff2 is the
// supplied variable TTF (kept beside it) in a smaller container; its font tables are identical.
const grotesk = localFont({
  src: "./fonts/SpaceGrotesk-Variable.woff2",
  variable: "--font-grotesk",
  weight: "300 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FINTIX — The Financial Simulator",
  description:
    "FINTIX teaches teenagers how financial markets work, through interactive lessons, market exploration and simulated decisions. No real money.",
};

export const viewport: Viewport = {
  themeColor: "#02031a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Retropix carries every headline, so it is fetched alongside the document.
  preload(asset("/fonts/retropix.woff2"), { as: "font", type: "font/woff2", crossOrigin: "anonymous" });

  return (
    // The inline script writes --dpr onto <html> before React arrives; that one attribute is expected to differ.
    <html lang="en" className={grotesk.variable} suppressHydrationWarning>
      <head>
        {/* Declared here rather than in globals.css so its URL includes the path the site is served from (GitHub Pages serves it from /<repository>/). */}
        <style>{`@font-face{font-family:"Retropix";src:url("${asset("/fonts/retropix.woff2")}") format("woff2");font-weight:400;font-style:normal;font-display:block}`}</style>
      </head>
      <body>
        {/* Retropix sizes depend on the pixel ratio of the screen. Setting it before the page is interactive keeps headings from resizing once the page wakes up. */}
        <Script id="pixel-ratio" strategy="beforeInteractive">
          {`document.documentElement.style.setProperty("--dpr",String(window.devicePixelRatio||1))`}
        </Script>
        {children}
      </body>
    </html>
  );
}
