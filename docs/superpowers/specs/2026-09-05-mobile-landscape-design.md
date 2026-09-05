# Mobile: Always Landscape, Never Clipped — Design

**Date:** 2026-09-05
**Status:** Built

## The shape of the problem

The instrument is a landscape panel. Nine octave rows by twelve chromatic
columns, with the readout standing beside it — that is 88 keys wide before
anything else is on the screen. There is no honest way to fold it into a
portrait phone: either the keys shrink past the point of being playable, or
half the app has to go away.

So a phone held upright does not get a portrait layout. It gets the page.

## Turned on its side

`#root` is given the viewport's dimensions swapped and rotated a quarter turn
about its top-left corner:

```css
width: 100dvh;
height: 100dvw;
transform-origin: top left;
transform: rotate(90deg) translateY(-100%);
```

`translateY(-100%)` lifts the frame by its own height first, so the quarter
turn drops it back exactly over the screen. The layout inside is landscape; the
pixels on the glass are portrait. Turning the phone anticlockwise reads it.

This is not a "please rotate your device" wall. Those give you nothing until
you comply. This gives you the whole app, sideways, which is worth having even
if you never turn the phone at all.

**Guarded on `(pointer: coarse)`.** A narrow, tall *desktop* window is the same
shape as a phone and must be left the right way up. A mouse says which one you
are.

**Only up to 900px wide**, so a tablet in portrait — which has room for the
real layout — is left alone as well.

### What the rotation costs

Two things, both of which the code has to answer for.

**Media queries never see the quarter turn.** They report the device, so in
rotated mode the layout's height is the viewport's *width*. Every size-aware
rule therefore asks the question twice:

```css
@custom-variant short {
  @media (max-height: 520px) { @slot; }
  @media (orientation: portrait) and (pointer: coarse) and (max-width: 520px) { @slot; }
}
```

**Viewport units inside the app mean the wrong axis.** Nothing below `#root`
may use `vh` or `vw`: the app is `h-full` against the frame, and `--app-w` /
`--app-h` are published on `#root` for the rare case that needs a number.

**Safe-area insets rotate too.** What the device calls its top edge is the left
of the layout, and so on round, so the padding is applied in rotated order.

## `short`, and why it is a height

A landscape phone is 360–430px tall and 640–930px wide. Width is not the
problem — height is, and the standard `sm:` / `md:` breakpoints are the wrong
axis for this app entirely. Everything compact keys off one variant, `short`,
at `max-height: 520px`: smaller type, tighter padding, a 126px readout column
instead of 170px, a 28px note instead of 46px.

Three places do more than shrink:

- **The live/idle indicator moves** out of the readout column and into the free
  corner beside the "note" label. One element, repositioned — not a second copy
  hidden at the other size, which would have put two "idle"s in the accessibility
  tree.
- **A microphone error hides the meter**, on short screens only. If the
  microphone could not be opened there is nothing to meter, and the message
  needs the room.
- **The editor toolbar wraps.** Play, undo, redo, tempo, notation, voice — on a
  640px phone they take two rows rather than pushing the panel wider than the
  screen.

The headphones warning stays at every size. Speaker-to-microphone feedback is
worse on a phone, not better.

## Nothing cut off, as a measurement

"It fits" is not a matter of opinion, so it is not tested by eye.
`e2e/audit.ts` walks the rendered page in the browser and reports two things:

1. every visible element whose box falls outside the frame that holds it, and
2. every box that hides its overflow while holding more than it can show
   (`scrollWidth > clientWidth`), which is precisely the definition of content
   being chopped off.

Elements inside a genuinely scrollable ancestor are exempt — they can be
reached. So are labels that declare `text-overflow: ellipsis`, which are meant
to run out of room.

That audit runs at four phone sizes (640×360 up to 915×412) against the tuner,
the key bed, the controls panel, the notes page, a microphone failure, the
recording review, and the editor signed in against the emulator with a bar of
notation written in both notations. Every one of those found something real
when it was first switched on.

The suite also pins the rotation itself: the frame lays out landscape, lands
over the whole portrait viewport at 0,0 — and does *not* rotate for a desktop
window of exactly the same shape.
