import type { PitchMatch } from '../lib/notes';
import type { ListenStatus } from '../hooks/use-pitch-detection';
import { CentsMeter } from './cents-meter';

interface NowPlayingProps {
  status: ListenStatus;
  match: PitchMatch | null;
  frequency: number | null;
  error: string | null;
  tolerance: number;
  onStart: () => void;
  onStop: () => void;
}

/**
 * The readout. Sticks to the top of the page so the note being played is
 * always in view, however far down the key bed its tile happens to sit.
 *
 * All three columns share one structure — a label row, a stretching body, and
 * a footnote row — so their tops, bodies and baselines line up exactly.
 */
export function NowPlaying({
  status,
  match,
  frequency,
  error,
  tolerance,
  onStart,
  onStop,
}: NowPlayingProps) {
  const live = status === 'listening';
  const starting = status === 'starting';
  const inTune = match !== null && Math.abs(match.cents) <= tolerance;

  return (
    <div className="flex min-w-0 flex-1">
      <div className="keycap relative flex flex-1 flex-col justify-center bg-tile p-3">
        <div className="flex items-stretch gap-4">
          {/* Note display. */}
          <div className="flex w-[132px] shrink-0 flex-col gap-2">
            <span className="mono-label h-3 leading-3">note</span>
            <span
              className={`flex flex-1 items-center text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums transition-colors duration-200 ${
                match === null ? 'text-hairline' : inTune ? 'text-intune' : 'text-signal'
              }`}
            >
              {match?.note.label ?? '––'}
            </span>
            <span className="h-3 font-mono text-[11px] leading-3 tabular-nums text-engrave">
              {frequency === null ? '–––.– hz' : `${frequency.toFixed(1)} hz`}
            </span>
          </div>

          {/* Deviation meter. */}
          <div className="flex flex-1 flex-col gap-2">
            <span className="mono-label h-3 leading-3">deviation</span>
            <CentsMeter cents={match?.cents ?? null} tolerance={tolerance} />
          </div>

          {/* Transport. */}
          <div className="flex w-[104px] shrink-0 flex-col gap-2">
            <span className="flex h-3 items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-[1px] transition-colors duration-200 ${
                  live ? 'bg-signal' : starting ? 'bg-engrave' : 'bg-hairline'
                }`}
              />
              <span className="mono-label">
                {live ? 'live' : starting ? 'wait' : 'idle'}
              </span>
            </span>

            <button
              type="button"
              onClick={live || starting ? onStop : onStart}
              disabled={starting}
              className={`keycap keycap-pressable flex flex-1 items-center justify-center text-[13px] font-medium lowercase tracking-wide hover:border-engrave active:keycap-pressed disabled:cursor-wait ${
                live
                  ? 'border-graphite bg-graphite bg-none text-panel hover:bg-graphite'
                  : 'hover:bg-white'
              }`}
            >
              {starting ? 'starting' : live ? 'stop' : 'listen'}
            </button>

            <span className="h-3 font-mono text-[10px] leading-3 lowercase text-engrave">
              {live ? 'mic open' : 'mic closed'}
            </span>
          </div>
        </div>

        {error !== null && (
          <p
            role="alert"
            className="mt-3 border-t border-hairline pt-3 font-mono text-[11px] text-signal"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
