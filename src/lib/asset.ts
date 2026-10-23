/**
 * A file from /public, at the path the site is actually served from. Locally
 * that is the root; on GitHub Pages the site lives under /<repository>/, which
 * Next.js adds to links and its own files but not to plain strings like these.
 */
export const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
