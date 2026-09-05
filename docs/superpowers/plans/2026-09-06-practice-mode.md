# Practice Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app remembers how you played — the key bed keeps a green/red mark per note during a free session on the tuner, and a written piece can be practised note by note and then in time on the notes page.

**Architecture:** All decisions live in pure functions under `src/lib/` with unit tests; one hook (`use-practice`) holds the only mutable state and the only timer; existing components gain props and stay dumb. The timed run is a recording graded against the schedule `buildSchedule` already produces, so it needs no new clock and no new capture.

**Tech Stack:** React 19, TypeScript, Tailwind 4 (`short:` variant for phones), Vitest + Testing Library, Playwright with an injected Web Audio microphone, Firebase emulators for the notes route.

**Build order:** Phase A (tasks 1–5, the tuner) is self-contained and shippable on its own. Phase B (tasks 6–11) adds the notes page.

**Status: done.** All eleven tasks landed. Where the build departed from the
plan it is recorded in the spec, under "What changed in the building".

---

## File Structure

**Create**

| File | Responsibility |
|---|---|
| `src/lib/practice.ts` | Marks: commit an attempt once held, expire on the hold, list the hold options |
| `src/lib/practice.test.ts` | Unit tests for the above |
| `src/lib/follow.ts` | Self-paced progress through a piece: targets, and whether an attempt advances |
| `src/lib/follow.test.ts` | Unit tests |
| `src/lib/run.ts` | Grade a timed run: schedule + samples → verdict per note + score |
| `src/lib/run.test.ts` | Unit tests |
| `src/hooks/use-practice.ts` | The only stateful part: feeds readings in, schedules one expiry timeout |
| `src/hooks/use-practice.test.ts` | Hook tests with fake timers |
| `src/components/practice-control.tsx` | Header button + popover: hold selector, reset, and (notes only) stage and score |
| `e2e/practice.spec.ts` | Tuner practice end to end against an injected microphone |

**Modify**

| File | Change |
|---|---|
| `src/components/note-tile.tsx` | Accept `mark` and `isTarget`; draw the remembered wash under the live one |
| `src/components/keybed.tsx` | Accept `marks`, and an optional octave range so the notes page can show a short bed |
| `src/components/notation-view.tsx` | Accept `verdicts` and `targetIndex` alongside the playing highlight |
| `src/components/notation-editor.tsx` | Swap the swara keyboard for the bed while practising; own the stage |
| `src/routes/dashboard.tsx` | Wire practice on the tuner, persist the hold |
| `src/routes/notes.tsx` | Add listening and the practice toggle to the notes header |
| `e2e/mobile.spec.ts` | Audit the tuner with practice on |

---

## Task 1: Marks — commit, expire, and the hold options

**Files:**
- Create: `src/lib/practice.ts`
- Test: `src/lib/practice.test.ts`

- [x] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { EMPTY, HOLDS, expire, nextExpiry, observe, reset } from './practice';

const TOLERANCE = 10;

/** Feed a run of readings of one pitch, one every 20ms from `from`. */
function hold(state = EMPTY, midi = 69, cents = 0, from = 0, count = 10) {
  let current = state;
  let committed = null;
  for (let index = 0; index < count; index += 1) {
    const step = observe(current, { at: from + index * 20, midi, cents }, TOLERANCE);
    current = step.state;
    committed = step.committed ?? committed;
  }
  return { state: current, committed };
}

describe('observe', () => {
  it('ignores a pitch that was not held long enough to be a note', () => {
    // 90ms is the threshold; four readings 20ms apart is 60ms.
    const { state, committed } = hold(EMPTY, 69, 0, 0, 4);

    expect(committed).toBeNull();
    expect(state.marks).toEqual({});
  });

  it('commits a mark once the pitch has been held', () => {
    const { state, committed } = hold();

    expect(committed).toMatchObject({ midi: 69, inTune: true });
    expect(state.marks[69]).toMatchObject({ midi: 69, cents: 0, inTune: true });
  });

  it('marks a note played outside the tolerance as out', () => {
    const { state } = hold(EMPTY, 69, 25);

    expect(state.marks[69].inTune).toBe(false);
    expect(state.marks[69].cents).toBe(25);
  });

  it('averages the intonation across the attempt rather than taking the last', () => {
    let state = EMPTY;
    for (let index = 0; index < 10; index += 1) {
      // Alternates +20 and -20, so the attempt averages to zero.
      const cents = index % 2 === 0 ? 20 : -20;
      state = observe(state, { at: index * 20, midi: 69, cents }, TOLERANCE).state;
    }

    expect(state.marks[69].cents).toBe(0);
    expect(state.marks[69].inTune).toBe(true);
  });

  it('commits once per attempt, not once per reading', () => {
    let state = EMPTY;
    let commits = 0;
    for (let index = 0; index < 20; index += 1) {
      const step = observe(state, { at: index * 20, midi: 69, cents: 0 }, TOLERANCE);
      state = step.state;
      if (step.committed) commits += 1;
    }

    expect(commits).toBe(1);
  });

  it('keeps the mark fresh while the note is still being held', () => {
    const { state } = hold(EMPTY, 69, 0, 0, 30);

    // The fade should start when you leave the pitch, not when you found it.
    expect(state.marks[69].at).toBe(29 * 20);
  });

  it('replaces the previous attempt at the same pitch', () => {
    const first = hold(EMPTY, 69, 30).state;
    expect(first.marks[69].inTune).toBe(false);

    const second = hold(first, 69, 0, 1000).state;
    expect(second.marks[69].inTune).toBe(true);
  });

  it('starts a new attempt when the pitch changes', () => {
    const first = hold(EMPTY, 69).state;
    const second = hold(first, 71, 0, 1000).state;

    expect(Object.keys(second.marks).map(Number).sort()).toEqual([69, 71]);
  });
});

