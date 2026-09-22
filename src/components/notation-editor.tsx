import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  letterToDegree,
  parseNotation,
  serializeLines,
  type Line,
  type Token,
} from '../lib/composition';
import {
  breakLine,
  caretAtEnd,
  deleteAt,
  deleteBefore,
  insertToken,
  moveDown,
  moveLeft,
  moveLineEnd,
  moveLineStart,
  moveRight,
  moveUp,
  type Caret,
  type Edit,
} from '../lib/caret';
import {
  canRedo,
  canUndo,
  clearHistory,
  initial,
  loadHistory,
  record,
  redo,
  saveHistory,
  undo,
  type History,
} from '../lib/history';
import {
  deleteRange,
  extract,
  insertLines,
  isEmpty,
  ordered,
  selectAll,
  type Selection,
} from '../lib/selection';
import { NOTATIONS, TONICS, type Notation } from '../lib/notation';
import { VOICES, type Voice } from '../lib/audio';
import { usePreference } from '../hooks/use-preference';
import type { Composition } from '../hooks/use-compositions';
import { useNotationPlayback } from '../hooks/use-notation-playback';
import { NotationView } from './notation-view';
import { SwaraKeyboard } from './swara-keyboard';
import { Keybed } from './keybed';
import { PracticeControl } from './practice-control';
import { advance, targetsOf, verdicts as hitsSoFar } from '../lib/follow';
import { useHoldPreference, usePractice } from '../hooks/use-practice';
import { useRun } from '../hooks/use-run';
import { useNumberPreference } from '../hooks/use-preference';
import { IN_TUNE_CENTS, type PitchMatch } from '../lib/notes';

/* Hover lives on the off state only — see the note in routes/notes.tsx. */
const KEY = 'keycap keycap-pressable active:keycap-pressed';
const KEY_OFF = `${KEY} hover:border-engrave hover:bg-white`;
const KEY_ON = `${KEY} border-graphite bg-graphite bg-none text-panel`;

const SELECT_ARROW =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='5'><path d='M0 0h8L4 5z' fill='%238a8a84'/></svg>\")";

/** Saved this long after you stop typing. */
const SAVE_DEBOUNCE_MS = 800;

/** What undo steps through: the document and where the caret was in it. */
interface DocState {
  lines: Line[];
  caret: Caret;
}

