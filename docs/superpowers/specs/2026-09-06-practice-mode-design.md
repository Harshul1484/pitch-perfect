# Practice Mode — Design

**Date:** 2026-09-06
**Status:** Agreed — building.

## What it is

Two kinds of practice, each living where it belongs.

1. **Regular practice, on the tuner.** Press listen, turn practice on, and
   play. Nothing to set up and nothing to follow. The key bed remembers.
2. **Piece practice, on the notes page.** Work through a piece you have
   written, in the place you wrote it — first at your own pace, then in time.

## Why the bed already being green and red is not this

The key bed tints the note you are playing today — green inside the tolerance,
red outside ([note-tile.tsx:63-72](../../../src/components/note-tile.tsx#L63-L72)).
That tint lasts exactly as long as the note does. What practice mode adds is
**memory**: the colour stays after you have moved on, so a scale you have just
played is still on the screen to be read. That, rather than the colour itself,
is the feature.

## 1. Regular practice, on the tuner

A `practice` switch in the header beside `record`, with a small popover for its
settings. Practice stays on when the popover is closed — the bed is what you
look at, the popover is only for setup.

Every note you play leaves a **mark** on its cell. Green if it was inside your
tolerance, red if it was not.

- **Latest attempt wins.** Play A4 sharp, then in tune, then flat, and the cell
  goes red, green, red. It answers "am I fixing it right now?", which is the
  question you are asking while the instrument is under your chin. A new hit
  restarts that cell's fade.
- **Hold before fade** is chosen by the player: 5s, 15s, 30s, 45s, 1 minute,
  2 minutes, 5 minutes, or no fade at all. No fade keeps the bed as it is until
  it is reset.
- **A mark is not laid down until the pitch has been held ~90ms**, the same
  threshold Quick Record uses ([recording.ts:41](../../../src/lib/recording.ts#L41)).
  Without it, sliding between notes paints red cells you never meant to play,
  and the bed fills with noise rather than notes.
- The live tint, the meter stubs and the cents number all stay exactly as they
  are. Marks sit underneath them: they are the memory, not the moment.

## 2. Piece practice, on the notes page

Open a piece and press `practice`. The page needs its own microphone control,
since until now nothing on it listened.

**Two surfaces show the same thing at once**, because they answer different
questions:

- **The written notes**, which answer *where am I in the piece*. Each swara
  turns green when you play it in tune and red when you miss it, and the note
  you are meant to play next is marked. You read along the page exactly as you
  already do during playback.
- **A compact key bed**, which answers *what did I actually play*. It shows the
  octaves the piece spans — usually one or two rows of twelve, not the full
  nine — growing only if you play outside them. It takes the swara keyboard's
  place while practice is on: you are playing the violin, not typing.

**Two stages, in order.**

*Learn.* The target note is marked and stays there until you play it in tune,
then it advances. A wrong note colours red where it lands; the target waits.
Nothing is on a clock, so the phrase cannot run away from you.

*Run.* The metronome counts in and the piece plays out at its tempo. Each note
is graded as its beat passes, hit or missed, whether or not you got it. At the
end: a score and the notes you dropped.

**A wrong note and an out-of-tune note are both red.** No third colour. On the
bed, the tile's position already says it was the wrong note and the cents number
already says it was the right note played badly; on the page, a red note is a
red note either way. The palette keeps its single accent.

## How it is built

Everything decidable is a pure function with a test, as the rest of `lib/` is.

**`lib/practice.ts`**

- `observe(state, sample, tolerance)` — accumulates readings and commits a mark
  once one has been held long enough. No timers, no React.
- `expire(state, now, holdMs)` — drops marks past their hold.
- `nextExpiry(state, holdMs)` — when the next one falls due, so the hook can
  set one timeout rather than tick.
- `HOLDS` — the durations offered, with "no fade" as null.

**`lib/follow.ts`** — self-paced progress through a piece: which note is the
target, and whether what was just played advances it.

**`lib/run.ts`**

- `grade(schedule, samples, bpm, tolerance)` — takes the piece's existing
  `buildSchedule` output ([playback.ts:29](../../../src/lib/playback.ts#L29))
  and the timestamped samples the recorder already collects, and returns a
  verdict per note plus a score.

The timed run is therefore *a recording graded against a schedule*. It needs no
new clock and no new capture: both already exist and are tested.

**`hooks/use-practice.ts`** — the only stateful part. Feeds `match` in,
schedules a single timeout for the next expiry, and holds none at all on "no
fade".

**UI**

- `practice-control.tsx` — the header button and its popover, mirroring
  `record-control.tsx`. Used by both routes.
- `note-tile.tsx` gains `mark` and `isTarget`; `keybed.tsx` gains an octave
  range so the notes page can show a short bed from the same component. Both
  stay dumb.
- `notation-view.tsx` gains a per-token verdict, alongside the playing
  highlight it already draws.
- The notes page gains a listen control and `usePitchDetection`.

## The trade-offs taken

**The practice settings are a popover, not a panel.** The tuner's left column is
already 314px of the 316px a 360px-tall phone has to give
([mobile design](2026-09-05-mobile-landscape-design.md)); a third panel would
break the no-scroll layout.

**The bed on the notes page shows only the octaves in play.** A full nine-row
bed would not fit beside a written page and a toolbar on a phone, and eight of
those rows would be empty for most pieces anyway.

**The bed replaces the swara keyboard rather than joining it.** Both are
twelve columns wide and neither is needed while the other is in use.

## Open when it is picked up

- Whether the free session should offer the same score the timed run does, or
  whether the bed alone is the point of it.
- Whether "learn" should let you skip a note you cannot get, or make you get it.
