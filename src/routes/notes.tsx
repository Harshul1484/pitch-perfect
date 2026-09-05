import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../hooks/use-auth';
import { useCompositions } from '../hooks/use-compositions';
import { AccountControl } from '../components/account-control';
import { NotationEditor } from '../components/notation-editor';

const KEY =
  'keycap keycap-pressable hover:border-engrave hover:bg-white active:keycap-pressed';

export function Notes() {
  const auth = useAuth();
  const store = useCompositions(auth.user?.uid ?? null);

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
    // No account control in the header here: the card below is the one place
    // to sign in, and two identical buttons would be a coin toss.
    return (
      <Shell>
        <div className="keycap flex flex-col items-start gap-3 self-start bg-tile p-5">
          <h2 className="text-[16px] font-semibold tracking-tight">
            Sign in to write notes
          </h2>
          <p className="max-w-prose text-[13px] text-engrave">
            Notes are saved to your account so they follow you between devices, which
            needs a sign-in. The tuner works without one.
          </p>
          <AccountControl {...auth} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell auth={auth}>
      <div className="flex min-h-0 flex-1 gap-2.5">
        <aside className="keycap flex w-[210px] shrink-0 flex-col gap-2 bg-tile p-3">
          <div className="flex items-center justify-between">
            <span className="mono-label">pieces</span>
            <button
              type="button"
              onClick={() => void createPiece()}
              className={`${KEY} px-2 py-1 font-mono text-[10px] lowercase tracking-[0.08em]`}
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
                className={`${KEY} truncate px-2 py-1.5 text-left text-[12px] ${
                  item.id === selectedId
                    ? 'border-graphite bg-graphite bg-none text-panel hover:bg-graphite'
                    : ''
                }`}
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
            onSave={store.save}
            onDelete={async (id) => {
              await store.remove(id);
              setSelectedId(null);
            }}
          />
        ) : (
          <div className="keycap flex min-h-0 flex-1 items-start bg-tile p-3">
            <p className="mono-label">select a piece, or make a new one</p>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({
  children,
  auth,
}: {
  children: ReactNode;
  auth?: ReturnType<typeof useAuth>;
}) {
  return (
    <div className="flex h-screen flex-col gap-2.5 overflow-hidden p-4">
      <header className="flex shrink-0 items-end justify-between px-0.5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[20px] font-semibold leading-none tracking-[-0.03em]">
            notes
          </h1>
          <Link to="/" className="mono-label hover:text-graphite">
            &larr; tuner
          </Link>
        </div>
        {auth && <AccountControl {...auth} />}
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
