# Quick Record — Design

**Date:** 2026-09-05
**Status:** Built

## Purpose

Record playing without leaving the tuner, review it with intonation analysis,
and save it to the notes.

## What a recording is

The detector already reports a note and its deviation about sixty times a
second. Recording is just keeping those readings and then making them
readable.

Samples land in a ref rather than in state. Re-rendering the page on every
reading, to store a number nobody is looking at yet, would be waste; the
summary is computed once, on stop.

## Turning readings into notes

`summarise` collapses consecutive readings of the same pitch into one note
with a duration and an average deviation. Three rules make the result match
what was actually played:

- **A minimum length.** Anything under 90ms is a bow change or the detector
  crossing between two pitches, not a note. Including them would bury the real
  notes in noise.
- **A maximum gap.** A silence longer than 180ms ends the current note even if
  the same pitch returns, so two separate bows do not merge into one.
- **Judge from the average.** In tune or not is decided by the mean across the
  note, not by any single reading, which would make the verdict a lottery.

## Saving

A recording is written as sargam relative to the current tonic, using
`tokenFromMidi` — the inverse of the playback mapping, with a round-trip test
across every tonic and the whole piano range.

**Note lengths are deliberately not carried over.** The recording knows how
long each note lasted, but turning that into beats needs a tempo the player
never stated, and an invented rhythm would be worse than none.

## Where it lives

The button sits in the header and the review opens beneath it.

It was first placed in the left column, which pushed that column past the
bottom of the screen. A scrollbar there would have been the wrong fix for an
instrument meant to fit one view, so both moved to the header.

The review panel opens itself when a recording finishes, but this is derived
rather than set from an effect: the panel is open unless *this* summary has
been dismissed. A new recording is a new object, so it opens again on its own,
with no cascading render.

Recording is disabled unless the microphone is open. Recording nothing would
look like it worked and then review as empty.

## Keeping Firestore out of the tuner

Saving needs Firestore, which is the largest dependency in the app and which
the tuner otherwise never touches. Wiring the compositions hook into the
dashboard pulled it straight back into the main bundle and undid the earlier
code split.

`lib/save-recording.ts` exists so the save can be a dynamic import. Firestore
is now its own chunk, shared by the notes route and this, and the main bundle
stays at about 129 kB gzipped.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint .` | pass |
| `vitest run` | 144 tests pass |
| `playwright test` | 21 tests pass |
| `vite build` | pass |

The end-to-end test feeds a phrase whose deviations are known exactly — 440 Hz
is A4 dead on, 500 Hz is B4 about +21 cents, 553 Hz is C♯5 about −4 cents —
and asserts the review names those notes, reports those cents, and picks B4 as
the furthest out. Checked on screen against the same phrase: 75% in tune, 3 of
4 notes, furthest out B4 +21¢.

**Not verified:** saving a recording to Firestore against a signed-in account.
The signed-out path, where saving is not offered, is covered.

## Out of Scope

Keeping the audio itself, so a recording cannot be played back — only its
notes are kept. Also: rhythm, tempo detection, and comparing a recording
against a written piece.
