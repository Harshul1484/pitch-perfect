# Metronome — Design

**Date:** 2026-09-05
**Status:** Built

## Purpose

A 4/4 metronome for practising against, with adjustable tempo and an accented
downbeat.

## Decisions

### Timing: Web Audio lookahead, not a timer

`setInterval` is not accurate enough for a metronome. It drifts by
milliseconds every tick, and the wander is audible inside a single bar.

Instead a coarse 25ms timer wakes up and schedules every beat falling inside a
120ms lookahead window at an exact `AudioContext` time. The audio clock, not
the JavaScript clock, decides when a click sounds.

Beat times accumulate by addition from a stored `nextBeatTime`, so stepping
window by window lands on exactly the same times as one long call. There is a
test for precisely that.

### The scheduler is pure

`src/lib/metronome.ts` holds `advance(state, until, bpm)` — no audio, no
React, no clock. It takes a position and a deadline and returns the beats due
plus the new position.

That makes the part most likely to be wrong testable without a sound card:
tempo changes mid-bar, bar wrapping, drift across many calls, and the guard
against spinning after a suspended tab all have direct tests.

### Tempo changes apply from the next beat

Tempo is read per beat inside `advance`, so changing it never retimes beats
already scheduled. Turning the knob mid-bar speeds up the next beat, it does
not jerk the current one.

### Accent

Beat one is a two-partial bell at 1568 and 3136 Hz with a 130ms decay; the
other three are a single 880 Hz click at 55ms. The upper partial is mixed back
so the accent reads as a bell rather than a louder beep.

Visually the downbeat is both taller and signal red.

### The displayed beat follows the audio clock

The beat lights are advanced by a rAF loop comparing `AudioContext.currentTime`
against a queue of scheduled beats, not by the scheduling timer. The light
therefore matches what you hear rather than the moment a beat was queued.

### One AudioContext

`getAudioContext()` is now exported from `lib/audio.ts` and shared with the
metronome, because browsers cap how many contexts a page may open.

## Interference with detection

Metronome clicks played through speakers can be picked up by the microphone.
The click is short and inharmonic, so the clarity gate usually rejects it, but
this is not guaranteed. The panel says "headphones advised" whenever the click
is running and the microphone is open.

## Pitch detection: median smoothing

Measuring the live readout on a steady 440 Hz tone showed the reading wandering
by tens of cents and dropping out intermittently — a single analysis window is
noisy even on a clean note, and a bowed string with bow noise is worse.

The hook now reports the median of the last five estimates. A median rejects a
wild frame outright, where a mean would let it drag the result; five frames is
about 80ms at 60fps, steady to read without feeling laggy. History is cleared
on a real silence so a new note is never averaged against the previous one.

Measured on an injected 440 Hz tone: 12 of 12 samples in tune, against roughly
1 in 10 before.

## Testing note

The end-to-end tests inject a synthetic tone by replacing `getUserMedia` with a
Web Audio stream, rather than using Chrome's
`--use-file-for-fake-audio-capture`. That flag resamples badly enough to add
tens of cents of jitter, which made intonation assertions flap for reasons
unrelated to this code.

## Tooltips

Hover and focus hints, styled as engraved dark labels.

They are marked `aria-hidden`: every control already carries its own
accessible name, and announcing the same thing twice is worse than not
announcing it.

They are only on controls whose label is not self-explanatory — the level
fader, the tolerance and sustain knobs, and the tempo knob, where the
interaction (drag or arrow keys) is not obvious. Tooltips on the keys, the
listen button and the start button were built and then removed: those already
say what they do, and 88 tooltips across the key bed was noise.

## Removed as decoration

The speaker grille and the status block both went, at the user's request and
in line with this design's own rule that a control which does nothing is
decoration. The grille only dimmed when muted, and the status block repeated
what the readout and the level fader already show.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint .` | pass |
| `vitest run` | 70 tests pass |
| `playwright test` | 9 tests pass |
| `vite build` | pass |

End-to-end coverage confirms a real browser lights all four beats in order,
clears them on stop, and clamps tempo at both ends.

## Out of Scope

Time signatures other than 4/4, subdivisions, tap tempo, accent patterns, and
count-in.
