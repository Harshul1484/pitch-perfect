interface PitchMeterProps {
  /** Cents off the nearest note, or null when nothing is sounding. */
  cents: number | null;
  tolerance: number;
}

const RANGE = 50;
/** Scale marks across the track, longer every fifth. */
const TICKS = Array.from({ length: 21 }, (_, index) => index);

/**
 * The deviation meter.
 *
 * Flat to the left and sharp to the right, which is what every physical tuner
 * does — worth following even though the key bed stacks pitch vertically,
 * because this is the convention a player already reads without thinking.
 *
 * The track carries a minimum size rather than being purely flexible: on a
 * short window there was no room left over and the meter collapsed to a sliver.
 */
export function PitchMeter({ cents, tolerance }: PitchMeterProps) {
  const sounding = cents !== null;
  const inTune = sounding && Math.abs(cents) <= tolerance;

  const clamped = sounding ? Math.max(-RANGE, Math.min(RANGE, cents)) : 0;
  const needle = 50 + (clamped / RANGE) * 50;
  const bandWidth = (tolerance / RANGE) * 100;

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span aria-hidden="true" className="text-[12px] leading-none text-engrave">
          &#9837;
        </span>

        <div className="relative h-11 min-w-0 flex-1 overflow-hidden rounded-[4px] border border-hairline bg-panel short:h-7">
          {/* Ticks along both edges. */}
          {(['top-0', 'bottom-0'] as const).map((edge) => (
            <span
              key={edge}
              aria-hidden="true"
              className={`absolute inset-x-0 flex h-2.5 justify-between px-1.5 short:h-1.5 ${edge}`}
            >
              {TICKS.map((tick) => (
                <span
                  key={tick}
                  className={`w-px bg-engrave/40 ${tick % 5 === 0 ? 'h-2.5 short:h-1.5' : 'h-1.5 short:h-1'} ${
                    edge === 'bottom-0' ? 'self-end' : ''
                  }`}
                />
              ))}
            </span>
          ))}

          {/* The in-tune window, so close enough has a visible size. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 border-x border-intune/30 bg-intune/15 transition-all duration-200"
            style={{ left: `${50 - bandWidth / 2}%`, width: `${bandWidth}%` }}
          />

          {/* Dead centre. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-2.5 left-1/2 w-px -translate-x-1/2 bg-graphite/25 short:inset-y-1.5"
          />

          {/* The needle. */}
          {sounding && (
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 w-0.5 -translate-x-1/2 transition-[left] duration-100 ease-out ${
                inTune ? 'bg-intune' : 'bg-signal'
              }`}
              style={{ left: `${needle}%` }}
            />
          )}
        </div>

        <span aria-hidden="true" className="text-[12px] leading-none text-engrave">
          &#9839;
        </span>
      </div>

      <div className="flex items-center justify-between px-3">
        <span className="mono-label">&minus;{tolerance}</span>
        <span
          className={`font-mono text-[10px] leading-3 tabular-nums ${
            !sounding ? 'text-engrave' : inTune ? 'text-intune' : 'text-signal'
          }`}
        >
          {!sounding ? '––' : inTune ? 'ok' : `${cents > 0 ? '+' : ''}${cents}`}
        </span>
        <span className="mono-label">+{tolerance}</span>
      </div>
    </div>
  );
}
