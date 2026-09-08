# Sheet music import and generation

**Status:** Proposed

## Goal

Let a signed-in player turn a clear, printed, single-melody Western score
(PNG, JPEG, WebP, or PDF) into an editable Perfect Pitch piece. Let the player
also render any compatible piece as a printable treble-clef score. Original
uploads are never persisted: only their derived symbolic notation is saved.

The feature is deliberately limited to printed, single-staff melody sheets in
the first release. It rejects handwriting, multi-part/piano systems, tablature,
and files that are too large or indistinct to scan honestly.

## Availability

`VITE_SHEET_MUSIC_ENABLED` is the global, build-time switch.

- It defaults to `false` in `.env.example` and in the application when unset.
- When false, the Notes route renders no sheet import, preview, export, or
  related keyboard affordance. The sheet modules are lazy loaded only from the
  enabled branch.
- When true, it is visible to every signed-in player. On Vercel, changing this
  environment variable requires a redeploy because Vite substitutes `VITE_*`
  values while building the client.

The recognition service independently rejects requests unless its own
`SHEET_MUSIC_ENABLED=true` setting is enabled. A stale client therefore cannot
open the processing endpoint after a feature is switched off.

## Data model

The current compact notation text remains the source used by the existing
editor, playback, and practice modes. A `score` extension is added only when a
piece is imported or rendered as a score:

```ts
interface ScoreData {
  version: 1;
  musicXml: string;
  source: 'imported' | 'generated';
  timeSignature: { beats: number; beatType: number };
  tempo: number;
}
```

`musicXml` is symbolic, editable score data, not the uploaded image or PDF.
It is saved in the existing owner-only composition document along with title,
notation, and tonic. The document limit is enforced in client validation and
Firestore rules. The source upload, rendered SVG, PDF, and temporary OMR files
are never written to Firestore, Firebase Storage, or a project directory.

Imported MusicXML is projected into the existing note tokens. Bars become
`|`; note durations are represented with the existing held/tied beat notation
when possible. The score preview remains the authority for rhythm that cannot
be represented exactly in the compact notation. Pre-existing pieces receive a
generated 4/4 score: one beat per plain note, holds extending the preceding
note, and tied groups sharing a beat.

## Recognition service

Recognition is a separate container service because the static Vite/Vercel
client cannot execute a full OMR engine. It exposes two endpoints:

```
GET  /health
POST /recognize
```

`POST /recognize` accepts one file in memory, validates type, page count and
size, invokes the OMR engine, validates the returned MusicXML, and returns the
symbolic score plus warnings. Input and intermediate files live in a unique
temporary directory that is deleted in a `finally` block. The service has no
database, storage bucket, or request archive.

The initial engine is Audiveris running inside that container. It is suited to
printed Western notation and exports MusicXML, but it must not claim perfect
recognition; the import UI always requires review. Audiveris is AGPL-3.0, so
the service deployment and distribution must preserve its licensing notices.

The browser knows only `VITE_OMR_API_URL`. It sends the source through HTTPS
directly to that endpoint, with no Firebase upload. Production deployment of
the container is a separate hosting configuration step; it cannot run in a
Vercel function.

## Player flow

1. From a signed-in Notes page, `import sheet` opens a file picker and explains
   the printed single-melody requirement.
2. The browser checks the file before any upload: supported type, at most 10
   MB, PDF at most 10 pages, and a readable image/PDF preview.
3. The user presses `scan`; the client sends it to the transient OMR service.
4. A review screen shows the engraved score, recognized title/key/time data,
   warnings, and the compact editable notation. The user can correct the
   notation before choosing `create piece`.
5. Creating the piece writes only title, notation, tonic, and score data. The
   browser releases the local object URL and the recognition service deletes
   the source.

Failure is explicit and recoverable: a missing service, invalid/empty
MusicXML, unsupported score layout, or an unrecognizable scan preserves the
local preview and offers retry or cancellation. No failed file is retained.

## Score generation

`view sheet` on an existing piece builds MusicXML locally from its notes when
needed, then uses OpenSheetMusicDisplay in a lazy-loaded module to engrave SVG
in the browser. The view supports:

- print / browser “Save as PDF”;
- download of the generated MusicXML;
- a score preview which is discarded when closed.

No score image or PDF is stored. A generated score uses treble clef, the
piece’s tonic/key, 4/4 by default, and its existing bar/hold/tie information.

## Security and limits

- Feature flag false means no front-end entry point and a disabled service.
- Client and service both enforce MIME sniffing, 10 MB input limit, and PDF
  page limit before OMR work begins.
- The service sets a bounded processing timeout and never follows URLs from
  uploads.
- MusicXML is parsed as data, never injected as HTML. The engraver receives a
  sanitized XML document, and downloaded output is a Blob.
- Composition rules remain owner-only and validate score XML as a bounded
  string. The client rejects oversized generated/imported score payloads before
  save.

## Verification

- Unit tests cover feature-flag parsing, file eligibility, MusicXML-to-token
  projection, token-to-MusicXML generation, and sanitation/size limits.
- Component tests cover disabled UI, rejected files, review corrections,
  cancel/retry, and score generation from existing notes.
- End-to-end tests run with a deterministic fake recognition response and
  prove a source file is never sent to Firestore while the created piece is
  playable and printable.
- The service integration suite checks temporary input cleanup, timeout,
  invalid MusicXML, and the feature-disabled response.

## Non-goals for the first release

- Handwritten notation, multiple staves/parts, chords, lyrics, tablature,
  percussion, and transposition of a scanned score.
- Retaining uploaded files, source previews, PDF/SVG exports, or scan history.
- Claiming automatic transcription is perfect; review is mandatory.
