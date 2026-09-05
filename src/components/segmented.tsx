interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}

/**
 * A two-or-three way switch of keycaps.
 *
 * Shared by notation and voice so the two read as the same kind of choice,
 * rather than each inventing its own control.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="flex items-center gap-1.5">
      {/*
       * The label goes on a phone. The caps themselves read "western" and
       * "sargam", so it is a heading for something already legible, and the
       * group keeps its accessible name either way.
       */}
      <span className="mono-label narrow:hidden">{label}</span>
      <div role="group" aria-label={label} className="flex gap-1">
        {options.map((option) => {
          const active = option === value;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={active}
              className={`keycap keycap-pressable px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] hover:border-engrave active:keycap-pressed ${
                active
                  ? 'border-graphite bg-graphite bg-none text-panel hover:bg-graphite'
                  : 'text-engrave hover:bg-white'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
