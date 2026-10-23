"use client";

import type { CSSProperties, ReactNode } from "react";
import { SiteNav } from "@/features/shell/SiteNav";
import { progress, useProgress } from "./progress";
import type { Module } from "./types";
import "./learn.css";
import "./labs.css";

function Lock() {
  return (
    <svg className="lock" viewBox="0 0 10 12" width="10" height="12" aria-hidden="true">
      <path d="M2 5V3h1V1h4v2h1v2h2v7H0V5h2Zm2 0h2V3H4v2Z" fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/** The Learning Hub's frame, under FINTIX's shared navigation bar. */
export function Shell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const state = useProgress();

  return (
    <div className="learn" data-wide={wide}>
      <SiteNav active="learn">
        <label>
          <input type="checkbox" checked={state.preview} onChange={(event) => progress.setPreview(event.target.checked)} />
          Preview: open all modules
        </label>
        <button type="button" role="menuitem" onClick={() => progress.reset()}>
          Reset learning progress
        </button>
      </SiteNav>
      {children}
    </div>
  );
}

/**
 * A module's one illustration. The supplied file carries a soft glow around
 * the framed tile; the tile is aligned to the box and the glow is left to
 * fall outside it, so the artwork is shown whole and unaltered.
 */
export function ModuleArt({ module, dim }: { module: Module; dim?: boolean }) {
  const { src, width, height, tile } = module.art;
  const [x, y, w, h] = tile;
  return (
    <span className="art" data-dim={dim} style={{ aspectRatio: `${w} / ${h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- supplied pixel art, shown as drawn */}
      <img
        src={src}
        width={width}
        height={height}
        alt=""
        draggable={false}
        style={{ width: `${(width / w) * 100}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` } as CSSProperties}
      />
    </span>
  );
}

export function Bar({ value, label }: { value: number; label: string }) {
  return (
    <span className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
      <i style={{ width: `${value}%` }} />
    </span>
  );
}

export { Lock };
