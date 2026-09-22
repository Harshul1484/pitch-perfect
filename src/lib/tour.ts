/**
 * The walkthrough: which things get pointed at, and where the panel goes.
 *
 * Everything here is arithmetic on rectangles, so the awkward parts — a panel
 * that would hang off the screen, a phone frame the whole app is rotated
 * inside — are decided in functions that can be tested without a browser.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

/** What each walkthrough is remembered as, once taken or declined. */
export const TUNER_TOUR = 'tuner';
export const NOTES_TOUR = 'notes';

export type Side = 'top' | 'bottom' | 'left' | 'right';

export interface Step {
  id: string;
  /**
   * The `data-tour` value of the thing to point at. Left out, the step is
   * centred and points at nothing, which is how a tour opens and closes.
   */
  target?: string;
  title: string;
  body: string;
  /**
   * Whether the thing being pointed at can be pressed while the step is up.
   *
   * Off by default: the walkthrough dims the page and holds onto the clicks
   * so the app cannot be worked from underneath it. A step that asks you to
   * do something has to hand that one control back, or it is telling you to
   * press a button it is also blocking.
   */
  interactive?: boolean;
}

/**
 * The tuner, in six steps.
 *
 * Six is a ceiling rather than a target. Every step is one more thing between
 * a player and the instrument in their hands, so the readout and the meter
 * are taught as one idea, and everything that can be discovered by pressing
 * it is left to be discovered.
 */
export const TUNER_STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Perfect Pitch',
    body: 'A tuner that tells you how close you are, and a notebook for the pieces you are learning. This takes about a minute.',
  },
  {
    id: 'listen',
    target: 'listen',
    interactive: true,
    title: 'Start here',
    body: 'Press listen and allow the microphone. Then play a note — the app works out which one it is and how far off you are.',
  },
  {
    id: 'readout',
    target: 'readout',
    title: 'The note, and the truth about it',
    body: 'The name, the frequency, and how many cents sharp or flat. The meter below runs flat to the left and sharp to the right; inside the green band you are in tune.',
  },
  {
    id: 'bed',
    target: 'bed',
    interactive: true,
    title: 'Every octave, and a reference tone',
    body: 'Your note lights up here. Click any key to hear the pitch you are aiming at. All 88 are shown, because scordatura tunings move where your strings sit.',
  },
  {
    id: 'practice',
    target: 'practice',
    interactive: true,
    title: 'Practice remembers',
    body: 'Switch this on and the keys keep what you played — green where you were in tune, red where you were not. A passage leaves a map of its own intonation.',
  },
  {
    id: 'notes-tab',
    target: 'notes-tab',
    title: 'The other half',
    body: 'Write the pieces you are learning, hear them played back, and practise against them a note at a time.',
  },
];

/**
 * The notebook, in five.
 *
 * It opens by asking for a piece rather than explaining one, because an
 * empty notebook has nothing to point at and reading about an editor you
 * cannot see teaches nobody anything. Making a piece is the first step, and
 * the rest talk about the thing that is then in front of you.
 */
export const NOTES_STEPS: Step[] = [
  {
    id: 'create',
    target: 'new',
    interactive: true,
    title: 'Start a piece',
    body: 'Press new. Everything you write is saved to your account and follows you between devices — the tuner works without one, this does not.',
  },
  {
    id: 'pieces',
    target: 'pieces',
    title: 'Everything you are learning',
    body: 'Your pieces live here, newest first. Open one to work on it; the notebook keeps as many as you like.',
  },
  {
    id: 'writing',
    target: 'keyboard',
    interactive: true,
    title: 'Write it as you say it',
    body: 'Tap the swaras, or type their letters: S R G m P. Bars, holds and notes tied into one beat are on the row underneath.',
  },
  {
    id: 'play',
    target: 'play',
    title: 'Hear it back',
    body: 'Played on a violin or a piano at whatever tempo you set, with the note it is on highlighted as it goes.',
  },
  {
    id: 'piece-practice',
    target: 'piece-practice',
    title: 'Then play it yourself',
    body: 'Learn walks the piece a note at a time and waits for you to get each one right. Run counts you in and scores the whole thing against the clock.',
  },
];

/**
 * Where a point in the window falls inside a frame that may be transformed.
 *
 * On a phone the whole app is rotated ninety degrees, so a rectangle measured
 * in window coordinates cannot be used to place something inside that frame —
 * the rotation would be applied to it a second time. Measuring three points
 * of the frame's own coordinate system gives the axes it is using, and any
 * window point can then be expressed in them.
 *
 * Works for any transform, rather than for the one rotation this app happens
 * to apply, because solving two equations is no harder than special-casing.
 */