interface NotationEditorProps {
  composition: Composition;
  /** What the microphone is hearing, when this page is listening. */
  match?: PitchMatch | null;
  listening?: boolean;
  onSave: (
    id: string,
    changes: { title?: string; notation?: string; tonic?: number },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

/**
 * Edit one piece.
 *
 * The caller keys this on the composition id, so switching pieces remounts it
 * and the notation state initialises straight from props. That avoids an
 * effect copying props into state, which would also race the live Firestore
 * snapshot and could overwrite what is being typed.
 *
 * Undo steps through whole documents, caret included, so undoing a deletion
 * puts the caret back where the deletion happened rather than wherever it
 * drifted to. Selection is deliberately outside the history: nobody wants to
 * spend undos walking back through highlights.
 */
export function NotationEditor({
  composition,
  match = null,
  listening = false,
  onSave,
  onDelete,
}: NotationEditorProps) {
  const [history, setHistory] = useState<History<DocState>>(() => {
    const lines = parseNotation(composition.notation);
    const fresh = initial({ lines, caret: caretAtEnd(lines) });

    // Undo from a previous visit, but only if it describes this document as it
    // stands. If the piece moved on elsewhere, those steps are about a version
    // that no longer exists.
    return (
      loadHistory<DocState>(
        composition.id,
        (present) => serializeLines(present.lines) === composition.notation,
      ) ?? fresh
    );
  });
  const { lines, caret } = history.present;

  const [selection, setSelection] = useState<Selection | null>(null);
  const [saptak, setSaptak] = useState(0);
  const [tie, setTie] = useState(false);
  const [bpm, setBpm] = useState(80);
  // Read only: both of these are set on the tuner and shared by the app.
  const [notation] = usePreference<Notation>('pitch.notation', 'western', NOTATIONS);
  const [voice] = usePreference<Voice>('pitch.voice', 'violin', VOICES);
  const [dirty, setDirty] = useState(false);

  /** Cut and copy keep their own clipboard, so notation survives round trips. */
  const clipboard = useRef<Line[]>([]);

  const playback = useNotationPlayback(lines, composition.tonic, bpm, 0.7, voice);

  /*
   * Practice. Two stages: learn waits for each note, run plays the piece in
   * time and scores it. The tolerance is the player's, shared with the tuner.
   */
  const [practising, setPractising] = useState(false);
  const [stage, setStage] = useState<'learn' | 'run'>('learn');
  const [reached, setReached] = useState(0);
  const [tolerance] = useNumberPreference('pitch.tolerance', IN_TUNE_CENTS, 2, 30);
  const [holdMs, setHoldMs] = useHoldPreference();

  const targets = useMemo(
    () => targetsOf(lines, composition.tonic),
    [lines, composition.tonic],
  );

  // Each attempt moves the target on, if it was the right note in tune. This
  // is a fold over events, so it happens as they arrive rather than in an
  // effect watching for them to have arrived.
  const practice = usePractice(
    match,
    tolerance,
    holdMs,
    practising,
    useCallback(
      (mark) => {
        if (stage !== 'learn') return;
        setReached((current) => advance(current, targets, mark));
      },
      [stage, targets],
    ),
  );

  const run = useRun(lines, composition.tonic, bpm, tolerance, match);

  const { id } = composition;

  // Keep the undo trail with the piece, so a reload does not lose it.
  useEffect(() => {
    saveHistory(id, history);
  }, [history, id]);

  useEffect(() => {
    if (!dirty) return;

    const notation = serializeLines(lines);
    const timer = window.setTimeout(() => {
      void onSave(id, { notation }).then(() => setDirty(false));
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [lines, dirty, id, onSave]);

  /** Apply an edit, recording it so it can be undone. */
  const apply = useCallback((edit: (state: DocState) => Edit) => {
    setHistory((current) => {
      const result = edit(current.present);
      return record(current, { lines: result.lines, caret: result.caret });
    });
    setSelection(null);
    setDirty(true);
  }, []);

  /** Anything typed over a selection replaces it, as in any editor. */
  const replacingSelection = useCallback(
    (then: (state: DocState) => Edit) =>
      (state: DocState): Edit => {
        if (selection === null || isEmpty(selection)) return then(state);

        const cleared = deleteRange(state.lines, selection);
        return then({ lines: cleared.lines, caret: cleared.caret });
      },
    [selection],
  );

  const insert = useCallback(
    (token: Token) =>
      apply(replacingSelection((state) => insertToken(state.lines, state.caret, token))),
    [apply, replacingSelection],
  );

  const addNote = useCallback(
    (degree: number) => {
      insert(
        tie
          ? { kind: 'note', degree, saptak, grouped: true }
          : { kind: 'note', degree, saptak },
      );
      // A tie joins one note to the beat before it; it is not a mode you stay
      // in, or every following note would pile into the same beat.
      setTie(false);
    },
    [insert, saptak, tie],
  );

  const moveCaret = useCallback((to: (l: Line[], c: Caret) => Caret, extend: boolean) => {
    setHistory((current) => {
      const next = to(current.present.lines, current.present.caret);

      setSelection((existing) =>
        extend
          ? { anchor: existing?.anchor ?? current.present.caret, focus: next }
          : null,
      );

      return { ...current, present: { ...current.present, caret: next } };
    });
  }, []);

  const copySelection = useCallback(() => {
    if (selection === null || isEmpty(selection)) return;

    const clip = extract(lines, selection);
    clipboard.current = clip;
    // Best effort, so notation can be pasted into a message or a file too.
    void navigator.clipboard?.writeText(serializeLines(clip)).catch(() => undefined);
  }, [lines, selection]);

  const cutSelection = useCallback(() => {
    if (selection === null || isEmpty(selection)) return;

    copySelection();
    apply((state) => deleteRange(state.lines, selection));
  }, [apply, copySelection, selection]);

  const paste = useCallback(() => {
    if (clipboard.current.length === 0) return;

    apply(
      replacingSelection((state) =>
        insertLines(state.lines, state.caret, clipboard.current),
      ),
    );
  }, [apply, replacingSelection]);

  // Typing shortcuts, so the on-screen keyboard teaches the letters and then
  // gets out of the way.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const command = event.metaKey || event.ctrlKey;

      if (command) {
        const key = event.key.toLowerCase();

        if (key === 'z') {
          event.preventDefault();
          setHistory((current) => (event.shiftKey ? redo(current) : undo(current)));
          setSelection(null);
          setDirty(true);
          return;
        }
        if (key === 'y') {
          event.preventDefault();
          setHistory(redo);
          setDirty(true);
          return;
        }
        if (key === 'a') {
          event.preventDefault();
          setSelection(selectAll(lines));
          return;
        }
        if (key === 'c') {
          event.preventDefault();
          copySelection();
          return;
        }
        if (key === 'x') {
          event.preventDefault();
          cutSelection();
          return;
        }
        if (key === 'v') {
          event.preventDefault();
          paste();
          return;
        }
        return;
      }

      if (event.altKey) return;

      const moves: Record<string, (l: Line[], c: Caret) => Caret> = {
        ArrowLeft: moveLeft,
        ArrowRight: moveRight,
        ArrowUp: moveUp,
        ArrowDown: moveDown,
        Home: moveLineStart,
        End: moveLineEnd,
      };

      const move = moves[event.key];
      if (move) {
        event.preventDefault();
        moveCaret(move, event.shiftKey);
        return;
      }

      const hasSelection = selection !== null && !isEmpty(selection);

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        if (hasSelection) {
          apply((state) => deleteRange(state.lines, selection));
        } else {
          apply((state) =>
            event.key === 'Backspace'
              ? deleteBefore(state.lines, state.caret)
              : deleteAt(state.lines, state.caret),
          );
        }
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        apply(replacingSelection((state) => breakLine(state.lines, state.caret)));
        return;
      }
      if (event.key === '-') {
        event.preventDefault();
        insert({ kind: 'sustain' });
        return;
      }
      if (event.key === '|' || event.key === '/') {
        event.preventDefault();
        insert({ kind: 'bar' });
        return;
      }
      if (event.key === '~') {
        event.preventDefault();
        setTie((value) => !value);
        return;
      }

      const degree = letterToDegree(event.key);
      if (degree !== null) {
        event.preventDefault();
        addNote(degree);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    addNote,
    apply,
    copySelection,
    cutSelection,
    insert,
    lines,
    moveCaret,
    paste,
    replacingSelection,
    selection,
  ]);

  const selectedRange = selection && !isEmpty(selection) ? ordered(selection) : null;

  return (
    <div className="keycap flex min-h-0 min-w-0 flex-1 flex-col gap-3 bg-tile p-3 short:gap-2 short:p-2">
      <div className="flex items-center gap-2 short:gap-1.5">
        <input
          defaultValue={composition.title}
          onChange={(event) => void onSave(id, { title: event.target.value })}
          // Swara shortcuts are ignored while a field has focus, so Enter
          // leaves the title rather than stranding you in it.
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          aria-label="title"
          className="keycap w-0 flex-1 bg-panel px-2.5 py-1.5 text-[13px] outline-none focus:border-graphite short:py-1 short:text-[12px]"
          placeholder="untitled"
        />

        <label className="flex items-center gap-1.5">
          <span className="mono-label">sa</span>
          <select
            value={composition.tonic}
            onChange={(event) => void onSave(id, { tonic: Number(event.target.value) })}
            aria-label="tonic of this piece"
            className="keycap keycap-pressable cursor-pointer appearance-none py-1.5 pl-2.5 pr-5 text-center font-mono text-[11px] tabular-nums hover:border-engrave"
            style={{
              backgroundImage: SELECT_ARROW,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 6px center',
            }}
          >
            {TONICS.map((name, pitchClass) => (
              <option key={name} value={pitchClass}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            // A deleted piece has no history worth keeping around.
            clearHistory(id);
            void onDelete(id);
          }}
          className={`${KEY_OFF} px-2 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] text-engrave`}
        >
          delete
        </button>
      </div>

      <NotationView
        lines={lines}
        verdicts={
          practising
            ? stage === 'run' && run.result
              ? Object.fromEntries(
                  run.result.notes.map((note) => [note.tokenIndex, note.verdict]),
                )
              : hitsSoFar(targets, reached)
            : undefined
        }
        targetIndex={
          practising && stage === 'learn' ? (targets[reached]?.tokenIndex ?? null) : null
        }
        playingIndex={playback.token}
        caret={caret}
        selection={selectedRange}
        notation={notation}
        tonic={composition.tonic}
        onCaretChange={(next, extend) => {
          setHistory((current) => ({
            ...current,
            present: { ...current.present, caret: next },
          }));
          setSelection((existing) =>
            extend ? { anchor: existing?.anchor ?? caret, focus: next } : null,
          );
        }}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-hairline-soft pt-2 short:gap-1.5 short:pt-1.5">
        <button
          type="button"
          data-tour="play"
          onClick={playback.isPlaying ? playback.stop : playback.play}
          aria-pressed={playback.isPlaying}
          className={`${
            playback.isPlaying ? KEY_ON : KEY_OFF
          } px-3 py-1.5 text-[12px] font-medium lowercase tracking-wide`}
        >
          {playback.isPlaying ? 'stop' : 'play'}
        </button>

        <button
          type="button"
          onClick={() => {
            setHistory(undo);
            setDirty(true);
          }}
          disabled={!canUndo(history)}
          className={`${KEY_OFF} px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] disabled:cursor-default disabled:opacity-40`}
        >
          undo
        </button>

        <button
          type="button"
          onClick={() => {
            setHistory(redo);
            setDirty(true);
          }}
          disabled={!canRedo(history)}
          className={`${KEY_OFF} px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] disabled:cursor-default disabled:opacity-40`}
        >
          redo
        </button>

        <label className="flex items-center gap-1.5">
          <span className="mono-label">tempo</span>
          <input
            type="number"
            min={30}
            max={240}
            value={bpm}
            onChange={(event) => setBpm(Number(event.target.value))}
            aria-label="playback tempo"
            className="keycap w-16 bg-panel px-2 py-1 text-center font-mono text-[11px] tabular-nums outline-none focus:border-graphite"
          />
        </label>

        <PracticeControl
          tourId="piece-practice"
          on={practising}
          onToggle={() => {
            setPractising((on) => !on);
            setReached(0);
            run.stop();
            run.clear();
          }}
          holdMs={holdMs}
          onHoldChange={setHoldMs}
          onReset={() => {
            practice.reset();
            setReached(0);
            run.clear();
          }}
          marked={Object.keys(practice.marks).length}
        >
          {practising && (
            <div className="flex flex-col gap-2 border-t border-hairline-soft pt-2">
              <div role="group" aria-label="practice stage" className="flex gap-1">
                {(['learn', 'run'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setStage(option);
                      run.stop();
                    }}
                    aria-pressed={stage === option}
                    className={`${
                      stage === option ? KEY_ON : `${KEY_OFF} text-engrave`
                    } flex-1 px-2 py-1 font-mono text-[10px] lowercase tracking-[0.08em]`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {stage === 'learn' ? (
                <span className="mono-label normal-case">
                  {reached} of {targets.length} — it waits for each note.
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={run.running ? run.stop : run.start}
                    disabled={!listening || targets.length === 0}
                    className={`${
                      run.running ? KEY_ON : KEY_OFF
                    } px-2 py-1 font-mono text-[10px] lowercase tracking-[0.08em] disabled:cursor-default disabled:opacity-40`}
                  >
                    {run.running ? 'stop' : 'start the run'}
                  </button>

                  <span className="mono-label normal-case">
                    {run.result
                      ? `${run.result.hits} of ${run.result.total} in tune, in time.`
                      : listening
                        ? 'A bar of count-in, then play along.'
                        : 'Press listen first.'}
                  </span>
                </>
              )}
            </div>
          )}
        </PracticeControl>

        <span className="ml-auto flex flex-wrap items-center justify-end gap-3 short:gap-1.5">
          {/*
           * No notation or voice switch here. Both are one setting for the
           * whole app, kept per person and set on the tuner; offering them
           * twice invites the belief that this page has its own, which it does
           * not. The piece's Sa stays, up beside the title — that one really
           * does belong to the piece.
           */}
          <span className="mono-label">{dirty ? 'saving' : 'saved'}</span>
        </span>
      </div>

      {/*
       * While practising, the bed takes the keyboard's place: you are playing
       * the violin, not typing, and the two are the same twelve columns wide.
       * It shows only the octaves in play — a full nine-row plate would not fit
       * beside a written page, and most of it would be empty anyway.
       */}
      {practising ? (
        <div className="flex h-[132px] shrink-0 flex-col gap-1 short:h-[92px]">
          <span className="mono-label">
            {stage === 'run'
              ? run.countingIn
                ? 'counting in'
                : run.running
                  ? 'playing'
                  : 'press run when you are ready'
              : reached >= targets.length && targets.length > 0
                ? 'that is the whole piece'
                : 'play the outlined note'}
          </span>

          <Keybed
            notation={notation}
            tonic={composition.tonic}
            onPlay={() => {}}
            activeMidi={null}
            detectedMidi={match?.note.midi ?? null}
            detectedCents={match?.cents ?? null}
            tolerance={tolerance}
            marks={practice.marks}
            targetMidi={stage === 'learn' ? (targets[reached]?.midi ?? null) : null}
            octaves={octavesOf(targets, match?.note.midi ?? null)}
          />
        </div>
      ) : (
        <SwaraKeyboard
          tourId="keyboard"
          saptak={saptak}
          onSaptakChange={setSaptak}
          notation={notation}
          tonic={composition.tonic}
          tie={tie}
          onTieToggle={() => setTie((value) => !value)}
          onNote={addNote}
          onSustain={() => insert({ kind: 'sustain' })}
          onBar={() => insert({ kind: 'bar' })}
          onNewLine={() =>
            apply(replacingSelection((state) => breakLine(state.lines, state.caret)))
          }
          onBackspace={() =>
            apply((state) =>
              selection && !isEmpty(selection)
                ? deleteRange(state.lines, selection)
                : deleteBefore(state.lines, state.caret),
            )
          }
        />
      )}
    </div>
  );
}

/**
 * The octaves worth showing: those the piece uses, widened to include whatever
 * is being played now so a stray note is still visible rather than silently
 * off the plate.
 */
function octavesOf(
  targets: { midi: number }[],
  heard: number | null,
): { from: number; to: number } {
  const midis = [
    ...targets.map((target) => target.midi),
    ...(heard === null ? [] : [heard]),
  ];
  if (midis.length === 0) return { from: 3, to: 5 };

  const octave = (midi: number) => Math.floor(midi / 12) - 1;
  return { from: octave(Math.min(...midis)), to: octave(Math.max(...midis)) };
}
