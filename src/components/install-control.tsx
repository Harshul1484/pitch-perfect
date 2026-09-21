import { useEffect, useRef, useState } from 'react';
import { useInstallPrompt } from '../hooks/use-install-prompt';

/* Hover lives on the off state only — see the note in routes/notes.tsx. */
const KEY = 'keycap keycap-pressable active:keycap-pressed';
const KEY_OFF = `${KEY} hover:border-engrave hover:bg-white`;

/**
 * The `install` cap.
 *
 * Shown only while the app can be installed from here, and gone once it has
 * been — so most players see it once, and a player who has installed never
 * sees it again. That is what earns it a place in a header that is otherwise
 * kept clear of anything you do not reach for while playing.
 *
 * On Chromium it opens the browser's own install dialog. On iOS, which has
 * no such dialog for a page to open, it explains the two taps instead.
 */
export function InstallControl() {
  const { offer, install } = useInstallPrompt();
  const [explaining, setExplaining] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape, as any panel like this should.
  useEffect(() => {
    if (!explaining) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setExplaining(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExplaining(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [explaining]);

  if (offer === null) return null;

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => {
          if (offer === 'prompt') void install();
          else setExplaining((value) => !value);
        }}
        aria-expanded={offer === 'ios' ? explaining : undefined}
        aria-haspopup={offer === 'ios' ? 'dialog' : undefined}
        className={`${KEY_OFF} flex h-7 items-center gap-1.5 px-2.5 font-mono text-[10px] lowercase tracking-[0.08em] text-engrave short:h-6 short:px-2 short:text-[9px]`}
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-[1px] bg-hairline" />
        install
      </button>

      {offer === 'ios' && explaining && (
        <div
          role="dialog"
          aria-label="how to install"
          className="keycap absolute right-0 top-[calc(100%+8px)] z-30 flex w-[240px] flex-col gap-2 bg-tile p-3"
        >
          <span className="mono-label">add to home screen</span>
          <ol className="flex flex-col gap-1.5 font-mono text-[11px] leading-[1.5] text-graphite">
            <li>
              1. Tap <strong className="font-medium">Share</strong> in Safari&rsquo;s
              toolbar.
            </li>
            <li>
              2. Choose <strong className="font-medium">Add to Home Screen</strong>.
            </li>
          </ol>
          <span className="mono-label normal-case">
            It opens full screen, in landscape, and works without a signal.
          </span>
        </div>
      )}
    </div>
  );
}
