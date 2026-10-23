"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { MODULES, isUnlocked, moduleProgress } from "./curriculum";
import { progress, useProgress } from "./progress";
import { Bar, Lock, Shell } from "./Shell";
import type { Lesson, Module } from "./types";
import { NeoSays } from "./ui";

/** The frame every lesson and challenge shares: where you are in the module, and the way through it. */
export function ModuleFrame({ module, active, children }: { module: Module; active: string; children: ReactNode }) {
  const state = useProgress();
  const percent = moduleProgress(module, state);
  const position = module.lessons.findIndex((lesson) => lesson.slug === active);
  const here = position === -1 ? "Final Challenge" : `Lesson ${position + 1} of ${module.lessons.length}`;
  const open = isUnlocked(MODULES.indexOf(module), state);

  const list = (
    <ol className="rail-list">
      {module.lessons.map((lesson, index) => (
        <li key={lesson.slug} data-done={state.lessons.includes(`${module.slug}/${lesson.slug}`)}>
          <Link href={`/learn/${module.slug}/${lesson.slug}`} aria-current={lesson.slug === active ? "page" : undefined}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <span>{lesson.title}</span>
          </Link>
        </li>
      ))}
      <li data-final="true" data-done={state.challenges.includes(module.slug)}>
        <Link href={`/learn/${module.slug}/challenge`} aria-current={active === "challenge" ? "page" : undefined}>
          <b aria-hidden="true">
            <i data-glyph="cup" />
          </b>
          <span>Final Challenge</span>
        </Link>
      </li>
    </ol>
  );

  return (
    <Shell>
      <main className="lesson" data-kind={active === "challenge" ? "challenge" : "lesson"}>
        <div className="crumbs">
          <Link href={`/learn/${module.slug}`}>
            <i aria-hidden="true" data-glyph="back" /> Back to Module
          </Link>
          <span>
            <b>
              Module {module.id}: {module.title}
            </b>
            {here}
          </span>
        </div>

        <aside className="rail" aria-label="Lessons in this module">
          <p className="rail-title">Lessons</p>
          {list}
          <div className="rail-progress">
            <span>Module progress</span>
            <Bar value={percent} label="Module progress" />
            <b>{percent}%</b>
          </div>
        </aside>

        {/* Narrow screens: the same list, folded into one compact control. */}
        <details className="rail-compact">
          <summary>
            <span>{here}</span>
            <Bar value={percent} label="Module progress" />
            <b>{percent}%</b>
          </summary>
          {list}
        </details>

        {open ? (
          children
        ) : (
          <div className="lesson-locked">
            <Lock />
            <h1 className="px">Module {module.id} is locked</h1>
            <p>Complete the module before it to open these lessons.</p>
            <Link className="cta" href="/learn">
              <span className="px">Learning Hub</span>
            </Link>
          </div>
        )}
      </main>
    </Shell>
  );
}

function LessonBody({ module, lesson }: { module: Module; lesson: Lesson }) {
  const [done, setDone] = useState(false);
  const index = module.lessons.indexOf(lesson);
  const previous = module.lessons[index - 1];
  const next = module.lessons[index + 1];
  const Lab = lesson.Lab;

  return (
    <article className="lesson-main">
      <header className="lesson-head" data-neo={Boolean(lesson.neo)}>
        <b className="lesson-no px" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </b>
        <div className="lesson-intro">
          <h1 className="px">{lesson.title}</h1>
          <p>{lesson.lede}</p>
        </div>
        {lesson.neo ? (
          <NeoSays mood={done ? "celebrate" : lesson.neo.mood} size={104}>
            {done && lesson.neo.done ? lesson.neo.done : lesson.neo.line}
          </NeoSays>
        ) : null}
      </header>

      {lesson.terms || lesson.formula ? (
        <dl className="terms">
          {lesson.terms?.map(([term, meaning]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
          {lesson.formula ? (
            <div data-formula="true">
              <dt>Formula</dt>
              <dd>{lesson.formula}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <p className="goal" data-done={done}>
        <i aria-hidden="true" data-glyph={done ? "tick" : "hand"} />
        <span>
          <b>{done ? "Done" : "Try it"}</b>
          {lesson.goal}
        </span>
      </p>

      <Lab onGoal={() => setDone(true)} />

      <footer className="lesson-foot">
        <p className="insight">
          <b>Key takeaway</b>
          {lesson.takeaway}
        </p>
        <nav className="lesson-nav" aria-label="Lesson navigation">
          {previous ? (
            <Link className="step" href={`/learn/${module.slug}/${previous.slug}`}>
              <i aria-hidden="true" data-glyph="back" /> Previous
            </Link>
          ) : (
            <span />
          )}
          <Link
            className="cta"
            data-ready={done}
            href={`/learn/${module.slug}/${next ? next.slug : "challenge"}`}
            onClick={() => progress.finishLesson(module.slug, lesson.slug)}
          >
            <span className="px">{next ? "Next lesson" : "Final challenge"}</span>
            <i aria-hidden="true" data-glyph="arrow" />
          </Link>
        </nav>
      </footer>
    </article>
  );
}

export function LessonView({ module, lesson }: { module: Module; lesson: Lesson }) {
  return (
    <ModuleFrame module={module} active={lesson.slug}>
      {/* Keyed, so each lesson starts with a fresh interactive and an unmet goal. */}
      <LessonBody key={lesson.slug} module={module} lesson={lesson} />
    </ModuleFrame>
  );
}
