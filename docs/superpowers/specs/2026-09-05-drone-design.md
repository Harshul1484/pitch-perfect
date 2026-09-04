# Tonic Drone — Design

**Date:** 2026-09-05
**Status:** Built

## Purpose

A sustained drone on the tonic, after a tanpura. Indian classical practice is
done against one, and it doubles as a tuning reference for any scordatura.

It also answers a layout problem: removing the speaker grille and status block
left the control rail with a large dead area. Filling it with a control that
does something is preferable to padding it, and matches this design's rule
that a control which does nothing is decoration.

## Decisions

### Partials: tonic, just fifth, octave

Three triangle oscillators at ratios 1, 3:2 and 2.

The fifth is a **just** 3:2 rather than the equal-tempered 700 cents, because
that is what a tanpura sounds. The two differ by about 2 cents, well below
what anyone hears, so it does not fight the equal-tempered readout.

The drone sits at gain 0.16 before the output fader, under a played note
rather than over it.

### The tonic moved to the rail

It was in the header, visible only in sargam mode. But the tonic is also the
drone's root, so it matters in Western notation too. One control, one meaning:
the tonic. The header keeps only the notation switch.

Sa sounds in octave 3 — 130 to 246 Hz across the twelve tonics — a comfortable
register to drone under a violin.

### Retune without restarting

Changing the tonic while the drone sounds glides the oscillators with
`setTargetAtTime` instead of tearing the graph down and rebuilding it, which
would click. The build effect deliberately does not depend on frequency; a
second effect handles retuning and level.

Fades are 120ms in and 180ms out, long enough that starting and stopping never
click.

## A test measurement error worth recording

The first end-to-end test read `oscillator.frequency.value` and got 440, the
default, so it looked as though the drone was sounding the wrong pitch.

The drone was correct. `setValueAtTime` only *schedules* a change, and the
param does not report the new value until the next render quantum. For a
one-off initial pitch a plain assignment is both simpler and immediately
observable, so the hook now uses one.

The lesson is about the measurement, not the code: reading an AudioParam back
does not tell you what was scheduled.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint .` | pass |
| `vitest run` | 84 tests pass |
| `playwright test` | 14 tests pass |
| `vite build` | pass |

The end-to-end tests count the oscillators the page actually builds and assert
their ratios, so a button that toggles its own state while making no sound
would fail. They also assert that moving the tonic does not build a second set.

## Layout

Adding the drone pushed the rail past its plate on shorter screens. The fader
slot went from 132 to 104px and the knobs from 44 to 40px, which brings the
rail back inside its bounds.

Not verified: displays shorter than about 640px, where the rail will overflow
again.

## Out of Scope

Tanpura pluck patterns and jivari timbre, a fifth-versus-fourth (Ma) drone
choice, per-string tuning presets, and A4 calibration.