export interface Basis {
  /** Where the frame's own origin sits in the window. */
  origin: Point;
  /** Where the frame's own (1, 0) and (0, 1) sit, relative to that origin. */
  unitX: Point;
  unitY: Point;
}

export function toLocal(basis: Basis, point: Point): Point {
  const dx = point.x - basis.origin.x;
  const dy = point.y - basis.origin.y;

  // [unitX unitY] [local] = [d]; two equations, solved directly.
  const determinant = basis.unitX.x * basis.unitY.y - basis.unitY.x * basis.unitX.y;
  if (Math.abs(determinant) < 1e-9) return { x: dx, y: dy };

  return {
    x: (dx * basis.unitY.y - dy * basis.unitY.x) / determinant,
    y: (dy * basis.unitX.x - dx * basis.unitX.y) / determinant,
  };
}

/** A rectangle expressed in the frame's own coordinates. */
export function rectToLocal(basis: Basis, rect: Rect): Rect {
  const corners = [
    toLocal(basis, { x: rect.x, y: rect.y }),
    toLocal(basis, { x: rect.x + rect.width, y: rect.y }),
    toLocal(basis, { x: rect.x, y: rect.y + rect.height }),
    toLocal(basis, { x: rect.x + rect.width, y: rect.y + rect.height }),
  ];

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * How far the ring stands off whatever it is lighting.
 *
 * One number, used twice: the hole is opened this much wider than its
 * target, and held this far inside the window. Two numbers meant the gap
 * was even on the sides with room and tighter on the sides without, which
 * on the key bed — wider and taller than the window it scrolls inside —
 * showed as a ring that was loose at the top left and pinched at the
 * bottom right.
 */
export const GAP = 8;

/** The hole, a little larger than the thing it is around. */
export function spotlight(target: Rect, padding = GAP): Rect {
  return {
    x: target.x - padding,
    y: target.y - padding,
    width: target.width + padding * 2,
    height: target.height + padding * 2,
  };
}

/**
 * The hole pulled back inside the window, ring and all.
 *
 * Two things push it out. The padding above widens it past anything sitting
 * flush against an edge, and the key bed is wider and taller than the window
 * it scrolls inside, so its rectangle genuinely runs off both. Either way
 * the border is drawn where it cannot be seen, and a spotlight missing two
 * of its four sides reads as a rendering fault rather than a highlight.
 *
 * The margin matches the padding, so a ring that has been pulled in sits
 * the same distance from the window as it would have sat from its target.
 */
export function contain(rect: Rect, frame: Size, margin = GAP): Rect {
  const left = Math.max(rect.x, margin);
  const top = Math.max(rect.y, margin);
  const right = Math.min(rect.x + rect.width, frame.width - margin);
  const bottom = Math.min(rect.y + rect.height, frame.height - margin);

  return {
    x: Math.min(left, right),
    y: Math.min(top, bottom),
    width: Math.max(right - left, 0),
    height: Math.max(bottom - top, 0),
  };
}

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

/**
 * Where to put the panel so it is beside its target and fully on screen.
 *
 * Below, then above, then right, then left: the first side it fits on wins.
 * If it fits on none — a small window, a large target — it takes the side
 * with the most room and is pushed back inside the edges, which is better
 * than a panel half off the screen.
 */
export function placePanel(
  target: Rect,
  panel: Size,
  viewport: Size,
  gap = 14,
): { x: number; y: number; side: Side } {
  const room: Record<Side, number> = {
    bottom: viewport.height - (target.y + target.height) - gap,
    top: target.y - gap,
    right: viewport.width - (target.x + target.width) - gap,
    left: target.x - gap,
  };

  const order: Side[] = ['bottom', 'top', 'right', 'left'];
  const needed = (side: Side) =>
    side === 'top' || side === 'bottom' ? panel.height : panel.width;

  const side =
    order.find((candidate) => room[candidate] >= needed(candidate)) ??
    order.reduce((best, candidate) => (room[candidate] > room[best] ? candidate : best));

  const centreX = target.x + target.width / 2 - panel.width / 2;
  const centreY = target.y + target.height / 2 - panel.height / 2;

  const position =
    side === 'bottom'
      ? { x: centreX, y: target.y + target.height + gap }
      : side === 'top'
        ? { x: centreX, y: target.y - gap - panel.height }
        : side === 'right'
          ? { x: target.x + target.width + gap, y: centreY }
          : { x: target.x - gap - panel.width, y: centreY };

  return {
    side,
    x: clamp(position.x, gap, Math.max(gap, viewport.width - panel.width - gap)),
    y: clamp(position.y, gap, Math.max(gap, viewport.height - panel.height - gap)),
  };
}
