import { useCallback, useEffect, useRef, useState } from 'react';
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
  initial,
  record,
  redo,
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
import { Segmented } from './segmented';
import type { Composition } from '../hooks/use-compositions';
import { useNotationPlayback } from '../hooks/use-notation-playback';
import { NotationView } from './notation-view';
import { SwaraKeyboard } from './swara-keyboard';

const KEY =
  'keycap keycap-pressable hover:border-engrave hover:bg-white active:keycap-pressed';

/** Saved this long after you stop typing. */
const SAVE_DEBOUNCE_MS = 800;

/** What undo steps through: the document and where the caret was in it. */
interface DocState {
  lines: Line[];
  caret: Caret;
}

interface NotationEditorProps {
  composition: Composition;
  onSave: (id: string, changes: { title?: string; notation?: string }) => Promise<void>;
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
export function NotationEditor({ composition, onSave, onDelete }: NotationEditorProps) {
  const [history, setHistory] = useState<History<DocState>>(() => {
    const lines = parseNotation(composition.notation);
    return initial({ lines, caret: caretAtEnd(lines) });
  });
  const { lines, caret } = history.present;

  const [selection, setSelection] = useState<Selection | null>(null);
  const [saptak, setSaptak] = useState(0);
  const [tie, setTie] = useState(false);
  const [bpm, setBpm] = useState(80);
  const [notation, setNotation] = usePreference<Notation>(
    'pitch.notation',
    'western',
    NOTATIONS,
  );
  const [voice, setVoice] = usePreference<Voice>('pitch.voice', 'violin', VOICES);
  const [dirty, setDirty] = useState(false);

  /** Cut and copy keep their own clipboard, so notation survives round trips. */
  const clipboard = useRef<Line[]>([]);

  const playback = useNotationPlayback(lines, composition.tonic, bpm, 0.7, voice);

  const { id } = composition;

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
    <div className="keycap flex min-h-0 flex-1 flex-col gap-3 bg-tile p-3">
      <div className="flex items-center gap-2">
        <input
          defaultValue={composition.title}
          onChange={(event) => void onSave(id, { title: event.target.value })}
          // Swara shortcuts are ignored while a field has focus, so Enter
          // leaves the title rather than stranding you in it.
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          aria-label="title"
          className="keycap flex-1 bg-panel px-2.5 py-1.5 text-[13px] outline-none focus:border-graphite"
          placeholder="untitled"
        />

        <label className="flex items-center gap-1.5">
          <span className="mono-label">sa</span>
          <span className="keycap bg-panel px-2.5 py-1.5 font-mono text-[11px]">
            {TONICS[composition.tonic]}
          </span>
        </label>

        <button
          type="button"
          onClick={() => void onDelete(id)}
          className={`${KEY} px-2 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] text-engrave`}
        >
          delete
        </button>
      </div>

      <NotationView
        lines={lines}
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

      <div className="flex items-center gap-2 border-t border-hairline-soft pt-2">
        <button
          type="button"
          onClick={playback.isPlaying ? playback.stop : playback.play}
          aria-pressed={playback.isPlaying}
          className={`${KEY} px-3 py-1.5 text-[12px] font-medium lowercase tracking-wide ${
            playback.isPlaying
              ? 'border-graphite bg-graphite bg-none text-panel hover:bg-graphite'
              : ''
          }`}
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
          className={`${KEY} px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] disabled:cursor-default disabled:opacity-40`}
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
          className={`${KEY} px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] disabled:cursor-default disabled:opacity-40`}
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

        <span className="ml-auto flex items-center gap-3">
          <Segmented
            label="notation"
            value={notation}
            options={NOTATIONS}
            onChange={setNotation}
          />
          <Segmented label="voice" value={voice} options={VOICES} onChange={setVoice} />
          <span className="mono-label">{dirty ? 'saving' : 'saved'}</span>
        </span>
      </div>

      <SwaraKeyboard
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
    </div>
  );
}