describe('expire', () => {
  it('drops a mark once its hold has run out', () => {
    const state = hold().state;
    const at = state.marks[69].at;

    expect(expire(state, at + 4_999, 5_000).marks[69]).toBeDefined();
    expect(expire(state, at + 5_001, 5_000).marks[69]).toBeUndefined();
  });

  it('keeps everything when there is no fade', () => {
    const state = hold().state;

    expect(expire(state, 10_000_000, null).marks[69]).toBeDefined();
  });

  it('returns the same state when nothing expired, so React can skip a render', () => {
    const state = hold().state;

    expect(expire(state, state.marks[69].at + 1, 5_000)).toBe(state);
  });
});

describe('nextExpiry', () => {
  it('is the oldest mark plus the hold', () => {
    let state = hold(EMPTY, 69, 0, 0).state;
    state = hold(state, 71, 0, 1_000).state;

    const oldest = state.marks[69].at;
    expect(nextExpiry(state, 5_000)).toBe(oldest + 5_000);
  });

  it('is nothing when there is no fade, or nothing to fade', () => {
    expect(nextExpiry(hold().state, null)).toBeNull();
    expect(nextExpiry(EMPTY, 5_000)).toBeNull();
  });
});

describe('reset', () => {
  it('clears the bed', () => {
    expect(reset().marks).toEqual({});
  });
});

