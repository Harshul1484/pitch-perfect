# pitch

A dashboard of every musical note on an 88-key piano, A0 through C8. Click any
tile to hear the pitch.

Built on a clean React + TypeScript SPA setup — routing, styling, testing, and
linting all wired up.

## Getting started

```bash
npm install
npm run dev
```

## How it works

All 88 frequencies come from one formula in `src/lib/notes.ts`, in twelve-tone
equal temperament anchored at A4 = 440 Hz:

```
frequency(midi) = 440 * 2 ** ((midi - 69) / 12)
```

MIDI numbers are the index because the octave arithmetic falls out of them
(`floor(midi / 12) - 1`) and the piano range gets clean bounds: A0 = 21,
C8 = 108.

Playback is a Web Audio triangle oscillator with a 15 ms attack and an
exponential decay (`src/lib/audio.ts`) — no audio files, no dependencies. The
ramps exist because starting and stopping a gain node at full amplitude clicks
audibly.

Naturals are light tiles and accidentals dark, borrowing the piano keyboard's
own encoding. Every tile is a real button with an `aria-label` naming the note
and its frequency.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the built output locally |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | ESLint over the repo |
| `npm run format` | Prettier, write mode |
| `npm run typecheck` | `tsc --noEmit` |

## Stack

Vite 8 · React 19 · TypeScript 6 · React Router 8 (library mode) ·
Tailwind CSS 4 · Vitest 5 + Testing Library · ESLint 10 · Prettier 3

TypeScript is pinned to 6.0.3 rather than 7.x because `typescript-eslint`
peers on `>=4.8.4 <6.1.0`. Revisit when that range widens.

## Layout

```
src/
├─ main.tsx      # mounts React
├─ router.tsx    # the route table — add pages here
├─ index.css     # Tailwind import + theme tokens
├─ lib/
│  ├─ notes.ts   # pitch math, the note table, octave grouping
│  └─ audio.ts   # Web Audio playback
├─ routes/       # one file per page
└─ components/   # reusable UI, knows nothing about routing
```

`NoteTile` takes an `onPlay` callback rather than reaching for the audio module
itself, so it stays a pure display component and needs no audio stubbing to
test.

## Design notes

See [`docs/superpowers/specs/`](docs/superpowers/specs/) for the design specs
and the reasoning behind the toolchain and audio choices.
