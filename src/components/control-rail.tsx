import { Fader } from './fader';
import { Knob } from './knob';
import { SpeakerGrille } from './speaker-grille';

interface ControlRailProps {
  volume: number;
  onVolumeChange: (value: number) => void;
  tolerance: number;
  onToleranceChange: (value: number) => void;
  sustain: number;
  onSustainChange: (value: number) => void;
  isLive: boolean;
}

/**
 * The control rail. Every control here does something — a fader that moved
 * nothing would be decoration, which this design language has no room for.
 */
export function ControlRail({
  volume,
  onVolumeChange,
  tolerance,
  onToleranceChange,
  sustain,
  onSustainChange,
  isLive,
}: ControlRailProps) {
  return (
    <aside className="keycap relative flex w-[108px] shrink-0 flex-col items-center gap-4 overflow-hidden bg-tile p-3">
      <Fader label="level" value={volume} onChange={onVolumeChange} />

      <span aria-hidden="true" className="h-px w-full shrink-0 bg-hairline-soft" />

      <Knob
        label="tolerance"
        value={tolerance}
        min={2}
        max={30}
        step={1}
        onChange={onToleranceChange}
        format={(cents) => `${cents}c`}
      />

      <Knob
        label="sustain"
        value={sustain}
        min={2}
        max={30}
        step={1}
        onChange={onSustainChange}
        format={(tenths) => `${(tenths / 10).toFixed(1)}s`}
      />

      <SpeakerGrille muted={volume === 0} />

      {/*
        A dark recessed block closing the rail, echoing the dark corner on the
        reference hardware and giving the composition one anchor of contrast.
      */}
      <div className="-mx-3 -mb-3 mt-auto flex w-[calc(100%+1.5rem)] flex-col gap-1.5 border-t border-graphite bg-graphite px-3 py-2.5">
        <span className="mono-label text-panel/40">status</span>

        <div className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-[1px] transition-colors duration-200 ${
              isLive ? 'bg-signal' : 'bg-panel/25'
            }`}
          />
          <span className="font-mono text-[10px] lowercase text-panel/70">
            {isLive ? 'mic' : 'off'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-[1px] ${volume > 0 ? 'bg-panel' : 'bg-panel/25'}`}
          />
          <span className="font-mono text-[10px] lowercase text-panel/70">
            {volume > 0 ? 'out' : 'mute'}
          </span>
        </div>
      </div>
    </aside>
  );
}
