import { useState } from 'react';
import { serializeLines, tokenFromMidi } from '../lib/composition';
import { swaraOfDegree, type Notation } from '../lib/notation';
import { noteAt } from '../lib/notes';
import { accuracy, type RecordingSummary } from '../lib/recording';
import { Swara } from './swara';

interface RecordingReviewProps {
  summary: RecordingSummary;
  tolerance: number;
  notation: Notation;
  tonic: number;
  /** Null when signed out, in which case saving is not offered. */
  onSave: ((title: string, notation: string) => Promise<void>) | null;
  onDiscard: () => void;
}

const KEY =
  'keycap keycap-pressable hover:border-engrave hover:bg-white active:keycap-pressed';

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * What you just played, and how in tune it was.
 *
 * Saving writes the notes as sargam relative to the current tonic, because
 * that is what the notes page reads and it keeps a recording transposable.
 * Note lengths are not carried over: the recording knows how long each note
 * lasted, but turning that into beats needs a tempo the player never stated,
 * and a wrong rhythm would be worse than none.
 */
export function RecordingReview({
  summary,
  tolerance,
  notation,
  tonic,
  onSave,
  onDiscard,
}: RecordingReviewProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const share = accuracy(summary);
  const { events } = summary;

  const save = async () => {
    if (!onSave) return;

    setSaving(true);
    const lines = [events.map((event) => tokenFromMidi(event.midi, tonic))];
    const title = `Recording · ${new Date().toLocaleString()}`;

    await onSave(title, serializeLines(lines));
    setSaving(false);
    setSaved(true);
  };

  return (
    <div
      role="group"
      aria-label="recording review"
      className="keycap flex w-[170px] shrink-0 flex-col gap-2 bg-tile p-3"
    >
      <div className="flex items-center justify-between">
        <span className="mono-label">recording</span>
        <span className="mono-label">{seconds(summary.durationMs)}</span>
      </div>

      {events.length === 0 ? (
        <p className="mono-label leading-[1.5] normal-case text-engrave">
          Nothing was picked up. Play closer to the microphone, or check the level.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-[26px] font-semibold leading-none tabular-nums ${
                share !== null && share >= 0.8 ? 'text-intune' : 'text-graphite'
              }`}
            >
              {Math.round((share ?? 0) * 100)}%
            </span>
            <span className="mono-label">in tune</span>
          </div>

          <span className="mono-label">
            {summary.inTuneCount} of {events.length} notes · ±{tolerance}c
          </span>

          {summary.worst && (
            <span className="mono-label normal-case">
              furthest out: {noteAt(summary.worst.midi).label}{' '}
              {summary.worst.meanCents > 0 ? '+' : ''}
              {summary.worst.meanCents}¢
            </span>
          )}

          <div className="flex max-h-[190px] min-h-0 flex-col gap-px overflow-y-auto border-y border-hairline-soft py-1">
            {events.map((event, index) => {
              const note = noteAt(event.midi);
              const token = tokenFromMidi(event.midi, tonic);

              return (
                <div
                  key={`${event.startMs}-${index}`}
                  className="flex items-center justify-between gap-2 px-0.5 py-0.5 text-[12px]"
                >
                  <span className="flex items-baseline gap-1">
                    {notation === 'sargam' ? (
                      <Swara
                        swara={{ ...swaraOfDegree(token.degree), saptak: token.saptak }}
                      />
                    ) : (
                      note.label
                    )}
                  </span>

                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      event.inTune ? 'text-intune' : 'text-signal'
                    }`}
                  >
                    {event.meanCents > 0 ? '+' : ''}
                    {event.meanCents}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="flex gap-1.5">
        {events.length > 0 && onSave && (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || saved}
            className={`${KEY} flex-1 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] disabled:cursor-default disabled:opacity-60`}
          >
            {saved ? 'saved' : saving ? 'saving' : 'save to notes'}
          </button>
        )}

        <button
          type="button"
          onClick={onDiscard}
          className={`${KEY} flex-1 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] text-engrave`}
        >
          {saved ? 'close' : 'discard'}
        </button>
      </div>

      {events.length > 0 && !onSave && (
        <span className="mono-label normal-case">Sign in to save this to notes.</span>
      )}
    </div>
  );
}
