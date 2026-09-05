import { describe, expect, it } from 'vitest';
import { parseNotation } from './composition';
import { buildSchedule } from './playback';
import { grade } from './run';
import type { Sample } from './recording';

/**
 * A run is a recording judged against a schedule. These tests feed readings
 * placed on the beat and ask what the piece made of them.
 */

/** Readings of one pitch filling a beat. At 60bpm a beat is 1000ms. */
function beat(index: number, midi: number, cents = 0, perBeat = 1000): Sample[] {
  return Array.from({ length: 20 }, (_, step) => ({
    at: index * perBeat + (step * perBeat) / 20,
    midi,
    cents,
  }));
}

const PIECE = buildSchedule(parseNotation('S R G'), 0);

describe('grade', () => {
  it('counts the notes played in tune, in time', () => {
    const samples = [...beat(0, 60), ...beat(1, 62), ...beat(2, 64)];
    const result = grade(PIECE, samples, 60, 10);

    expect(result.notes.map((note) => note.verdict)).toEqual(['hit', 'hit', 'hit']);
    expect(result.hits).toBe(3);
    expect(result.total).toBe(3);
  });

  it('calls a note missed when nothing was played on its beat', () => {
    const result = grade(PIECE, [...beat(0, 60), ...beat(2, 64)], 60, 10);

    expect(result.notes.map((note) => note.verdict)).toEqual(['hit', 'missed', 'hit']);
    expect(result.hits).toBe(2);
  });

  it('calls the wrong note wrong, however well it was played', () => {
    const result = grade(PIECE, [...beat(0, 60), ...beat(1, 65), ...beat(2, 64)], 60, 10);

    expect(result.notes[1]).toMatchObject({ verdict: 'wrong', played: 65, expected: 62 });
  });

  it('calls the right note played badly out, and says by how much', () => {
    const result = grade(
      PIECE,
      [...beat(0, 60), ...beat(1, 62, 30), ...beat(2, 64)],
      60,
      10,
    );

    expect(result.notes[1]).toMatchObject({ verdict: 'out', cents: 30 });
  });

  it('takes the note that was played, not a moment of wobble crossing to it', () => {
    // Two readings of the note below, then the real note for the rest.
    const wobble: Sample[] = [
      { at: 1000, midi: 61, cents: 0 },
      { at: 1050, midi: 61, cents: 0 },
      ...beat(1, 62).slice(3),
    ];
    const result = grade(PIECE, [...beat(0, 60), ...wobble, ...beat(2, 64)], 60, 10);

    expect(result.notes[1].verdict).toBe('hit');
  });

  it('follows the tempo it was played at', () => {
    // At 120bpm a beat is 500ms, so the same phrase happens twice as fast.
    const fast = [...beat(0, 60, 0, 500), ...beat(1, 62, 0, 500), ...beat(2, 64, 0, 500)];

    expect(grade(PIECE, fast, 120, 10).hits).toBe(3);
  });

  it('keeps each verdict pointing at its place on the page', () => {
    const withBar = buildSchedule(parseNotation('S | R'), 0);
    const result = grade(withBar, [...beat(0, 60), ...beat(1, 62)], 60, 10);

    expect(result.notes.map((note) => note.tokenIndex)).toEqual([0, 2]);
  });

  it('scores nothing for a run where nothing was played, rather than failing', () => {
    const result = grade(PIECE, [], 60, 10);

    expect(result.hits).toBe(0);
    expect(result.total).toBe(3);
    expect(result.notes.every((note) => note.verdict === 'missed')).toBe(true);
  });

  it('has nothing to score for an empty piece', () => {
    const empty = buildSchedule(parseNotation(''), 0);

    expect(grade(empty, [], 60, 10)).toMatchObject({ hits: 0, total: 0, notes: [] });
  });
});
