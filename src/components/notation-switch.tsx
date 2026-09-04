import { TONICS, type Notation } from '../lib/notation';

interface NotationSwitchProps {
  notation: Notation;
  onNotationChange: (notation: Notation) => void;
  /** Pitch class chosen as Sa, indexed like TONICS. */
  tonic: number;
  onTonicChange: (tonic: number) => void;
}

const OPTIONS: { value: Notation; label: string }[] = [
  { value: 'western', label: 'western' },
  { value: 'sargam', label: 'sargam' },
];

/**
 * Notation selector, plus the tonic when sargam is showing.
 *
 * Sargam names degrees of a scale rather than absolute pitches, so it needs to
 * know which pitch is Sa. The selector only appears in sargam mode, where it
 * means something.
 */
export function NotationSwitch({
  notation,
  onNotationChange,
  tonic,
  onTonicChange,
}: NotationSwitchProps) {
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

      {notation === 'sargam' && (
        <label className="flex items-center gap-1.5">
          <span className="mono-label">sa</span>
          <select
            value={tonic}
            onChange={(event) => onTonicChange(Number(event.target.value))}
            aria-label="pitch of Sa"
            className="keycap keycap-pressable cursor-pointer appearance-none px-2.5 py-1.5 pr-5 text-center font-mono text-[10px] tabular-nums text-graphite hover:border-engrave"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='5'><path d='M0 0h8L4 5z' fill='%238a8a84'/></svg>\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 6px center',
            }}
          >
            {TONICS.map((name, pitchClass) => (
              <option key={name} value={pitchClass}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
