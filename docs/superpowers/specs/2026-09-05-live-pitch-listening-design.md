# Live Pitch Listening — Design

**Date:** 2026-09-05
**Status:** Built
**Builds on:** [2026-09-05-note-dashboard-design.md](2026-09-05-note-dashboard-design.md)

## Purpose

Turn the note grid from a soundboard into a readout. You play the violin, the
app listens through the microphone, and the tile you are actually playing
lights up — green when you are in tune, amber when you are not.

The tiles keep their click-to-play behaviour. The two uses complement each
other: click a tile to hear the target, then match it on the instrument.

## Why intonation, not just note names

A violin has no frets. A note 30 cents flat is still recognisably "C4", so an
app that only names the note would call a badly out-of-tune note correct. The
cents readout is the part that carries the information worth having.

In tune is defined as within 10 cents.

## Why the full 88 keys stay

The original plan was to narrow the grid to the violin range, G3 to E7. That
was wrong: this player uses scordatura — DADA, FEFE and other cross-tunings —
so the reachable range moves. The grid stays complete, and the readout solves
visibility instead.

The detector searches 55 Hz to 3600 Hz for the same reason, wide enough for
any retuning rather than assuming standard GDAE.

## Detection

**Algorithm: McLeod Pitch Method.** MPM builds a Normalised Square Difference
Function and takes the *first* peak within 90% of the tallest, rather than the
tallest itself. That distinction is what prevents octave errors: a bowed
string's harmonics are strong enough that plain autocorrelation frequently
reports the octave above. An e2e test asserts G3 lights G3 and not G4.

Parabolic interpolation around the chosen peak recovers sub-sample precision.
Without it, resolution is one sample period, which near the top of the range
is worth tens of cents.

**Monophonic only.** Double stops will read as one note or waver between the
two. That is inherent to the method, not a defect to fix later.

**Thresholds, chosen from measurement.** Peak NSDF clarity was measured across
signal types:

| Signal | RMS | Clarity |
|---|---|---|
| Quiet tone at fake-capture level | 0.0028 | 1.00 |
| Quiet tone + 30% noise | 0.0030 | 0.86 |
| White noise only | 0.0040 | 0.08 |
| Near-silence | 0.00014 | 0.36 |

Clarity separates signal from noise by an order of magnitude, so it does the
real work at 0.55, and the RMS gate only has to exclude near-silence at
0.0015. Both are deliberately permissive so soft playing and a distant
microphone still register.

**Capture settings.** `echoCancellation`, `noiseSuppression` and
`autoGainControl` are all disabled. Each one mangles sustained tones: AGC
pumps the level, noise suppression treats a held note as noise, echo
cancellation phase-shifts it.

## Interface

A sticky readout at the top of the page shows the note, its frequency, and a
needle on a −50 to +50 cent scale with the in-tune window shaded. It sticks
because the matching tile may be scrolled far down an 88-key grid; the readout
is always in view, and the glowing tile gives context when it is on screen.

The tile itself swaps its reference frequency for the live cents offset while
sounding, and rings green or amber. The heard state outranks the click flash.

The last reading is held for 250 ms after the signal drops, so the display
does not blink out between bow strokes.

The nav bar was removed: the app is one screen, and the About page it linked
to was starter scaffolding.

## Testing

Unit tests drive the detector with synthesised tones — pure sines, bowed
harmonic stacks, quiet signals, white noise — asserting accuracy in cents and
guarding the octave error.

End-to-end tests run in real Chrome via Playwright, with a persistent profile
so browser session state survives between runs. `navigator.mediaDevices
.getUserMedia` is replaced with a Web Audio oscillator at a known pitch.

**Chrome's own `--use-file-for-fake-audio-capture` was tried first and
abandoned.** It played WAV fixtures so poorly that detection clarity sat at
0.2–0.3 with erratic frequencies, while the same detector scored 1.0 on an
injected stream. It was testing Chrome's audio plumbing, not this app.

What the e2e tests do not cover is Chrome's real capture device. Everything
above it is the real path: getUserMedia, analyser wiring, detection, note
matching, and rendering.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint .` | pass |
| `vitest run` | 50 tests pass |
| `playwright test` | 7 tests pass |
| `vite build` | pass |

Not verified: detection from a real microphone with a real violin. The signal
path is exercised end to end with synthetic input only.

## Out of Scope

Polyphony and double stops, tuner presets for named scordatura tunings, note
history, ear-training drills, and MIDI input.
