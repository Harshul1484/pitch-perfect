import { IN_TUNE_CENTS } from '../lib/notes';

interface CentsMeterProps {
  /** Deviation from the note in cents, or null when nothing is sounding. */
  cents: number | null;
}

const RANGE = 50;

/**
 * A needle showing how far off the note is. Centre is in tune, left is flat,
 * right is sharp — the convention every physical tuner uses.
 */
export function CentsMeter({ cents }: CentsMeterProps) {
  const inTune = cents !== null && Math.abs(cents) <= IN_TUNE_CENTS;
  const clamped = cents === null ? 0 : Math.max(-RANGE, Math.min(RANGE, cents));
  const offset = 50 + (clamped / RANGE) * 50;

  return (
    <div>
      <div className="relative h-10 overflow-hidden rounded-lg bg-black/5">
        {/* The in-tune window, so "close enough" is visible, not just numeric. */}
        <div
          className="absolute inset-y-0 bg-intune/15"
          style={{
            left: `${50 - (IN_TUNE_CENTS / RANGE) * 50}%`,
            width: `${(IN_TUNE_CENTS / RANGE) * 100}%`,
          }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-black/20" />

        {cents !== null && (
          <div
            className={`absolute inset-y-1 w-1 rounded-full transition-all duration-75 ${
              inTune ? 'bg-intune' : 'bg-offtune'
            }`}
            style={{ left: `${offset}%`, transform: 'translateX(-50%)' }}
          />
        )}
      </div>

      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted">
        <span>−50¢</span>
        <span>
          {cents === null
            ? 'flat / sharp'
            : inTune
              ? 'in tune'
              : `${cents > 0 ? '+' : ''}${cents}¢ ${cents > 0 ? 'sharp' : 'flat'}`}
        </span>
        <span>+50¢</span>
      </div>
    </div>
  );
}
