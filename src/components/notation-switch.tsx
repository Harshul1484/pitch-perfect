import type { Notation } from '../lib/notation';

interface NotationSwitchProps {
  notation: Notation;
  onNotationChange: (notation: Notation) => void;
}

const OPTIONS: { value: Notation; label: string }[] = [
  { value: 'western', label: 'western' },
  { value: 'sargam', label: 'sargam' },
];

/**
 * Notation selector.
 *
 * The tonic itself lives on the control rail, because it is also the drone's
 * root and so matters in both notations.
 */
export function NotationSwitch({ notation, onNotationChange }: NotationSwitchProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <span className="mono-label">notation</span>
        <div role="group" aria-label="notation" className="flex gap-1">
          {OPTIONS.map((option) => {
            const active = notation === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onNotationChange(option.value)}
                aria-pressed={active}
                className={`keycap keycap-pressable px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] hover:border-engrave active:keycap-pressed ${
                  active
                    ? 'border-graphite bg-graphite bg-none text-panel hover:bg-graphite'
                    : 'text-engrave hover:bg-white'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
