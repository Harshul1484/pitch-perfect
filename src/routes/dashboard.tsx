import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_NOTES, IN_TUNE_CENTS, nearestNote, type Note } from '../lib/notes';
import { playFrequency } from '../lib/audio';
import { useMetronome } from '../hooks/use-metronome';
import { usePitchDetection } from '../hooks/use-pitch-detection';
import { ControlRail } from '../components/control-rail';
import { Keybed } from '../components/keybed';
import { MetronomePanel } from '../components/metronome-panel';
import { NowPlaying } from '../components/now-playing';

/** How long a key stays depressed after being clicked. */
const FLASH_MS = 260;

export function Dashboard() {
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  const [volume, setVolume] = useState(70);
  const [tolerance, setTolerance] = useState(IN_TUNE_CENTS);
  /** Reference tone length, in tenths of a second. */
  const [sustain, setSustain] = useState(14);
  const flashTimer = useRef<number | null>(null);

  const [bpm, setBpm] = useState(90);

  const { status, reading, error, start, stop } = usePitchDetection();
  const metronome = useMetronome(bpm, volume / 100);

  const match = useMemo(
    () => (reading ? nearestNote(reading.frequency) : null),
    [reading],
  );

  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) {
        window.clearTimeout(flashTimer.current);
      }
    };
  }, []);

  const handlePlay = useCallback(
    (note: Note) => {
      playFrequency(note.frequency, {
        volume: volume / 100,
        durationSeconds: sustain / 10,
      });
      setActiveMidi(note.midi);

      if (flashTimer.current !== null) {
        window.clearTimeout(flashTimer.current);
      }
      flashTimer.current = window.setTimeout(() => setActiveMidi(null), FLASH_MS);
    },
    [volume, sustain],
  );

  return (
    /* One screen, no scrolling: the key bed takes whatever height is left. */
    <div className="flex h-screen flex-col gap-2.5 overflow-hidden p-4">
      <header className="flex shrink-0 items-end justify-between px-0.5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[20px] font-semibold leading-none tracking-[-0.03em]">
            pitch
          </h1>
          <p className="mono-label">
            tuning instrument · {ALL_NOTES.length} keys · a4 = 440 hz
          </p>
        </div>
        <p className="mono-label hidden sm:block">equal temperament · mpm detection</p>
      </header>

      <div className="flex shrink-0 gap-2.5">
        <NowPlaying
          status={status}
          match={match}
          frequency={reading?.frequency ?? null}
          error={error}
          tolerance={tolerance}
          onStart={start}
          onStop={stop}
        />

        <MetronomePanel
          bpm={bpm}
          onBpmChange={setBpm}
          isRunning={metronome.isRunning}
          beat={metronome.beat}
          onToggle={metronome.toggle}
          micOpen={status === 'listening'}
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-2.5">
        <ControlRail
          volume={volume}
          onVolumeChange={setVolume}
          tolerance={tolerance}
          onToleranceChange={setTolerance}
          sustain={sustain}
          onSustainChange={setSustain}
        />

        {/* Key bed plate. */}
        <div className="keycap relative flex min-h-0 flex-1 flex-col bg-tile p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between border-b border-hairline-soft pb-2">
            <span className="mono-label">key bed · a0 – c8</span>
            <span className="mono-label">
              {status === 'listening' ? 'listening' : 'click a key to hear it'}
            </span>
          </div>

          <Keybed
            onPlay={handlePlay}
            activeMidi={activeMidi}
            detectedMidi={match?.note.midi ?? null}
            detectedCents={match?.cents ?? null}
            tolerance={tolerance}
          />
        </div>
      </div>
    </div>
  );
}
