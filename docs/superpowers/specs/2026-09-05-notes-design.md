# Written Notes — Design

**Date:** 2026-09-05
**Status:** Built

## Purpose

Write sargam notation in the app instead of a paper notebook, save it per
user, and play it back.

Built from photographs of the user's own notebook, which uses underlines for
komal, dots above for taar, curved ties for beat grouping and `/` for bar
divisions. Scope agreed as swaras with komal/tivra and saptak marks in free
lines; grouping, bar lines and taal are deliberately out.

## Degrees, not pitches

A piece stores degrees relative to Sa, never absolute pitches. Changing the
tonic therefore transposes the piece rather than rewriting it, which is what
sargam means and why this app has treated Sa as movable from the start.

## Notation is stored as text

Firestore does not support nested arrays, so lines of tokens could not be
stored directly. Rather than wrap every line in a map, the notation is stored
as one compact string:

| Written | Means |
|---|---|
| `S r R g G m M P d D n N` | the twelve degrees, lowercase komal, `M` tivra Ma |
| `S'` / `S''` | taar, ati-taar |
| `S,` / `S,,` | mandra, ati-mandra |
| `-` | hold the previous note another beat |
| newline | a new line of notation |

That is compact, diffable, hand-editable and round-trips exactly — there is a
test asserting `serialize(parse(text)) === text`.

The parser skips characters it does not recognise instead of throwing. This
text can be hand-edited, and losing a whole piece to one stray character would
be worse than dropping the character.

## Diacritics are drawn, not typed

Reuses the existing `Swara` renderer: komal underlined, tivra overlined,
saptak dotted. Its dot rows are always reserved, so nothing collides.

## Playback

Every token occupies exactly one beat, whether a note or a hold. That makes
the beat number and the token index the same value, which is why the highlight
needs no separate timeline — the beat being played *is* the cell to light.

A hold extends the note before it, but only if that note runs right up to this
beat; a hold after silence is silence. The whole phrase is scheduled against
the AudioContext clock up front, so timing does not depend on the main thread,
and the highlight is driven from that same clock.

`playFrequency` was split into `scheduleTone`, which takes a start time, so
immediate and scheduled playback share one path.

## Storage and rules

Documents live at `users/{uid}/compositions/{id}`. Nesting under the uid makes
ownership structural, so the rule is a single uid comparison rather than a
field check that has to be remembered on every write.

The rules also constrain shape: only the five expected keys, title under 200
characters, notation under 20,000, tonic an integer 0–11. Without that a
compromised client could store arbitrary documents, or exhaust the quota with
one enormous write. Everything outside that path is denied.

`onSnapshot` keeps the list live, so a save needs no local patching: the write
goes up and the snapshot comes back down.

## Two React problems worth recording

**State from props.** The editor is keyed on the composition id, so switching
pieces remounts it and notation state initialises straight from props. The
first attempt copied props into state inside an effect, which both tripped the
compiler lint and would have raced the live snapshot — a save echoing back
could have overwritten what was being typed.

**Derived, not set.** `useCompositions` stores only what the snapshot reports.
Signed-out and loading are derived from whether a result matching the current
path has arrived. Setting them inside the effect cascaded a render every time
the subscription was rebuilt.

## Code splitting

Adding Firestore took the bundle from 128 kB to 257 kB gzipped for every
visitor, including those who only ever use the tuner.

`lib/firestore.ts` is now separate from `lib/firebase.ts`, so importing the
database is a deliberate act, and the notes route is lazy. Splitting the route
alone was not enough: `firebase.ts` statically imported Firestore for `getDb`,
and the dashboard imports that file for auth, so it landed in the main chunk
regardless.

Main bundle is back to 128 kB gzipped, with Firestore's 132 kB loaded only on
`/notes`.

## Verification

Tested against the Firebase emulators, which the app connects to when a dev
build is loaded with `?emulator=1`. That drives the real `signInWithPopup` and
real Firestore writes with a throwaway account, rather than mocking the parts
most likely to be wrong.

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint .` | pass |
| `vitest run` | 127 tests pass |
| `playwright test` | 18 tests pass |
| `vite build` | pass |

The end-to-end tests cover writing a phrase, saving, reloading and finding it
intact; renaming; deleting; and that **a second account cannot see the first
account's notes** — the security rule verified rather than assumed.

The Firestore emulator will not start under Git Bash on Windows, exiting at
once with `0xC000013A`. Launching it from PowerShell works.

**Not verified:** the audible result of playback, and behaviour against the
real project rather than the emulators.

## Known gaps

- Editing is append-only. There is no caret, so a line can only be corrected
  by backspacing to the mistake.
- A piece's tonic is fixed at C on creation and shown read-only.
- The swara shortcuts are ignored while a text field has focus; Enter now
  leaves the title so the keyboard becomes live again.

## Out of Scope

Beat grouping, bar lines, taal, Devanagari script, sharing, and export.
