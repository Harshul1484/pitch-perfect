import { useCallback, useEffect, useRef, useState } from 'react';
import { detectPitch, type PitchReading } from '../lib/pitch';

export type ListenStatus =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'blocked'
  | 'unsupported'
  | 'error';

/** 2048 samples at 44.1 kHz is ~46 ms — enough periods for the low strings. */
const FFT_SIZE = 2048;

/**
 * Keep showing the last note for a moment after the signal drops, so the
 * display does not blink out during bow changes.
 */
const HOLD_MS = 250;

export interface PitchDetection {
  status: ListenStatus;
  reading: PitchReading | null;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function usePitchDetection(): PitchDetection {
  const [status, setStatus] = useState<ListenStatus>('idle');
  const [reading, setReading] = useState<PitchReading | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastHeardRef = useRef(0);

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    void contextRef.current?.close();
    contextRef.current = null;

    setReading(null);
    setStatus('idle');
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setError(
        'This browser will not open a microphone here. getUserMedia needs HTTPS or localhost.',
      );
      return;
    }

    setStatus('starting');
    setError(null);

    navigator.mediaDevices
      .getUserMedia({
        // Every one of these processes the signal in ways that wreck pitch
        // accuracy: AGC pumps the level, noise suppression eats sustained
        // tones, echo cancellation phase-shifts them.
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      .then((stream) => {
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = FFT_SIZE;

        context.createMediaStreamSource(stream).connect(analyser);

        streamRef.current = stream;
        contextRef.current = context;

        const samples = new Float32Array(analyser.fftSize);

        const tick = () => {
          analyser.getFloatTimeDomainData(samples);
          const detected = detectPitch(samples, context.sampleRate);
          const now = performance.now();

          if (detected) {
            lastHeardRef.current = now;
            setReading(detected);
          } else if (now - lastHeardRef.current > HOLD_MS) {
            setReading(null);
          }

          frameRef.current = requestAnimationFrame(tick);
        };

        setStatus('listening');
        frameRef.current = requestAnimationFrame(tick);
      })
      .catch((cause: unknown) => {
        const name = cause instanceof Error ? cause.name : '';

        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setStatus('blocked');
          setError('Microphone permission was denied. Allow it and try again.');
          return;
        }

        setStatus('error');
        setError(
          name === 'NotFoundError'
            ? 'No microphone found.'
            : 'Could not open the microphone.',
        );
      });
  }, []);

  useEffect(() => stop, [stop]);

  return { status, reading, error, start, stop };
}
