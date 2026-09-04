interface FaderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

/** Scale ticks beside the travel, longer every fifth mark. */
const TICKS = Array.from({ length: 21 }, (_, index) => index);

/**
 * A vertical fader with an engraved scale, after the volume slider on the
 * reference hardware. Native range input underneath, so keyboard and
 * assistive technology work without reimplementing them.
 */
export function Fader({ label, value, onChange }: FaderProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-[132px] items-stretch gap-1.5">
        {/* Engraved scale. */}
        <div
          aria-hidden="true"
          className="flex w-3 flex-col justify-between py-[6px]"
        >
          {TICKS.map((tick) => (
            <span
              key={tick}
              className={`h-px self-end bg-engrave/50 ${tick % 5 === 0 ? 'w-3' : 'w-1.5'}`}
            />
          ))}
        </div>

        {/* Travel slot. The bottom of the range is marked in signal red, the
            way a level meter marks its floor. */}
        <div className="keycap relative w-7 overflow-hidden rounded-[6px]">
          <span
            aria-hidden="true"
            className="absolute inset-x-[9px] bottom-[8px] top-[8px] rounded-full bg-recess"
          />
          <span
            aria-hidden="true"
            className="absolute inset-x-[9px] bottom-[8px] h-3 rounded-full bg-signal"
            style={{ opacity: value === 0 ? 1 : 0.25 }}
          />

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            aria-label={label}
            className="absolute left-1/2 top-1/2 h-7 w-[132px] -translate-x-1/2 -translate-y-1/2 -rotate-90 cursor-ns-resize appearance-none bg-transparent outline-none [&::-moz-range-thumb]:h-[9px] [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-[3px] [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-graphite [&::-moz-range-thumb]:bg-panel [&::-webkit-slider-thumb]:h-[9px] [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-[3px] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-graphite [&::-webkit-slider-thumb]:bg-panel"
          />
        </div>
      </div>

      <span className="mono-label">{label}</span>
      <span className="font-mono text-[10px] tabular-nums text-graphite">{value}</span>
    </div>
  );
}
