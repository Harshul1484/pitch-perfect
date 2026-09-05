import { BEATS_PER_BAR, MAX_BPM, MIN_BPM, clampBpm } from '../lib/metronome';

interface MetronomePanelProps {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  isRunning: boolean;
  beat: number | null;
  onToggle: () => void;
  /** True when the microphone is open, which speakers can interfere with. */
  micOpen: boolean;
}

const BEATS = Array.from({ length: BEATS_PER_BAR }, (_, index) => index);

/**
 * Four-four metronome. The downbeat is accented as a bell and as a taller,
 * red marker, so the bar reads at a glance without counting.
 */
export function MetronomePanel({
  bpm,
  onBpmChange,
  isRunning,
  beat,
  onToggle,
  micOpen,
}: MetronomePanelProps) {
  return (
    <div className="keycap flex w-[170px] shrink-0 flex-col gap-2 bg-tile p-3">
      <div className="flex h-3 items-center justify-between">
        <span className="mono-label">metronome</span>
        <span className="mono-label">4/4</span>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="number"
          min={MIN_BPM}
          max={MAX_BPM}
          step={1}
          value={bpm}
          onChange={(event) => onBpmChange(clampBpm(Number(event.target.value)))}
          aria-label="tempo"
          className="keycap w-[68px] bg-panel px-2 py-1.5 text-center font-mono text-[13px] tabular-nums outline-none focus:border-graphite"
        />
        <span className="mono-label">bpm</span>
      </label>

      <div className="flex flex-1 items-center gap-3">
        <div className="flex flex-1 flex-col gap-2">
          {/* Beat lights. The downbeat is taller and turns signal red. */}
          <div
            className="flex h-5 items-end gap-1.5"
            role="status"
            aria-live="off"
            aria-label={
              isRunning && beat !== null
                ? `beat ${beat + 1} of ${BEATS_PER_BAR}`
                : 'metronome stopped'
            }
          >
            {BEATS.map((index) => {
              const lit = isRunning && beat === index;
              const accent = index === 0;

              return (
                <span
                  key={index}
                  data-beat={index}
                  data-lit={lit ? 'true' : 'false'}
                  className={`flex-1 rounded-[2px] border transition-colors duration-75 ${
                    accent ? 'h-5' : 'h-3.5'
                  } ${
                    lit
                      ? accent
                        ? 'border-signal bg-signal'
                        : 'border-graphite bg-graphite'
                      : 'border-hairline bg-recess'
                  }`}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={onToggle}
            aria-pressed={isRunning}
            className={`keycap keycap-pressable flex h-9 items-center justify-center text-[12px] font-medium lowercase tracking-wide hover:border-engrave active:keycap-pressed ${
              isRunning
                ? 'border-graphite bg-graphite bg-none text-panel hover:bg-graphite'
                : 'hover:bg-white'
            }`}
          >
            {isRunning ? 'stop' : 'start'}
          </button>
        </div>
      </div>

      <p
        className={`mono-label h-3 leading-3 ${
          isRunning && micOpen ? 'text-signal' : 'text-engrave/0'
        }`}
      >
        headphones advised
      </p>
    </div>
  );
}
