import { describe, expect, it } from 'vitest';
import { MIN_NOTE_MS, accuracy, summarise, type Sample } from './recording';

/** A run of readings on one pitch, one every 16ms. */
function hold(midi: number, from: number, ms: number, cents = 0): Sample[] {
  const samples: Sample[] = [];
  for (let at = from; at < from + ms; at += 16) samples.push({ at, midi, cents });
  return samples;
}

describe('summarise', () => {
  it('collapses a run of readings into one note', () => {
    const { events } = summarise(hold(69, 0, 500), 10);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ midi: 69, startMs: 0 });
    expect(events[0].durationMs).toBeGreaterThan(450);
  });

  it('splits when the pitch changes', () => {
    const { events } = summarise([...hold(69, 0, 400), ...hold(71, 400, 400)], 10);

    expect(events.map((event) => event.midi)).toEqual([69, 71]);
  });

  it('splits the same pitch across a silence, rather than merging two bows', () => {
    // A 400ms gap between two runs on the same note.
    const { events } = summarise([...hold(69, 0, 300), ...hold(69, 700, 300)], 10);

    expect(events).toHaveLength(2);
    expect(events[1].startMs).toBe(700);
  });

  it('drops flickers too short to be notes', () => {
    const samples = [...hold(69, 0, 400), ...hold(70, 400, 32), ...hold(69, 440, 400)];
    const { events } = summarise(samples, 10);

    expect(events.map((event) => event.midi)).toEqual([69, 69]);
    expect(MIN_NOTE_MS).toBeGreaterThan(32);
  });

  it('averages intonation across the note', () => {
    const samples = [
      ...hold(69, 0, 200, 20),
      ...hold(69, 200, 200, 0).map((s) => ({ ...s, cents: 0 })),
    ];
    const { events } = summarise(samples, 10);

    expect(events).toHaveLength(1);
    expect(events[0].meanCents).toBeCloseTo(10, 0);
  });

  it('judges in tune from the average, not from any one reading', () => {
    const { events } = summarise(hold(69, 0, 400, 4), 10);
    expect(events[0].inTune).toBe(true);

    const off = summarise(hold(69, 0, 400, 25), 10);
    expect(off.events[0].inTune).toBe(false);
  });

  it('counts how many landed in tune', () => {
    const samples = [
      ...hold(69, 0, 300, 2),
      ...hold(71, 300, 300, 30),
      ...hold(72, 600, 300, -1),
    ];
    const summary = summarise(samples, 10);

    expect(summary.events).toHaveLength(3);
    expect(summary.inTuneCount).toBe(2);
  });

  it('names the note furthest out', () => {
    const samples = [
      ...hold(69, 0, 300, 5),
      ...hold(71, 300, 300, -40),
      ...hold(72, 600, 300, 12),
    ];

    expect(summarise(samples, 10).worst?.midi).toBe(71);
  });

  it('handles a recording with nothing in it', () => {
    const summary = summarise([], 10);

    expect(summary).toMatchObject({ events: [], inTuneCount: 0, worst: null });
    expect(summary.durationMs).toBe(0);
  });

  it('takes the given duration over the last sample, so silence at the end counts', () => {
    const summary = summarise(hold(69, 0, 300), 10, 5000);

    expect(summary.durationMs).toBe(5000);
  });
});

describe('accuracy', () => {
  it('is null when nothing was played', () => {
    expect(accuracy(summarise([], 10))).toBeNull();
  });

  it('is the share of notes in tune', () => {
    const samples = [...hold(69, 0, 300, 2), ...hold(71, 300, 300, 40)];

    expect(accuracy(summarise(samples, 10))).toBeCloseTo(0.5, 5);
  });
});
