interface CentsMeterProps {
  /** Deviation from the note in cents, or null when nothing is sounding. */
  cents: number | null;
  tolerance: number;
}

const RANGE = 50;
/** Engraved scale marks across the travel. */
const TICKS = Array.from({ length: 21 }, (_, index) => index - 10);

/**
 * An analog deviation meter. Centre is in tune, left flat, right sharp — the
 * convention every physical tuner uses.
 */
export function CentsMeter({ cents, tolerance }: CentsMeterProps) {
  const inTune = cents !== null && Math.abs(cents) <= tolerance;
  const clamped = cents === null ? 0 : Math.max(-RANGE, Math.min(RANGE, cents));
  const offset = 50 + (clamped / RANGE) * 50;
  const windowWidth = (tolerance / RANGE) * 100;

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="keycap relative flex-1 overflow-hidden bg-recess">
        {/* The in-tune window, so "close enough" is visible, not just numeric. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 bg-intune/10 transition-all duration-200"
          style={{ left: `${50 - windowWidth / 2}%`, width: `${windowWidth}%` }}
        />

        {/* Engraved scale. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 flex justify-between px-2 pt-1.5"
        >
          {TICKS.map((tick) => (
            <span
              key={tick}
              className={`w-px bg-engrave/45 ${
                tick === 0 ? 'h-3.5' : tick % 5 === 0 ? 'h-2.5' : 'h-1.5'
              }`}
            />
          ))}
        </span>

        {/* Centre line. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-graphite/25"
        />

        {/* The needle. */}
        {cents !== null && (
          <span
            aria-hidden="true"
            className={`absolute bottom-1.5 top-5 w-[2px] rounded-full transition-[left] duration-150 ease-out ${
              inTune ? 'bg-intune' : 'bg-signal'
            }`}
            style={{ left: `${offset}%`, transform: 'translateX(-50%)' }}
          />
        )}
      </div>

      <div className="flex h-3 items-center justify-between leading-3">
        <span className="mono-label">−50</span>
        <span
          className={`font-mono text-[11px] tabular-nums ${
            cents === null ? 'text-engrave' : inTune ? 'text-intune' : 'text-signal'
          }`}
        >
          {cents === null
            ? 'flat / sharp'
            : inTune
              ? 'in tune'
              : `${cents > 0 ? '+' : ''}${cents}¢ ${cents > 0 ? 'sharp' : 'flat'}`}
        </span>
        <span className="mono-label">+50</span>
      </div>
    </div>
  );
}
