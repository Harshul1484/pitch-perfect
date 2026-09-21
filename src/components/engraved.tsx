import { useEffect, useRef, useState } from 'react';
import type { Engraver } from '../lib/engrave';
import { sanitizeMusicXml } from '../lib/musicxml';

interface EngravedProps {
  musicXml: string;
  /** Left out, the real engraver is fetched on first use. Tests hand in a stand-in. */
  engrave?: Engraver;
  className?: string;
  /** Called once the score is on the page, or has failed to get there. */
  onDrawn?: (ok: boolean) => void;
}

/**
 * A score, drawn.
 *
 * Shared by the preview and the import review, so both draw the same way and
 * neither knows the engraver by name. The score is sanitised before it is
 * drawn, because it may have come out of Firestore or out of a recognition
 * service rather than out of this build, and the engraver receives parsed
 * data rather than the string that arrived.
 *
 * The engraving library is imported here, inside the effect, and only when no
 * engraver was handed in: that keeps it out of every bundle and every test
 * that does not actually draw.
 */
export function Engraved({ musicXml, engrave, className = '', onDrawn }: EngravedProps) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{
    status: 'drawing' | 'drawn' | 'failed';
    message?: string;
  }>({ status: 'drawing' });

  useEffect(() => {
    const target = container.current;
    if (!target) return;

    // An engraver that finishes after this has gone has nowhere to draw and
    // nothing to tell; the flag lets its result fall on the floor.
    let open = true;
    target.replaceChildren();
    setState({ status: 'drawing' });

    (async () => {
      try {
        const xml = sanitizeMusicXml(musicXml);
        const draw = engrave ?? (await import('../lib/engrave')).engraveWithOsmd;
        if (!open) return;
        await draw(target, xml);
        if (!open) return;
        setState({ status: 'drawn' });
        onDrawn?.(true);
      } catch (cause) {
        if (!open) return;
        const reason = cause instanceof Error ? cause.message : String(cause);
        setState({
          status: 'failed',
          message: /doctype/i.test(reason)
            ? reason
            : `The score could not be drawn. ${reason}`,
        });
        onDrawn?.(false);
      }
    })();

    return () => {
      open = false;
    };
    // onDrawn is a notification, not an input to the drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicXml, engrave]);

  return (
    <>
      {state.status === 'drawing' && <span className="mono-label">drawing</span>}
      {state.status === 'failed' && (
        <p role="alert" className="font-mono text-[11px] leading-[1.5] text-signal">
          {state.message}
        </p>
      )}

      {/* The engraver owns everything inside this element. White rather than
          the panel colour, so the page reads as paper and what is printed is
          what is seen. */}
      <div
        ref={container}
        role="img"
        aria-label="sheet music"
        className={`sheet-page keycap min-h-0 flex-1 overflow-auto bg-white p-4 ${className}`}
      />
    </>
  );
}
