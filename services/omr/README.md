# Sheet recognition service

One upload in, MusicXML out, nothing kept.

This is the one part of Perfect Pitch that is not the static site. A browser
cannot run an optical music recognition engine, so this container holds
[Audiveris](https://github.com/Audiveris/audiveris) and puts two endpoints in
front of it:

```
GET  /health     → { ok: true, enabled: boolean }
POST /recognize  ← multipart/form-data, one field named "sheet"
                 → { musicXml: string, warnings: string[] }
```

## What it promises

- **Nothing is kept.** Each request gets its own directory under the system
  temp root. The upload is written there, Audiveris runs against it, the
  export is read back, and the directory is removed in a `finally` — on
  success, on failure, and when the engine has to be killed. There is no
  database, no bucket and no request log of file contents.
- **Off means absent.** Unless `SHEET_MUSIC_ENABLED` is exactly `true`,
  `/recognize` answers 404. A client built with the feature on cannot open
  the endpoint after it has been switched off here.
- **Files are judged by their bytes.** PNG, JPEG, WebP and PDF are recognised
  by their signatures, not their declared type. Anything else is 415. Files
  over 10 MB are 413, as is a PDF with more than 10 pages.
- **The engine is on a clock.** After `RECOGNIZE_TIMEOUT_MS` (90 s by default)
  it is killed and the request answers 504.
- **The export is checked before it is returned.** Exactly one score, no
  DOCTYPE, under 200 KB — or 422.

Audiveris reads printed Western notation and does not read it perfectly. The
site treats every result as a draft for review; this service never claims
otherwise.

## Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `SHEET_MUSIC_ENABLED` | `false` | Exactly `true` turns `/recognize` on. |
| `AUDIVERIS_BIN` | `/opt/audiveris/bin/Audiveris` | The engine's launcher. |
| `ALLOWED_ORIGIN` | `https://pitch-perfect-ashen.vercel.app` | The one origin browsers may call from. |
| `RECOGNIZE_TIMEOUT_MS` | `90000` | How long the engine gets per request. |
| `PORT` | `8080` | Where to listen. |
| `JAVA_TOOL_OPTIONS` | `-Xmx1g -Djava.awt.headless=true` | Audiveris's heap. It wants about a gigabyte for a full page. |

The Node service itself is small — well under 256 MB. Audiveris is not; size
the container for the JVM heap above plus headroom, and expect a request to
take several seconds of a full core.

## Running it

```sh
docker build -t perfect-pitch-omr services/omr
docker run --rm -p 8080:8080 -e SHEET_MUSIC_ENABLED=true perfect-pitch-omr
curl -F sheet=@scan.png http://127.0.0.1:8080/recognize
```

Deploy the image to any container host (Fly.io, Cloud Run, Render, a VM with
Docker). It cannot run as a Vercel function. Give the site its URL through
`VITE_SHEET_MUSIC_ENABLED=true` and `VITE_OMR_API_URL=https://…` and redeploy
the site, since Vite inlines those at build time. Set `ALLOWED_ORIGIN` here
to the site's origin.

## Tests

```sh
cd services/omr && bun install && npm test
```

The tests drive the service with a stand-in for Audiveris
(`test/fake-audiveris.mjs`) that produces whatever the case calls for — a
score, two scores, a DOCTYPE, nothing, a compressed `.mxl`, or a process that
never ends — and check what the service does with each, including that the
working directory is empty afterwards. Audiveris itself is not under test
here; it is a released program with its own.

## Licence notice

This image contains Audiveris, © Hervé Bitteur and contributors, licensed
under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html).
Audiveris is not modified here; it is invoked as a separate process by its
command line. Running this service for others to use is making Audiveris
available over a network, and the AGPL asks that its source be available to
those users: it is, at the repository above, at the version pinned in the
Dockerfile (`AUDIVERIS_VERSION`). Keep this notice with any deployment.

The service code in this directory is part of Perfect Pitch and under its
licence.
