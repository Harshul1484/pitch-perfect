import { useCallback, useMemo, useRef } from 'react';
import type { Caret } from '../lib/caret';
import type { Line } from '../lib/composition';
import type { Range } from '../lib/selection';
import { midiFor } from '../lib/composition';
import { swaraOfDegree, type Notation } from '../lib/notation';
import { noteAt } from '../lib/notes';
import type { Verdict } from '../lib/run';
import { Swara } from './swara';

interface NotationViewProps {
  lines: Line[];
  /** Index of the token sounding, counted across all lines. */
  playingIndex: number | null;
  caret: Caret;
  /** The highlighted run, in document order, or null when nothing is selected. */
  selection: Range | null;
  notation: Notation;
  /** Pitch class of Sa, needed to name notes the Western way. */
  tonic: number;
  onCaretChange: (caret: Caret, extend: boolean) => void;
  /** How each note was played while practising, by token index. */
  verdicts?: Record<number, Verdict>;
  /** The note practice is waiting for, by token index. */
  targetIndex?: number | null;
}

/** Read the caret position a pointer is over, from the cell under it. */
function positionAt(target: EventTarget | null): Caret | null {
  const element = (target as HTMLElement | null)?.closest?.('[data-line]');
  if (!element) return null;

  const line = Number(element.getAttribute('data-line'));
  const index = Number(element.getAttribute('data-index'));
  return Number.isFinite(line) && Number.isFinite(index) ? { line, index } : null;
}

/**
 * The written page.
 *
 * Cells are fixed width so swaras line up down the page as well as across, the
 * way they do on ruled paper.
 *
 * The caret sits between cells rather than on one, which is what lets a note
 * be inserted mid-line. Clicking a gap puts it there; clicking a cell puts it
 * on the near side of that cell.
 */
