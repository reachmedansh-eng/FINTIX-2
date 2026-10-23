"use client";

import Link from "next/link";
import { ChallengeView } from "./ChallengeView";
import { MODULES, moduleBySlug } from "./curriculum";
import { LessonView } from "./LessonView";
import { ModuleIntro } from "./ModuleIntro";
import { useProgress } from "./progress";
import { ModuleArt, Shell } from "./Shell";
import type { Module } from "./types";
import { NeoSays } from "./ui";

/**
 * Routes hand over slugs; these resolve them in the browser bundle, where the
 * curriculum's interactive components live. The routes have already checked
 * that the slugs exist.
 */

export function ModuleScreen({ module }: { module: string }) {
  const entry = moduleBySlug(module);
  return entry ? <ModuleIntro module={entry} /> : null;
}

export function LessonScreen({ module, lesson }: { module: string; lesson: string }) {
  const entry = moduleBySlug(module);
  if (!entry) return null;
  if (lesson === "challenge") return <ChallengeView module={entry} />;
  if (lesson === "complete") return <Complete module={entry} />;
  const found = entry.lessons.find((item) => item.slug === lesson);
  return found ? <LessonView module={entry} lesson={found} /> : null;
}

function Complete({ module }: { module: Module }) {
  const state = useProgress();
  const passed = state.challenges.includes(module.slug);
  const next = MODULES[MODULES.indexOf(module) + 1];
  const total = MODULES.filter((entry) => state.challenges.includes(entry.slug)).length;

  return (
    <Shell>
      <main className="complete" data-passed={passed}>
        <div className="complete-art">
          <ModuleArt module={module} />
        </div>
        <div className="complete-body">
          <p className="intro-kicker">{passed ? `${total} of ${MODULES.length} modules complete` : "Not complete yet"}</p>
          <h1 className="px">{passed ? `Module ${module.id} complete!` : `Module ${module.id}: one step left`}</h1>
          {passed ? (
            <>
              <p className="complete-lead">You now understand:</p>
              <ul className="complete-list">
                {module.learned.map((item, index) => (
                  <li key={item} style={{ animationDelay: `${index * 70}ms` }}>
                    <i aria-hidden="true" data-glyph="tick" />
                    {item}
                  </li>
                ))}
              </ul>
              <ol className="complete-track" aria-label="Modules completed">
                {MODULES.map((entry) => (
                  <li key={entry.slug} data-done={state.challenges.includes(entry.slug)} data-here={entry === module}>
                    {entry.id}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="complete-lead">Pass the final challenge to complete this module.</p>
          )}
          <div className="complete-actions">
            <Link className="step" href={`/learn/${module.slug}`}>
              Review module
            </Link>
            {!passed ? (
              <Link className="cta" data-ready="true" href={`/learn/${module.slug}/challenge`}>
                <span className="px">Final challenge</span>
                <i aria-hidden="true" data-glyph="arrow" />
              </Link>
            ) : next ? (
              <Link className="cta" data-ready="true" href={`/learn/${next.slug}`}>
                <span className="px">Next module</span>
                <i aria-hidden="true" data-glyph="arrow" />
              </Link>
            ) : (
              <Link className="cta" data-ready="true" href="/learn">
                <span className="px">Learning Hub</span>
                <i aria-hidden="true" data-glyph="arrow" />
              </Link>
            )}
          </div>
        </div>
        {passed ? (
          <div className="complete-neo">
            <NeoSays mood="celebrate" size={220} side="top">
              {next ? `Nicely done. Module ${next.id}, ${next.title}, is now open.` : "That’s every module. The trading simulator is where this knowledge goes next."}
            </NeoSays>
          </div>
        ) : null}
      </main>
    </Shell>
  );
}
