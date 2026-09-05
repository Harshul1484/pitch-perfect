import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HOLDS } from '../lib/practice';

interface PracticeControlProps {
  on: boolean;
  onToggle: () => void;
  /** How long a mark stays before fading. Null keeps it until reset. */
  holdMs: number | null;
  onHoldChange: (ms: number | null) => void;
  onReset: () => void;
  /** How many notes are remembered, so reset has a visible purpose. */
  marked: number;
  /** The notes page adds its stage and score here. */
  children?: ReactNode;
}

/*
 * Hover lives on the off state only — see the note in routes/notes.tsx.
 */
const KEY = 'keycap keycap-pressable active:keycap-pressed';
const KEY_OFF = `${KEY} hover:border-engrave hover:bg-white`;
const KEY_ON = `${KEY} border-graphite bg-graphite bg-none text-panel`;

/**
 * The practice switch, and the settings behind it.
 *
 * The switch and its panel are separate: practice keeps running when the panel
 * is closed, because the thing you actually watch is the key bed, and a panel
 * covering it would defeat the point. Same arrangement as the record button
 * and its review.
 */
export function PracticeControl({
  on,
  onToggle,
  holdMs,
  onHoldChange,
  onReset,
  marked,
  children,
}: PracticeControlProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape, as any panel like this should.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={container} className="relative flex items-stretch gap-1 short:gap-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        className={`${
          on ? KEY_ON : KEY_OFF
        } flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] short:px-2 short:py-1 short:text-[9px]`}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-[1px] ${on ? 'bg-signal' : 'bg-hairline'}`}
        />
        practice
      </button>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="practice settings"
        className={`${KEY_OFF} flex items-center px-1.5 font-mono text-[10px] leading-none text-engrave short:px-1`}
      >
        &#9662;
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="practice settings"
          className="keycap absolute right-0 top-[calc(100%+8px)] z-30 flex w-[236px] flex-col gap-3 bg-tile p-3 narrow:w-[210px] short:gap-2 short:p-2"
        >
          <div className="flex flex-col gap-1.5">
            <span className="mono-label">colour holds for</span>

            <div role="group" aria-label="colour hold" className="flex flex-wrap gap-1">
              {HOLDS.map((option) => {
                const selected = option.ms === holdMs;

                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => onHoldChange(option.ms)}
                    aria-pressed={selected}
                    className={`${
                      selected ? KEY_ON : `${KEY_OFF} text-engrave`
                    } px-2 py-1 font-mono text-[10px] lowercase tracking-[0.08em]`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <span className="mono-label normal-case">
              {holdMs === null
                ? 'Colours stay until you reset.'
                : 'Timed from when you leave the note.'}
            </span>
          </div>

          {children}

          <div className="flex items-center justify-between gap-2 border-t border-hairline-soft pt-2">
            <span className="mono-label">{marked} marked</span>
            <button
              type="button"
              onClick={onReset}
              disabled={marked === 0}
              className={`${KEY_OFF} px-2 py-1 font-mono text-[10px] lowercase tracking-[0.08em] disabled:cursor-default disabled:opacity-40`}
            >
              reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
