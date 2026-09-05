import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { IN_TUNE_CENTS, frequencyOf, nearestNote, type Note } from '../lib/notes';
import { VOICES, playFrequency, type Voice } from '../lib/audio';
import { useAuth } from '../hooks/use-auth';
import { usePreference } from '../hooks/use-preference';
import { useRecorder } from '../hooks/use-recorder';
import { useDrone } from '../hooks/use-drone';
import { useMetronome } from '../hooks/use-metronome';
import { usePitchDetection } from '../hooks/use-pitch-detection';
import type { Notation } from '../lib/notation';
import { AccountControl } from '../components/account-control';
import { ControlsPopover } from '../components/controls-popover';
import { NotationSwitch } from '../components/notation-switch';
import { Keybed } from '../components/keybed';
import { MetronomePanel } from '../components/metronome-panel';
import { RecordControl } from '../components/record-control';
import { TunerColumn } from '../components/tuner-column';

/** How long a key stays depressed after being clicked. */
const FLASH_MS = 260;

export function Dashboard() {
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  const [tolerance, setTolerance] = useState(IN_TUNE_CENTS);
  /** Reference tone length, in tenths of a second. */
  const [sustain, setSustain] = useState(14);
  const flashTimer = useRef<number | null>(null);

  const [bpm, setBpm] = useState(90);
  const [notation, setNotation] = usePreference<Notation>('pitch.notation', 'western', [
    'western',
    'sargam',
  ]);
  const [voice, setVoice] = usePreference<Voice>('pitch.voice', 'violin', VOICES);
  /** Pitch class shown as Sa. C by default; movable, as sargam requires. */
  const [tonic, setTonic] = useState(0);

  const { status, reading, error, start, stop } = usePitchDetection();
  // Output level is the operating system's job, so everything plays at full
  // scale and the per-voice gains keep it civil.
  const metronome = useMetronome(bpm, 1);
  // Sa in octave 3, a comfortable register to drone under a violin.
  const drone = useDrone(frequencyOf(tonic + 48), 1);
  const auth = useAuth();
  const uid = auth.user?.uid ?? null;

  const match = useMemo(
    () => (reading ? nearestNote(reading.frequency) : null),
    [reading],
  );

  const recorder = useRecorder(match, tolerance);

  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) {
        window.clearTimeout(flashTimer.current);
      }
    };
  }, []);

  const handlePlay = useCallback(
    (note: Note) => {
      playFrequency(note.frequency, { durationSeconds: sustain / 10, voice });
      setActiveMidi(note.midi);

      if (flashTimer.current !== null) {
        window.clearTimeout(flashTimer.current);
      }
      flashTimer.current = window.setTimeout(() => setActiveMidi(null), FLASH_MS);
    },
    [sustain, voice],
  );

  return (
    /* One screen, no scrolling: the key bed takes whatever height is left. */
    <div className="flex h-screen flex-col gap-2.5 overflow-hidden p-4">
      <header className="flex shrink-0 items-end justify-between px-0.5">
        <h1 className="text-[20px] font-semibold leading-none tracking-[-0.03em]">
          pitch
        </h1>
        <div className="flex items-center gap-4">
          <Link
            to="/notes"
            className={
              'keycap keycap-pressable px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] text-graphite hover:border-engrave hover:bg-white active:keycap-pressed'
            }
          >
            notes &rarr;
          </Link>
          <span aria-hidden="true" className="h-4 w-px bg-hairline" />
          <NotationSwitch notation={notation} onNotationChange={setNotation} />
          <RecordControl
            isRecording={recorder.isRecording}
            elapsedMs={recorder.elapsedMs}
            disabled={status !== 'listening'}
            onToggle={recorder.isRecording ? recorder.stop : recorder.start}
            summary={recorder.summary}
            tolerance={tolerance}
            notation={notation}
            tonic={tonic}
            bpm={bpm}
            onSave={
              uid === null
                ? null
                : async (title, text) => {
                    // Loaded on demand: Firestore is the heaviest thing in the
                    // app and the tuner otherwise never needs it.
                    const { saveRecording } = await import('../lib/save-recording');
                    await saveRecording(uid, title, text, tonic);
                  }
            }
            onDiscard={recorder.discard}
          />
          <ControlsPopover
            tolerance={tolerance}
            onToleranceChange={setTolerance}
            sustain={sustain}
            onSustainChange={setSustain}
            tonic={tonic}
            onTonicChange={setTonic}
            droneOn={drone.isOn}
            onDroneToggle={drone.toggle}
            voice={voice}
            onVoiceChange={setVoice}
          />
          <span aria-hidden="true" className="h-4 w-px bg-hairline" />
          <AccountControl {...auth} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-2.5">
        <div className="flex min-h-0 shrink-0 flex-col gap-2.5">
          <TunerColumn
            status={status}
            match={match}
            frequency={reading?.frequency ?? null}
            error={error}
            tolerance={tolerance}
            notation={notation}
            tonic={tonic}
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

        <Keybed
          notation={notation}
          tonic={tonic}
          onPlay={handlePlay}
          activeMidi={activeMidi}
          detectedMidi={match?.note.midi ?? null}
          detectedCents={match?.cents ?? null}
          tolerance={tolerance}
        />
      </div>
    </div>
  );
}