export function NotationView({
  lines,
  playingIndex,
  caret,
  selection,
  notation,
  tonic,
  onCaretChange,
  verdicts,
  targetIndex = null,
}: NotationViewProps) {
  /** Whether the token at this position falls inside the selection. */
  const selected = (line: number, index: number): boolean => {
    if (selection === null) return false;
    const { start, end } = selection;

    const afterStart = line > start.line || (line === start.line && index >= start.index);
    const beforeEnd = line < end.line || (line === end.line && index < end.index);
    return afterStart && beforeEnd;
  };
  // Where each line starts in the flat token numbering.
  const offsets = useMemo(() => {
    const starts: number[] = [];
    let total = 0;
    for (const line of lines) {
      starts.push(total);
      total += line.length;
    }
    return starts;
  }, [lines]);

  const empty = lines.every((line) => line.length === 0);

  /**
   * Dragging across the page selects, the way it does in any text. The whole
   * page listens rather than each cell, so a drag that starts on one cell and
   * crosses others is one gesture instead of a series of unrelated events.
   */
  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      const at = positionAt(event.target);
      if (!at) return;

      dragging.current = true;
      onCaretChange(at, event.shiftKey);
    },
    [onCaretChange],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!dragging.current) return;

      const at = positionAt(event.target);
      // Extend to wherever the pointer has reached.
      if (at) onCaretChange(at, true);
    },
    [onCaretChange],
  );

  const endDrag = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      role="group"
      aria-label="written notation"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
    >
      {empty && (
        <p className="mono-label py-6 text-center">type a swara, or press a key below</p>
      )}

      {lines.map((line, lineIndex) => (
        <div
          key={lineIndex}
          className="flex min-h-[40px] flex-wrap items-center border-b border-hairline-soft/60 pb-1"
        >
          {/* One gap per boundary, including the one before the first cell. */}
          {Array.from({ length: line.length + 1 }, (_, index) => (
            <CaretSlot
              key={`gap-${index}`}
              line={lineIndex}
              index={index}
              active={caret.line === lineIndex && caret.index === index}
            />
          )).flatMap((slot, index) => {
            const token = line[index];
            if (!token) return [slot];

            const flat = offsets[lineIndex] + index;
            const playing = flat === playingIndex;

            if (token.kind === 'bar') {
              return [
                slot,
                <span
                  key={index}
                  data-bar=""
                  aria-label="bar line"
                  className={`mx-0.5 h-7 w-px shrink-0 ${
                    selected(lineIndex, index) ? 'bg-signal' : 'bg-graphite/40'
                  }`}
                />,
              ];
            }

            return [
              slot,
              <button
                key={index}
                type="button"
                // Clicking a cell puts the caret before it, so a wrong note can
                // be deleted with one backspace.
                data-line={lineIndex}
                data-index={index}
                data-selected={selected(lineIndex, index) ? 'true' : undefined}
                data-verdict={verdicts?.[flat]}
                data-target={flat === targetIndex ? 'true' : undefined}
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] text-[14px] transition-colors duration-100 short:h-7 short:w-7 ${
                  playing
                    ? 'bg-signal/15 text-signal'
                    : selected(lineIndex, index)
                      ? 'bg-graphite/15 text-graphite'
                      : verdicts?.[flat] === 'hit'
                        ? 'bg-intune/20 text-intune'
                        : verdicts?.[flat]
                          ? 'bg-signal/15 text-graphite'
                          : 'text-graphite hover:bg-black/5'
                } ${
                  flat === targetIndex
                    ? 'outline-2 -outline-offset-2 outline-graphite'
                    : ''
                }`}
              >
                {token.kind === 'sustain' ? (
                  <span aria-hidden="true">&mdash;</span>
                ) : notation === 'western' ? (
                  <WesternName midi={midiFor(token, tonic)} />
                ) : (
                  <Swara
                    swara={{ ...swaraOfDegree(token.degree), saptak: token.saptak }}
                  />
                )}

                {/*
                  The tie, arcing back to the note it shares a beat with. It
                  hangs below the cell and is curved, so it cannot be mistaken
                  for the straight underline that marks a komal swara.
                */}
                {token.kind === 'note' &&
                  token.grouped &&
                  (index === 0 ? (
                    /*
                      Tied to the beat that ended the line above. There is
                      nothing on this line to arc back to, so it gets a stub
                      running off the left edge instead of a curve into space.
                    */
                    <span
                      data-tie=""
                      data-tie-continued=""
                      aria-hidden="true"
                      className="absolute -bottom-1.5 left-0 h-2 w-1/2 rounded-bl-[999px] border-b-2 border-l-2 border-signal/50"
                    />
                  ) : (
                    /*
                      Centre to centre. The arc joins the two notes that share
                      a beat, so it starts under the middle of the one before
                      and ends under the middle of this one — half a cell each
                      side, plus the 8px caret slot between them. It used to
                      run to this cell's right edge, which left it looking
                      shunted one place along.
                    */
                    <span
                      data-tie=""
                      aria-hidden="true"
                      className="absolute -bottom-1.5 left-[calc(-50%-8px)] h-2 w-[calc(100%+8px)] rounded-b-[999px] border-b-2 border-l-2 border-r-2 border-signal/50"
                    />
                  ))}
              </button>,
            ];
          })}
        </div>
      ))}
    </div>
  );
}

/** A written note under Western naming: pitch class with its octave. */
function WesternName({ midi }: { midi: number }) {
  const note = noteAt(midi);

  return (
    <span className="leading-none tracking-tight">
      {note.name}
      <sup className="ml-px text-[9px] font-medium tabular-nums opacity-70">
        {note.octave}
      </sup>
    </span>
  );
}

/** The gap between two cells, and the caret when it is here. */
function CaretSlot({
  active,
  line,
  index,
}: {
  active: boolean;
  line: number;
  index: number;
}) {
  return (
    <button
      type="button"
      aria-label="place caret"
      data-line={line}
      data-index={index}
      className="group relative h-8 w-2 shrink-0"
    >
      <span
        className={`absolute inset-y-1 left-1/2 w-[1.5px] -translate-x-1/2 rounded-full transition-colors ${
          active ? 'animate-pulse bg-signal' : 'bg-transparent group-hover:bg-hairline'
        }`}
      />
    </button>
  );
}
