import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_NOTES, groupByOctave, nearestNote, type Note } from '../lib/notes';
import { playFrequency } from '../lib/audio';
import { usePitchDetection } from '../hooks/use-pitch-detection';
import { NowPlaying } from '../components/now-playing';
import { OctaveRow } from '../components/octave-row';

/** How long a tile stays highlighted after being clicked. */
const FLASH_MS = 260;

export function Dashboard() {
  const octaves = useMemo(() => groupByOctave(ALL_NOTES), []);
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  const flashTimer = useRef<number | null>(null);

  const { status, reading, error, start, stop } = usePitchDetection();

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

  const handlePlay = useCallback((note: Note) => {
    playFrequency(note.frequency);
    setActiveMidi(note.midi);

    if (flashTimer.current !== null) {
      window.clearTimeout(flashTimer.current);
    }
    flashTimer.current = window.setTimeout(() => setActiveMidi(null), FLASH_MS);
  }, []);

  return (
    <div>
      <NowPlaying
        status={status}
        match={match}
        frequency={reading?.frequency ?? null}
        error={error}
        onStart={start}
        onStop={stop}
      />

      <header className="mb-8 mt-8">
        <h1 className="text-3xl font-semibold tracking-tight">Every note</h1>
        <p className="mt-2 max-w-prose text-muted">
          All {ALL_NOTES.length} notes of an 88-key piano, A0 through C8, at A4 = 440
          Hz. Press Listen and the tile you are playing lights up, green when you are
          within 10 cents. Click any tile to hear it as a reference.
        </p>
      </header>

      <div className="space-y-8">
        {octaves.map((group) => (
          <OctaveRow
            key={group.octave}
            group={group}
            onPlay={handlePlay}
            activeMidi={activeMidi}
            detectedMidi={match?.note.midi ?? null}
            detectedCents={match?.cents ?? null}
          />
        ))}
      </div>
    </div>
  );
}
