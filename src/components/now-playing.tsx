import { IN_TUNE_CENTS, type PitchMatch } from '../lib/notes';
import type { ListenStatus } from '../hooks/use-pitch-detection';
import { CentsMeter } from './cents-meter';

interface NowPlayingProps {
  status: ListenStatus;
  match: PitchMatch | null;
  frequency: number | null;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
}

const BUTTON =
  'rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90';

/**
 * The readout. Sticks to the top of the page so the note you are playing is
 * always in view, however far down the grid its tile happens to sit.
 */
export function NowPlaying({
  status,
  match,
  frequency,
  error,
  onStart,
  onStop,
}: NowPlayingProps) {
  const listening = status === 'listening';
  const inTune = match !== null && Math.abs(match.cents) <= IN_TUNE_CENTS;

  return (
    <div className="sticky top-0 z-10 -mx-6 border-b border-black/10 bg-surface/90 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-6">
        <div className="min-w-[7rem]">
          <div
            className={`text-5xl font-semibold tabular-nums transition-colors ${
              match === null ? 'text-muted/30' : inTune ? 'text-intune' : 'text-offtune'
            }`}
          >
            {match?.note.label ?? '—'}
          </div>
          <div className="mt-1 text-xs tabular-nums text-muted">
            {frequency === null ? 'listening for a note' : `${frequency.toFixed(1)} Hz`}
          </div>
        </div>

        <div className="flex-1">
          <CentsMeter cents={match?.cents ?? null} />
        </div>

        <div>
          {listening || status === 'starting' ? (
            <button
              type="button"
              onClick={onStop}
              className={`${BUTTON} bg-ink text-white`}
              disabled={status === 'starting'}
            >
              {status === 'starting' ? 'Starting…' : 'Stop'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              className={`${BUTTON} bg-accent text-white`}
            >
              Listen
            </button>
          )}
        </div>
      </div>

      {error !== null && (
        <p role="alert" className="mt-3 text-sm text-offtune">
          {error}
        </p>
      )}
    </div>
  );
}
