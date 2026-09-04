import type { Swara as SwaraType } from '../lib/notation';

/**
 * A swara in Bhatkhande notation: komal underlined, tivra Ma overlined, and
 * saptak marked with dots below (mandra) or above (taar).
 *
 * Drawn rather than written with combining diacritics, which attach to a
 * single character and would sit under only the "R" of "Re".
 *
 * The dot rows are always present, even when empty. Reserving the space keeps
 * a komal underline from colliding with a mandra dot, keeps dots off the
 * frequency line beneath, and stops the label shifting as the saptak changes.
 *
 * Dots stop at two. Beyond ati-mandra and ati-taar the convention runs out and
 * this key bed spans nine octaves — the row legend carries the octave number.
 */
export function Swara({
  swara,
  className = '',
}: {
  swara: SwaraType;
  className?: string;
}) {
  const dots = Math.min(Math.abs(swara.saptak), 2);
  const above = swara.saptak > 0 ? dots : 0;
  const below = swara.saptak < 0 ? dots : 0;

  const line = swara.komal
    ? 'underline decoration-[1.2px] underline-offset-[2px]'
    : swara.tivra
      ? 'overline decoration-[1.2px]'
      : '';

  return (
    <span className={`inline-flex flex-col items-center leading-none ${className}`}>
      <Dots count={above} />
      <span className={line}>{swara.text}</span>
      <Dots count={below} />
    </span>
  );
}

/** A fixed-height row, so the glyph never moves whether dots are drawn or not. */
function Dots({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-[5px] items-center justify-center gap-[2px]"
    >
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="h-[2px] w-[2px] rounded-full bg-current" />
      ))}
    </span>
  );
}
