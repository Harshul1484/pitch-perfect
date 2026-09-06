import { useEffect, useRef, useState } from 'react';
import type { Notation } from '../lib/notation';
import type { RecordingSummary } from '../lib/recording';
import { RecordingReview } from './recording-review';

interface RecordControlProps {
  isRecording: boolean;
  elapsedMs: number;
  /** True unless the microphone is open. */
  disabled: boolean;
  onToggle: () => void;
  summary: RecordingSummary | null;
  tolerance: number;
  notation: Notation;
  tonic: number;
  bpm: number;
  onSave: ((title: string, notation: string) => Promise<void>) | null;
  onDiscard: () => void;
}

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Record, and review what was recorded.
 *
 * Both live in the header rather than beside the key bed. The review is a tall
 * panel and the left column could not grow to hold it without either
 * overflowing the screen or gaining a scrollbar, neither of which suits an
 * instrument meant to fit one view.
 *
 * A red dot when idle and a square when running, which is the language every
 * recorder uses, and the clock rides on the button so it needs no readout of
 * its own.
 */
export function RecordControl({
  isRecording,
  elapsedMs,
  disabled,
  onToggle,
  summary,
  tolerance,
  notation,
  tonic,
  bpm,
  onSave,
  onDiscard,
}: RecordControlProps) {
  const container = useRef<HTMLDivElement>(null);

  /**
   * A finished recording shows itself; there is nothing else to do with one.
   * Rather than opening it from an effect, which would cascade a render, the
   * panel is open unless this particular summary has been dismissed. A new
   * recording is a new object, so it opens again on its own.
   */
  const [dismissed, setDismissed] = useState<RecordingSummary | null>(null);
  const open = summary !== null && summary !== dismissed;
  const close = () => setDismissed(summary);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={isRecording}
        title={disabled ? 'Start listening first' : undefined}
        className={`keycap keycap-pressable flex h-7 items-center gap-1.5 px-2.5 font-mono text-[10px] lowercase tracking-[0.08em] hover:border-engrave short:h-6 short:px-2 active:keycap-pressed disabled:cursor-not-allowed disabled:opacity-45 ${
          isRecording
            ? 'border-graphite bg-graphite bg-none text-panel hover:bg-graphite'
            : 'text-graphite hover:bg-white'
        }`}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 bg-signal ${isRecording ? 'rounded-[1px]' : 'rounded-full'}`}
        />
        {isRecording ? (
          <span className="tabular-nums">{clock(elapsedMs)}</span>
        ) : (
          'record'
        )}
      </button>

      {open && summary !== null && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30">
          <RecordingReview
            summary={summary}
            tolerance={tolerance}
            notation={notation}
            tonic={tonic}
            bpm={bpm}
            onSave={onSave}
            onDiscard={() => {
              onDiscard();
              close();
            }}
          />
        </div>
      )}
    </div>
  );
}
