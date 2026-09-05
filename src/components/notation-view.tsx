import { useMemo } from 'react';
import type { Line } from '../lib/composition';
import { swaraOfDegree } from '../lib/notation';
import { Swara } from './swara';

interface NotationViewProps {
  lines: Line[];
  /** Index of the token sounding during playback, counted across all lines. */
  playingIndex: number | null;
}

/**
 * The written page.
 *
 * Laid out as rows of fixed-width cells rather than flowing text, so swaras
 * line up vertically the way they do on ruled paper and a phrase can be read
 * down the page as well as across.
 */
export function NotationView({ lines, playingIndex }: NotationViewProps) {
  // Where each line starts in the flat token numbering, which during playback
  // is also the beat numbering.
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
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {empty && (
        <p className="mono-label py-6 text-center">type a swara, or press a key below</p>
      )}

      {lines.map((line, lineIndex) => (
        <div
          key={lineIndex}
          className="flex min-h-[34px] flex-wrap items-center gap-x-1 gap-y-2 border-b border-hairline-soft/60 pb-1"
        >
          {line.map((token, tokenIndex) => {
            const playing = offsets[lineIndex] + tokenIndex === playingIndex;

            return (
              <span
                key={tokenIndex}
                className={`flex h-8 w-8 items-center justify-center rounded-[6px] text-[14px] transition-colors duration-100 ${
                  playing ? 'bg-signal/15 text-signal' : 'text-graphite'
                }`}
              >
                {token.kind === 'sustain' ? (
                  <span aria-hidden="true">&mdash;</span>
                ) : (
                  <Swara
                    swara={{ ...swaraOfDegree(token.degree), saptak: token.saptak }}
                  />
                )}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
