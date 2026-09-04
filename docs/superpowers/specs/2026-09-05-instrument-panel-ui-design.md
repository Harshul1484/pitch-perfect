# Instrument Panel UI — Design

**Date:** 2026-09-05
**Status:** Built
**Builds on:** [2026-09-05-live-pitch-listening-design.md](2026-09-05-live-pitch-listening-design.md)

## Purpose

Rebuild the interface as a machined instrument panel, after Teenage
Engineering hardware, Nothing OS, Apple HIG and Dieter Rams.

The subject suits the language exactly: the app is 88 notes in a grid, and
those are already keycaps. The visual metaphor is not decoration bolted on, it
is what the thing is.

## Two design sources, and which won

`npx getdesign@latest add apple` installed a `DESIGN.md` describing Apple's
**marketing site**: Action Blue `#0066cc`, pill buttons, SF Pro, full-bleed
photographic tiles, exactly one drop shadow.

That conflicts with the brief this project was given — graphite hairlines,
`#FF3B30`, 10–14px radii, Inter and IBM Plex Mono, keycaps. The brief is more
specific and matches the reference hardware, so **the brief governs the visual
language**.

What was taken from `DESIGN.md` is the part that genuinely agrees with it:

- The 8px structural grid.
- Elevation from surface change and border weight, never from blur — Apple's
  "exactly one shadow, and it belongs to photography" rule reaches the same
  place as "components separated by thin borders instead of elevation".
- Restraint about chrome.

## Language

**Surfaces.** Matte white through light grey: `#fafafa` panel, `#f5f5f3` tile,
`#efefea` recess. Accidentals are `#d8d8d1` rather than near-black, because
the reference hardware is monochrome-light throughout; the piano's
natural/accidental distinction survives as a tonal step instead of a hard
inversion.

**Line work.** 1px `#b4b4ac` hairlines, darkening toward graphite on hover and
to `#2b2b2b` when pressed. Borders do the work shadows would.

**Accent.** One: `#ff3b30`, spent only on live state and out-of-tune. Green
`#1f8a4c` marks in tune. Nothing else is coloured.

**The keycap.** A single utility carries the whole physical affordance: a
top-edge light catch, a downward gradient, a 1px hairline, and on press a
`scale(0.98)` with the highlight replaced by an inset shadow, over 200ms.

**Contrast anchor.** One dark block closes the control rail, echoing the dark
corner of the reference hardware. Without it the composition floats.

## Layout

One screen, no scrolling. The page is a fixed-height column: header, readout,
then a row of control rail and key bed that takes whatever height is left.

The key bed is a single 12 × 9 grid — twelve chromatic columns by nine octave
rows — rather than nine independent rows. That has three consequences:

1. Every key is the same size, and every column lines up.
2. C is always leftmost and B always rightmost, so the partial first and last
   octaves indent the way they do on a real keyboard. **This fixed a real
   defect:** A0/A♯0/B0 previously sat in the first three columns, misaligned
   against A/A♯/B in every octave below.
3. The grid stretches to its container, which is what makes one-screen fit
   possible.

## Controls

Every control on the rail does something. A fader that moved nothing would be
decoration, and this language has no room for it.

| Control | Does |
|---|---|
| Fader | Reference tone level, 0–100 |
| Knob | In-tune tolerance, ±2¢ to ±30¢ |
| Knob | Reference tone sustain, 0.2s to 3.0s |
| Grille | Output indicator, dims at zero level |
| Squares | Microphone and output state |

Tolerance is genuinely variable: a beginner wants ±20, an advanced player ±5.

The knob reports as an ARIA slider, because that is how it behaves — draggable
vertically, and driven by arrow, Home and End keys.

## Decoration, and its limits

Braille digits label the octave rows, as the reference hardware engraves them
beside its number keys.

Connector pins were built at every grid intersection and then **removed at the
user's request**. They were the most literal quotation of the hardware and the
least useful mark on the screen.

## Typography

Inter for the interface, IBM Plex Mono for metadata, both self-hosted via
Fontsource rather than a CDN. Metadata is lowercase, 10px, tracked at 0.14em.

## Bug found by the redesign

The `keycap` utility paints a white gradient, which overrode `bg-graphite` on
the active Stop button. The dark fill never appeared and the light label went
invisible against white. Fixed with `bg-none` wherever a keycap takes a solid
fill; the same fix applies to accidental keys and the grille.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint .` | pass |
| `vitest run` | 52 tests pass |
| `playwright test` | 7 tests pass |
| `vite build` | pass |
| Rendered in Chrome | idle, sharp, and in-tune states confirmed |

Not verified: appearance on displays shorter than about 700px, where nine key
rows plus the readout will compress.

## Out of Scope

Dark theme, A4 calibration for baroque and orchestral pitch, and named
scordatura presets.
