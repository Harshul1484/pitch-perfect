import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IN_TUNE_CENTS, frequencyOf, nearestNote, type Note } from '../lib/notes';
import { VOICES, playFrequency, type Voice } from '../lib/audio';
import { useAuth } from '../hooks/use-auth';
import { useNumberPreference, usePreference } from '../hooks/use-preference';
import { useRecorder } from '../hooks/use-recorder';
import { useDrone } from '../hooks/use-drone';
import { useMetronome } from '../hooks/use-metronome';
import { usePitchDetection } from '../hooks/use-pitch-detection';
import { useHoldPreference, usePractice } from '../hooks/use-practice';
import { useMedia } from '../hooks/use-media';
import type { Notation } from '../lib/notation';
import { AccountControl } from '../components/account-control';
import { InstallControl } from '../components/install-control';
import { UpdateControl } from '../components/update-control';
import { ControlsPanel, ControlsPopover } from '../components/controls-popover';
import { Keybed } from '../components/keybed';
import { Pages } from '../components/pages';
import { MAX_BPM, MIN_BPM } from '../lib/metronome';
import { MetronomePanel } from '../components/metronome-panel';
import { PracticeControl } from '../components/practice-control';
import { RecordControl } from '../components/record-control';
import { TunerColumn } from '../components/tuner-column';
import { Tour } from '../components/tour';
import { useTour } from '../hooks/use-tour';
import { TUNER_STEPS, TUNER_TOUR } from '../lib/tour';

/** How long a key stays depressed after being clicked. */
const FLASH_MS = 260;

export function Dashboard() {
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  // Settings the player sets once and expects to find again next time.
  const [tolerance, setTolerance] = useNumberPreference(
    'pitch.tolerance',
    IN_TUNE_CENTS,
    2,
    30,
  );
  /** Reference tone length, in tenths of a second. */
  const [sustain, setSustain] = useNumberPreference('pitch.sustain', 14, 2, 30);
  const flashTimer = useRef<number | null>(null);

  const [bpm, setBpm] = useNumberPreference('pitch.bpm', 90, MIN_BPM, MAX_BPM);
  const [notation, setNotation] = usePreference<Notation>('pitch.notation', 'western', [
    'western',
    'sargam',
  ]);
  const [voice, setVoice] = usePreference<Voice>('pitch.voice', 'violin', VOICES);
  /** Pitch class shown as Sa. C by default; movable, as sargam requires. */
  const [tonic, setTonic] = useNumberPreference('pitch.tonic', 0, 0, 11);

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

  // Offered on a first visit; once taken or declined, not offered again.
  const tour = useTour(TUNER_TOUR, TUNER_STEPS);

  /*
   * Where the readout column has room to spare, the controls live in it as a
   * panel rather than behind a button in the header. Rendered rather than
   * hidden: a display:none copy is still in the document, and two controls
   * answering to one name is a bug for a screen reader and a test alike.
   */
  const roomy = useMedia('(min-height: 900px)');

  // Practice: the bed keeps what it heard, rather than only showing it.
  const [practising, setPractising] = useState(false);
  const [holdMs, setHoldMs] = useHoldPreference();
  const practice = usePractice(match, tolerance, holdMs, practising);

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
    /*
     * One screen, no scrolling: the key bed takes whatever height is left.
     * Height comes from the frame (#root) rather than the viewport, because on
     * a phone held upright that frame is the rotated one.
     */
    <div className="relative flex h-full flex-col gap-2.5 overflow-hidden p-4 short:gap-1.5 short:p-1.5">
      <Tour tour={tour} label="show me around" />

      <header className="flex shrink-0 items-center justify-between gap-2 px-0.5">
        <Pages />
        {/*
         * Grouped by what the controls are for, with the gaps doing the
         * grouping: tight inside a group, wide between. Eight caps in a row at
         * even spacing left it to the reader to work out what belonged with
         * what, which is a job the layout should have done.
         */}
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-4 short:gap-2">
          {/* The two things you reach for while playing, kept together. */}
          <span className="flex items-center gap-1.5 short:gap-1">
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
            <PracticeControl
              tourId="practice"
              on={practising}
              onToggle={() => setPractising((on) => !on)}
              holdMs={holdMs}
              onHoldChange={setHoldMs}
              onReset={practice.reset}
              marked={Object.keys(practice.marks).length}
            />
          </span>

          {!roomy && (
            <>
              <span aria-hidden="true" className="h-4 w-px bg-hairline narrow:hidden" />
              <ControlsPopover
                notation={notation}
                onNotationChange={setNotation}
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
            </>
          )}
          <span aria-hidden="true" className="h-4 w-px bg-hairline narrow:hidden" />
          {/* Both are there only when they are relevant: install until the
              app is installed, update only after a deploy has landed under
              a session that is still open. */}
          <UpdateControl />
          <InstallControl />
          <AccountControl {...auth} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-2.5 short:gap-1.5">
        <div className="flex min-h-0 shrink-0 flex-col gap-2.5 short:gap-1.5">
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
          />

          {/* Only where the column has room left over; otherwise the header
              keeps its button and this is not rendered at all. */}
          {roomy && (
            <ControlsPanel
              notation={notation}
              onNotationChange={setNotation}
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
          )}
        </div>

        <Keybed
          notation={notation}
          tonic={tonic}
          onPlay={handlePlay}
          activeMidi={activeMidi}
          detectedMidi={match?.note.midi ?? null}
          detectedCents={match?.cents ?? null}
          tolerance={tolerance}
          marks={practice.marks}
        />
      </div>
    </div>
  );
}
