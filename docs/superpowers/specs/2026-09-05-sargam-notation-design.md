# Sargam Notation — Design

**Date:** 2026-09-05
**Status:** Built

## Purpose

Let the key bed and readout be named in Hindustani sargam instead of Western
letters.

## The decision that shapes everything: Sa is movable

Sargam names **degrees of a scale**, not absolute pitches. Sa is whatever
tonic the player chooses; every other swara is defined relative to it.

So the tonic is a setting, not a constant. Hardcoding C = Sa would have made
the whole mode useless to this user, who retunes the violin to scordatura such
as DADA and FEFE. The tonic selector appears only in sargam mode, where it
means something.

This is the same reasoning that kept all 88 keys rather than narrowing to the
violin range.

## Mapping

Twelve degrees above Sa, Bhatkhande convention:

| Semitones | Swara | Written |
|---|---|---|
| 0 | Sa | plain |
| 1 | komal Re | underlined |
| 2 | Re | plain |
| 3 | komal Ga | underlined |
| 4 | Ga | plain |
| 5 | Ma | plain |
| 6 | tivra Ma | overlined |
| 7 | Pa | plain |
| 8 | komal Dha | underlined |
| 9 | Dha | plain |
| 10 | komal Ni | underlined |
| 11 | Ni | plain |

Sa and Pa are achala — they have no altered form, which is why neither appears
twice. Ma is the only swara with a tivra form. Both facts have tests.

## Diacritics are drawn, not typed

Komal is an underline, tivra an overline, and saptak is dots: below for
mandra, above for taar, none for madhya.

These are rendered with CSS rather than Unicode combining marks. A combining
low line attaches to one character, so it would sit under only the "R" of
"Re", where Bhatkhande underlines the whole swara.

The dot rows are always present even when empty. Reserving the space stops
three collisions that the first attempt had: a komal underline against a
mandra dot, dots against the frequency line below, and the glyph shifting as
the saptak changes.

Dots stop at two. Beyond ati-mandra and ati-taar the convention runs out and
this key bed spans nine octaves, so the octave number in the row legend
carries the rest.

Madhya saptak is anchored to the octave containing Sa at octave 4, so it moves
with the tonic: with Sa on D, C4 falls into mandra.

## Accessibility

Diacritics do not read aloud, so the accessible name spells the modifier:
"komal Re", "tivra Ma". Sargam keeps the Western name beside it — "Play komal
Ni, C4, 261.63 hertz" — because a swara alone does not say which octave it is
in.

The readout does the same visually, showing the Western name next to the
frequency while the swara is displayed large.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint .` | pass |
| `vitest run` | 84 tests pass |
| `playwright test` | 11 tests pass |
| `vite build` | pass |

Checked on screen with Sa on D: D reads Sa undotted, C reads komal Ni with a
mandra dot, G♯ reads tivra Ma overlined, and taar dots begin at D5.

## Out of Scope

Carnatic swara names and the sixteen-swara system, raga-aware spelling (which
would pick between enharmonic readings by context), shruti and just
intonation, and Devanagari script.
