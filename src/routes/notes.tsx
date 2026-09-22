import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/use-auth';
import { useCompositions } from '../hooks/use-compositions';
import { AccountControl, GoogleMark } from '../components/account-control';
import { InstallControl } from '../components/install-control';
import { UpdateControl } from '../components/update-control';
import { NotationEditor } from '../components/notation-editor';
import { usePitchDetection } from '../hooks/use-pitch-detection';
import { Mark } from '../components/mark';
import { Pages } from '../components/pages';
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
      <Shell>
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
          <EmptyState
            ready={store.status === 'ready'}
            hasPieces={store.items.length > 0}
            onCreate={() => void createPiece()}
          />
        )}
      </div>
    </Shell>
  );
}

/**
 * The editor pane before a piece is open.
 *
 * This was one line of grey text in the top-left corner of a pane the size of
 * the screen: it told you the pane was empty, which you could already see, and
 * left the rest of it doing nothing. It is also the first thing a new player
 * meets after signing in, so it now does an empty state's actual job — says
 * what the page is for, offers the one action worth taking, and names the
 * three things a piece can do once it exists.
 */
function EmptyState({
  ready,
  hasPieces,
  onCreate,
}: {
  ready: boolean;
  hasPieces: boolean;
  onCreate: () => void;
}) {
  // Nothing is claimed about the library until it has actually loaded —
  // otherwise a returning player is told to write their first piece.
  const first = ready && !hasPieces;

  return (
    <div className="keycap flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-tile p-6 text-center short:gap-3 short:p-3">
      <Mark size="lg" />

      <div className="flex flex-col items-center gap-2.5 short:gap-1.5">
        <h2 className="font-mono text-[16px] font-semibold leading-none tracking-[-0.01em] short:text-[13px]">
          {first ? 'Write your first piece' : 'No piece open'}
        </h2>

        <p className="max-w-[58ch] font-mono text-[12px] leading-[1.7] text-graphite/80 short:text-[10px] short:leading-[1.5]">
          {ready && hasPieces
            ? 'Pick one from the list on the left, or start something new.'
            : 'Type a phrase in sargam or Western letters, hear it played back, then practise against it a note at a time.'}
        </p>
      </div>

      <button
        type="button"
        onClick={onCreate}
        className={`${KEY_OFF} px-4 py-2 font-mono text-[12px] font-medium lowercase tracking-[0.08em]`}
      >
        new piece
      </button>

      {/* Three columns rather than a paragraph: what the page does, in the
          order you do it. Hidden where the pane is too short to spare rows. */}
      <div className="hidden w-full max-w-[520px] grid-cols-3 gap-4 border-t border-hairline-soft pt-5 tall:grid">
        {[
          ['write', 'in sargam or Western letters'],
          ['hear', 'played back on violin or piano'],
          ['practise', 'note by note, then a timed run'],
        ].map(([label, blurb]) => (
          <span key={label} className="flex flex-col items-center gap-1.5">
            <span className="mono-label">{label}</span>
            <span className="max-w-[22ch] font-mono text-[11px] leading-[1.6] text-engrave">
              {blurb}
            </span>
          </span>
        ))}
      </div>
    </div>
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
}: {
  children: ReactNode;
  auth?: ReturnType<typeof useAuth>;
  listening?: boolean;
  onListen?: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-2.5 overflow-hidden p-4 short:gap-1.5 short:p-1.5">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-0.5">
        {/* The same two tabs as the tuner, so the app has one navigation
            rather than a link out and a link back. */}
        <Pages />

        <div className="flex items-center gap-2 short:gap-1.5">
          {onListen && (
            <button
              type="button"
              onClick={onListen}
              aria-pressed={listening}
              className={`${
                listening ? KEY_ON : KEY_OFF
              } flex h-7 items-center gap-1.5 px-2.5 font-mono text-[10px] lowercase tracking-[0.08em] short:h-6 short:px-2 short:text-[9px]`}
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
          <UpdateControl />
          <InstallControl />
          {auth && <AccountControl {...auth} />}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
