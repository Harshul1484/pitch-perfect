# Sheet Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import a clear printed melody sheet into an editable private piece and generate a printable sheet from a piece, behind one global feature flag.

**Architecture:** The React app validates, reviews, converts, renders, and stores symbolic score data only. A separate Audiveris container accepts one upload in a temporary workspace, returns MusicXML, and removes its workspace in `finally`.

**Tech Stack:** React 19, TypeScript, Vite, Firebase Auth/Firestore, Vitest, Playwright, OpenSheetMusicDisplay, Node 22, Fastify, Busboy, Audiveris CLI, Docker.

**Spec:** `docs/superpowers/specs/2026-09-09-sheet-music-design.md`

## Global Constraints

- `VITE_SHEET_MUSIC_ENABLED` defaults to exactly `false`; false renders no sheet controls.
- V1 accepts only printed, single-staff Western melody PNG, JPEG, WebP, or PDF files at most 10 MB; PDFs have at most 10 pages.
- Never persist the upload, object URL, rendered SVG/PDF, or scan history.
- Persist only bounded owner-scoped symbolic MusicXML in the composition document.
- All scans require review; no automatic result is claimed perfect.
- The user installs packages with Bun. Do not push implementation commits unless asked.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/feature-flags.ts` | Safe build-time flag parser. |
| `src/lib/score.ts` | Score type and size validation. |
| `src/lib/sheet-file.ts` | Upload eligibility only; no retained bytes. |
| `src/lib/musicxml.ts` | Compact notation ⇄ monophonic MusicXML. |
| `src/lib/omr-client.ts` | Typed, transient recognition request. |
| `src/components/sheet-preview.tsx` | Lazy browser engraving and print/download. |
| `src/components/sheet-import.tsx` | Pick, scan, review, cancel, create piece. |
| `services/omr/src/server.mjs` | Ephemeral Audiveris API. |

### Task 1: Feature flag and symbolic score persistence

**Files:** Create `src/lib/feature-flags.ts`, `src/lib/feature-flags.test.ts`, `src/lib/score.ts`, `src/lib/score.test.ts`. Modify `.env.example`, `src/hooks/use-compositions.ts`, and `firestore.rules`.

**Interfaces produced:**

```ts
export const MAX_SCORE_XML = 200_000;
export interface ScoreData {
  version: 1; musicXml: string; source: 'imported' | 'generated';
  timeSignature: { beats: number; beatType: number }; tempo: number;
}
export function isSheetMusicEnabled(raw?: string): boolean;
export function isScoreData(value: unknown): value is ScoreData;
```

- [x] **Step 1: Write the failing tests.**

```ts
expect(isSheetMusicEnabled(undefined)).toBe(false);
expect(isSheetMusicEnabled('false')).toBe(false);
expect(isSheetMusicEnabled('true')).toBe(true);
expect(isScoreData({ version: 1, musicXml: '<score-partwise/>', source: 'generated', timeSignature: { beats: 4, beatType: 4 }, tempo: 80 })).toBe(true);
expect(isScoreData({ musicXml: 'x'.repeat(MAX_SCORE_XML + 1) })).toBe(false);
```

- [x] **Step 2: Run red.** Run `bunx vitest run src/lib/feature-flags.test.ts src/lib/score.test.ts`; expect missing-module failures.
- [x] **Step 3: Implement green.** Return true only for the literal string `true`. Validate exact score version/source, nonempty XML at most `MAX_SCORE_XML`, time values `1..32`, and tempo `30..260`. Make `score?: ScoreData` flow through composition snapshot/create/save. Add `VITE_SHEET_MUSIC_ENABLED=false` and `VITE_OMR_API_URL=`. Permit an optional bounded score in the composition Firestore allowlist.
- [x] **Step 4: Verify.** Run `bunx vitest run src/lib/feature-flags.test.ts src/lib/score.test.ts; bunx tsc --noEmit`; expect PASS.
- [x] **Step 5: Commit.** `git add src/lib/feature-flags* src/lib/score* src/hooks/use-compositions.ts firestore.rules .env.example && git commit -m "feat: add gated sheet score data"`

### Task 2: File validation and MusicXML conversion

**Files:** Create `src/lib/sheet-file.ts`, `src/lib/sheet-file.test.ts`, `src/lib/musicxml.ts`, `src/lib/musicxml.test.ts`.

**Interfaces produced:**

```ts
export const MAX_SHEET_BYTES = 10 * 1024 * 1024;
export function checkSheetFile(file: File): string | null;
export function scoreFromLines(lines: Line[], tonic: number, title: string, tempo: number): ScoreData;
export function linesFromMusicXml(xml: string, tonic: number): { title: string; lines: Line[]; score: ScoreData; warnings: string[] };
```

- [x] **Step 1: Write failing tests.**

```ts
expect(checkSheetFile(new File(['x'], 'scan.png', { type: 'image/png' }))).toBeNull();
expect(checkSheetFile(new File(['x'], 'scan.svg', { type: 'image/svg+xml' }))).toMatch(/png, jpeg, webp, or pdf/i);
expect(serializeLines(linesFromMusicXml(FIXTURE, 0).lines)).toBe('S R | G -');
expect(scoreFromLines(parseNotation('S R | G -'), 0, 'Etude', 80).musicXml).toContain('<step>C</step>');
```

- [x] **Step 2: Run red.** Run `bunx vitest run src/lib/sheet-file.test.ts src/lib/musicxml.test.ts`; expect missing-module failures.
- [x] **Step 3: Implement green.** Validate only four MIME types and the 10 MB cap without caching bytes. Parse MusicXML with `DOMParser`, reject parser errors and `DOCTYPE`, require one part/treble staff, map pitches with `tokenFromMidi`, measures to bars, and unrepresentable rhythm to review warnings. Generate complete 4/4 score-partwise XML; plain note = beat, sustain = extension, grouped notes share the beat.
- [x] **Step 4: Verify.** Run `bunx vitest run src/lib/sheet-file.test.ts src/lib/musicxml.test.ts; bunx vitest run`; expect PASS.
- [x] **Step 5: Commit.** `git add src/lib/sheet-file* src/lib/musicxml* && git commit -m "feat: convert single melody scores to notes"`

### Task 3: Browser score preview and export

**Files:** Create `src/components/sheet-preview.tsx`, `src/components/sheet-preview.test.tsx`. Modify `package.json` and `src/components/notation-editor.tsx`.

**Interface produced:**

```tsx
export function SheetPreview(props: { score: ScoreData; title: string; onClose(): void }): ReactNode;
```

- [x] **Step 1: Write failing component tests.**

```tsx
render(<SheetPreview score={SCORE} title="Etude" onClose={close} />);
await expect(screen.findByLabelText('sheet music')).resolves.toBeVisible();
await user.click(screen.getByRole('button', { name: 'download musicxml' }));
expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
```

- [x] **Step 2: Run red.** Run `bunx vitest run src/components/sheet-preview.test.tsx`; expect missing-component failure.
- [x] **Step 3: Implement green.** Add `opensheetmusicdisplay` to `package.json` for the user’s Bun install. Dynamically import it only after the modal opens; render an SVG container labeled `sheet music`; revoke the download object URL; call `window.print()` after applying a print class. Add the feature-gated `view sheet` cap. Use `composition.score ?? scoreFromLines(lines, tonic, title, bpm)` so old pieces work.
- [ ] **Step 4: Verify.** Run `bunx vitest run src/components/sheet-preview.test.tsx; bunx tsc --noEmit`; expect PASS. Build with the false flag and assert there is no visible control.
- [x] **Step 5: Commit.** `git add package.json src/components/sheet-preview* src/components/notation-editor.tsx && git commit -m "feat: render printable sheets from notes"`

### Task 4: Import, review, and private creation flow

**Files:** Create `src/lib/omr-client.ts`, `src/lib/omr-client.test.ts`, `src/components/sheet-import.tsx`, `src/components/sheet-import.test.tsx`. Modify `src/routes/notes.tsx`, `src/hooks/use-compositions.ts`, and `e2e/notes.spec.ts`.

**Interface produced:**

```ts
export async function recognizeSheet(file: File, endpoint: string): Promise<{ musicXml: string; warnings: string[] }>;
```

- [x] **Step 1: Write failing workflow tests.**

```tsx
await user.upload(screen.getByLabelText('sheet file'), badSvg);
expect(screen.getByRole('alert')).toHaveTextContent('PNG, JPEG, WebP, or PDF');
await user.upload(screen.getByLabelText('sheet file'), clearPng);
await user.click(screen.getByRole('button', { name: 'scan sheet' }));
expect(fetch).toHaveBeenCalledWith('https://omr.example/recognize', expect.objectContaining({ method: 'POST' }));
await user.click(screen.getByRole('button', { name: 'create piece' }));
expect(create).toHaveBeenCalledWith('Etude', 0, expect.objectContaining({ source: 'imported' }));
```

- [x] **Step 2: Run red.** Run `bunx vitest run src/lib/omr-client.test.ts src/components/sheet-import.test.tsx`; expect missing-module failures.
- [x] **Step 3: Implement green.** Send one `FormData` field named `sheet` to `${VITE_OMR_API_URL}/recognize`; never call Firebase Storage. Keep File/object URL in local state only and revoke it on cancel/replacement/unmount. Show warnings and editable projected notation before create. Create atomically with the imported `ScoreData`; lazy-load and render every UI only when the feature flag is true.
- [ ] **Step 4: Verify.** Run component tests plus `bunx playwright test e2e/notes.spec.ts --grep "sheet"`; mock recognition and assert Firestore receives symbolic score data, never source bytes/data URL.
- [x] **Step 5: Commit.** `git add src/lib/omr-client* src/components/sheet-import* src/routes/notes.tsx src/hooks/use-compositions.ts e2e/notes.spec.ts && git commit -m "feat: import reviewed sheet music"`

### Task 5: Ephemeral Audiveris recognition service

**Files:** Create `services/omr/package.json`, `services/omr/src/server.mjs`, `services/omr/src/server.test.mjs`, `services/omr/Dockerfile`, `services/omr/.dockerignore`, and `services/omr/README.md`.

**Endpoints:** `GET /health` and `POST /recognize`.

- [x] **Step 1: Write failing service tests.**

```js
const response = await app.inject({ method: 'POST', url: '/recognize', payload: form });
assert.equal(response.statusCode, 200);
assert.match(response.json().musicXml, /<score-partwise/);
assert.deepEqual(await readdir(WORK_ROOT), []);
```

- [x] **Step 2: Run red.** Run `node --test services/omr/src/server.test.mjs`; expect missing-service failure.
- [x] **Step 3: Implement green.** Use Fastify/Busboy limits `{ files: 1, fileSize: 10 * 1024 * 1024, fields: 0 }`. Return 404 when `SHEET_MUSIC_ENABLED !== 'true'`, 415 for unsupported MIME, 413 for oversize, 422 for invalid export, and 504 after 90 seconds. Create `mkdtemp(join(tmpdir(), 'perfect-pitch-omr-'))`, run `AUDIVERIS_BIN -batch -transcribe -export -output <out> -- <input>`, find exactly one export, validate without external entities, then delete the workspace in `finally`.
- [x] **Step 4: Containerize/document.** Pin an Audiveris release, expose port 8080, set CORS to `https://pitch-perfect-ashen.vercel.app`, and document AGPL-3.0 notice, `SHEET_MUSIC_ENABLED`, `AUDIVERIS_BIN`, 256 MB RAM, and deployment as a container service—not Vercel.
- [ ] **Step 5: Verify and commit.** Run `node --test services/omr/src/server.test.mjs`; then `git add services/omr && git commit -m "feat: add transient sheet recognition service"`.

### Task 6: Release verification

**Files:** Modify `README.md`, `.env.example`, and `e2e/notes.spec.ts`.

- [ ] **Step 1: Add failing acceptance tests.**

```ts
await expect(page.getByRole('button', { name: /import sheet/i })).toHaveCount(0);
// With flag true and a mocked valid response: import, correct, create, reopen,
// and assert the score preview plus print/download actions exist.
```

- [ ] **Step 2: Run red.** Run `bunx playwright test e2e/notes.spec.ts --grep "sheet"`; expect failure before final flag/test wiring.
- [ ] **Step 3: Implement release configuration.** Seed true only in sheet e2e contexts; route the endpoint to a deterministic mocked MusicXML response. Document the two Vercel variables, redeploy requirement, and no-upload-retention guarantee.
- [ ] **Step 4: Verify full release suite.** Run `bunx vitest run; bunx eslint .; bunx tsc --noEmit; bun run build; bunx playwright test`; expect all tests pass, with only the existing two lint warnings if unchanged.
- [ ] **Step 5: Commit.** `git add README.md .env.example e2e/notes.spec.ts && git commit -m "docs: document gated sheet music release"`
