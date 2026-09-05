# Drag Select, Persisted Undo, and Measuring Timbre

**Date:** 2026-09-05
**Status:** Built

Closes the three gaps left after undo and the voices went in.

## Drag select

The whole page listens for pointer events rather than each cell. A drag that
starts on one cell and crosses several others is one gesture, and handling it
in one place is simpler than stitching together events from each cell it
passes over.

Cells and gaps carry `data-line` and `data-index`, so the handler reads the
position from whatever is under the pointer instead of needing a closure per
cell.

Shift-click and Shift-arrow still work; this is an addition, not a replacement.

## Undo across a reload

The trail is kept in localStorage, keyed by the piece.

**Not in Firestore.** It is per-person scratch state, it would bloat every
document, and every keystroke would become a write. Forty states are stored
rather than the two hundred kept in memory, because this is serialised on each
edit.

Loading is guarded by a match: the stored present state has to equal the piece
as saved. If the piece moved on elsewhere — another tab, another device — those
steps describe a document that no longer exists, and replaying them would
resurrect it. Deleting a piece clears its history.

Every storage access is wrapped. Losing undo across a reload is not worth
failing an edit over, and private windows throw on the accessor itself.

## Measuring the timbre

The previous note said the violin was "unheard by me", and left it there. That
was the wrong place to stop. Timbre cannot be *judged* by a test, but the
things that make a bowed note bowed — a gradual attack, a level sustain, and
vibrato — are all measurable.

`buildVoice` now takes the context and destination to build into, so the same
shipping code can be rendered into an `OfflineAudioContext` and the samples
examined. The end-to-end test imports the app's own audio module into the page,
so it measures what ships rather than a copy.

Measured at 440 Hz over one second:

| | violin | piano |
|---|---|---|
| RMS at 10ms | 0.006 | 0.004 |
| RMS at 50ms | 0.054 | 0.123 |
| RMS at 300ms | 0.097 | 0.017 |
| RMS at 700ms | 0.098 | 0.001 |
| Zero-crossing rate | 887, 875, 888, 875, 888 | 887, 887, 888, 888, 888 |

The violin climbs and then holds level from 300ms to 700ms; the piano peaks at
50ms and has all but gone by 700ms. The violin's crossing rate wobbles, which
is the vibrato moving the pitch; the piano's does not.

**The measurement found a real fault.** The bow attack was an exponential ramp
from near-silence, which is very concave: it reached only 4% of level at 50ms
of a 90ms attack, then jumped. That reads as a struck note, not a bowed one.
A linear ramp puts it at 56% at 55% through, which is what a bow does.

What is still unverified is whether it sounds *good*. That is a judgement, and
it needs ears.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint .` | pass |
| `vitest run` | 224 tests pass |
| `playwright test` | 30 tests pass |
| `vite build` | pass |

End-to-end: a drag across the page selects and typing replaces the selection
while the note past it survives; undo steps back, redo returns, and the trail
is still there after a reload.
