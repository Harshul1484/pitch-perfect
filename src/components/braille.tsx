/**
 * Braille digits, used the way the reference hardware uses them: as quiet
 * metadata engraved beside a label, readable if you know the code and simply
 * texture if you do not.
 *
 * A cell is two columns of three dots. Dots 1-3 run down the left column,
 * 4-6 down the right.
 */
const DIGIT_DOTS: Record<string, number[]> = {
  0: [2, 4, 5],
  1: [1],
  2: [1, 2],
  3: [1, 4],
  4: [1, 4, 5],
  5: [1, 5],
  6: [1, 2, 4],
  7: [1, 2, 4, 5],
  8: [1, 2, 5],
  9: [2, 4],
};

const CELL = [1, 2, 3, 4, 5, 6];

interface BrailleDigitProps {
  digit: string;
  className?: string;
}

export function BrailleDigit({ digit, className = '' }: BrailleDigitProps) {
  const raised = DIGIT_DOTS[digit] ?? [];

  return (
    <span
      aria-hidden="true"
      className={`grid grid-flow-col grid-rows-3 gap-[2px] ${className}`}
    >
      {CELL.map((dot) => (
        <span
          key={dot}
          className={`h-[2px] w-[2px] rounded-full ${
            raised.includes(dot) ? 'bg-engrave' : 'bg-transparent'
          }`}
        />
      ))}
    </span>
  );
}

/** Renders each character of a number as its own braille cell. */
export function BrailleNumber({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex gap-[3px] ${className}`} aria-hidden="true">
      {String(value)
        .split('')
        .map((digit, index) => (
          <BrailleDigit key={`${digit}-${index}`} digit={digit} />
        ))}
    </span>
  );
}
