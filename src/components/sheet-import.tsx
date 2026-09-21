import { useCallback, useEffect, useRef, useState } from 'react';
import { parseNotation, serializeLines } from '../lib/composition';
import type { Engraver } from '../lib/engrave';
import { linesFromMusicXml } from '../lib/musicxml';
import { TONICS } from '../lib/notation';
import { recognizeSheet } from '../lib/omr-client';
import type { ScoreData } from '../lib/score';
import { checkSheetFile } from '../lib/sheet-file';
import { Engraved } from './engraved';

interface SheetImportProps {
  /** Sa the app is set to — the starting point until the score suggests its own. */
  tonic: number;
  endpoint: string;
  onCreate: (
    title: string,
    tonic: number,
    contents: { notation: string; score: ScoreData },
  ) => Promise<unknown>;
  onClose: () => void;
  /** The real recogniser posts to the service; tests hand in a stand-in. */
  recognize?: typeof recognizeSheet;
  engrave?: Engraver;
}

/* Hover lives on the off state only — see the note in routes/notes.tsx. */
const KEY = 'keycap keycap-pressable active:keycap-pressed';
const KEY_OFF = `${KEY} hover:border-engrave hover:bg-white`;
const CAP = `${KEY_OFF} h-7 px-2.5 font-mono text-[10px] lowercase tracking-[0.08em] disabled:cursor-default disabled:opacity-40`;

const SELECT_ARROW =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='5'><path d='M0 0h8L4 5z' fill='%238a8a84'/></svg>\")";

const ACCEPT =
  'image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf';

/** What has been recognised, as it stands after the player's corrections. */
interface Review {
  musicXml: string;
  title: string;
  tonic: number;
  notation: string;
  warnings: string[];
  score: ScoreData;
}

/**
 * A printed sheet becomes a piece.
 *
 * Pick, scan, review, create. The file lives in this component's state and
 * nowhere else: it is sent to the recogniser once, its preview is an object
 * URL that is revoked the moment it is replaced, cancelled or created from,
 * and what is finally written is the title, the notation as corrected, and the
 * symbolic score — never the file, never its URL.
 *
 * Review is not optional. No recogniser reads a photograph perfectly, so the
 * notation is shown for correction beside the engraved score, with whatever
 * the recogniser and the projection wanted flagged listed under "check these".
 */
