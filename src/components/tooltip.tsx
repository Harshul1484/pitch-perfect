import type { ReactNode } from 'react';

type Side = 'top' | 'right' | 'bottom';

interface TooltipProps {
  /** What the control does, in plain lowercase. */
  label: string;
  side?: Side;
  /** Applied to the wrapper, so it can fill a grid cell. */
  className?: string;
  children: ReactNode;
}

const PLACEMENT: Record<Side, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
};

const ARROW: Record<Side, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 -mt-[3px]',
  right: 'right-full top-1/2 -translate-y-1/2 -mr-[3px]',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-[3px]',
};

/**
 * A hover and focus hint, styled as an engraved dark label so it reads as part
 * of the instrument rather than a browser affordance.
 *
 * Marked aria-hidden on purpose: every control it wraps already carries its
 * own accessible name, and announcing the same thing twice is worse than not
 * announcing it. The tooltip is a visual convenience, not the label.
 */
export function Tooltip({ label, side = 'top', className = '', children }: TooltipProps) {
  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}

      <span
        aria-hidden="true"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-[6px] border border-graphite bg-graphite px-2 py-1 font-mono text-[10px] lowercase leading-none tracking-[0.06em] text-panel opacity-0 shadow-[0_2px_6px_rgba(43,43,43,0.18)] transition-[opacity,transform] duration-200 ease-out group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${PLACEMENT[side]}`}
      >
        {label}
        <span
          className={`absolute h-[6px] w-[6px] rotate-45 border-b border-r border-graphite bg-graphite ${ARROW[side]}`}
        />
      </span>
    </span>
  );
}
