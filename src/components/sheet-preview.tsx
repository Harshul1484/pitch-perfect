import { useEffect, useState, type ReactNode } from 'react';
import type { Engraver } from '../lib/engrave';
import type { ScoreData } from '../lib/score';
import { Engraved } from './engraved';

interface SheetPreviewProps {
  score: ScoreData;
  title: string;
  onClose: () => void;
  /** Left out, the real engraver is fetched on first use. Tests hand in a stand-in. */
  engrave?: Engraver;
}

/* Hover lives on the off state only — see the note in routes/notes.tsx. */
const KEY = 'keycap keycap-pressable active:keycap-pressed';
const KEY_OFF = `${KEY} hover:border-engrave hover:bg-white`;

/** Marks the body while printing, so the print stylesheet can show only the sheet. */
const PRINTING = 'printing-sheet';

/** A filename from a title: letters, digits and dashes, or a fallback. */
function fileNameOf(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'piece'}.musicxml`;
}

/**
 * A piece as a printed page.
 *
 * A frame around the engraving: it offers print and download, and goes away.
 * Nothing it draws or downloads is kept anywhere once it closes.
 */
export function SheetPreview({
  score,
  title,
  onClose,
  engrave,
}: SheetPreviewProps): ReactNode {
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const download = () => {
    // A Blob, not a data URL: the document never becomes part of a link that
    // could be copied, and the URL is released as soon as the click has gone.
    const blob = new Blob([score.musicXml], {
      type: 'application/vnd.recordare.musicxml+xml',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileNameOf(title);
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const print = () => {
    document.body.classList.add(PRINTING);
    try {
      window.print();
    } finally {
      document.body.classList.remove(PRINTING);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="sheet preview"
      className="absolute inset-0 z-40 flex flex-col gap-2.5 bg-tile/95 p-4 short:gap-1.5 short:p-2"
    >
      <div className="flex shrink-0 items-center gap-2">
        <span className="mono-label">sheet</span>
        <span className="min-w-0 flex-1 truncate text-[13px]">{title}</span>

        <button
          type="button"
          onClick={print}
          disabled={!drawn}
          className={`${KEY_OFF} h-7 px-2.5 font-mono text-[10px] lowercase tracking-[0.08em] disabled:cursor-default disabled:opacity-40`}
        >
          print
        </button>
        <button
          type="button"
          onClick={download}
          className={`${KEY_OFF} h-7 px-2.5 font-mono text-[10px] lowercase tracking-[0.08em]`}
        >
          download musicxml
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`${KEY_OFF} h-7 px-2.5 font-mono text-[10px] lowercase tracking-[0.08em]`}
        >
          close
        </button>
      </div>

      <Engraved musicXml={score.musicXml} engrave={engrave} onDrawn={setDrawn} />
    </div>
  );
}
