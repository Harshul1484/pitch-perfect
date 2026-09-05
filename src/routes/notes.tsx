import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../hooks/use-auth';
import { useCompositions } from '../hooks/use-compositions';
import { AccountControl, GoogleMark } from '../components/account-control';
import { NotationEditor } from '../components/notation-editor';
import { usePitchDetection } from '../hooks/use-pitch-detection';
import { Mark } from '../components/mark';
import { nearestNote } from '../lib/notes';

/*
 * Hover styling belongs to the off state, never alongside the on state.
 * `hover:bg-white` and `hover:bg-graphite` have the same specificity, so
 * whichever Tailwind emits last wins — and it emits white last, which
 * repainted a pressed cap white and took its near-white label with it.
 */
const KEY = 'keycap keycap-pressable active:keycap-pressed';
const KEY_OFF = `${KEY} hover:border-engrave hover:bg-white`;
const KEY_ON = `${KEY} border-graphite bg-graphite bg-none text-panel`;

export function Notes() {
  const auth = useAuth();
  const store = useCompositions(auth.user?.uid ?? null);

  // This page listens too, so a piece can be practised where it lives.
  const { status, reading, start, stop } = usePitchDetection();
  const listening = status === 'listening';
  const match = useMemo(
    () => (reading ? nearestNote(reading.frequency) : null),
    [reading],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => store.items.find((item) => item.id === selectedId) ?? null,
    [store.items, selectedId],
  );

  const createPiece = useCallback(async () => {
    const id = await store.create('Untitled', 0);
    if (id) setSelectedId(id);
  }, [store]);

  if (auth.status === 'loading') {
    return (
      <Shell>
        <span className="mono-label">checking session</span>
      </Shell>
    );
  }

  if (auth.status !== 'signed-in') {
    // No account control in the header here: the page below is the one place
    // to sign in, and two ways in would be a coin toss.
    return (
      <Shell titled={false}>
        <SignIn {...auth} />
      </Shell>
    );
  }

  return (
    <Shell auth={auth} listening={listening} onListen={listening ? stop : start}>
      <div className="flex min-h-0 flex-1 gap-2.5 short:gap-1.5">
        <aside className="keycap flex w-[210px] shrink-0 flex-col gap-2 bg-tile p-3 narrow:w-[132px] short:gap-1.5 short:p-2">
          <div className="flex items-center justify-between">
            <span className="mono-label">pieces</span>
            <button
              type="button"
              onClick={() => void createPiece()}
              className={`${KEY_OFF} px-2 py-1 font-mono text-[10px] lowercase tracking-[0.08em]`}
            >
              new
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {store.status === 'loading' && <span className="mono-label">loading</span>}
            {store.status === 'ready' && store.items.length === 0 && (
              <span className="mono-label">nothing yet</span>
            )}

            {store.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                aria-current={item.id === selectedId ? 'true' : undefined}
                className={`${
                  item.id === selectedId ? KEY_ON : KEY_OFF
                } truncate px-2 py-1.5 text-left text-[12px]`}
              >
                {item.title || 'Untitled'}
              </button>
            ))}
          </div>

          {store.error !== null && (
            <p role="alert" className="mono-label normal-case text-signal">
              {store.error}
            </p>
          )}
        </aside>

        {selected ? (
          // Keyed on the id, so switching pieces remounts the editor and its
          // state starts from this piece rather than being copied in.
          <NotationEditor
            key={selected.id}
            composition={selected}
            match={match}
            listening={listening}
            onSave={store.save}
            onDelete={async (id) => {
              await store.remove(id);
              setSelectedId(null);
            }}
          />
        ) : (
          <div className="keycap flex min-h-0 min-w-0 flex-1 items-start bg-tile p-3">
            <p className="mono-label">select a piece, or make a new one</p>
          </div>
        )}
      </div>
    </Shell>
  );
}

/**
 * The signed-out notes page.
 *
 * The whole screen rather than a card in the corner: there is nothing else on
 * it, so a panel would only draw a box around emptiness. Centred, monospaced
 * and quiet — the wordmark, what the thing is, one way in, and the small print
 * underneath.
 */
function SignIn({ status, error, signIn }: ReturnType<typeof useAuth>) {
  const busy = status === 'signing-in';

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 px-4 text-center short:gap-4">
      <h1 className="flex items-center gap-3 font-mono text-[32px] font-semibold leading-none tracking-[-0.02em] short:gap-2 short:text-[22px]">
        <Mark size="lg" />
        Perfect Pitch
      </h1>

      <p className="max-w-[54ch] font-mono text-[13px] leading-[1.75] text-graphite/85 short:text-[11px] short:leading-[1.6]">
        Your practice notebook &mdash; write phrases in sargam or Western notation, hear
        them played back on violin or piano, and practise against them a note at a time.
      </p>

      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="keycap keycap-pressable flex w-[300px] max-w-full items-center justify-center gap-2.5 px-5 py-3.5 font-mono text-[13px] font-semibold tracking-[0.01em] hover:border-engrave hover:bg-white active:keycap-pressed disabled:cursor-wait short:w-[260px] short:py-2.5 short:text-[12px]"
      >
        <GoogleMark size={15} />
        {busy ? 'Signing in' : 'Continue with Google'}
      </button>

      {error !== null && (
        <p role="alert" className="max-w-[46ch] font-mono text-[11px] text-signal">
          {error}
        </p>
      )}

      <p className="max-w-[46ch] font-mono text-[11px] leading-[1.7] text-engrave/70 short:text-[10px]">
        Notes are saved to your account so they follow you between devices. The tuner
        works without one.
      </p>
    </div>
  );
}

function Shell({
  children,
  auth,
  listening,
  onListen,
  titled = true,
}: {
  children: ReactNode;
  auth?: ReturnType<typeof useAuth>;
  listening?: boolean;
  onListen?: () => void;
  /** The signed-out page carries its own heading, centred. */
  titled?: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-2.5 overflow-hidden p-4 short:gap-1.5 short:p-1.5">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-3">
          {titled && (
            /* The same heading as the tuner: mark, then the word. The word is
               the section here rather than the product, because the page is
               reached from one and goes back to it. */
            <h1 className="flex shrink-0 items-center gap-2 text-[18px] font-semibold leading-none tracking-[-0.02em] short:gap-1.5 short:text-[14px]">
              <Mark />
              notes
            </h1>
          )}
          <Link
            to="/"
            className={
              'keycap keycap-pressable px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] text-graphite hover:border-engrave hover:bg-white active:keycap-pressed short:px-2 short:py-1 short:text-[9px]'
            }
          >
            &larr; home
          </Link>
        </div>
        <div className="flex items-center gap-2 short:gap-1.5">
          {onListen && (
            <button
              type="button"
              onClick={onListen}
              aria-pressed={listening}
              className={`${
                listening ? KEY_ON : KEY_OFF
              } flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] short:px-2 short:py-1 short:text-[9px]`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-[1px] ${
                  listening ? 'bg-signal' : 'bg-hairline'
                }`}
              />
              {listening ? 'stop' : 'listen'}
            </button>
          )}
          {auth && <AccountControl {...auth} />}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
