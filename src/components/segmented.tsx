interface SegmentedProps<T extends string> {
  /** Names the group for assistive technology; the caller draws the label. */
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}

/* Hover lives on the off state only — see the note in routes/notes.tsx. */
const KEY = 'keycap keycap-pressable active:keycap-pressed';
const KEY_OFF = `${KEY} hover:border-engrave hover:bg-white`;
const KEY_ON = `${KEY} border-graphite bg-graphite bg-none text-panel`;

/**
 * A two-or-three way switch of keycaps.
 *
 * Shared by notation and voice so the two read as the same kind of choice,
 * rather than each inventing its own control.
 *
 * It draws no label of its own. Every one of these now sits in a settings grid
 * that puts the labels in their own column, and a component that also printed
 * one would break the column it was sitting in.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {options.map((option) => {
        const active = option === value;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={active}
            className={`${
              active ? KEY_ON : `${KEY_OFF} text-engrave`
            } px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em]`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
