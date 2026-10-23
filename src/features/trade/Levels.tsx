"use client";

import Link from "next/link";
import { levels, simProgress, useSimProgress } from "./progress";
import { SimShell } from "./SimShell";
import { Glyph, NeoSprite } from "./ui";

function Padlock() {
  return (
    <svg className="sim-glyph" viewBox="0 0 10 12" width="12" height="14" aria-hidden="true">
      <path d="M2 5V3h1V1h4v2h1v2h2v7H0V5h2Zm2 0h2V3H4v2Z" fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/** The simulator's front door: three levels, of which Beginner is open. */
export function Levels() {
  const progress = useSimProgress();
  const list = levels(progress);
  const started = !!progress && (progress.tutorialDone || progress.tutorialSkipped);

  return (
    <SimShell>
      <div className="lvl">
        <header className="lvl-head">
          <NeoSprite mood="wave" size={120} />
          <div>
            <h1 className="px">Choose your level</h1>
            <p>Practise buying and selling with ₹1,00,000 of virtual money in a simulated market. No real money is involved.</p>
          </div>
        </header>

        <ol className="lvl-list">
          {list.map((level, index) => (
            <li key={level.id} className="lvl-card" data-state={level.state}>
              <p className="lvl-number">Level {index + 1}</p>
              <h2 className="px">{level.name}</h2>
              <p className="lvl-note">{level.note}</p>
              {level.state === "open" ? (
                <div className="lvl-actions">
                  <Link className="sim-button" data-tone="buy" href="/trade/beginner">
                    {started ? "Open simulator" : "Start with Neo"} <Glyph name="arrow" />
                  </Link>
                  {started ? (
                    <Link className="sim-button" data-tone="quiet" href="/trade/beginner/tutorial" onClick={() => simProgress.replay()}>
                      Replay tutorial
                    </Link>
                  ) : null}
                </div>
              ) : (
                <p className="lvl-lock">
                  <Padlock /> {level.state === "unlocked-soon" ? "Unlocked · coming in a later version" : "Locked"}
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </SimShell>
  );
}
