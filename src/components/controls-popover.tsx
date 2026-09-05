import { useEffect, useRef, useState } from 'react';
import { TONICS } from '../lib/notation';
import { Knob } from './knob';

interface ControlsPopoverProps {
  tolerance: number;
  onToleranceChange: (value: number) => void;
  sustain: number;
  onSustainChange: (value: number) => void;
  tonic: number;
  onTonicChange: (tonic: number) => void;
  droneOn: boolean;
  onDroneToggle: () => void;
}

const KEY =
  'keycap keycap-pressable hover:border-engrave hover:bg-white active:keycap-pressed';

const SELECT_ARROW =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='5'><path d='M0 0h8L4 5z' fill='%238a8a84'/></svg>\")";

/**
 * The settings that are set once and then left alone: tolerance, sustain,
 * tonic and the drone.
 *
 * There is no output level here on purpose. The operating system already has
 * a volume control that people know how to reach, and duplicating it would
 * only create two places to look when something is too quiet.
 *
 * They used to occupy a permanent rail beside the key bed, which spent a
 * column of the screen on controls that are touched rarely. Folded away here,
 * the instrument itself gets the room.
 */
export function ControlsPopover(props: ControlsPopoverProps) {
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
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`${KEY} flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] ${
          props.droneOn ? 'text-graphite' : 'text-engrave'
        }`}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-[1px] ${
            props.droneOn ? 'bg-signal' : 'bg-hairline'
          }`}
        />
        controls
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="controls"
          className="keycap absolute right-0 top-[calc(100%+8px)] z-30 flex w-[248px] gap-4 bg-tile p-4"
        >
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex gap-4">
              <Knob
                label="tolerance"
                value={props.tolerance}
                min={2}
                max={30}
                step={1}
                onChange={props.onToleranceChange}
                format={(cents) => `${cents}c`}
              />
              <Knob
                label="sustain"
                value={props.sustain}
                min={2}
                max={30}
                step={1}
                onChange={props.onSustainChange}
                format={(tenths) => `${(tenths / 10).toFixed(1)}s`}
              />
            </div>

            <span aria-hidden="true" className="h-px w-full bg-hairline-soft" />

            <label className="flex items-center justify-between gap-2">
              <span className="mono-label">tonic</span>
              <select
                value={props.tonic}
                onChange={(event) => props.onTonicChange(Number(event.target.value))}
                aria-label="tonic"
                className="keycap keycap-pressable w-[86px] cursor-pointer appearance-none py-1.5 pl-2.5 pr-5 text-center font-mono text-[11px] tabular-nums text-graphite hover:border-engrave"
                style={{
                  backgroundImage: SELECT_ARROW,
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

            <button
              type="button"
              onClick={props.onDroneToggle}
              aria-pressed={props.droneOn}
              className={`${KEY} flex h-9 w-full items-center justify-center gap-1.5 text-[12px] font-medium lowercase tracking-wide ${
                props.droneOn
                  ? 'border-graphite bg-graphite bg-none text-panel hover:bg-graphite'
                  : ''
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-[1px] ${
                  props.droneOn ? 'bg-signal' : 'bg-hairline'
                }`}
              />
              drone
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