describe('HOLDS', () => {
  it('offers the durations the player expects, ending in no fade', () => {
    expect(HOLDS.map((hold) => hold.label)).toEqual([
      '5s',
      '15s',
      '30s',
      '45s',
      '1m',
      '2m',
      '5m',
      'none',
    ]);
    expect(HOLDS[HOLDS.length - 1].ms).toBeNull();
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `node node_modules/vitest/vitest.mjs run src/lib/practice.test.ts`
Expected: FAIL — cannot resolve `./practice`.

- [x] **Step 3: Write the implementation**

```ts
import { MIN_NOTE_MS, type Sample } from './recording';

/**
 * What the key bed remembers.
 *
 * The bed already tints the note being played; that tint lasts exactly as long
 * as the note does. A mark is the same judgement kept afterwards, so a scale
 * you have just played is still readable on the screen.
 */
export interface Mark {
  midi: number;
  /** Mean cents across the attempt, rounded. */
  cents: number;
  inTune: boolean;
  /**
   * When the attempt was last heard. Refreshed while the note is still
   * sounding, so the fade starts when you leave the pitch rather than when you
   * found it.
   */
  at: number;
}

export interface PracticeState {
  /** The latest attempt at each pitch. */
  marks: Record<number, Mark>;
  /** Being heard now, not yet held long enough to count as a note. */
  pending: { midi: number; since: number; cents: number[]; committed: boolean } | null;
}

export const EMPTY: PracticeState = { marks: {}, pending: null };

/** How long a mark stays before it fades. Null is "until reset". */
export const HOLDS: { ms: number | null; label: string }[] = [
  { ms: 5_000, label: '5s' },
  { ms: 15_000, label: '15s' },
  { ms: 30_000, label: '30s' },
  { ms: 45_000, label: '45s' },
  { ms: 60_000, label: '1m' },
  { ms: 120_000, label: '2m' },
  { ms: 300_000, label: '5m' },
  { ms: null, label: 'none' },
];

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Take one reading.
 *
 * A pitch has to be held before it marks the bed — the same threshold Quick
 * Record uses. Without it, sliding between notes paints red cells that were
 * never played, and the bed fills with noise instead of notes.
 *
 * `committed` is set only on the reading where an attempt first counts, so a
 * caller can treat it as an event rather than diffing state.
 */
export function observe(
  state: PracticeState,
  sample: Sample,
  tolerance: number,
): { state: PracticeState; committed: Mark | null } {
  const pending =
    state.pending && state.pending.midi === sample.midi
      ? state.pending
      : { midi: sample.midi, since: sample.at, cents: [], committed: false };

  const cents = [...pending.cents, sample.cents];
  const held = sample.at - pending.since;

  if (held < MIN_NOTE_MS) {
    return { state: { ...state, pending: { ...pending, cents } }, committed: null };
  }

  const average = Math.round(mean(cents));
  const mark: Mark = {
    midi: sample.midi,
    cents: average,
    inTune: Math.abs(average) <= tolerance,
    at: sample.at,
  };

  return {
    state: {
      marks: { ...state.marks, [sample.midi]: mark },
      pending: { ...pending, cents, committed: true },
    },
    committed: pending.committed ? null : mark,
  };
}

/**
 * Drop marks whose hold has run out. Returns the same state when nothing went,
 * so a caller can skip re-rendering eighty-eight tiles for no reason.
 */
export function expire(
  state: PracticeState,
  now: number,
  holdMs: number | null,
): PracticeState {
  if (holdMs === null) return state;

  const kept = Object.entries(state.marks).filter(
    ([, mark]) => now - mark.at <= holdMs,
  );
  if (kept.length === Object.keys(state.marks).length) return state;

  return { ...state, marks: Object.fromEntries(kept) };
}

/** When the next mark falls due, so a hook can set one timeout rather than tick. */
export function nextExpiry(state: PracticeState, holdMs: number | null): number | null {
  if (holdMs === null) return null;

  const times = Object.values(state.marks).map((mark) => mark.at);
  if (times.length === 0) return null;

  return Math.min(...times) + holdMs;
}

export function reset(): PracticeState {
  return EMPTY;
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/practice.test.ts`
Expected: PASS, 14 tests.

- [x] **Step 5: Commit**

```bash
git add src/lib/practice.ts src/lib/practice.test.ts
git commit -m "feat: remember how each note was played"
```

---

## Task 2: The practice hook

**Files:**
- Create: `src/hooks/use-practice.ts`
- Test: `src/hooks/use-practice.test.ts`

- [x] **Step 1: Write the failing tests**

```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePractice } from './use-practice';
import { noteAt, type PitchMatch } from '../lib/notes';

function match(midi: number, cents: number): PitchMatch {
  return { note: noteAt(midi), cents, frequency: noteAt(midi).frequency };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePractice', () => {
  it('records nothing while it is switched off', () => {
    const { result, rerender } = renderHook(
      ({ heard }) => usePractice(heard, 10, 5_000, false),
      { initialProps: { heard: match(69, 0) as PitchMatch | null } },
    );

    act(() => vi.advanceTimersByTime(200));
    rerender({ heard: match(69, 0) });

    expect(result.current.marks).toEqual({});
  });

  it('marks a note that was held', () => {
    const { result, rerender } = renderHook(
      ({ heard }) => usePractice(heard, 10, 5_000, true),
      { initialProps: { heard: null as PitchMatch | null } },
    );

    // Readings arrive as new objects, the way the detector delivers them.
    for (let step = 0; step < 10; step += 1) {
      act(() => {
        vi.advanceTimersByTime(20);
      });
      rerender({ heard: match(69, 2) });
    }

    expect(result.current.marks[69]).toMatchObject({ midi: 69, inTune: true });
  });

  it('forgets a mark once its hold has passed', () => {
    const { result, rerender } = renderHook(
      ({ heard }) => usePractice(heard, 10, 5_000, true),
      { initialProps: { heard: null as PitchMatch | null } },
    );

    for (let step = 0; step < 10; step += 1) {
      act(() => {
        vi.advanceTimersByTime(20);
      });
      rerender({ heard: match(69, 2) });
    }
    expect(result.current.marks[69]).toBeDefined();

    rerender({ heard: null });
    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(result.current.marks[69]).toBeUndefined();
  });

  it('keeps marks for ever when the hold is off', () => {
    const { result, rerender } = renderHook(
      ({ heard }) => usePractice(heard, 10, null, true),
      { initialProps: { heard: null as PitchMatch | null } },
    );

    for (let step = 0; step < 10; step += 1) {
      act(() => {
        vi.advanceTimersByTime(20);
      });
      rerender({ heard: match(69, 2) });
    }

    rerender({ heard: null });
    act(() => {
      vi.advanceTimersByTime(600_000);
    });

    expect(result.current.marks[69]).toBeDefined();
  });

  it('clears the bed when reset', () => {
    const { result, rerender } = renderHook(
      ({ heard }) => usePractice(heard, 10, null, true),
      { initialProps: { heard: null as PitchMatch | null } },
    );

    for (let step = 0; step < 10; step += 1) {
      act(() => {
        vi.advanceTimersByTime(20);
      });
      rerender({ heard: match(69, 2) });
    }

    act(() => result.current.reset());

    expect(result.current.marks).toEqual({});
  });

  it('drops everything it remembered when switched off', () => {
    const { result, rerender } = renderHook(
      ({ heard, on }) => usePractice(heard, 10, null, on),
      { initialProps: { heard: null as PitchMatch | null, on: true } },
    );

    for (let step = 0; step < 10; step += 1) {
      act(() => {
        vi.advanceTimersByTime(20);
      });
      rerender({ heard: match(69, 2), on: true });
    }

    rerender({ heard: null, on: false });

    expect(result.current.marks).toEqual({});
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `node node_modules/vitest/vitest.mjs run src/hooks/use-practice.test.ts`
Expected: FAIL — cannot resolve `./use-practice`.

- [x] **Step 3: Write the implementation**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PitchMatch } from '../lib/notes';
import {
  EMPTY,
  expire,
  nextExpiry,
  observe,
  type Mark,
  type PracticeState,
} from '../lib/practice';

export interface Practice {
  /** The latest attempt at each pitch, by midi number. */
  marks: Record<number, Mark>;
  /** The attempt that just counted, on the render it counted. Null otherwise. */
  committed: Mark | null;
  reset: () => void;
}

/**
 * Remember how each note was played.
 *
 * The detector reports about sixty times a second and every reading is fed
 * straight in, which is the same cadence the live tint already re-renders at.
 * Fading is a single scheduled timeout rather than a tick, because most of the
 * time nothing is due — and on "no fade" nothing ever is.
 */
export function usePractice(
  match: PitchMatch | null,
  tolerance: number,
  holdMs: number | null,
  enabled: boolean,
): Practice {
  const [state, setState] = useState<PracticeState>(EMPTY);
  const [committed, setCommitted] = useState<Mark | null>(null);
  const timer = useRef<number | null>(null);

  // Feed each reading in. Marks live in state, not a ref: the bed is rendered
  // from them.
  useEffect(() => {
    if (!enabled || match === null) return;

    const sample = {
      at: performance.now(),
      midi: match.note.midi,
      cents: match.cents,
    };

    setState((current) => {
      const step = observe(current, sample, tolerance);
      setCommitted(step.committed);
      return step.state;
    });
  }, [match, enabled, tolerance]);

  // Switching off is a clean slate, so turning it back on starts a session
  // rather than resuming one from an hour ago.
  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      setCommitted(null);
    }
  }, [enabled]);

  // One timeout, set for whenever the oldest mark falls due.
  useEffect(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }

    const due = nextExpiry(state, holdMs);
    if (due === null) return;

    timer.current = window.setTimeout(
      () => setState((current) => expire(current, performance.now(), holdMs)),
      Math.max(0, due - performance.now()),
    );

    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [state, holdMs]);

  const reset = useCallback(() => {
    setState(EMPTY);
    setCommitted(null);
  }, []);

  return { marks: state.marks, committed, reset };
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `node node_modules/vitest/vitest.mjs run src/hooks/use-practice.test.ts`
Expected: PASS, 6 tests.

- [x] **Step 5: Commit**

```bash
git add src/hooks/use-practice.ts src/hooks/use-practice.test.ts
git commit -m "feat: hold practice marks, and let them fade"
```

---

## Task 3: The bed shows what it remembers

**Files:**
- Modify: `src/components/note-tile.tsx`
- Modify: `src/components/keybed.tsx`
- Test: `src/components/note-tile.test.tsx`

- [x] **Step 1: Write the failing tests**

Append to `src/components/note-tile.test.tsx`:

```tsx
it('remembers a note that was played in tune', () => {
  render(
    <NoteTile
      note={noteAt(69)}
      onPlay={() => {}}
      isActive={false}
      tolerance={10}
      notation="western"
      tonic={0}
      mark={{ midi: 69, cents: 3, inTune: true, at: 0 }}
    />,
  );

  expect(screen.getByRole('button')).toHaveAttribute('data-mark', 'in-tune');
});

it('remembers a note that was played out', () => {
  render(
    <NoteTile
      note={noteAt(69)}
      onPlay={() => {}}
      isActive={false}
      tolerance={10}
      notation="western"
      tonic={0}
      mark={{ midi: 69, cents: 28, inTune: false, at: 0 }}
    />,
  );

  expect(screen.getByRole('button')).toHaveAttribute('data-mark', 'out');
});

it('says which note you are meant to play next', () => {
  render(
    <NoteTile
      note={noteAt(69)}
      onPlay={() => {}}
      isActive={false}
      tolerance={10}
      notation="western"
      tonic={0}
      isTarget
    />,
  );

  expect(screen.getByRole('button')).toHaveAttribute('data-target', 'true');
});

it('lets the note being played now win over what it remembers', () => {
  render(
    <NoteTile
      note={noteAt(69)}
      onPlay={() => {}}
      isActive={false}
      detectedCents={2}
      tolerance={10}
      notation="western"
      tonic={0}
      mark={{ midi: 69, cents: 28, inTune: false, at: 0 }}
    />,
  );

  // The live reading is the truth of the moment; the mark is only memory.
  expect(screen.getByRole('button')).toHaveAttribute('data-state', 'in-tune');
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `node node_modules/vitest/vitest.mjs run src/components/note-tile.test.tsx`
Expected: FAIL — `mark` is not a prop, and `data-mark` is absent.

- [x] **Step 3: Add the props**

In `src/components/note-tile.tsx`, extend `NoteTileProps`:

```tsx
  /** How this note was last played, kept after the note stopped sounding. */
  mark?: Mark | null;
  /** True when this is the note the piece is waiting for. */
  isTarget?: boolean;
```

Inside the component, after the existing `wash`/`ink` block:

```tsx
  // Memory sits under the moment: a live reading always wins the wash, because
  // what you are playing now matters more than what you played a minute ago.
  const remembered = mark ? (mark.inTune ? 'in-tune' : 'out') : null;
  if (wash === '' && remembered) {
    wash = mark!.inTune ? 'bg-intune/20' : 'bg-signal/15';
    ink = mark!.inTune ? 'text-intune' : 'text-graphite';
  }
```

Add to the `<button>`:

```tsx
      data-mark={remembered ?? undefined}
      data-target={isTarget ? 'true' : undefined}
```

and append to its `className`:

```tsx
${isTarget ? 'outline outline-2 -outline-offset-2 outline-graphite' : ''}
```

In `src/components/keybed.tsx`, add to `KeybedProps`:

```tsx
  /** What was played earlier in this session, by midi number. */
  marks?: Record<number, Mark>;
  /** The note the piece is waiting for, or null. */
  targetMidi?: number | null;
  /** Limit the plate to these octaves inclusive. Defaults to the whole range. */
  octaves?: { from: number; to: number };
```

and pass `mark={marks?.[note.midi] ?? null}` and `isTarget={note.midi === targetMidi}` to each `NoteTile`. When `octaves` is given, build `CELLS` and the row count from that range instead of the full nine, and set `gridTemplateRows` from the row count rather than the fixed `grid-rows-9` class.

- [x] **Step 4: Run the tests to verify they pass**

Run: `node node_modules/vitest/vitest.mjs run src/components/note-tile.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/note-tile.tsx src/components/keybed.tsx src/components/note-tile.test.tsx
git commit -m "feat: draw remembered marks and the target on the bed"
```

---

## Task 4: The practice control

**Files:**
- Create: `src/components/practice-control.tsx`

- [x] **Step 1: Write the component**

Mirror `record-control.tsx`: a header cap that toggles, plus a popover that closes on outside click and Escape. Props:

```tsx
interface PracticeControlProps {
  on: boolean;
  onToggle: () => void;
  holdMs: number | null;
  onHoldChange: (ms: number | null) => void;
  onReset: () => void;
  /** How many notes are currently remembered, shown so reset has a purpose. */
  marked: number;
  /** Rendered inside the popover: the notes page adds its stage and score. */
  children?: ReactNode;
}
```

The cap uses the shared on/off shape — `KEY_ON` when `on`, `KEY_OFF` otherwise, never both, per `e2e/hover.spec.ts`. The popover lists `HOLDS` as a row of small caps with `aria-pressed`, a `reset` cap, and `children`.

- [x] **Step 2: Check it compiles and the hover rule holds**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no output.

- [x] **Step 3: Commit**

```bash
git add src/components/practice-control.tsx
git commit -m "feat: a practice switch and its settings"
```

---

## Task 5: Practice on the tuner

**Files:**
- Modify: `src/routes/dashboard.tsx`
- Create: `e2e/practice.spec.ts`

- [x] **Step 1: Wire the route**

In `src/routes/dashboard.tsx`:

```tsx
const [practising, setPractising] = useState(false);
const [holdMs, setHoldMs] = useHoldPreference();
const practice = usePractice(match, tolerance, holdMs, practising);
```

Persist the hold with the existing preference hook family — a `usePreference<string>` over the `HOLDS` labels, converted to ms on read, because `useNumberPreference` cannot express "none".

Render `<PracticeControl … />` in the header between `RecordControl` and `ControlsPopover`, and pass `marks={practice.marks}` to `<Keybed />`.

- [x] **Step 2: Write the failing end-to-end test**

`e2e/practice.spec.ts`, using the injected microphone from `e2e/fake-microphone.ts`:

```ts
import { expect, test } from '@playwright/test';
import { openWithTone } from './fake-microphone';

test('the bed remembers a note after you stop playing it', async () => {
  const { context, page } = await openWithTone(440, 'practice');

  await page.getByRole('button', { name: 'listen' }).click();
  await page.getByRole('button', { name: 'practice' }).click();

  const a4 = page.getByRole('button', { name: /^Play A4/ });
  await expect(a4).toHaveAttribute('data-state', 'in-tune', { timeout: 10_000 });

  // Stop the tone: the live tint goes, the memory stays.
  await page.evaluate(() => (window as unknown as { __silence?: () => void }).__silence?.());

  await expect(a4).toHaveAttribute('data-mark', 'in-tune', { timeout: 10_000 });

  await context.close();
});

test('reset clears what the bed remembered', async () => {
  const { context, page } = await openWithTone(440, 'practice-reset');

  await page.getByRole('button', { name: 'listen' }).click();
  await page.getByRole('button', { name: 'practice' }).click();

  const a4 = page.getByRole('button', { name: /^Play A4/ });
  await expect(a4).toHaveAttribute('data-mark', 'in-tune', { timeout: 10_000 });

  await page.getByRole('button', { name: 'practice' }).click();
  await page.getByRole('button', { name: 'reset' }).click();

  await expect(a4).not.toHaveAttribute('data-mark', 'in-tune');

  await context.close();
});
```

Add a `__silence` hook to `e2e/fake-microphone.ts` that stops the oscillators, so a test can prove the mark outlives the sound.

- [x] **Step 3: Run it**

Run: `node node_modules/@playwright/test/cli.js test e2e/practice.spec.ts --reporter=list`
Expected: PASS, 2 tests.

- [x] **Step 4: Check the phone still fits**

Add practice-on to `e2e/mobile.spec.ts` — open practice, then `expectNothingCutOff(await audit(page))`.

Run: `node node_modules/@playwright/test/cli.js test e2e/mobile.spec.ts --reporter=list`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/routes/dashboard.tsx e2e/practice.spec.ts e2e/fake-microphone.ts e2e/mobile.spec.ts
git commit -m "feat: practice mode on the tuner"
```

**Phase A is complete and shippable here.**

---

## Task 6: Following a piece

**Files:**
- Create: `src/lib/follow.ts`
- Test: `src/lib/follow.test.ts`

- [x] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { parseNotation } from './composition';
import { advance, targetsOf, verdicts } from './follow';
import type { Mark } from './practice';

const mark = (midi: number, inTune: boolean): Mark => ({
  midi,
  cents: inTune ? 2 : 30,
  inTune,
  at: 0,
});

describe('targetsOf', () => {
  it('lists the notes to play, and nothing else', () => {
    // A bar takes no time and a hold is not a note of its own.
    const targets = targetsOf(parseNotation('S | R - G'), 0);

    expect(targets.map((target) => target.midi)).toEqual([60, 62, 64]);
  });

  it('is empty for an empty piece', () => {
    expect(targetsOf(parseNotation(''), 0)).toEqual([]);
  });
});

describe('advance', () => {
  const targets = targetsOf(parseNotation('S R G'), 0);

  it('moves on when the right note is played in tune', () => {
    expect(advance(0, targets, mark(60, true))).toBe(1);
  });

  it('stays put when the right note is played out of tune', () => {
    expect(advance(0, targets, mark(60, false))).toBe(0);
  });

  it('stays put when a different note is played', () => {
    expect(advance(0, targets, mark(64, true))).toBe(0);
  });

  it('stops at the end rather than running off it', () => {
    expect(advance(2, targets, mark(64, true))).toBe(3);
    expect(advance(3, targets, mark(64, true))).toBe(3);
  });
});

describe('verdicts', () => {
  it('marks the notes already got right', () => {
    const targets = targetsOf(parseNotation('S R G'), 0);

    expect(verdicts(targets, 2)).toEqual({ 0: 'hit', 1: 'hit' });
  });

  it('has nothing to say before you start', () => {
    expect(verdicts(targetsOf(parseNotation('S R'), 0), 0)).toEqual({});
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `node node_modules/vitest/vitest.mjs run src/lib/follow.test.ts`
Expected: FAIL — cannot resolve `./follow`.

- [x] **Step 3: Implement**

```ts
import type { Line } from './composition';
import { buildSchedule } from './playback';
import type { Mark } from './practice';

/** A note the piece is waiting for, and where it sits on the page. */
export interface Target {
  tokenIndex: number;
  midi: number;
}

/** The sounding notes of a piece, in order. Bars and holds are not targets. */
export function targetsOf(lines: Line[], tonic: number): Target[] {
  return buildSchedule(lines, tonic)
    .placed.filter((item) => item.midi !== null)
    .map((item) => ({ tokenIndex: item.tokenIndex, midi: item.midi as number }));
}

/**
 * Where the piece is after an attempt.
 *
 * Self-paced: only the right note, in tune, moves you on. Anything else leaves
 * the target where it is, so the phrase waits for you rather than running away.
 */
export function advance(index: number, targets: Target[], mark: Mark): number {
  if (index >= targets.length) return targets.length;

  const target = targets[index];
  return target.midi === mark.midi && mark.inTune ? index + 1 : index;
}

/** Which written notes have been got right so far, by token index. */
export function verdicts(
  targets: Target[],
  index: number,
): Record<number, 'hit'> {
  return Object.fromEntries(
    targets.slice(0, index).map((target) => [target.tokenIndex, 'hit' as const]),
  );
}
```

- [x] **Step 4: Run to verify they pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/follow.test.ts`
Expected: PASS, 8 tests.

- [x] **Step 5: Commit**

```bash
git add src/lib/follow.ts src/lib/follow.test.ts
git commit -m "feat: follow a written piece note by note"
```

---

## Task 7: Grading a timed run

**Files:**
- Create: `src/lib/run.ts`
- Test: `src/lib/run.test.ts`

- [x] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { parseNotation } from './composition';
import { buildSchedule } from './playback';
import { grade } from './run';
import type { Sample } from './recording';

/** Readings of one pitch filling a beat, at 60bpm so a beat is 1000ms. */
function beat(index: number, midi: number, cents = 0): Sample[] {
  return Array.from({ length: 20 }, (_, step) => ({
    at: index * 1000 + step * 40,
    midi,
    cents,
  }));
}

const PIECE = buildSchedule(parseNotation('S R G'), 0);

describe('grade', () => {
  it('counts the notes played in tune, in time', () => {
    const samples = [...beat(0, 60), ...beat(1, 62), ...beat(2, 64)];
    const result = grade(PIECE, samples, 60, 10);

    expect(result.notes.map((note) => note.verdict)).toEqual(['hit', 'hit', 'hit']);
    expect(result.hits).toBe(3);
    expect(result.total).toBe(3);
  });

  it('calls a note missed when nothing was played on its beat', () => {
    const result = grade(PIECE, [...beat(0, 60), ...beat(2, 64)], 60, 10);

    expect(result.notes.map((note) => note.verdict)).toEqual(['hit', 'missed', 'hit']);
    expect(result.hits).toBe(2);
  });

  it('calls the wrong note wrong, however well it was played', () => {
    const result = grade(PIECE, [...beat(0, 60), ...beat(1, 65), ...beat(2, 64)], 60, 10);

    expect(result.notes[1]).toMatchObject({ verdict: 'wrong', played: 65 });
  });

  it('calls the right note played badly out, and says by how much', () => {
    const result = grade(PIECE, [...beat(0, 60), ...beat(1, 62, 30), ...beat(2, 64)], 60, 10);

    expect(result.notes[1]).toMatchObject({ verdict: 'out', cents: 30 });
  });

  it('follows the tempo it was played at', () => {
    // At 120bpm a beat is 500ms, so the same phrase happens twice as fast.
    const fast = [
      ...beat(0, 60).map((s) => ({ ...s, at: s.at / 2 })),
      ...beat(1, 62).map((s) => ({ ...s, at: s.at / 2 })),
      ...beat(2, 64).map((s) => ({ ...s, at: s.at / 2 })),
    ];

    expect(grade(PIECE, fast, 120, 10).hits).toBe(3);
  });

  it('scores nothing for an empty run rather than dividing by zero', () => {
    const result = grade(PIECE, [], 60, 10);

    expect(result.hits).toBe(0);
    expect(result.total).toBe(3);
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `node node_modules/vitest/vitest.mjs run src/lib/run.test.ts`
Expected: FAIL — cannot resolve `./run`.

- [x] **Step 3: Implement**

```ts
import { beatSeconds, type Schedule } from './playback';
import type { Sample } from './recording';

export type Verdict = 'hit' | 'out' | 'wrong' | 'missed';

export interface Graded {
  tokenIndex: number;
  expected: number;
  /** What was actually heard on that beat, or null if nothing was. */
  played: number | null;
  cents: number | null;
  verdict: Verdict;
}

export interface RunResult {
  notes: Graded[];
  hits: number;
  total: number;
}

/** The pitch heard most often in a window, which is the note that was played. */
function dominant(samples: Sample[]): { midi: number; cents: number } | null {
  if (samples.length === 0) return null;

  const counts = new Map<number, Sample[]>();
  for (const sample of samples) {
    counts.set(sample.midi, [...(counts.get(sample.midi) ?? []), sample]);
  }

  const [midi, group] = [...counts.entries()].reduce((best, entry) =>
    entry[1].length > best[1].length ? entry : best,
  );

  const cents = group.reduce((total, sample) => total + sample.cents, 0) / group.length;
  return { midi, cents: Math.round(cents) };
}

/**
 * Score a run against the piece.
 *
 * This is a recording judged against a schedule: both already exist, so a
 * timed run needs no clock and no capture of its own. Each note owns the beats
 * it was written for, and whatever was heard during them is what was played.
 */
export function grade(
  schedule: Schedule,
  samples: Sample[],
  bpm: number,
  tolerance: number,
): RunResult {
  const perBeatMs = beatSeconds(bpm) * 1000;

  const notes: Graded[] = schedule.placed
    .filter((item) => item.midi !== null)
    .map((item) => {
      const from = item.startBeat * perBeatMs;
      const to = from + item.beats * perBeatMs;
      const heard = dominant(samples.filter((s) => s.at >= from && s.at < to));
      const expected = item.midi as number;

      if (heard === null) {
        return {
          tokenIndex: item.tokenIndex,
          expected,
          played: null,
          cents: null,
          verdict: 'missed' as const,
        };
      }

      const verdict: Verdict =
        heard.midi !== expected
          ? 'wrong'
          : Math.abs(heard.cents) <= tolerance
            ? 'hit'
            : 'out';

      return {
        tokenIndex: item.tokenIndex,
        expected,
        played: heard.midi,
        cents: heard.cents,
        verdict,
      };
    });

  return {
    notes,
    hits: notes.filter((note) => note.verdict === 'hit').length,
    total: notes.length,
  };
}
```

- [x] **Step 4: Run to verify they pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/run.test.ts`
Expected: PASS, 6 tests.

- [x] **Step 5: Commit**

```bash
git add src/lib/run.ts src/lib/run.test.ts
git commit -m "feat: grade a timed run against the written piece"
```

---

## Task 8: The written page shows how it went

**Files:**
- Modify: `src/components/notation-view.tsx`

- [x] **Step 1: Add the props**

```tsx
  /** How each written note was played, by token index. */
  verdicts?: Record<number, 'hit' | 'out' | 'wrong' | 'missed'>;
  /** The note being waited for, by token index. */
  targetIndex?: number | null;
```

- [x] **Step 2: Colour the cells**

In the note cell's `className`, after the existing playing highlight:

```tsx
verdicts?.[flat] === 'hit'
  ? 'bg-intune/20 text-intune'
  : verdicts?.[flat]
    ? 'bg-signal/15'
    : ''
```

and for the target, the same outline the bed uses:

```tsx
flat === targetIndex ? 'outline outline-2 -outline-offset-2 outline-graphite' : ''
```

Add `data-verdict={verdicts?.[flat]}` so a test can read it without depending on colour.

- [x] **Step 3: Check it compiles**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no output.

- [x] **Step 4: Commit**

```bash
git add src/components/notation-view.tsx
git commit -m "feat: colour the written notes by how they were played"
```

---

## Task 9: Practice a piece on the notes page

**Files:**
- Modify: `src/routes/notes.tsx`
- Modify: `src/components/notation-editor.tsx`

- [x] **Step 1: Listen from the notes page**

`src/routes/notes.tsx` gains `usePitchDetection()` and a `listen` cap in its header, matching the tuner's wording so there is one name for one thing. The match is passed down to `NotationEditor`.

- [x] **Step 2: Hold the practice state in the editor**

`NotationEditor` gains:

```tsx
const [practising, setPractising] = useState(false);
const [stage, setStage] = useState<'learn' | 'run'>('learn');
const [index, setIndex] = useState(0);
const [result, setResult] = useState<RunResult | null>(null);

const targets = useMemo(
  () => targetsOf(lines, composition.tonic),
  [lines, composition.tonic],
);
const practice = usePractice(match, tolerance, holdMs, practising);
```

Advance on a fresh attempt:

```tsx
useEffect(() => {
  if (!practising || stage !== 'learn' || practice.committed === null) return;
  setIndex((current) => advance(current, targets, practice.committed!));
}, [practice.committed, practising, stage, targets]);
```

- [x] **Step 3: Swap the keyboard for the bed while practising**

```tsx
{practising ? (
  <Keybed
    notation={notation}
    tonic={composition.tonic}
    onPlay={() => {}}
    activeMidi={null}
    detectedMidi={match?.note.midi ?? null}
    detectedCents={match?.cents ?? null}
    tolerance={tolerance}
    marks={practice.marks}
    targetMidi={targets[index]?.midi ?? null}
    octaves={octaveRange(targets, match?.note.midi ?? null)}
  />
) : (
  <SwaraKeyboard … />
)}
```

`octaveRange` is a small local helper: the lowest and highest octave among the targets, widened to include whatever is being played now so a stray note is still visible.

- [x] **Step 4: The stage and the score**

Pass `<PracticeControl>` the stage caps (`learn` / `run`) and, after a run, `{result.hits} of {result.total}`. Starting a run clears `result`, records samples through `useRecorder`, and on stop calls `grade(buildSchedule(lines, tonic), samples, bpm, tolerance)`.

- [x] **Step 5: Check it compiles and nothing is cut off**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Run: `node node_modules/@playwright/test/cli.js test e2e/mobile.spec.ts --reporter=list`
Expected: no output; PASS.

- [x] **Step 6: Commit**

```bash
git add src/routes/notes.tsx src/components/notation-editor.tsx
git commit -m "feat: practise a piece from its own page"
```

---

## Task 10: Piece practice end to end

**Files:**
- Modify: `e2e/notes.spec.ts`

- [x] **Step 1: Write the test**

Sign in against the emulator with the injected microphone playing C4 (261.63Hz), write `S R G`, turn on practice, and assert:

- the first written note carries `data-target`
- once C4 has been heard, the first note carries `data-verdict="hit"` and the target has moved to the second
- the bed shown alongside carries `data-mark="in-tune"` on C4

- [x] **Step 2: Run it**

Run: `node node_modules/@playwright/test/cli.js test e2e/notes.spec.ts --reporter=list -g practis`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add e2e/notes.spec.ts
git commit -m "test: practising a piece, end to end"
```

---

## Task 11: Verify and open the PR

- [x] **Step 1: Full verification**

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
node node_modules/vitest/vitest.mjs run
node node_modules/@playwright/test/cli.js test
node node_modules/vite/bin/vite.js build
```

Expected: no type errors; no new lint errors; all unit tests pass; all e2e pass; build succeeds.

- [x] **Step 2: Open the pull request**

```bash
git push -u origin practice-mode
gh pr create --title "Practice mode" --body "…"
```

- [x] **Step 3: Merge**

```bash
gh pr merge --squash --delete-branch
```
