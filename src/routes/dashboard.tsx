import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_NOTES, groupByOctave, type Note } from '../lib/notes';
import { playFrequency } from '../lib/audio';
import { OctaveRow } from '../components/octave-row';

/** How long a tile stays highlighted after being struck. */
const FLASH_MS = 260;

export function Dashboard() {
  const octaves = useMemo(() => groupByOctave(ALL_NOTES), []);
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  const flashTimer = useRef<number | null>(null);

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
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Every note</h1>
        <p className="mt-2 max-w-prose text-muted">
          All {ALL_NOTES.length} notes of an 88-key piano, A0 through C8, in equal
          temperament at A4 = 440 Hz. Click any tile to hear it.
        </p>
      </header>

      <div className="space-y-8">
        {octaves.map((group) => (
          <OctaveRow
            key={group.octave}
            group={group}
            onPlay={handlePlay}
            activeMidi={activeMidi}
          />
        ))}
      </div>
    </div>
  );
}
