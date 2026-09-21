import { useState } from 'react';

interface NumberFieldProps {
  /** Names the field for assistive technology; the caller draws the label. */
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  className?: string;
}

/**
 * A number you type.
 *
 * The whole of this component is one rule: do not correct a number while it is
 * still being typed. Every field in the app used to clamp on each keystroke,
 * which is fine for the last digit and wrong for all the ones before it — a
 * tempo of 100 was unreachable, because the "1" was corrected to 30 and the
 * "0" after it made 300, which was corrected to 260.
 *
 * So the raw text is kept while the field is being edited and the number is
 * only handed over once it is a number the caller can accept. Anything still
 * out of range is clamped when you leave the field or press Enter, which is
 * the point at which you have said you are finished.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  className = '',
}: NumberFieldProps) {
  /** What is in the box, while it differs from the value behind it. */
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const typed = draft === null ? value : Number(draft);

    // An empty box is not zero, and not the minimum either: it is someone
    // part-way through retyping. Leaving it gives the old value back.
    if (draft !== null && (draft.trim() === '' || !Number.isFinite(typed))) {
      setDraft(null);
      return;
    }

    onChange(Math.min(max, Math.max(min, typed)));
    setDraft(null);
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft ?? value}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);

        // In range already, so there is nothing to correct and the rest of the
        // app can follow along as it is typed. The text stays as it was typed:
        // "1." is worth 1 but is not finished, and rewriting it to "1" would
        // take the decimal point away again.
        const typed = Number(text);
        if (
          text.trim() !== '' &&
          Number.isFinite(typed) &&
          typed >= min &&
          typed <= max
        ) {
          onChange(typed);
        }
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
      }}
      aria-label={label}
      className={`keycap bg-panel px-2 py-1.5 text-center font-mono text-[13px] tabular-nums outline-none focus:border-graphite ${className}`}
    />
  );
}
