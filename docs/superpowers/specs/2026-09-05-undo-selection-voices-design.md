# Undo, Selection, and Instrument Voices — Design

**Date:** 2026-09-05
**Status:** Built

## Undo and redo

`lib/history.ts` keeps a stack of whole states rather than a log of invertible
operations. Notation documents are small — a few hundred tokens — so copying
one per edit is cheaper than describing every change and its inverse, and it
cannot drift out of step with the document the way an operation log can.

**A step carries the caret as well as the lines.** Undoing a deletion has to
put the caret back where the deletion happened, not leave it wherever it
drifted to afterwards.

One step per edit, no coalescing by time. Each note here is a deliberate act,
unlike prose where undoing letter by letter would be tedious. Two hundred
states are kept, so a long session cannot grow without limit.

Recording a new state discards the redo trail, because the timeline has
branched and the old future is no longer reachable.

Selection is deliberately **outside** the history: nobody wants to spend undos
walking back through highlights.

## Selection, cut, copy, paste

A selection is two carets — where it started and where it was dragged to.
Either may come first in the document, so every operation works on the ordered
pair rather than on anchor and focus directly.

Extended with Shift and the arrow keys, or Shift-click. Ctrl/Cmd with A, C, X,
V and Z behave as they do anywhere else.

Anything typed while a selection is live replaces it, as in any editor.

Copy keeps its own clipboard of tokens, and also writes the notation as text to
the system clipboard so a phrase can be pasted into a message or a file. Paste
reads the internal one: reading the system clipboard needs a permission prompt
that is not worth interrupting writing for.

## The tie at an edge

Playback flattens the page before scheduling, so a tie at the start of a line
already joined the beat that ended the line above — lines run on. That is now
under test rather than incidental.

A tie with nothing at all before it starts its own beat; there is no beat to
join. Same after a bar, which ends the beat before it.

What was wrong was the drawing. The arc reached left into empty space at the
start of a line, so a line-leading tie now gets a stub running off the left
edge instead — it reads as continuing from above.

The arc is also drawn **below** the cell and curved, because a straight line
under a swara already means komal, and a tied komal note would otherwise show
two nearly identical strokes.

## Voices

Notes sounded like a piano because they were one: a triangle with an immediate
attack and a decay across the whole note.

**Violin** is now the default. A sawtooth is the right starting point, since
bowing is a stick-slip motion and produces a sawtooth-like waveform. On its own
it buzzes, so it runs through a lowpass that tracks the note — a fixed cutoff
makes high notes dull — takes a 90ms attack rather than a struck one, holds
roughly level while the bow travels, and carries a little delayed vibrato at
5.5 Hz and 11 cents. The vibrato eases in, so short notes stay straight; it is
what most separates a bowed note from a synthesised one.

**Piano** keeps the old struck envelope, and is one switch away.

## Notation on the notes page

The page and its keyboard now name notes either way. In Western naming a note
is shown as pitch class and octave, computed from the piece's tonic, so the
same document reads either way without being rewritten — the stored notation is
degrees relative to Sa regardless.

Notation and voice are stored per person in localStorage and shared by both
routes, since they belong to the reader rather than to the page. Every access
is guarded: private windows throw on the accessor itself, and a preference is
never worth a blank page.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint .` | pass |
| `vitest run` | 207 tests pass |
| `playwright test` | 24 tests pass |
| `vite build` | pass |

End-to-end: notes are named both ways on demand, and switching renames what is
already written.

Three notes tests failed first because the page now defaults to Western naming
while they asserted sargam. They pin the notation explicitly now rather than
depending on a remembered preference. A fourth failure was a genuine name
collision — the written page and the notation switch both answered to
"notation" — so the page is now "written notation".

**Not verified:** how the violin actually sounds. The graph is built and
scheduled correctly, but timbre is a judgement only listening can make.

## Known gaps

- No drag-select; Shift-click and Shift-arrow only.
- Undo is per session, not stored with the piece.

## Settings that persist

Tolerance, sustain, tempo and tonic now survive a reload alongside notation and
voice, kept in localStorage and shared by both routes. They belong to the
player, not to the page or the session.

`useNumberPreference` had a real bug on first write: a missing key reads as
`null`, and `Number(null)` is `0`, which sails through any range check that
includes zero. It now checks for the missing key before converting. There is a
test for exactly that case.

A stored value outside the current range is discarded rather than clamped. Out
of bounds means the range has changed since it was written, and today's default
is the better answer than yesterday's edge.

## A piece's tonic

It was fixed at C on creation and shown read-only. It is now a selector.

Because notation is stored as degrees relative to Sa, **changing the tonic
transposes the piece rather than rewriting it** — which is the whole point of
storing degrees. The end-to-end test writes Sa and Pa with Sa on C, sees C4 and
G4, moves Sa to D, sees D4 and A4, and confirms that in sargam they are still
Sa and Pa because the degrees never moved.

The Firestore rules already allowed and bounded `tonic`, so nothing had to
change there.
