"use client";

import Link from "next/link";
import { useState } from "react";
import { MODULES, isUnlocked, lessonsDone, moduleProgress } from "./curriculum";
import { useProgress } from "./progress";
import { Bar, Lock, ModuleArt, Shell } from "./Shell";
import { NeoSays } from "./ui";
import { asset } from "@/lib/asset";

/** The supplied student-room artwork, shown whole at its own proportions. */
const ROOM = { src: asset("/learn/room.png"), width: 1672, height: 941 };

export function Hub() {
  const state = useProgress();
  const [refused, setRefused] = useState<string | null>(null);
  const current = MODULES.findIndex((entry, index) => isUnlocked(index, state) && !state.challenges.includes(entry.slug));
  const finished = current === -1;
  const started = state.lessons.length > 0 || state.challenges.length > 0;

  return (
    <Shell wide>
      <main className="hub">
        <div className="hub-room">
          {/* eslint-disable-next-line @next/next/no-img-element -- supplied artwork, shown unaltered */}
          <img src={ROOM.src} width={ROOM.width} height={ROOM.height} alt="" draggable={false} />
        </div>

        <div className="hub-head">
          <p className="hub-kicker">Learning Hub</p>
          <h1 className="px">Learning Modules</h1>
          <p className="hub-sub">Understand the market before you trade it.</p>
        </div>

        <div className="hub-neo">
          <NeoSays mood={finished ? "celebrate" : started ? "wave" : "celebrate"} size={168}>
            {finished
              ? "All five modules complete. You know what you’re doing, and what you’re risking."
              : started
                ? `Welcome back. Module ${MODULES[current].id} is where you left off.`
                : "Welcome to the Learning Modules. Let’s understand the market before you trade."}
          </NeoSays>
        </div>

        <section className="hub-path" aria-label="Modules">
          <ol>
            {MODULES.map((entry, index) => {
              const open = isUnlocked(index, state);
              const done = state.challenges.includes(entry.slug);
              const percent = moduleProgress(entry, state);
              const status = done ? "Complete" : !open ? "Locked" : percent ? "Continue" : "Start";
              const body = (
                <>
                  <span className="mod-step">
                    <b className="px">{entry.id}</b>
                    <em>{status}</em>
                  </span>
                  <ModuleArt module={entry} dim={!open} />
                  <span className="mod-title px">{entry.title}</span>
                  <span className="mod-tag">{entry.tagline}</span>
                  <span className="mod-foot">
                    {open ? (
                      <>
                        <Bar value={percent} label={`${entry.title} progress`} />
                        <span>
                          {lessonsDone(entry, state)}/{entry.lessons.length}
                        </span>
                      </>
                    ) : (
                      <>
                        <Lock />
                        <span>Finish Module {MODULES[index - 1].id} first</span>
                      </>
                    )}
                  </span>
                </>
              );
              return (
                <li key={entry.slug} data-state={done ? "done" : !open ? "locked" : index === current ? "current" : "open"}>
                  {open ? (
                    <Link className="mod" href={`/learn/${entry.slug}`}>
                      {body}
                    </Link>
                  ) : (
                    <button type="button" className="mod" aria-disabled="true" onClick={() => setRefused(entry.slug)}>
                      {body}
                    </button>
                  )}
                  {refused === entry.slug && !open ? (
                    <p className="mod-refused" role="status">
                      Complete Module {MODULES[index - 1].id}’s final challenge to open this one.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <p className="hub-route">
            <span>Learn</span>
            <span>Understand</span>
            <span>Experiment</span>
            <span>Build confidence</span>
            <span data-locked="true">
              Trade <Lock />
            </span>
          </p>
        </section>
      </main>
    </Shell>
  );
}
