"use client";

import Link from "next/link";
import { useState } from "react";
import { seeded } from "./charts";
import { ModuleFrame } from "./LessonView";
import { progress } from "./progress";
import type { Module, Question } from "./types";
import { NeoSays } from "./ui";

type Verdict = "right" | "wrong" | undefined;

const parse = (text: string) => Number.parseFloat(text.replace(/[₹,%\s]|shares?/gi, ""));

/** A fixed shuffle, so the server and the browser agree on the starting order. */
function shuffled(steps: string[]) {
  const random = seeded(steps.length * 97 + steps[0].length);
  const order = steps.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (order.every((value, index) => value === index)) order.reverse();
  return order;
}

function Row({ question, number, verdict, onVerdict }: { question: Question; number: number; verdict: Verdict; onVerdict: (right: boolean) => void }) {
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<number | null>(null);
  const [order, setOrder] = useState(() => (question.kind === "order" ? shuffled(question.steps) : []));
  const locked = verdict === "right";

  const swap = (from: number, to: number) => {
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    setOrder(next);
  };

  return (
    <li className="q" data-verdict={verdict} data-kind={question.kind}>
      <b className="q-no">{number}</b>
      <div className="q-body">
        <p className="q-prompt">{question.prompt}</p>

        {question.kind === "number" ? (
          <form
            className="q-number"
            onSubmit={(event) => {
              event.preventDefault();
              if (text.trim()) onVerdict(Math.abs(parse(text) - question.answer) < 0.011);
            }}
          >
            {question.unit === "₹" ? <span>₹</span> : null}
            <input inputMode="decimal" value={text} onChange={(event) => setText(event.target.value)} readOnly={locked} aria-label={question.prompt} placeholder="Your answer" autoComplete="off" />
            {question.unit && question.unit !== "₹" ? <span>{question.unit}</span> : null}
            <button type="submit" disabled={locked || !text.trim()}>
              Check
            </button>
          </form>
        ) : null}

        {question.kind === "choice" ? (
          <div className="q-choices" role="radiogroup" aria-label={question.prompt}>
            {question.options.map((option, index) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={chosen === index}
                disabled={locked}
                onClick={() => {
                  setChosen(index);
                  onVerdict(index === question.answer);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}

        {question.kind === "order" ? (
          <>
            <ol className="q-order">
              {order.map((step, index) => (
                <li key={step}>
                  <span>{question.steps[step]}</span>
                  <button type="button" onClick={() => swap(index, index - 1)} disabled={locked || index === 0} aria-label={`Move “${question.steps[step]}” earlier`}>
                    <i aria-hidden="true" data-glyph="up" />
                  </button>
                  <button type="button" onClick={() => swap(index, index + 1)} disabled={locked || index === order.length - 1} aria-label={`Move “${question.steps[step]}” later`}>
                    <i aria-hidden="true" data-glyph="down" />
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="q-check" disabled={locked} onClick={() => onVerdict(order.every((step, index) => step === index))}>
              Check order
            </button>
          </>
        ) : null}

        {verdict ? (
          <p className="q-note" aria-live="polite">
            <b>{verdict === "right" ? "Correct." : "Not yet."}</b> {verdict === "right" ? question.explain : question.hint}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function ChallengeView({ module }: { module: Module }) {
  const { challenge } = module;
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const right = challenge.questions.filter((_, index) => verdicts[index] === "right").length;
  const wrong = verdicts.some((verdict) => verdict === "wrong");
  const passed = right === challenge.questions.length;

  const judge = (index: number) => (correct: boolean) => {
    const next = [...verdicts];
    next[index] = correct ? "right" : "wrong";
    setVerdicts(next);
    if (challenge.questions.every((_, at) => next[at] === "right")) progress.passChallenge(module.slug);
  };

  return (
    <ModuleFrame module={module} active="challenge">
      <article className="challenge">
        <header className="challenge-head">
          <i aria-hidden="true" data-glyph="cup" />
          <div>
            <p className="challenge-kicker">Module {module.id} checkpoint</p>
            <h1 className="px">Final Challenge</h1>
          </div>
          <NeoSays mood={passed ? "celebrate" : wrong ? "think" : "neutral"} size={104}>
            {passed ? challenge.neo.pass : wrong ? "Close. Read the hint, then try that one again." : challenge.neo.intro}
          </NeoSays>
        </header>

        <div className="challenge-grid">
          <section className="brief" aria-label="Scenario">
            <h2>The situation</h2>
            {challenge.scenario.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {challenge.facts ? (
              <dl>
                {challenge.facts.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {challenge.book ? (
              <table>
                <thead>
                  <tr>
                    <th>Buyers · Bids</th>
                    <th>Sellers · Asks</th>
                  </tr>
                </thead>
                <tbody>
                  {challenge.book.bids.map((bid, index) => (
                    <tr key={bid}>
                      <td data-side="bid">₹{bid}</td>
                      <td data-side="ask">₹{challenge.book?.asks[index]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <div className="score" aria-live="polite">
              <span>Answered correctly</span>
              <b className="px">
                {right}/{challenge.questions.length}
              </b>
              <span className="score-pips" aria-hidden="true">
                {challenge.questions.map((_, index) => (
                  <i key={index} data-verdict={verdicts[index]} />
                ))}
              </span>
            </div>
          </section>

          <ol className="questions">
            {challenge.questions.map((question, index) => (
              <Row key={question.prompt} question={question} number={index + 1} verdict={verdicts[index]} onVerdict={judge(index)} />
            ))}
          </ol>
        </div>

        <footer className="challenge-foot" data-passed={passed}>
          <p>{passed ? "Every answer is correct. The module is complete." : "Answer every question correctly to complete the module. You can retry as often as you like."}</p>
          {passed ? (
            <Link className="cta" data-ready="true" href={`/learn/${module.slug}/complete`}>
              <span className="px">Complete module</span>
              <i aria-hidden="true" data-glyph="arrow" />
            </Link>
          ) : null}
        </footer>
      </article>
    </ModuleFrame>
  );
}
