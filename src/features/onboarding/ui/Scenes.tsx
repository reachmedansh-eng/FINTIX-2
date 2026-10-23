import Link from "next/link";
import type { MouseEvent } from "react";
import { COPY, PRODUCT_ROUTE } from "../content";
import { ArrowRight } from "./Glyphs";

/** A headline line: clipped at its own baseline so it can rise into place, split into words so each can light up. */
function Line({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <span className="onb-line">
      <span className="onb-line-in">
        {words.map((word, i) => (
          <span key={i}>
            <span className="onb-word">{word}</span>
            {i < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </span>
  );
}

function Title({ lines, small }: { lines: readonly string[]; small?: boolean }) {
  return (
    <p className={small ? "onb-title onb-title-small px" : "onb-title px"} aria-hidden="true">
      {lines.map((line) => (
        <Line key={line} text={line} />
      ))}
    </p>
  );
}

function Body({ children }: { children: string }) {
  return (
    <p className="onb-body" aria-hidden="true">
      {children}
    </p>
  );
}

type Props = { onEnter: (event: MouseEvent<HTMLAnchorElement>) => void };

/**
 * Scenes 02 to 08: the words that travel with the camera. They are marked up
 * here and brought in and out by the timeline in journey.ts. The visible copy
 * is hidden from assistive technology because the same story is given in
 * plain reading order at the top of the page; the entry link is not.
 */
export function Scenes({ onEnter }: Props) {
  return (
    <>
      <section className="onb-scene onb-understand" data-scene="understand">
        <div className="onb-shade" />
        <div className="onb-copy">
          <Title lines={COPY.understand.title} />
          <Body>{COPY.understand.body}</Body>
        </div>
      </section>

      <section className="onb-scene onb-learn" data-scene="learn">
        <div className="onb-copy">
          <Title lines={COPY.learn.title} small />
        </div>
        <ul className="onb-concepts" aria-hidden="true">
          {COPY.learn.concepts.map((concept, i) => (
            <li key={concept.word} className="onb-concept" data-concept={i}>
              <span className="onb-concept-word px">{concept.word}</span>
              <span className="onb-concept-note">{concept.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="onb-scene onb-capital" data-scene="capital">
        <div className="onb-shade" />
        <div className="onb-copy">
          <Title lines={COPY.capital.title} />
          <Body>{COPY.capital.body}</Body>
        </div>
      </section>

      <section className="onb-scene onb-explore" data-scene="explore">
        <div className="onb-shade" />
        <div className="onb-copy">
          <Title lines={COPY.explore.title} />
          <Body>{COPY.explore.body}</Body>
        </div>
        <ul className="onb-fragments" aria-hidden="true">
          {COPY.explore.fragments.map((fragment) => (
            <li key={fragment.label} className="onb-fragment" data-up={fragment.up ? "" : undefined}>
              <span className="px">{fragment.label}</span>
              <span className="onb-fragment-value">{fragment.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="onb-scene onb-simulate" data-scene="simulate">
        <div className="onb-copy">
          <Title lines={COPY.simulate.title} />
          <Body>{COPY.simulate.body}</Body>
        </div>
      </section>

      <section className="onb-scene onb-build" data-scene="build">
        <div className="onb-shade" />
        <div className="onb-copy">
          <Title lines={COPY.build.title} />
          <Body>{COPY.build.body}</Body>
        </div>
      </section>

      <section className="onb-scene onb-arrive" data-scene="arrive">
        <div className="onb-shade" />
        <div className="onb-copy">
          <Title lines={COPY.arrive.title} />
        </div>
        <div className="onb-action">
          <span className="onb-enter-wrap">
            <Link href={PRODUCT_ROUTE} className="onb-enter px" onClick={onEnter}>
              <span>{COPY.arrive.action}</span>
              <ArrowRight className="onb-enter-arrow" />
            </Link>
          </span>
          <p className="onb-enter-note" aria-hidden="true">
            {COPY.arrive.note}
          </p>
        </div>
      </section>
    </>
  );
}
