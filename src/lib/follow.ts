import type { Line } from './composition';
import { buildSchedule } from './playback';
import type { Mark } from './practice';

/**
 * Working through a written piece at your own pace.
 *
 * The piece waits for you: only the right note, in tune, moves the target on.
 * Nothing here knows about time — that is the other half of practice, and it
 * is graded rather than followed.
 */

/** A note the piece is waiting for, and where it sits on the page. */
export interface Target {
  /** Index across the whole piece, bars and holds included. */
  tokenIndex: number;
  midi: number;
}

/**
 * The sounding notes of a piece, in order.
 *
 * Taken from the same schedule playback uses, so a bar (which takes no time)
 * and a hold (which lengthens the note before it) are not targets — neither is
 * something you play.
 */
export function targetsOf(lines: Line[], tonic: number): Target[] {
  return buildSchedule(lines, tonic)
    .placed.filter((item) => item.midi !== null)
    .map((item) => ({ tokenIndex: item.tokenIndex, midi: item.midi as number }));
}

/**
 * Where the piece stands after an attempt.
 *
 * A wrong note, or the right note played badly, leaves the target where it is.
 * That is the whole point of the self-paced stage: the phrase cannot run away
 * from you, and getting a note nearly right is not getting it.
 */
export function advance(index: number, targets: Target[], mark: Mark): number {
  if (index >= targets.length) return targets.length;

  const target = targets[index];
  return target.midi === mark.midi && mark.inTune ? index + 1 : index;
}

/**
 * Which written notes have been got right so far, keyed by their place on the
 * page rather than by their place in the run — the page is what draws them.
 */
export function verdicts(targets: Target[], index: number): Record<number, 'hit'> {
  return Object.fromEntries(
    targets.slice(0, index).map((target) => [target.tokenIndex, 'hit' as const]),
  );
}
