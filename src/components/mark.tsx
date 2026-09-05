/**
 * The product mark: three bars rising to a red one.
 *
 * It is the pitch meter, small enough to sign a page with — the same shape the
 * app draws when you are sharp, and the same single accent the rest of the
 * panel is allowed. Drawn from spans rather than an SVG so it inherits the
 * palette and needs no asset.
 *
 * Sized with classes rather than inline heights so it can stand down on a
 * phone, where the header has no pixels to spare and the mark would otherwise
 * be taller than the title beside it.
 */
const BARS = {
  sm: ['h-[6px]', 'h-[9px]', 'h-[13px]'],
  md: ['h-[8px] short:h-[6px]', 'h-[12px] short:h-[9px]', 'h-[17px] short:h-[13px]'],
  lg: ['h-[10px]', 'h-[16px]', 'h-[22px]'],
};

const WIDTH = {
  sm: 'w-[2px]',
  md: 'w-[3px] short:w-[2px]',
  lg: 'w-[4px]',
};

export function Mark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-end gap-[2px]">
      {BARS[size].map((height, index) => (
        <span
          key={height}
          className={`rounded-[1px] ${height} ${WIDTH[size]} ${
            index === 2 ? 'bg-signal' : 'bg-graphite'
          }`}
        />
      ))}
    </span>
  );
}
