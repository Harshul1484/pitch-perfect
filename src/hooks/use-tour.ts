import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import type { Step } from '../lib/tour';

/**
 * Whether a walkthrough is being offered, running, or finished with.
 *
 * `offered` is deliberately its own state rather than the tour simply
 * starting. A walkthrough that opens over the app before anyone has asked
 * for it is a thing to get past; one that asks first is a thing to accept.
 */
export type TourStatus = 'idle' | 'offered' | 'running';

/**
 * Which walkthroughs this device has already had.
 *
 * Per device rather than per account, because the tuner works signed out and
 * there is no account to hang it on. localStorage throws in a private window,
 * so a failure degrades to remembering for this session only — the tour is
 * then offered once more next time, which is a far better failure than a
 * blank page.
 */
const seen = new Set<string>();

const key = (tour: string) => `pitch.tour.${tour}`;

function alreadySeen(tour: string): boolean {
  if (seen.has(tour)) return true;
  try {
    return window.localStorage.getItem(key(tour)) !== null;
  } catch {
    return false;
  }
}

function remember(tour: string): void {
  seen.add(tour);
  try {
    window.localStorage.setItem(key(tour), 'done');
  } catch {
    // Kept in the set above, which lasts as long as the page does.
  }
}

/** Forget these walkthroughs, so they are offered again. */
export function resetTours(tours: string[]): void {
  for (const tour of tours) {
    seen.delete(tour);
    try {
      window.localStorage.removeItem(key(tour));
    } catch {
      // Nothing to undo.
    }
  }
}

/** The element a step points at, if it is on the page and has a size. */
function findTarget(step: Step | undefined): HTMLElement | null {
  if (!step?.target) return null;

  const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? element : null;
}

export interface Tour {
  status: TourStatus;
  step: Step | null;
  /** Which step of how many, counting only the ones being shown. */
  position: number;
  total: number;
  target: HTMLElement | null;
  take: () => void;
  next: () => void;
  back: () => void;
  /** Leave, and do not offer again. */
  finish: () => void;
}

type Phase = 'waiting' | 'running' | 'aside' | 'over';

/**
 * One walkthrough.
 *
 * The status is worked out from what has happened rather than stored and
 * kept in step: whether this device has seen the tour is read once when the
 * hook is first used, and everything after that follows from whether it has
 * been taken or finished. Nothing here sets state from an effect, which is
 * what would otherwise make the offer appear a render late.
 */
export function useTour(
  name: string,
  steps: Step[],
  /** Hold the offer back until the page has something to point at. */
  ready = true,
): Tour {
  // Read once. A tour finished in this session is remembered by `finish`,
  // not by re-reading storage on every render.
  const [wasSeen] = useState(() => alreadySeen(name));
  const [phase, setPhase] = useState<Phase>('waiting');
  const [shown, setShown] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  const status: TourStatus =
    phase === 'running'
      ? 'running'
      : phase === 'waiting' && ready && !wasSeen
        ? 'offered'
        : 'idle';

  /*
   * The offer steps aside as soon as you start using the app yourself.
   *
   * It is an invitation, not a notice to be dismissed, and someone who has
   * begun pressing things has answered it. It is not remembered as seen:
   * having ignored it once is not the same as having declined it, so it is
   * offered again next visit — and the account menu has it either way.
   */
  useEffect(() => {
    if (status !== 'offered') return;

    const aside = (event: PointerEvent) => {
      const inside =
        event.target instanceof Element && event.target.closest('[data-tour-offer]');
      if (!inside) setPhase('aside');
    };

    document.addEventListener('pointerdown', aside, true);
    return () => document.removeEventListener('pointerdown', aside, true);
  }, [status]);

  const take = useCallback(() => {
    /*
     * Every step is kept, including ones whose target does not exist yet.
     * The notebook tour asks you to make a piece and then talks about the
     * editor, which is not on the page until you have. A step with nothing
     * to point at simply dims the page and speaks for itself.
     */
    setShown(steps);
    setIndex(0);
    setPhase('running');
  }, [steps]);

  const finish = useCallback(() => {
    remember(name);
    setPhase('over');
    setTarget(null);
  }, [name]);

  const step = phase === 'running' ? (shown[index] ?? null) : null;

  const next = useCallback(() => {
    if (index + 1 >= shown.length) {
      finish();
      return;
    }
    setIndex(index + 1);
  }, [finish, index, shown.length]);

  const back = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);

  /*
   * Which element this step points at can only be answered by looking at the
   * page, so it is answered after the render that put the step on screen —
   * before paint, so the spotlight never lands in the wrong place first. The
   * same answer is wanted again whenever the window resizes, since this app
   * rearranges itself a great deal with height.
   */
  useLayoutEffect(() => {
    if (!step) return;

    const resolve = () => setTarget(findTarget(step));
    resolve();

    window.addEventListener('resize', resolve);
    return () => window.removeEventListener('resize', resolve);
  }, [step]);

  return {
    status,
    step,
    position: index + 1,
    total: shown.length,
    target,
    take,
    next,
    back,
    finish,
  };
}
