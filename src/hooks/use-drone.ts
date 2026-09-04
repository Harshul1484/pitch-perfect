import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioContext } from '../lib/audio';

/**
 * A sustained drone on the tonic, after a tanpura.
 *
 * The partials are the tonic, the fifth above it, and the octave. The fifth is
 * a just 3:2 rather than the equal-tempered 700 cents, because that is what a
 * tanpura actually sounds. The two differ by about 2 cents, which is well
 * below what anyone hears, so it does not fight the equal-tempered readout.
 */
const PARTIALS = [
  { ratio: 1, gain: 1 },
  { ratio: 1.5, gain: 0.42 },
  { ratio: 2, gain: 0.3 },
];

/** Overall drone level, before the output fader. Sits under the played note. */
const DRONE_GAIN = 0.16;
/** Fades, long enough that starting and stopping never clicks. */
const FADE_IN = 0.12;
const FADE_OUT = 0.18;

export interface DroneControls {
  isOn: boolean;
  toggle: () => void;
  stop: () => void;
}

export function useDrone(frequency: number, volume: number): DroneControls {
  const [isOn, setIsOn] = useState(false);

  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const gainRef = useRef<GainNode | null>(null);

  const stop = useCallback(() => {
    setIsOn(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOn((on) => !on);
  }, []);

  // Build and tear down the graph. Frequency and volume are handled by the
  // effect below, so retuning does not restart the drone.
  useEffect(() => {
    if (!isOn) return;

    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.connect(ctx.destination);

    const oscillators = PARTIALS.map((partial) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency * partial.ratio;
      gain.gain.setValueAtTime(partial.gain, ctx.currentTime);

      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();

      return oscillator;
    });

    oscillatorsRef.current = oscillators;
    gainRef.current = master;

    return () => {
      const endsAt = ctx.currentTime + FADE_OUT;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.0001, endsAt);

      for (const oscillator of oscillators) oscillator.stop(endsAt);

      oscillatorsRef.current = [];
      gainRef.current = null;
    };
    // frequency is deliberately absent: retuning is handled live below, and
    // rebuilding the graph on every change would click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOn]);

  // Retune and re-level without restarting.
  useEffect(() => {
    const ctx = getAudioContext();
    if (!ctx || !isOn) return;

    oscillatorsRef.current.forEach((oscillator, index) => {
      const ratio = PARTIALS[index]?.ratio ?? 1;
      oscillator.frequency.setTargetAtTime(frequency * ratio, ctx.currentTime, 0.02);
    });

    const master = gainRef.current;
    if (master) {
      const target = Math.max(DRONE_GAIN * volume, 0.0001);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(target, ctx.currentTime, FADE_IN);
    }
  }, [frequency, volume, isOn]);

  return { isOn, toggle, stop };
}
