import type { NextConfig } from "next";

// The artwork, wordmark and Retropix are served from /public under fixed names, so they are
// cached for a day and refreshed in the background rather than treated as immutable.
const staticAsset = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];

// GitHub Pages: the site is built as static files (STATIC_EXPORT=1) and served from
// /<repository>/ (PAGES_BASE_PATH, set by the deploy workflow). Locally neither is set.
const exporting = process.env.STATIC_EXPORT === "1";
const basePath = exporting ? (process.env.PAGES_BASE_PATH ?? "") : "";

const nextConfig: NextConfig = {
  // No framework badge over the product while developing.
  devIndicators: false,
  // Files from /public are referenced as plain strings; asset() (src/lib/asset.ts) adds this path to them.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(exporting
    ? {
        output: "export",
        basePath,
        // Every page is written as a folder with an index.html, which is how GitHub Pages serves a path.
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        // A static host sets its own headers; these apply when the app runs on a Next.js server.
        async headers() {
          return [
            { source: "/onboarding/:file*", headers: staticAsset },
            { source: "/brand/:file*", headers: staticAsset },
            { source: "/auth/:file*", headers: staticAsset },
            { source: "/learn/:dir(modules|neo)/:file*", headers: staticAsset },
            { source: "/learn/room.png", headers: staticAsset },
            { source: "/fonts/:file*", headers: staticAsset },
            { source: "/dashboard/:file*", headers: staticAsset },
            { source: "/models/:file*", headers: staticAsset },
          ];
        },
      }),
};

export default nextConfig;
