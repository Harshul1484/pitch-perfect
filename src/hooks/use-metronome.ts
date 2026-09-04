import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioContext } from '../lib/audio';
import {
  BEATS_PER_BAR,
  SCHEDULE_AHEAD,
  SCHEDULER_INTERVAL_MS,
  advance,
  type ScheduledBeat,
  type SchedulerState,
} from '../lib/metronome';

/** Accent is a two-partial bell; the off-beats are a plain click. */
const ACCENT_PARTIALS = [1568, 3136];
const CLICK_PARTIALS = [880];
const ACCENT_DECAY = 0.13;
const CLICK_DECAY = 0.055;
const ACCENT_GAIN = 0.5;
const CLICK_GAIN = 0.3;
const SILENCE = 0.0001;

function soundBeat(
  ctx: AudioContext,
  { time, accent }: ScheduledBeat,
  volume: number,
): void {
  const partials = accent ? ACCENT_PARTIALS : CLICK_PARTIALS;
  const decay = accent ? ACCENT_DECAY : CLICK_DECAY;
  const peak = (accent ? ACCENT_GAIN : CLICK_GAIN) * volume;

  if (peak <= 0) return;

  partials.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, time);

    // Upper partial sits back, so the accent reads as a bell not a beep.
    const partialPeak = peak / (index + 1.6);
    gain.gain.setValueAtTime(SILENCE, time);
    gain.gain.exponentialRampToValueAtTime(partialPeak, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(SILENCE, time + decay);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(time);
    oscillator.stop(time + decay);
  });
}

export interface MetronomeControls {
  isRunning: boolean;
  /** Beat currently sounding, zero-based, or null when stopped. */
  beat: number | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

/**
 * Drives the pure scheduler with a real clock and real audio.
 *
 * The displayed beat is advanced from the AudioContext clock rather than from
 * the scheduling timer, so the light matches what you hear instead of the
 * moment a beat was queued.
 */
export function useMetronome(bpm: number, volume: number): MetronomeControls {
  const [isRunning, setIsRunning] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);

  const bpmRef = useRef(bpm);
  const volumeRef = useRef(volume);
  const stateRef = useRef<SchedulerState>({ nextBeatTime: 0, nextBeat: 0 });
  const pendingRef = useRef<ScheduledBeat[]>([]);
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  // Kept in refs so the scheduler reads the live value without being torn
  // down and restarted on every tempo or level change. Synced in an effect
  // rather than during render, which React forbids.
  useEffect(() => {
    bpmRef.current = bpm;
    volumeRef.current = volume;
  }, [bpm, volume]);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingRef.current = [];
    setBeat(null);
    setIsRunning(false);
  }, []);

  const start = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    if (timerRef.current !== null) return;

    // A beat lands almost immediately, so pressing start feels connected.
    stateRef.current = { nextBeatTime: ctx.currentTime + 0.06, nextBeat: 0 };
    pendingRef.current = [];
    setIsRunning(true);

    timerRef.current = window.setInterval(() => {
      const { beats, state } = advance(
        stateRef.current,
        ctx.currentTime + SCHEDULE_AHEAD,
        bpmRef.current,
        BEATS_PER_BAR,
      );
      stateRef.current = state;

      for (const scheduled of beats) {
        soundBeat(ctx, scheduled, volumeRef.current);
        pendingRef.current.push(scheduled);
      }
    }, SCHEDULER_INTERVAL_MS);

    const followAudioClock = () => {
      const now = ctx.currentTime;
      let current: number | null = null;

      while (pendingRef.current.length > 0 && pendingRef.current[0].time <= now) {
        current = pendingRef.current[0].beat;
        pendingRef.current.shift();
      }

      if (current !== null) setBeat(current);
      frameRef.current = requestAnimationFrame(followAudioClock);
    };

    frameRef.current = requestAnimationFrame(followAudioClock);
  }, []);

  const toggle = useCallback(() => {
    if (timerRef.current !== null) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  useEffect(() => stop, [stop]);

  return { isRunning, beat, start, stop, toggle };
}
