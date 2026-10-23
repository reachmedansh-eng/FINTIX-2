// After a static export: Next.js writes each page's navigation data in nested folders
// (home/__next.home/__PAGE__.txt) but the browser asks for it under one flattened name
// (home/__next.home.__PAGE__.txt). Without the flattened copies, every in-app navigation on a static
// host misses its data and falls back to a full page load. This writes each file under the name asked for.
//   node scripts/flatten-segments.mjs [outDir]
import { copyFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? "out";
let written = 0;

/** Every file under a __next.* folder, as its path parts relative to that folder. */
function files(dir, parts = []) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, [...parts, name]) : [[...parts, name]];
  });
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    if (name.startsWith("__next.")) {
      for (const parts of files(path)) {
        copyFileSync(join(path, ...parts), join(dir, [name, ...parts].join(".")));
        written += 1;
      }
    } else walk(path);
  }
}

walk(out);
console.log(`flatten-segments: wrote ${written} navigation data files`);