export function SheetImport({
  tonic: initialTonic,
  endpoint,
  onCreate,
  onClose,
  recognize = recognizeSheet,
  engrave,
}: SheetImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [creating, setCreating] = useState(false);
  const inflight = useRef<AbortController | null>(null);

  const releasePreview = useCallback(() => {
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  }, []);

  // Whatever is in flight or on screen goes with the component.
  useEffect(() => {
    return () => {
      inflight.current?.abort();
    };
  }, []);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pick = (picked: File | null) => {
    releasePreview();
    setReview(null);
    setProblem(null);

    if (!picked) {
      setFile(null);
      return;
    }

    const refusal =
      checkSheetFile(picked) ??
      (endpoint.trim() === '' ? 'Recognition is not set up on this deployment.' : null);
    if (refusal) {
      setFile(null);
      setProblem(refusal);
      return;
    }

    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  };

  const scan = async () => {
    if (!file) return;
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;

    setScanning(true);
    setProblem(null);
    try {
      const { musicXml, warnings } = await recognize(file, endpoint, controller.signal);
      if (controller.signal.aborted) return;

      const read = linesFromMusicXml(musicXml, initialTonic);
      const tonic = read.suggestedTonic ?? initialTonic;
      const against = tonic === initialTonic ? read : linesFromMusicXml(musicXml, tonic);

      setReview({
        musicXml,
        title: read.title,
        tonic,
        notation: serializeLines(against.lines),
        warnings: [...warnings, ...against.warnings],
        score: against.score,
      });
    } catch (cause) {
      if (controller.signal.aborted) return;
      setProblem(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (inflight.current === controller) inflight.current = null;
      setScanning(false);
    }
  };

  /** Read the same score against a different Sa. Corrections to the notation start over. */
  const retonic = (tonic: number) => {
    if (!review) return;
    const read = linesFromMusicXml(review.musicXml, tonic);
    setReview({
      ...review,
      tonic,
      notation: serializeLines(read.lines),
      warnings: read.warnings,
      score: read.score,
    });
  };

  const create = async () => {
    if (!review) return;
    setCreating(true);
    try {
      // Through the parser and back, so what is stored is the notation as
      // the editor will read it rather than exactly as it was typed.
      const notation = serializeLines(parseNotation(review.notation));
      await onCreate(review.title.trim() || 'Untitled', review.tonic, {
        notation,
        score: review.score,
      });
      releasePreview();
      onClose();
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCreating(false);
    }
  };

  const cancel = () => {
    inflight.current?.abort();
    releasePreview();
    onClose();
  };

  return (
    <div
      role="region"
      aria-label="import sheet"
      className="keycap flex min-h-0 min-w-0 flex-1 flex-col gap-3 bg-tile p-3 short:gap-2 short:p-2"
    >
      <div className="flex shrink-0 items-center gap-2">
        <span className="mono-label">import sheet</span>
        <span className="min-w-0 flex-1" />
        {review && (
          <button
            type="button"
            onClick={() => void create()}
            disabled={creating}
            className={CAP}
          >
            {creating ? 'creating' : 'create piece'}
          </button>
        )}
        <button type="button" onClick={cancel} className={CAP}>
          cancel
        </button>
      </div>

      {review === null ? (
        <>
          <p className="max-w-[60ch] font-mono text-[11px] leading-[1.6] text-graphite/80">
            A clear photo or scan of one printed melody line &mdash; treble clef, one
            staff, no chords. Handwriting and piano systems will not read. The file is
            scanned and then let go; only the notes it contained are kept.
          </p>

          <label className="flex items-center gap-2">
            <span className={`${CAP} inline-flex items-center`}>choose file</span>
            <input
              type="file"
              accept={ACCEPT}
              aria-label="sheet file"
              onChange={(event) => pick(event.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <span className="mono-label normal-case">
              {file ? file.name : 'nothing chosen'}
            </span>
          </label>

          {problem && (
            <p
              role="alert"
              className="max-w-[60ch] font-mono text-[11px] leading-[1.5] text-signal"
            >
              {problem}
            </p>
          )}

          {file && previewUrl && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {file.type === 'application/pdf' ? (
                <object
                  data={previewUrl}
                  type="application/pdf"
                  aria-label={`preview of ${file.name}`}
                  className="keycap min-h-0 flex-1 bg-white"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={`preview of ${file.name}`}
                  className="keycap min-h-0 flex-1 self-start object-contain bg-white"
                />
              )}

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void scan()}
                  disabled={scanning}
                  className={`${CAP} font-medium`}
                >
                  {scanning ? 'scanning' : 'scan sheet'}
                </button>
                {scanning && (
                  <span className="mono-label normal-case">
                    This can take a little while for a full page.
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 short:gap-2">
          <div className="flex min-h-0 w-[300px] shrink-0 flex-col gap-2.5 narrow:w-[220px]">
            <input
              value={review.title}
              onChange={(event) => setReview({ ...review, title: event.target.value })}
              aria-label="title"
              className="keycap bg-panel px-2.5 py-1.5 text-[13px] outline-none focus:border-graphite"
              placeholder="untitled"
            />

            <label className="flex items-center gap-1.5">
              <span className="mono-label">sa</span>
              <select
                value={review.tonic}
                onChange={(event) => retonic(Number(event.target.value))}
                aria-label="tonic"
                className="keycap keycap-pressable cursor-pointer appearance-none py-1.5 pl-2.5 pr-5 text-center font-mono text-[11px] tabular-nums hover:border-engrave"
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

            {review.warnings.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="mono-label">check these</span>
                <ul
                  aria-label="check these"
                  className="flex flex-col gap-1 font-mono text-[11px] leading-[1.5] text-graphite/80"
                >
                  {review.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <label className="flex min-h-0 flex-1 flex-col gap-1">
              <span className="mono-label">notes, as read</span>
              <textarea
                value={review.notation}
                onChange={(event) =>
                  setReview({ ...review, notation: event.target.value })
                }
                aria-label="notation"
                spellCheck={false}
                className="keycap min-h-[120px] flex-1 resize-none bg-panel p-2.5 font-mono text-[12px] leading-[1.7] outline-none focus:border-graphite"
              />
            </label>

            {problem && (
              <p role="alert" className="font-mono text-[11px] leading-[1.5] text-signal">
                {problem}
              </p>
            )}
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
            <span className="mono-label">as scanned</span>
            <Engraved musicXml={review.musicXml} engrave={engrave} />
          </div>
        </div>
      )}
    </div>
  );
}
