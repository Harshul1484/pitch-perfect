import { describe, expect, it } from 'vitest';
import {
  NOTES_STEPS,
  GAP,
  TUNER_STEPS,
  contain,
  placePanel,
  rectToLocal,
  spotlight,
  toLocal,
  type Basis,
} from './tour';

/** The frame untransformed: its axes are the window's own. */
const plain: Basis = {
  origin: { x: 0, y: 0 },
  unitX: { x: 1, y: 0 },
  unitY: { x: 0, y: 1 },
};

/**
 * The frame as a phone rotates it: ninety degrees, so the frame's x runs down
 * the window and its y runs left across it. These are the numbers the app's
 * own `rotate(90deg) translateY(-100%)` produces.
 */
const rotated: Basis = {
  origin: { x: 400, y: 0 },
  unitX: { x: 0, y: 1 },
  unitY: { x: -1, y: 0 },
};

describe('toLocal', () => {
  it('changes nothing when the frame is not transformed', () => {
    expect(toLocal(plain, { x: 30, y: 70 })).toEqual({ x: 30, y: 70 });
  });

  it('accounts for an offset frame', () => {
    const shifted: Basis = { ...plain, origin: { x: 10, y: 20 } };
    expect(toLocal(shifted, { x: 30, y: 70 })).toEqual({ x: 20, y: 50 });
  });

  it('undoes a rotation rather than applying it twice', () => {
    // The frame's origin is the window's top right; its x runs downward.
    expect(toLocal(rotated, { x: 400, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(toLocal(rotated, { x: 400, y: 100 })).toEqual({ x: 100, y: 0 });
    expect(toLocal(rotated, { x: 300, y: 0 })).toEqual({ x: 0, y: 100 });
  });

  it('falls back to a plain offset when the axes are degenerate', () => {
    // A frame scaled to nothing has no usable axes; better an approximate
    // answer than a division by zero.
    const flat: Basis = {
      origin: { x: 5, y: 5 },
      unitX: { x: 0, y: 0 },
      unitY: { x: 0, y: 0 },
    };
    expect(toLocal(flat, { x: 15, y: 25 })).toEqual({ x: 10, y: 20 });
  });
});

describe('rectToLocal', () => {
  it('leaves a rectangle alone in an untransformed frame', () => {
    expect(rectToLocal(plain, { x: 10, y: 20, width: 30, height: 40 })).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
  });

  it('swaps the sides of a rectangle in a rotated frame', () => {
    const local = rectToLocal(rotated, { x: 300, y: 0, width: 100, height: 50 });

    // What was 100 wide across the window is 100 tall in the frame.
    expect(local.width).toBe(50);
    expect(local.height).toBe(100);
  });
});

describe('spotlight', () => {
  it('opens the hole a little wider than the thing inside it', () => {
    expect(spotlight({ x: 100, y: 50, width: 40, height: 20 }, 8)).toEqual({
      x: 92,
      y: 42,
      width: 56,
      height: 36,
    });
  });
});

describe('contain', () => {
  const frame = { width: 1000, height: 600 };

  it('holds the ring as far off the window as it stands off a target', () => {
    // What the eye reads is the gap. One that is 8px at the top left and
    // 3px at the bottom right looks like a mistake, because it is one.
    const held = contain(spotlight({ x: 100, y: 100, width: 2000, height: 2000 }), frame);

    // The sides with room keep their gap from the target; the sides
    // without are held the same distance off the window instead.
    expect(held.x).toBe(100 - GAP);
    expect(held.y).toBe(100 - GAP);
    expect(frame.width - (held.x + held.width)).toBe(GAP);
    expect(frame.height - (held.y + held.height)).toBe(GAP);
  });

  it('leaves a rectangle with room to spare alone', () => {
    expect(contain({ x: 100, y: 100, width: 200, height: 100 }, frame)).toEqual({
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
  });

  it('pulls a hole off the edges so its border can be seen', () => {
    // The key bed runs off the window on both sides; its ring has to come
    // back to where there are pixels to draw it on.
    const held = contain({ x: -20, y: -20, width: 1100, height: 700 }, frame);

    expect(held.x).toBe(GAP);
    expect(held.y).toBe(GAP);
    expect(held.x + held.width).toBe(frame.width - GAP);
    expect(held.y + held.height).toBe(frame.height - GAP);
  });

  it('never turns a rectangle inside out', () => {
    // Something scrolled entirely off the window has no visible part, and a
    // negative width would paint a ring across the whole page.
    const gone = contain({ x: 1400, y: 900, width: 50, height: 50 }, frame);

    expect(gone.width).toBe(0);
    expect(gone.height).toBe(0);
    expect(gone.x).toBeGreaterThanOrEqual(0);
    expect(gone.y).toBeGreaterThanOrEqual(0);
  });
});

describe('placePanel', () => {
  const panel = { width: 280, height: 150 };
  const viewport = { width: 1200, height: 800 };

  it('goes below the target when there is room', () => {
    const at = placePanel({ x: 500, y: 100, width: 100, height: 40 }, panel, viewport);

    expect(at.side).toBe('bottom');
    expect(at.y).toBeGreaterThan(140);
    // Centred on the target.
    expect(at.x + panel.width / 2).toBeCloseTo(550, 0);
  });

  it('goes above when the target is near the bottom', () => {
    const at = placePanel({ x: 500, y: 700, width: 100, height: 40 }, panel, viewport);

    expect(at.side).toBe('top');
    expect(at.y + panel.height).toBeLessThan(700);
  });

  it('goes beside when there is room above nor below', () => {
    // A target as tall as the window leaves only the sides.
    const at = placePanel({ x: 40, y: 0, width: 100, height: 800 }, panel, viewport);

    expect(at.side).toBe('right');
    expect(at.x).toBeGreaterThan(140);
  });

  it('never lets the panel leave the window', () => {
    const corners = [
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 1180, y: 780, width: 20, height: 20 },
      { x: 1180, y: 0, width: 20, height: 20 },
      { x: 0, y: 780, width: 20, height: 20 },
    ];

    for (const target of corners) {
      const at = placePanel(target, panel, viewport);
      expect(at.x, JSON.stringify(target)).toBeGreaterThanOrEqual(0);
      expect(at.y, JSON.stringify(target)).toBeGreaterThanOrEqual(0);
      expect(at.x + panel.width, JSON.stringify(target)).toBeLessThanOrEqual(
        viewport.width,
      );
      expect(at.y + panel.height, JSON.stringify(target)).toBeLessThanOrEqual(
        viewport.height,
      );
    }
  });

  it('still returns something usable when the panel cannot fit at all', () => {
    const tiny = { width: 200, height: 120 };
    const at = placePanel({ x: 40, y: 40, width: 100, height: 40 }, panel, tiny);

    expect(Number.isFinite(at.x)).toBe(true);
    expect(Number.isFinite(at.y)).toBe(true);
    expect(at.x).toBeGreaterThanOrEqual(0);
    expect(at.y).toBeGreaterThanOrEqual(0);
  });
});

describe('the steps themselves', () => {
  const all = [...TUNER_STEPS, ...NOTES_STEPS];

  it('keeps each tour short enough to sit through', () => {
    // Six is the ceiling for either. Every step is one more thing between a
    // player and the instrument in their hands.
    expect(TUNER_STEPS.length).toBeLessThanOrEqual(6);
    expect(NOTES_STEPS.length).toBeLessThanOrEqual(6);
  });

  it('gives every step an id of its own, and something to say', () => {
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    for (const step of all) {
      expect(step.title.length, step.id).toBeGreaterThan(0);
      expect(step.body.length, step.id).toBeGreaterThan(20);
    }
  });

  it('opens the tuner tour without pointing at anything', () => {
    expect(TUNER_STEPS[0].target).toBeUndefined();
  });

  it('lets you press what a step tells you to press', () => {
    // Every way a step has of telling you to do something to the thing it
    // is pointing at. A step that says one of these and then holds onto the
    // click is worse than no step at all, and the only thing standing
    // between the two is this flag.
    const tells = /\b(press|click|tap|switch this on)\b/i;

    for (const step of all) {
      if (!tells.test(step.body)) continue;
      expect(step.target, step.id).toBeDefined();
      expect(step.interactive, step.id).toBe(true);
    }
  });

  it('never opens a hole around nothing', () => {
    // Interactive means "leave this control uncovered", which needs a
    // control to leave uncovered.
    for (const step of all.filter((s) => s.interactive)) {
      expect(step.target, step.id).toBeDefined();
    }
  });
});
