import { describe, expect, it } from 'vitest';
import { serializeLines } from './composition';
import {
  MIN_NOTE_MS,
  accuracy,
  summarise,
  toTokens,
  type NoteEvent,
  type Sample,
} from './recording';

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

describe('toTokens', () => {
  const at = (midi: number, startMs: number, durationMs: number): NoteEvent => ({
    midi,
    startMs,
    durationMs,
    meanCents: 0,
    inTune: true,
  });

  /** 120 bpm, so a beat is 500ms. */
  const BPM = 120;

  it('writes one note per beat when each note lasts a beat', () => {
    const tokens = toTokens([at(60, 0, 500), at(62, 500, 500)], 0, BPM);

    expect(serializeLines([tokens])).toBe('S R');
  });

  it('turns a long note into a note and holds', () => {
    // A note lasting three beats.
    expect(serializeLines([toTokens([at(60, 0, 1500)], 0, BPM)])).toBe('S - -');
  });

  it('rounds to the nearest beat', () => {
    // 1.4 beats rounds to one, 1.6 rounds to two.
    expect(serializeLines([toTokens([at(60, 0, 700)], 0, BPM)])).toBe('S');
    expect(serializeLines([toTokens([at(60, 0, 800)], 0, BPM)])).toBe('S -');
  });

  it('never drops a note that was too short to round up', () => {
    // A tenth of a beat would round to zero, which would lose the note.
    expect(serializeLines([toTokens([at(60, 0, 50)], 0, BPM)])).toBe('S');
  });

  it('follows the tonic, so the notation transposes', () => {
    // With Sa on D, A4 is Pa.
    expect(serializeLines([toTokens([at(69, 0, 500)], 2, BPM)])).toBe('P');
  });

  it('reads the tempo, so the same playing at half speed is written the same', () => {
    const slow = toTokens([at(60, 0, 1000), at(62, 1000, 1000)], 0, 60);
    const fast = toTokens([at(60, 0, 500), at(62, 500, 500)], 0, 120);

    expect(serializeLines([slow])).toBe(serializeLines([fast]));
  });

  it('adds bar lines when asked', () => {
    const events = [0, 1, 2, 3, 4, 5].map((index) => at(60 + index, index * 500, 500));

    expect(serializeLines([toTokens(events, 0, BPM, 4)])).toBe('S r R g | G m');
  });

  it('counts holds toward the bar, not just notes', () => {
    // A note of three beats, then two more: the bar falls after the fourth.
    const tokens = toTokens([at(60, 0, 1500), at(62, 1500, 500), at(64, 2000, 500)], 0, BPM, 4);

    expect(serializeLines([tokens])).toBe('S - - R | G');
  });

  it('writes nothing for an empty recording', () => {
    expect(toTokens([], 0, BPM)).toEqual([]);
  });
});
