import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Rendered under the knob, e.g. "±10¢". */
  format: (value: number) => string;
}

/** Sweep of the indicator, in degrees either side of vertical. */
const SWEEP = 135;
/** Pixels of vertical drag to travel the whole range. */
const DRAG_RANGE = 160;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A machined control knob. Turning is done by dragging vertically or with the
 * arrow keys — it reports as a slider to assistive technology, because that is
 * what it behaves like.
 */
export function Knob({ label, value, min, max, step, onChange, format }: KnobProps) {
  const dragStart = useRef<{ y: number; value: number } | null>(null);

  const fraction = (value - min) / (max - min);
  const angle = -SWEEP + fraction * SWEEP * 2;

  const quantise = useCallback(
    (raw: number) => clamp(Math.round(raw / step) * step, min, max),
    [max, min, step],
  );

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { y: event.clientY, value };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    // Up increases, matching how a physical knob reads.
    const travelled = (dragStart.current.y - event.clientY) / DRAG_RANGE;
    onChange(quantise(dragStart.current.value + travelled * (max - min)));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragStart.current = null;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta =
      event.key === 'ArrowUp' || event.key === 'ArrowRight'
        ? step
        : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
          ? -step
          : event.key === 'Home'
            ? min - value
            : event.key === 'End'
              ? max - value
              : 0;

    if (delta === 0) return;
    event.preventDefault();
    onChange(quantise(value + delta));
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="keycap relative h-11 w-11 cursor-ns-resize touch-none rounded-full outline-none focus-visible:border-graphite"
      >
        {/* Fine concentric machining. */}
        <span className="pointer-events-none absolute inset-[5px] rounded-full border border-hairline/70" />
        <span className="pointer-events-none absolute inset-[9px] rounded-full border border-hairline/50" />

        {/* The indicator line. */}
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 h-[15px] w-[1.5px] origin-bottom -translate-x-1/2 rounded-full bg-graphite"
          style={{ transform: `translateX(-50%) translateY(-100%) rotate(${angle}deg)` }}
        />
      </div>

      <span className="mono-label">{label}</span>
      <span className="font-mono text-[10px] tabular-nums text-graphite">
        {format(value)}
      </span>
    </div>
  );
}
