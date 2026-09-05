import { useCallback, useEffect, useState } from 'react';
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
} from '../lib/caret';
import { TONICS } from '../lib/notation';
import type { Composition } from '../hooks/use-compositions';
import { useNotationPlayback } from '../hooks/use-notation-playback';
import { NotationView } from './notation-view';
import { SwaraKeyboard } from './swara-keyboard';

const KEY =
  'keycap keycap-pressable hover:border-engrave hover:bg-white active:keycap-pressed';

/** Saved this long after you stop typing. */
const SAVE_DEBOUNCE_MS = 800;

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
 */
export function NotationEditor({ composition, onSave, onDelete }: NotationEditorProps) {
  const [lines, setLines] = useState<Line[]>(() => parseNotation(composition.notation));
  const [caret, setCaret] = useState<Caret>(() =>
    caretAtEnd(parseNotation(composition.notation)),
  );
  const [saptak, setSaptak] = useState(0);
  const [tie, setTie] = useState(false);
  const [bpm, setBpm] = useState(80);
  const [dirty, setDirty] = useState(false);

  const playback = useNotationPlayback(lines, composition.tonic, bpm, 0.7);

  const { id } = composition;

  useEffect(() => {
    if (!dirty) return;

    const notation = serializeLines(lines);
    const timer = window.setTimeout(() => {
      void onSave(id, { notation }).then(() => setDirty(false));
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [lines, dirty, id, onSave]);

  /** Apply an edit that moves the caret with it. */
  const apply = useCallback(
    (edit: (lines: Line[], caret: Caret) => { lines: Line[]; caret: Caret }) => {
      setLines((currentLines) => {
        const result = edit(currentLines, caret);
        setCaret(result.caret);
        return result.lines;
      });
      setDirty(true);
    },
    [caret],
  );

  const insert = useCallback(
    (token: Token) => apply((l, c) => insertToken(l, c, token)),
    [apply],
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

  // Typing shortcuts, so the on-screen keyboard teaches the letters and then
  // gets out of the way.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

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
        setCaret((current) => move(lines, current));
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        apply(deleteBefore);
        return;
      }
      if (event.key === 'Delete') {
        event.preventDefault();
        apply(deleteAt);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        apply(breakLine);
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
  }, [addNote, apply, insert, lines]);

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
        onCaretChange={setCaret}
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

        <span className="mono-label ml-auto">{dirty ? 'saving' : 'saved'}</span>
      </div>

      <SwaraKeyboard
        saptak={saptak}
        onSaptakChange={setSaptak}
        tie={tie}
        onTieToggle={() => setTie((value) => !value)}
        onNote={addNote}
        onSustain={() => insert({ kind: 'sustain' })}
        onBar={() => insert({ kind: 'bar' })}
        onNewLine={() => apply(breakLine)}
        onBackspace={() => apply(deleteBefore)}
      />
    </div>
  );
}
