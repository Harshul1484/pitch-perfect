import { TONICS } from '../lib/notation';
import { Fader } from './fader';
import { Knob } from './knob';
import { Tooltip } from './tooltip';

interface ControlRailProps {
  volume: number;
  onVolumeChange: (value: number) => void;
  tolerance: number;
  onToleranceChange: (value: number) => void;
  sustain: number;
  onSustainChange: (value: number) => void;
  /** Pitch class used as Sa in sargam and as the drone's root. */
  tonic: number;
  onTonicChange: (tonic: number) => void;
  droneOn: boolean;
  onDroneToggle: () => void;
}

const SELECT_ARROW =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='5'><path d='M0 0h8L4 5z' fill='%238a8a84'/></svg>\")";

/**
 * The control rail. Every control here does something — a control that moved
 * nothing would be decoration, which this design language has no room for.
 */
export function ControlRail({
  volume,
  onVolumeChange,
  tolerance,
  onToleranceChange,
  sustain,
  onSustainChange,
  tonic,
  onTonicChange,
  droneOn,
  onDroneToggle,
}: ControlRailProps) {
  return (
    <aside className="keycap relative flex min-h-0 w-[108px] shrink-0 flex-col items-center gap-3 bg-tile p-3">
      <Tooltip label="output level for keys, click and drone" side="right">
        <Fader label="level" value={volume} onChange={onVolumeChange} />
      </Tooltip>

      <span aria-hidden="true" className="h-px w-full shrink-0 bg-hairline-soft" />

      <Tooltip label="how close counts as in tune" side="right">
        <Knob
          label="tolerance"
          value={tolerance}
          min={2}
          max={30}
          step={1}
          onChange={onToleranceChange}
          format={(cents) => `${cents}c`}
        />
      </Tooltip>

      <Tooltip label="how long a clicked key rings" side="right">
        <Knob
          label="sustain"
          value={sustain}
          min={2}
          max={30}
          step={1}
          onChange={onSustainChange}
          format={(tenths) => `${(tenths / 10).toFixed(1)}s`}
        />
      </Tooltip>

      {/*
        Drone, at the foot of the rail. A sustained tonic is how Indian
        classical practice is done, and it doubles as a tuning reference for
        any scordatura.
      */}
      <div className="mt-auto flex w-full shrink-0 flex-col items-center gap-2 border-t border-hairline-soft pt-2.5">
        <label className="flex w-full flex-col items-center gap-1">
          <span className="mono-label">tonic</span>
          <Tooltip label="root for the drone, and Sa in sargam" side="right" className="w-full">
            <select
              value={tonic}
              onChange={(event) => onTonicChange(Number(event.target.value))}
              aria-label="tonic"
              className="keycap keycap-pressable w-full cursor-pointer appearance-none py-1.5 pl-2.5 pr-5 text-center font-mono text-[11px] tabular-nums text-graphite hover:border-engrave"
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
          </Tooltip>
        </label>

        <Tooltip label="sustained tonic, fifth and octave" side="right" className="w-full">
          <button
            type="button"
            onClick={onDroneToggle}
            aria-pressed={droneOn}
            className={`keycap keycap-pressable flex h-9 w-full items-center justify-center gap-1.5 text-[12px] font-medium lowercase tracking-wide hover:border-engrave active:keycap-pressed ${
              droneOn
                ? 'border-graphite bg-graphite bg-none text-panel hover:bg-graphite'
                : 'hover:bg-white'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-[1px] ${
                droneOn ? 'bg-signal' : 'bg-hairline'
              }`}
            />
            drone
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
