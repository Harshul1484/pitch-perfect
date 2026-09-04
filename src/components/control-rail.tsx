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
}

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
}: ControlRailProps) {
  return (
    <aside className="keycap relative flex w-[108px] shrink-0 flex-col items-center gap-4 bg-tile p-3">
      <Tooltip label="output level for keys and click" side="right">
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
    </aside>
  );
}
