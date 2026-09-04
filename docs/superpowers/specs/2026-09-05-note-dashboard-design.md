# Note Dashboard — Design

**Date:** 2026-09-05
**Status:** Built
**Builds on:** [2026-09-05-react-starter-design.md](2026-09-05-react-starter-design.md)

## Purpose

A tile dashboard showing every musical note, where clicking a tile sounds the
pitch.

"All musical notes" was taken literally: the full 88-key piano range, A0
through C8. Not one octave, not the seven naturals — all 88.

## Decisions

### Tuning: twelve-tone equal temperament, A4 = 440 Hz

Every frequency derives from one formula rather than a lookup table:

```
frequency(midi) = 440 * 2 ** ((midi - 69) / 12)
```

MIDI numbering is the index because it is the standard integer encoding for
pitch, makes the octave arithmetic trivial (`floor(midi / 12) - 1`), and gives
the range clean bounds: A0 = 21, C8 = 108.

Accidentals are written as sharps only (`C♯`, never `D♭`). Enharmonic spelling
depends on key context, which a flat note grid does not have.

### Audio: Web Audio oscillator, no files

A triangle oscillator through a gain node. Triangle rather than sine because
sine gets shrill in the top octaves, where C8 sits at 4186 Hz.

The gain envelope ramps up over 15 ms and decays exponentially over 1.4 s.
Starting and stopping a gain node at full amplitude produces an audible click;
ramping removes it. The ramp targets 0.0001 rather than 0 because
`exponentialRampToValueAtTime` cannot reach zero.

The `AudioContext` is created lazily and reused, because browsers refuse to
start one outside a user gesture.

`playFrequency` returns a boolean rather than throwing when Web Audio is
absent. That is the real situation in jsdom and in browsers that block audio
outright, and it makes the module testable without mocking.

### Layout: grouped by octave, twelve columns

Nine sections, one per octave, each a grid of up to twelve tiles. The first and
last are deliberately partial — octave 0 holds only A0, A♯0, B0, and octave 8
holds only C8, which is what an 88-key piano actually has.

Naturals are light and accidentals dark, borrowing the piano keyboard's own
encoding so the pattern is readable at a glance.

The shell is `max-w-5xl`. At `max-w-3xl` twelve columns squeezed each tile to
about 55 px, which made the frequency labels hard to read.

## Structure

```
src/
├─ lib/
│  ├─ notes.ts       # pitch math, the note table, octave grouping
│  ├─ notes.test.ts
│  ├─ audio.ts       # Web Audio playback
│  └─ audio.test.ts
├─ components/
│  ├─ note-tile.tsx      # one note; knows nothing about audio
│  ├─ note-tile.test.tsx
│  └─ octave-row.tsx     # one octave's grid
└─ routes/
   └─ dashboard.tsx      # owns playback and the flash state
```

### Boundaries

`NoteTile` takes an `onPlay` callback rather than calling the audio module
itself. The tile stays a pure display component, testable without any audio
stubbing, and the dashboard decides what sounding a note means.

`notes.ts` is pure data and arithmetic with no React and no audio, so the pitch
math is testable on its own.

## Feedback

A struck tile gets an accent ring for 260 ms. The timer is cleared on the next
click and on unmount, so rapid clicking does not leak timers or leave a tile
stuck highlighted.

## Accessibility

Every tile is a real `<button>`, so it is keyboard reachable and operable.
Each carries an `aria-label` naming the note and its frequency
("Play C♯4, 277.18 hertz"), because the visible label alone reads as
meaningless characters to a screen reader.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint .` | pass |
| `vitest run` | 16 tests pass |
| `vite build` | pass |
| Rendered in Chromium | 88 tiles, no console errors |
| Web Audio in-browser | oscillator graph reaches `running` |

Frequencies spot-checked against known values: A0 = 27.5, C4 = 261.63,
A4 = 440, C8 = 4186.01 Hz.

Not verified: audible output, which headless Chromium cannot capture.

## Out of Scope

Ear training and quiz modes, note duration or waveform controls, sustain and
polyphony, MIDI input, and flat spelling.
