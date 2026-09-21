# pitch

Play your violin and the app tells you which note you are playing — and how in
tune it is. The tile lights up green when you are within 10 cents, amber when
you are not.

Tiles double as a soundboard: click one to hear the target pitch, then match it
on the instrument.

## Getting started

```bash
npm install
npm run dev
```

Press **Listen** and allow microphone access. The microphone needs HTTPS or
localhost — `npm run dev` serves localhost, so it works out of the box.

## Why cents matter

A violin has no frets, so a note 30 cents flat is still recognisably "C4". An
app that only named the note would call a badly out-of-tune note correct. The
cents readout is the part worth having.

The full 88-key grid stays visible rather than narrowing to the standard violin
range, because scordatura tunings — DADA, FEFE, other cross-tunings — move the
reachable range around.

## How it works

Frequencies come from one equal-temperament formula in `src/lib/notes.ts`,
anchored at A4 = 440 Hz:

```
frequency(midi) = 440 * 2 ** ((midi - 69) / 12)
```

Detection (`src/lib/pitch.ts`) uses the McLeod Pitch Method: it builds a
Normalised Square Difference Function and takes the first strong peak rather
than the tallest. That is what stops a bowed string's loud harmonics from
being reported an octave high.

**One note at a time.** Double stops will read as one note or waver between
the two — inherent to monophonic detection.

Capture runs with `echoCancellation`, `noiseSuppression` and `autoGainControl`
all off. Each of them mangles a sustained tone.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the built output locally |
| `npm test` | Vitest unit tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run e2e` | Playwright tests in real Chrome |
| `npm run lint` | ESLint over the repo |
| `npm run format` | Prettier, write mode |
| `npm run typecheck` | `tsc --noEmit` |

## Testing

Unit tests drive the detector with synthesised tones and assert accuracy in
cents, including a guard against the octave error.

End-to-end tests run in real Chrome with a persistent profile, replacing
`getUserMedia` with a Web Audio oscillator at a known pitch. Chrome's own
`--use-file-for-fake-audio-capture` was tried first and abandoned: it rendered
WAV fixtures so poorly that clarity sat at 0.2–0.3, testing Chrome's audio
plumbing rather than this app.

## Sheet music (off by default)

A signed-in player can turn a photo or PDF of one printed melody line into a
piece, and print any piece as a treble-clef sheet. It is behind a build-time
flag and ships off.

**Turning it on** takes two variables on the site and one container service:

| Where | Variable | Value |
| --- | --- | --- |
| Vercel (site) | `VITE_SHEET_MUSIC_ENABLED` | exactly `true` — anything else leaves it off |
| Vercel (site) | `VITE_OMR_API_URL` | the recognition service's URL, e.g. `https://omr.example.com` |
| the service | `SHEET_MUSIC_ENABLED` | exactly `true` |

Both site variables are inlined by Vite when the bundle is built, so changing
either one needs a **redeploy** of the site, not just a saved setting. The
service is the container in [`services/omr`](services/omr/README.md) — it holds
Audiveris, which cannot run in a browser or in a Vercel function — deployed to
any container host and pointed back at the site's origin through
`ALLOWED_ORIGIN`.

**What is kept, and what is not.** A scan is sent once, over HTTPS, straight
from the browser to the service. Neither end keeps it: the browser holds it in
memory for the duration of the scan and releases its preview URL the moment
the import is created, cancelled or replaced, and the service writes it to a
per-request temporary directory that is removed in a `finally`. What is saved
is the piece — title, the notation as corrected on the review screen, tonic,
and the symbolic MusicXML the scan produced — in the owner's own Firestore
document, whose rules refuse any other field. The end-to-end test reads that
document back and checks for the file's bytes, its name, and any data or blob
URL, and finds none.

**Review is mandatory.** No recogniser reads a photograph perfectly. Every scan
is shown for correction, with the engraved score beside the notation and
whatever the recogniser or the projection wanted flagged, before a piece is
made from it.

**What it reads.** Printed, single-staff, treble-clef Western notation as PNG,
JPEG, WebP or PDF of at most 10 MB and 10 pages. Not handwriting, not piano
systems, not chords, not tablature — those are refused or reduced, and said so.

## Stack

Vite 8 · React 19 · TypeScript 6 · React Router 8 · Tailwind CSS 4 ·
Vitest 5 + Testing Library · Playwright · ESLint 10 · Prettier 3

TypeScript is pinned to 6.0.3 rather than 7.x because `typescript-eslint`
peers on `>=4.8.4 <6.1.0`.

## Layout

```
src/
├─ lib/
│  ├─ notes.ts    # pitch math, the note table, frequency to note
│  ├─ audio.ts    # reference tone playback
│  └─ pitch.ts    # microphone pitch detection (MPM)
├─ hooks/
│  └─ use-pitch-detection.ts   # microphone lifecycle
├─ components/    # note tile, octave row, readout, cents meter
└─ routes/
   └─ dashboard.tsx

services/
└─ omr/            # sheet recognition: Audiveris in a container, nothing kept
```

Sheet music lives in `lib/feature-flags.ts`, `lib/score.ts`, `lib/musicxml.ts`,
`lib/sheet-file.ts`, `lib/omr-client.ts`, `lib/engrave.ts` and the
`sheet-*` and `engraved` components, all reached only from the enabled branch.

## Design notes

See [`docs/superpowers/specs/`](docs/superpowers/specs/) for the design specs,
including measured threshold data and the reasoning behind the detection
algorithm.
