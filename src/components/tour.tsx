import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  placePanel,
  rectToLocal,
  contain,
  spotlight,
  type Basis,
  type Rect,
  type Side,
} from '../lib/tour';
import type { Tour as TourState } from '../hooks/use-tour';
import { Mark } from './mark';

/* Hover lives on the off state only — see the note in routes/notes.tsx. */
const KEY = 'keycap keycap-pressable active:keycap-pressed';
const KEY_OFF = `${KEY} hover:border-engrave hover:bg-white`;
const KEY_ON = `${KEY} border-graphite bg-graphite bg-none text-panel`;
const CAP = 'h-7 px-2.5 font-mono text-[10px] lowercase tracking-[0.08em]';

const PANEL = { width: 300, height: 176 };

/**
 * The walkthrough, drawn over the app.
 *
 * The overlay lives inside the same frame as the app rather than at the top
 * of the document, because on a phone that frame is rotated ninety degrees
 * and an overlay outside it would be the only thing on screen the right way
 * up. Living inside it means a rectangle measured in window coordinates has
 * to be brought back into the frame's own — which is what the probes below
 * are for: three zero-sized markers whose positions reveal the frame's axes,
 * whatever transform is on it.
 */
export function Tour({ tour, label }: { tour: TourState; label: string }) {
  const origin = useRef<HTMLSpanElement>(null);
  const alongX = useRef<HTMLSpanElement>(null);
  const alongY = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [hole, setHole] = useState<Rect | null>(null);
  const [at, setAt] = useState<{ x: number; y: number; side: Side } | null>(null);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);

  // Measure after paint, so the probes have been laid out.
  useLayoutEffect(() => {
    if (tour.status !== 'running') return;

    const measure = () => {
      const o = origin.current?.getBoundingClientRect();
      const x = alongX.current?.getBoundingClientRect();
      const y = alongY.current?.getBoundingClientRect();
      if (!o || !x || !y) return;

      // The probes sit at (0,0), (100,0) and (0,100) of the frame's own
      // coordinates, so where they land gives its axes.
      const basis: Basis = {
        origin: { x: o.x, y: o.y },
        unitX: { x: (x.x - o.x) / 100, y: (x.y - o.y) / 100 },
        unitY: { x: (y.x - o.x) / 100, y: (y.y - o.y) / 100 },
      };

      const local = (box: DOMRect) =>
        rectToLocal(basis, { x: box.x, y: box.y, width: box.width, height: box.height });

      const parent = origin.current?.parentElement?.getBoundingClientRect();
      const size = parent
        ? local(parent)
        : { width: window.innerWidth, height: window.innerHeight };
      setFrame({ width: size.width, height: size.height });

      if (!tour.target) {
        setHole(null);
        setAt(null);
        return;
      }

      const lit = contain(spotlight(local(tour.target.getBoundingClientRect())), size);
      setHole(lit);

      /*
       * The panel is measured rather than assumed. Its width is fixed but its
       * height is whatever the words need, and placing it by a guessed height
       * put it on top of the very thing it was pointing at as soon as the
       * text ran to another line.
       */
      const panel = panelRef.current?.getBoundingClientRect();
      const height = panel ? local(panel).height : PANEL.height;

      setAt(
        placePanel(
          lit,
          { width: PANEL.width, height: Math.max(height, 1) },
          { width: size.width, height: size.height },
        ),
      );
    };

    measure();

    /*
     * Measured again whenever the page moves under it. The panel used to be
     * placed once per step, so anything that shifted afterwards — the meter
     * appearing, the status line changing width — left it sitting over the
     * control it was pointing at.
     */
    const watch = new ResizeObserver(measure);
    if (tour.target) watch.observe(tour.target);
    if (origin.current?.parentElement) watch.observe(origin.current.parentElement);

    /*
     * The panel is watched too, because it is placed by its top left and
     * grows downward. A panel measured before the mono font has loaded is
     * shorter than the one that ends up on screen, and one placed above its
     * target then grows straight down over the thing it is pointing at.
     */
    if (panelRef.current) watch.observe(panelRef.current);

    /*
     * And again once the fonts have arrived. The body is set in the mono
     * face; measured against the fallback it wraps a line shorter, which
     * placed the panel a line too low and left it growing over the control
     * it was pointing at the moment the real face landed.
     */
    void document.fonts?.ready.then(measure);

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      watch.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [tour.status, tour.target, tour.step]);

  // Keyboard: the arrows walk it, Escape leaves.
  useEffect(() => {
    if (tour.status !== 'running') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') tour.finish();
      else if (event.key === 'ArrowRight' || event.key === 'Enter') tour.next();
      else if (event.key === 'ArrowLeft') tour.back();
      else return;
      event.preventDefault();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [tour]);

  // Focus goes into the panel so the walkthrough is where the keyboard is.
  useEffect(() => {
    if (tour.status === 'running') panelRef.current?.focus();
  }, [tour.status, tour.step]);

  if (tour.status === 'idle') return null;

  const probes = (
    <>
      <span ref={origin} aria-hidden="true" className="absolute left-0 top-0 h-0 w-0" />
      <span
        ref={alongX}
        aria-hidden="true"
        className="absolute left-[100px] top-0 h-0 w-0"
      />
      <span
        ref={alongY}
        aria-hidden="true"
        className="absolute left-0 top-[100px] h-0 w-0"
      />
    </>
  );

  if (tour.status === 'offered') {
    /*
     * Dark, on a page that is entirely light.
     *
     * The first version of this was a panel in the app's own colours, which
     * made it invisible: everything here is a pale tile with a hairline
     * around it, so one more pale tile reads as part of the furniture. There
     * are no drop shadows in this system to lift it with, so it is lifted by
     * inverting instead — and it carries the mark, so what is speaking is
     * obvious before the words are read.
     */
    return (
      <div
        data-tour-offer=""
        className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center p-5"
      >
        {/*
         * The bar itself takes no clicks — only its two buttons do.
         *
         * It floats over the bottom of the app, which on this page is a key
         * bed and on the notebook is whatever popover you have just opened.
         * A bar that swallowed the clicks that landed on it made the first
         * thing a new player pressed do nothing at all, which is a poor
         * introduction from something offering to help.
         */}
        <div className="tour-rise flex items-center gap-3 rounded-[4px] border border-graphite bg-graphite py-2 pl-3 pr-2 text-panel">
          <Mark size="sm" tone="paper" />
          <span className="font-mono text-[11px] tracking-[0.06em] text-panel">
            First time here?
          </span>
          <button
            type="button"
            onClick={tour.take}
            className={`${CAP} pointer-events-auto keycap keycap-pressable border-panel bg-panel bg-none font-medium text-graphite hover:bg-white active:keycap-pressed`}
          >
            {label}
          </button>
          <button
            type="button"
            onClick={tour.finish}
            className={`${CAP} pointer-events-auto rounded-[4px] border border-transparent text-panel/70 hover:text-panel`}
          >
            no thanks
          </button>
        </div>
      </div>
    );
  }

  const step = tour.step;
  if (!step || !frame) return <div className="absolute inset-0">{probes}</div>;

  /*
   * Everywhere the walkthrough is holding onto clicks: the whole frame,
   * or the four bands around the lit control when the step wants it pressed.
   */
  const open = step.interactive && hole ? hole : null;
  const catchers: Rect[] = open
    ? [
        { x: 0, y: 0, width: frame.width, height: Math.max(open.y, 0) },
        {
          x: 0,
          y: open.y + open.height,
          width: frame.width,
          height: Math.max(frame.height - (open.y + open.height), 0),
        },
        { x: 0, y: open.y, width: Math.max(open.x, 0), height: open.height },
        {
          x: open.x + open.width,
          y: open.y,
          width: Math.max(frame.width - (open.x + open.width), 0),
          height: open.height,
        },
      ]
    : [{ x: 0, y: 0, width: frame.width, height: frame.height }];

  const placed = at ?? {
    x: frame.width / 2 - PANEL.width / 2,
    y: frame.height / 2 - PANEL.height / 2,
    side: 'bottom' as Side,
  };

  return (
    /*
     * Nothing here catches a click unless it says so. The overlay used to
     * be one hit-testable sheet, which meant a step could ask you to press a
     * control and then quietly eat the press.
     */
    <div className="pointer-events-none absolute inset-0 z-40">
      {probes}

      {/*
       * Catches the clicks, so the app cannot be worked from under the
       * walkthrough while it is explaining itself — except for the one
       * control a step has asked you to press, which is left uncovered by
       * fencing it off with four panes instead of one sheet. They are
       * invisible; the dimming is the shadow below, which is why the pale
       * corners that four *visible* panes used to leave do not come back.
       */}
      {catchers.map((pane, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="pointer-events-auto absolute"
          style={{ left: pane.x, top: pane.y, width: pane.width, height: pane.height }}
        />
      ))}

      {hole ? (
        /*
         * One element the size of the hole, casting a shadow wide enough to
         * cover everything around it. Four panes around a rectangle were
         * tried first and left pale corners: the ring is rounded and the
         * panes were not, so the corner between the two stayed undimmed.
         */
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute rounded-[5px] border-2 border-signal shadow-[0_0_0_9999px_rgb(43_43_43/0.5)] ${
            step.interactive ? 'tour-beckon' : ''
          }`}
          style={{ left: hole.x, top: hole.y, width: hole.width, height: hole.height }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-graphite/50" />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        tabIndex={-1}
        className="keycap pointer-events-auto absolute flex flex-col gap-2.5 bg-tile p-4 outline-none"
        style={{ left: placed.x, top: placed.y, width: PANEL.width }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="mono-label">
            {tour.position} of {tour.total}
          </span>
          <button
            type="button"
            onClick={tour.finish}
            className={`${KEY_OFF} ${CAP} text-engrave`}
          >
            skip
          </button>
        </div>

        {/* The opening step names the app, so it is signed. The steps after
            it are about one control each and the mark would only be
            furniture repeated five times. */}
        <div className="flex items-center gap-2">
          {!step.target && <Mark size="md" />}
          <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.01em]">
            {step.title}
          </h2>
        </div>
        <p className="font-mono text-[11px] leading-[1.6] text-graphite/85">
          {step.body}
        </p>

        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={tour.back}
            disabled={tour.position === 1}
            className={`${KEY_OFF} ${CAP} disabled:cursor-default disabled:opacity-40`}
          >
            back
          </button>
          <button
            type="button"
            onClick={tour.next}
            className={`${KEY_ON} ${CAP} font-medium`}
          >
            {tour.position === tour.total ? 'done' : 'next'}
          </button>
        </div>
      </div>
    </div>
  );
}
