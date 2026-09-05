import { useMemo } from 'react';
import type { Caret } from '../lib/caret';
import type { Line } from '../lib/composition';
import { swaraOfDegree } from '../lib/notation';
import { Swara } from './swara';

interface NotationViewProps {
  lines: Line[];
  /** Index of the token sounding, counted across all lines. */
  playingIndex: number | null;
  caret: Caret;
  onCaretChange: (caret: Caret) => void;
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
  onCaretChange,
}: NotationViewProps) {
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

  return (
    <div
      role="group"
      aria-label="notation"
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
              active={caret.line === lineIndex && caret.index === index}
              onClick={() => onCaretChange({ line: lineIndex, index })}
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
                  className="mx-0.5 h-7 w-px shrink-0 bg-graphite/40"
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
                onClick={() => onCaretChange({ line: lineIndex, index })}
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] text-[14px] transition-colors duration-100 ${
                  playing ? 'bg-signal/15 text-signal' : 'text-graphite hover:bg-black/5'
                }`}
              >
                {token.kind === 'sustain' ? (
                  <span aria-hidden="true">&mdash;</span>
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
                {token.kind === 'note' && token.grouped && (
                  <span
                    data-tie=""
                    aria-hidden="true"
                    className="absolute -bottom-1.5 -left-2.5 h-2 w-[calc(100%+0.625rem)] rounded-b-[999px] border-b-2 border-l-2 border-r-2 border-signal/50"
                  />
                )}
              </button>,
            ];
          })}
        </div>
      ))}
    </div>
  );
}

/** The gap between two cells, and the caret when it is here. */
function CaretSlot({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="place caret"
      onClick={onClick}
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
