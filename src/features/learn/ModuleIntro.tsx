"use client";

import Link from "next/link";
import { MODULES, isUnlocked, moduleProgress } from "./curriculum";
import { useProgress } from "./progress";
import { Bar, Lock, ModuleArt, Shell } from "./Shell";
import type { Module } from "./types";
import { NeoSays } from "./ui";

export function ModuleIntro({ module }: { module: Module }) {
  const state = useProgress();
  const index = MODULES.indexOf(module);
  const open = isUnlocked(index, state);
  const done = (slug: string) => state.lessons.includes(`${module.slug}/${slug}`);
  const next = module.lessons.find((lesson) => !done(lesson.slug));
  const passed = state.challenges.includes(module.slug);
  const percent = moduleProgress(module, state);
  const target = next ? `/learn/${module.slug}/${next.slug}` : `/learn/${module.slug}/challenge`;

  return (
    <Shell>
      <main className="intro">
        <div className="crumbs">
          <Link href="/learn">
            <i aria-hidden="true" data-glyph="back" /> Back to Learning Hub
          </Link>
          <span>
            Module {module.id} of {String(MODULES.length).padStart(2, "0")}
          </span>
        </div>

        <div className="intro-art">
          <ModuleArt module={module} />
        </div>

        <div className="intro-body">
          <p className="intro-kicker">Module {module.id}</p>
          <h1 className="px">{module.title}</h1>
          <p className="intro-desc">{module.description}</p>
          <ul className="intro-meta">
            <li>
              <b>{module.lessons.length}</b> lessons
            </li>
            <li>
              <b>~{module.minutes}</b> mins
            </li>
            <li>
              <b>{module.level}</b>
            </li>
            {percent ? (
              <li data-progress="true">
                <Bar value={percent} label="Module progress" />
                <b>{percent}%</b>
              </li>
            ) : null}
          </ul>

          <ol className="intro-lessons">
            {module.lessons.map((lesson, position) => (
              <li key={lesson.slug} data-done={done(lesson.slug)} data-next={open && lesson === next}>
                {open ? (
                  <Link href={`/learn/${module.slug}/${lesson.slug}`}>
                    <b>{String(position + 1).padStart(2, "0")}</b>
                    <span>{lesson.title}</span>
                    <i aria-hidden="true" data-glyph={done(lesson.slug) ? "tick" : "go"} />
                  </Link>
                ) : (
                  <span>
                    <b>{String(position + 1).padStart(2, "0")}</b>
                    <span>{lesson.title}</span>
                  </span>
                )}
              </li>
            ))}
            <li data-final="true" data-done={passed}>
              {open ? (
                <Link href={`/learn/${module.slug}/challenge`}>
                  <b aria-hidden="true">
                    <i data-glyph="cup" />
                  </b>
                  <span>Final Challenge</span>
                  <i aria-hidden="true" data-glyph={passed ? "tick" : "go"} />
                </Link>
              ) : (
                <span>
                  <b aria-hidden="true">
                    <i data-glyph="cup" />
                  </b>
                  <span>Final Challenge</span>
                </span>
              )}
            </li>
          </ol>
        </div>

        <aside className="intro-guide">
          <p className="intro-guide-title">Meet Neo</p>
          <NeoSays mood="celebrate" size={190} side="top">
            {open ? module.neo : `This one opens when Module ${MODULES[index - 1].id} is complete. See you there.`}
          </NeoSays>
          {open ? (
            <Link className="cta" href={passed ? `/learn/${module.slug}/${module.lessons[0].slug}` : target}>
              <span className="px">{passed ? "Review module" : percent ? "Continue" : "Start module"}</span>
              <i aria-hidden="true" data-glyph="arrow" />
            </Link>
          ) : (
            <Link className="cta" data-locked="true" href={`/learn/${MODULES[index - 1].slug}`}>
              <Lock />
              <span className="px">Go to Module {MODULES[index - 1].id}</span>
            </Link>
          )}
        </aside>
      </main>
    </Shell>
  );
}
