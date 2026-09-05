import { describe, expect, it } from 'vitest';
import { parseNotation } from './composition';
import { advance, targetsOf, verdicts } from './follow';
import type { Mark } from './practice';

const mark = (midi: number, inTune: boolean): Mark => ({
  midi,
  cents: inTune ? 2 : 30,
  inTune,
  at: 0,
});

describe('targetsOf', () => {
  it('lists the notes to play, and nothing else', () => {
    // A bar takes no time, and a hold lengthens the note before it rather than
    // being a note of its own. Neither is something to play.
    const targets = targetsOf(parseNotation('S | R - G'), 0);

    expect(targets.map((target) => target.midi)).toEqual([60, 62, 64]);
  });

  it('keeps each target pointing at its place on the page', () => {
    const targets = targetsOf(parseNotation('S | R'), 0);

    // Token 1 is the bar, so the second note is token 2.
    expect(targets.map((target) => target.tokenIndex)).toEqual([0, 2]);
  });

  it('reads notes relative to the tonic of the piece', () => {
    expect(targetsOf(parseNotation('S'), 2)[0].midi).toBe(62);
  });

  it('is empty for an empty piece', () => {
    expect(targetsOf(parseNotation(''), 0)).toEqual([]);
  });
});

describe('advance', () => {
  const targets = targetsOf(parseNotation('S R G'), 0);

  it('moves on when the right note is played in tune', () => {
    expect(advance(0, targets, mark(60, true))).toBe(1);
  });

  it('stays put when the right note is played out of tune', () => {
    expect(advance(0, targets, mark(60, false))).toBe(0);
  });

  it('stays put when a different note is played', () => {
    expect(advance(0, targets, mark(64, true))).toBe(0);
  });

  it('stops at the end rather than running off it', () => {
    expect(advance(2, targets, mark(64, true))).toBe(3);
    expect(advance(3, targets, mark(64, true))).toBe(3);
  });
});

describe('verdicts', () => {
  it('marks the notes already got right', () => {
    const targets = targetsOf(parseNotation('S R G'), 0);

    expect(verdicts(targets, 2)).toEqual({ 0: 'hit', 1: 'hit' });
  });

  it('has nothing to say before you start', () => {
    expect(verdicts(targetsOf(parseNotation('S R'), 0), 0)).toEqual({});
  });

  it('reports against the page, not against the run of notes', () => {
    // The bar is token 1, so the second note's verdict belongs to token 2.
    expect(verdicts(targetsOf(parseNotation('S | R'), 0), 2)).toEqual({
      0: 'hit',
      2: 'hit',
    });
  });
});
