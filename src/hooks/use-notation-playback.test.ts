import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Line } from '../lib/composition';

/**
 * Stopping playback must actually stop the sound.
 *
 * A phrase is scheduled onto the AudioContext clock in one go, so once `play`
 * returns, nothing on the React side is in the loop any more. Clearing the
 * highlight and flipping the button therefore looks like stopping without
 * being stopping — the piece plays on to the end. That was the bug, and it is
 * only visible from the audio graph, so the graph is what this watches.
 */

interface FakeParam {
  value: number;
  ramps: { to: number; at: number }[];
}

function param(value = 1): FakeParam & Record<string, unknown> {
  const self: FakeParam & Record<string, unknown> = {
    value,
    ramps: [],
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn((to: number, at: number) => {
      self.ramps.push({ to, at });
    }),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
  return self;
}

/** Every oscillator the run created, and when it was told to stop. */
const started: { stoppedAt: number | null }[] = [];
/** Every gain node, so the bus everything plays through can be found. */
const gains: ReturnType<typeof param>[] = [];

class FakeAudioContext {
  currentTime = 10;
  state = 'running';
  destination = { name: 'destination' };

  resume = vi.fn();

  createOscillator() {
    const record: { stoppedAt: number | null } = { stoppedAt: null };
    started.push(record);
    return {
      type: '',
      frequency: param(),
      detune: param(0),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn((at: number) => {
        record.stoppedAt = at;
      }),
    };
  }

  createGain() {
    const gain = param();
    gains.push(gain);
    return { gain, connect: vi.fn(), disconnect: vi.fn() };
  }

  createBiquadFilter() {
    return { type: '', frequency: param(), Q: param(), connect: vi.fn() };
  }
}

/** Sa Re Ga Ma, four beats of it. */
const LINES: Line[] = [
  [
    { kind: 'note', degree: 0, saptak: 0 },
    { kind: 'note', degree: 2, saptak: 0 },
    { kind: 'note', degree: 4, saptak: 0 },
    { kind: 'note', degree: 5, saptak: 0 },
  ],
];

async function load() {
  // The module keeps one AudioContext for the life of the page, so it has to
  // be re-imported per test or the fake from the last one leaks in.
  vi.resetModules();
  return import('./use-notation-playback');
}

beforeEach(() => {
  started.length = 0;
  gains.length = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
  window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useNotationPlayback', () => {
  it('schedules the whole phrase up front', async () => {
    const { useNotationPlayback } = await load();
    const { result } = renderHook(() => useNotationPlayback(LINES, 0, 60, 0.7, 'violin'));

    act(() => result.current.play());

    // Four notes, and the violin runs an oscillator plus a vibrato LFO each.
    expect(started).toHaveLength(8);
    expect(result.current.isPlaying).toBe(true);
  });

  it('cuts every scheduled note short when stopped', async () => {
    const { useNotationPlayback } = await load();
    // A slow tempo, so the phrase is still running when it is stopped.
    const { result } = renderHook(() => useNotationPlayback(LINES, 0, 30, 0.7, 'violin'));

    act(() => result.current.play());
    act(() => result.current.stop());

    expect(result.current.isPlaying).toBe(false);

    // Nothing may be left playing into the future: every source is stopped at
    // about the moment stop was pressed, not at the end of its own note.
    const now = 10;
    for (const source of started) {
      expect(source.stoppedAt).not.toBeNull();
      expect(source.stoppedAt!).toBeLessThanOrEqual(now + 0.1);
    }
  });

  it('fades out rather than chopping the waveform', async () => {
    const { useNotationPlayback } = await load();
    const { result } = renderHook(() => useNotationPlayback(LINES, 0, 30, 0.7, 'violin'));

    act(() => result.current.play());
    act(() => result.current.stop());

    // The bus is the one gain every note was routed through; it is taken to
    // silence over a short ramp, which is what stops the speakers clicking.
    const faded = gains.filter((gain) =>
      gain.ramps.some((ramp) => ramp.to === 0 && ramp.at > 10 && ramp.at <= 10.1),
    );
    expect(faded).not.toHaveLength(0);
  });

  it('stops being playable to death: stopping twice is harmless', async () => {
    const { useNotationPlayback } = await load();
    const { result } = renderHook(() => useNotationPlayback(LINES, 0, 30, 0.7, 'violin'));

    act(() => result.current.play());
    act(() => result.current.stop());
    act(() => result.current.stop());

    expect(result.current.isPlaying).toBe(false);
  });
});
