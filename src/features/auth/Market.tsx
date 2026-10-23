"use client";

import { useEffect, useRef } from "react";

/**
 * A small live market feed for the workstation: one fictional FINTIX asset,
 * simulated in the browser. No real financial data is used or fetched.
 *
 * The price is a random walk with the things that make a chart look traded:
 * quiet and busy spells, short trends that turn, and a pull back toward a
 * slowly drifting level so it never runs off. A candle is built tick by tick
 * and a new one opens every few seconds, so the feed never repeats or stops.
 */

const SYMBOL = "FNTX";
const TICKS_PER_CANDLE = 8;
/** Candle pitch in CSS pixels: body and gap. */
const BODY = 4;
const GAP = 3;

const UP = "#2fc0ff";
const DOWN = "#2a7cf6";
const LAST = "#f4b63a";
const GRID = "rgba(170, 176, 200, 0.1)";

type Candle = { open: number; high: number; low: number; close: number };

function createFeed() {
  let price = 248.6;
  let level = price;
  let trend = 0;
  let busy = 0.4;

  /** Roughly normal, from three uniform draws: enough for a believable walk. */
  const noise = () => Math.random() + Math.random() + Math.random() - 1.5;

  const tick = () => {
    busy += (0.4 - busy) * 0.08 + Math.abs(noise()) * 0.09;
    if (Math.random() < 0.03) busy += 0.3;
    if (Math.random() < 0.06) trend = noise() * 0.07;
    level += noise() * 0.03;
    price += noise() * 0.26 * busy + trend + (level - price) * 0.035;
    return price;
  };

  const candle = (open: number): Candle => {
    const made = { open, high: open, low: open, close: open };
    for (let i = 0; i < TICKS_PER_CANDLE; i++) extend(made, tick());
    return made;
  };

  return { tick, candle, price: () => price };
}

function extend(candle: Candle, price: number) {
  candle.close = price;
  if (price > candle.high) candle.high = price;
  if (price < candle.low) candle.low = price;
}

export function Market({ animate }: { animate: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const priceText = useRef<HTMLSpanElement>(null);
  const changeText = useRef<HTMLSpanElement>(null);
  const clockText = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;

    const feed = createFeed();
    let candles: Candle[] = [];
    let ticks = 0;
    let sessionOpen = feed.price();
    /** The visible price range, eased so the chart never jumps when it rescales. */
    let top = 0;
    let bottom = 0;
    let width = 0;
    let height = 0;
    let ratio = 1;
    let frame = 0;
    let timer = 0;
    let dirty = true;

    const capacity = () => Math.max(8, Math.floor((width - 6) / (BODY + GAP)));

    const seed = () => {
      candles = [];
      let open = feed.price();
      sessionOpen = open;
      for (let i = 0; i < capacity(); i++) {
        const made = feed.candle(open);
        candles.push(made);
        open = made.close;
      }
      const high = Math.max(...candles.map((c) => c.high));
      const low = Math.min(...candles.map((c) => c.low));
      top = high;
      bottom = low;
    };

    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = element.clientWidth;
      height = element.clientHeight;
      element.width = Math.max(1, Math.round(width * ratio));
      element.height = Math.max(1, Math.round(height * ratio));
      if (!candles.length) seed();
      while (candles.length > capacity()) candles.shift();
      dirty = true;
    };

    const readout = () => {
      const last = candles[candles.length - 1].close;
      const change = ((last - sessionOpen) / sessionOpen) * 100;
      if (priceText.current) priceText.current.textContent = last.toFixed(2);
      if (changeText.current) {
        changeText.current.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
        changeText.current.dataset.up = String(change >= 0);
      }
    };

    const clock = () => {
      if (clockText.current) clockText.current.textContent = new Date().toLocaleTimeString("en-GB");
    };

    const step = () => {
      const price = feed.tick();
      if (ticks === TICKS_PER_CANDLE) {
        ticks = 0;
        candles.push({ open: candles[candles.length - 1].close, high: price, low: price, close: price });
        while (candles.length > capacity()) candles.shift();
      }
      extend(candles[candles.length - 1], price);
      ticks++;
      readout();
      dirty = true;
      // Trades do not arrive on a metronome.
      timer = window.setTimeout(step, 260 + Math.random() * 380);
    };

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const high = Math.max(...candles.map((c) => c.high));
      const low = Math.min(...candles.map((c) => c.low));
      const settle = (current: number, target: number) => (Math.abs(target - current) < 0.002 ? target : current + (target - current) * 0.12);
      const nextTop = settle(top, high);
      const nextBottom = settle(bottom, low);
      if (!dirty && nextTop === top && nextBottom === bottom) return;
      top = nextTop;
      bottom = nextBottom;
      dirty = false;

      // Everything is placed on whole device pixels, so the chart is as hard-edged as the type around it.
      const px = (value: number) => Math.round(value * ratio);
      const pad = 5;
      const span = Math.max(0.01, top - bottom);
      const y = (price: number) => px(pad + ((top - price) / span) * (height - pad * 2));

      context.clearRect(0, 0, element.width, element.height);

      context.fillStyle = GRID;
      for (let line = 0; line <= 3; line++) context.fillRect(0, px(pad + ((height - pad * 2) * line) / 3), element.width, 1);

      const pitch = px(BODY + GAP);
      const body = px(BODY);
      const wick = Math.max(1, Math.round(ratio));
      const start = element.width - px(6) - candles.length * pitch;
      candles.forEach((candle, index) => {
        const x = start + index * pitch;
        const rising = candle.close >= candle.open;
        context.fillStyle = rising ? UP : DOWN;
        context.fillRect(x + Math.floor((body - wick) / 2), y(candle.high), wick, Math.max(1, y(candle.low) - y(candle.high)));
        const from = y(Math.max(candle.open, candle.close));
        context.fillRect(x, from, body, Math.max(wick, y(Math.min(candle.open, candle.close)) - from));
      });

      // The last traded price: a dotted gold line across the chart, with a marker at the edge.
      const last = y(candles[candles.length - 1].close);
      context.fillStyle = LAST;
      context.globalAlpha = 0.5;
      for (let x = 0; x < element.width - px(5); x += px(4)) context.fillRect(x, last, px(2), wick);
      context.globalAlpha = 1;
      context.fillRect(element.width - px(4), last - wick, px(4), wick * 3);
    };

    resize();
    readout();
    clock();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const seconds = window.setInterval(clock, 1000);
    frame = requestAnimationFrame(draw);
    if (animate) timer = window.setTimeout(step, 600);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.clearInterval(seconds);
      observer.disconnect();
    };
  }, [animate]);

  return (
    <div className="auth-market" aria-hidden="true">
      <div className="auth-market-top">
        <span className="auth-market-symbol">{SYMBOL}</span>
        <span className="auth-market-price" ref={priceText} />
        <span className="auth-market-change" ref={changeText} />
      </div>
      <canvas className="auth-market-chart" ref={canvas} />
      <div className="auth-market-foot">
        <span className="auth-market-live">Simulated feed</span>
        <span ref={clockText} />
      </div>
    </div>
  );
}
