# Caret Editing, Bar Lines and Ties — Design

**Date:** 2026-09-05
**Status:** Built

## Purpose

Close the three gaps left in the notes feature: editing was append-only, and
the notebook's bar lines and beat grouping were missing.

## Caret

The caret sits **between** tokens: index 0 is before the first, index
`line.length` after the last. That is how a text caret behaves, and it is what
makes inserting mid-line and appending at the end the same operation rather
than two.

`lib/caret.ts` holds the whole model as pure functions — insert, backspace,
delete, split, and the six movements — each returning both the new lines and
where the caret ended up. Keeping the caret with the edit is the point: after
deleting a token the caret must not be left pointing past the end.

Backspace at the start of a line joins it to the line above, and delete at the
end pulls the next line up, both landing the caret at the join. That is what a
text editor does, and notation is being typed, so it should behave the same.

Clicking a cell puts the caret **before** it, so a wrong note is one backspace
away. Clicking a gap puts the caret in the gap.

## Bar lines

A `bar` token, written `|` and taking no time at all. The parser also accepts
`/`, which is what the notebook this was built from uses; a pipe is the usual
symbol in printed notation, so that is what gets written back.

## Beat grouping

The curved tie under notes squeezed into one matra is a `grouped` flag on a
note: it shares the previous token's beat rather than taking one of its own.
Written with a leading `~`.

Rendered as an **arc hanging below the cell**, not a straight underline. A
straight line under a swara already means komal, and a tied komal note would
have shown two nearly identical strokes.

Tie is a one-shot, not a mode. It applies to the next note and then clears —
left latched, every following note would pile into the same beat.

## Playback

The beat is the unit. A plain note takes one; tied notes share one between
them; a hold adds a beat to the note before it; a bar takes none.

`buildSchedule` now returns a placement per token — start beat, length, and
what to sound — rather than a list of notes. That single structure drives both
the audio and the highlight, so they cannot drift apart.

A held note and the hold extending it cover the same beats, so more than one
token can match a moment. The latest to start wins, which walks the highlight
along the page cell by cell the way it is read, instead of parking it on the
note for the whole of a long hold.

## Recorded rhythm

The previous version deliberately dropped note lengths, on the grounds that
turning them into beats needed a tempo the player had not stated.

**That was wrong, and the user said so.** The tempo *is* stated: it is the one
set on the metronome and being practised to. `toTokens` now quantises each
recorded note against it, so a note lasting about two beats is written as a
note and a hold, with a bar line every four beats. Where the rounding guesses
badly, the caret is now there to fix it.

Anything shorter than half a beat still gets one beat; rounding it to zero
would silently drop notes that were played.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint .` | pass |
| `vitest run` | 181 tests pass |
| `playwright test` | 23 tests pass |
| `vite build` | pass |

End-to-end, against the emulators: a note is corrected in the middle of a line
and the note after it survives; a bar and a tie are written, saved, reloaded,
and are still there.

Two of those tests failed first because they typed before the editor had
mounted, losing keystrokes — a fault in the tests, not the editor, found by
dumping the page text rather than guessing.

## Known gaps

- No selection, so no cut, copy or paste.
- No undo.
- A tie can be placed on the first note of a line, where there is no previous
  beat to join; it is treated as starting its own.
