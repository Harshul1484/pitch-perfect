import { useEffect, useState } from 'react';
import { applyUpdate, isUpdateReady, onUpdateReady } from '../lib/register-sw';

/* Hover lives on the off state only — see the note in routes/notes.tsx. */
const KEY = 'keycap keycap-pressable active:keycap-pressed';
const KEY_OFF = `${KEY} hover:border-engrave hover:bg-white`;

/**
 * The `update` cap.
 *
 * Shown only once a newer build is installed and waiting, which is to say
 * only after a deploy has landed under a session that is still open. Pressing
 * it hands the page over to the new build and reloads.
 *
 * Deliberately a cap and not a banner across the screen. Nothing is broken
 * and nothing is urgent — the old build goes on working until the player is
 * at a point where reloading costs them nothing — so it sits in the header
 * with the other things that are there when they are relevant and absent
 * when they are not.
 */
export function UpdateControl() {
  const [ready, setReady] = useState(isUpdateReady);
  const [taking, setTaking] = useState(false);

  useEffect(() => onUpdateReady(() => setReady(true)), []);

  if (!ready) return null;

  return (
    <button
      type="button"
      onClick={() => {
        setTaking(true);
        applyUpdate();
      }}
      title="A newer version is ready. This reloads the page."
      className={`${KEY_OFF} flex h-7 items-center gap-1.5 px-2.5 font-mono text-[10px] lowercase tracking-[0.08em] text-graphite short:h-6 short:px-2 short:text-[9px]`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-[1px] ${taking ? 'bg-hairline' : 'bg-signal'}`}
      />
      {taking ? 'updating' : 'update'}
    </button>
  );
}
