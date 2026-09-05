import type { AuthState } from '../hooks/use-auth';

/** First initial, for the avatar when Google gives us no photo. */
function initialOf(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || '?';
  return source.slice(0, 1).toUpperCase();
}

/**
 * What to call someone in a header with no room in it.
 *
 * The first name, or the part of the address before the @. The full name was
 * being cut off mid-word — "Harshul R…" — which is worse than not saying it:
 * it costs the space and still fails to identify anyone. Anything genuinely
 * long falls back to nothing, and the avatar carries it.
 */
function shortNameOf(name: string | null, email: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0] ?? email?.trim().split('@')[0] ?? null;
  if (!first) return null;

  return first.length <= 12 ? first : null;
}

/**
 * Sign in with Google, and who is signed in.
 *
 * Renders nothing when Firebase is not configured — an inert sign-in button
 * would be worse than no button.
 */
export function AccountControl({ status, user, error, signIn, signOut }: AuthState) {
  if (status === 'unavailable') return null;

  if (status === 'loading') {
    return <span className="mono-label">checking session</span>;
  }

  if (status === 'signed-in' && user) {
    return (
      <div className="flex items-center gap-2 short:gap-1.5">
        {/*
         * Squared, like everything else on the panel. A circle was the one
         * round thing left in a language made of caps and hairlines, and it
         * read as something pasted on from another app. The whole identity is
         * on the title, for the times the first name is not enough.
         */}
        <span
          className="flex items-center gap-1.5"
          title={user.displayName ?? user.email ?? undefined}
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              referrerPolicy="no-referrer"
              className="h-5 w-5 rounded-[2px] border border-hairline object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded-[2px] border border-hairline bg-panel font-mono text-[10px] text-graphite"
            >
              {initialOf(user.displayName, user.email)}
            </span>
          )}

          {shortNameOf(user.displayName, user.email) !== null && (
            <span className="mono-label normal-case narrow:hidden">
              {shortNameOf(user.displayName, user.email)}
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={signOut}
          className="keycap keycap-pressable px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] text-engrave hover:border-engrave hover:bg-white active:keycap-pressed short:px-2 short:py-1 short:text-[9px]"
        >
          sign out
        </button>
      </div>
    );
  }

  const busy = status === 'signing-in';

  return (
    <div className="flex items-center gap-2">
      {error !== null && (
        <span role="alert" className="mono-label max-w-[34ch] normal-case text-signal">
          {error}
        </span>
      )}

      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="keycap keycap-pressable flex items-center gap-2 px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.08em] text-graphite hover:border-engrave hover:bg-white active:keycap-pressed disabled:cursor-wait"
      >
        <GoogleMark />
        {busy ? 'signing in' : 'sign in'}
      </button>
    </div>
  );
}

/** Google's mark, drawn inline so no external request is needed. */
export function GoogleMark({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.500h7.1c4.2-3.8 6.6-9.5 6.6-16.1z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2V14H4.5A22 22 0 0 0 2 24c0 3.6.9 6.9 2.5 10l7.3-5.8z"
      />
      <path
        fill="#EA4335"
        d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.3 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14l7.3 5.8c1.7-5.2 6.5-9 12.2-9z"
      />
    </svg>
  );
}
