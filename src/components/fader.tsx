interface FaderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

/** Scale ticks beside the travel, longer every fifth mark. */
const TICKS = Array.from({ length: 21 }, (_, index) => index);

const SLOT_HEIGHT = 132;
const SLOT_PADDING = 10;
/** Travel is inset from the slot ends so the thumb never meets the corners. */
const TRAVEL = SLOT_HEIGHT - SLOT_PADDING * 2;

const THUMB =
  '[&::-moz-range-thumb]:h-[22px] [&::-moz-range-thumb]:w-[11px] [&::-moz-range-thumb]:rounded-[3px] [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-graphite [&::-moz-range-thumb]:bg-panel ' +
  '[&::-webkit-slider-thumb]:h-[22px] [&::-webkit-slider-thumb]:w-[11px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-[3px] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-graphite [&::-webkit-slider-thumb]:bg-panel';

/**
 * A vertical fader with an engraved scale, after the level slider on the
 * reference hardware.
 *
 * The slot deliberately does not clip: an `overflow-hidden` here shaves the
 * corners off the thumb when it reaches either end of the travel.
 */
export function Fader({ label, value, onChange }: FaderProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-stretch gap-1.5" style={{ height: SLOT_HEIGHT }}>
        {/* Engraved scale. */}
        <div aria-hidden="true" className="flex w-3 flex-col justify-between py-[9px]">
          {TICKS.map((tick) => (
            <span
              key={tick}
              className={`h-px self-end bg-engrave/45 ${tick % 5 === 0 ? 'w-3' : 'w-1.5'}`}
            />
          ))}
        </div>

        <div className="keycap relative w-7 rounded-[7px]">
          {/* Recessed groove, with the floor of the range marked in signal red. */}
          <span
            aria-hidden="true"
            className="absolute left-1/2 w-[7px] -translate-x-1/2 overflow-hidden rounded-full border border-hairline-soft bg-recess"
            style={{ top: SLOT_PADDING, height: TRAVEL }}
          >
            <span
              className="absolute inset-x-0 bottom-0 h-[9px] transition-opacity duration-200"
              style={{
                backgroundColor: 'var(--color-signal)',
                opacity: value === 0 ? 1 : 0.3,
              }}
            />
          </span>

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            aria-label={label}
            style={{ width: TRAVEL }}
            className={`absolute left-1/2 top-1/2 h-7 -translate-x-1/2 -translate-y-1/2 -rotate-90 cursor-ns-resize appearance-none bg-transparent outline-none focus-visible:ring-1 focus-visible:ring-graphite ${THUMB}`}
          />
        </div>
      </div>

      <span className="mono-label">{label}</span>
      <span className="font-mono text-[10px] tabular-nums text-graphite">{value}</span>
    </div>
  );
}
