import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';

/**
 * A scan goes in, MusicXML comes out, and nothing stays.
 *
 * This is the one piece of Perfect Pitch that is not the static site: a
 * container that holds Audiveris, because a browser cannot run it. It has no
 * database, no bucket and no archive. Each request gets its own temporary
 * directory, the engine is run against it, the export is read back, and the
 * directory is removed in a `finally` — whether the engine succeeded, failed,
 * or had to be killed.
 *
 * Audiveris is AGPL-3.0. Deploying this service is distributing Audiveris,
 * and the notice in README.md is part of the service for that reason.
 */

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 10;
/** Matches the client's cap: a score it would refuse to store is not worth returning. */
export const MAX_SCORE_XML = 200_000;
export const DEFAULT_TIMEOUT_MS = 90_000;

/** What a file is, by its first bytes rather than by what it says it is. */
function sniff(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_MAGIC)) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'jpg';
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-')
    return 'pdf';
  return null;
}
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Pages in a PDF, counted the cheap way.
 *
 * Page objects are declared as `/Type /Page`; this counts those. A PDF that
 * compresses its object streams hides them, in which case this undercounts —
 * and the engine's own limits, and the timeout, are the backstop. It is a
 * gate on obviously large documents, not an authority.
 */
function pdfPages(bytes) {
  const text = bytes.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page(?![s\w])/g);
  return matches ? matches.length : 1;
}

/**
 * The XML inside an .mxl, which is a zip with the score in it.
 *
 * Only the two compression methods the zip format allows for are handled:
 * stored and deflated. The score is the entry container.xml names, or
 * failing that the first .xml outside META-INF.
 */
function unzipScore(archive) {
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const method = archive.readUInt16LE(offset + 8);
    const compressed = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const name = archive.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const start = offset + 30 + nameLength + extraLength;
    const data = archive.subarray(start, start + compressed);
    entries.set(name, method === 8 ? inflateRawSync(data) : method === 0 ? data : null);
    offset = start + compressed;
  }

  const container = entries.get('META-INF/container.xml');
  const named = container && /full-path="([^"]+)"/.exec(container.toString('utf8'))?.[1];
  const chosen =
    (named && entries.get(named)) ??
    [...entries].find(
      ([name]) => name.endsWith('.xml') && !name.startsWith('META-INF/'),
    )?.[1];

  return chosen ? chosen.toString('utf8') : null;
}

async function exportsUnder(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (/\.(xml|musicxml|mxl)$/i.test(entry.name)) {
      found.push(join(entry.parentPath ?? entry.path, entry.name));
    }
  }
  return found;
}

/** Run the engine with a deadline, killing it if the deadline passes. */
function run(command, args, timeoutMs) {
  return new Promise((resolve) => {
    const [bin, ...prefix] = command;
    const child = execFile(
      bin,
      [...prefix, ...args],
      { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          timedOut: Boolean(error && error.killed),
          code: error && !error.killed ? (error.code ?? 1) : 0,
          stderr: String(stderr ?? ''),
          stdout: String(stdout ?? ''),
        });
      },
    );
    child.on('error', () =>
      resolve({ timedOut: false, code: 127, stderr: '', stdout: '' }),
    );
  });
}

/**
 * The service. Options exist so the tests can point it at a stand-in engine
 * and a temporary root of their own; in production every one comes from the
 * environment.
 */
export function buildApp({
  enabled = process.env.SHEET_MUSIC_ENABLED === 'true',
  command = [process.env.AUDIVERIS_BIN ?? 'audiveris'],
  workRoot = tmpdir(),
  timeoutMs = Number(process.env.RECOGNIZE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  maxBytes = MAX_BYTES,
  allowedOrigin = process.env.ALLOWED_ORIGIN ?? 'https://pitch-perfect-ashen.vercel.app',
  logger = false,
} = {}) {
  const app = Fastify({ logger, bodyLimit: maxBytes + 64 * 1024 });

  // Exactly one file, no fields, no more than the cap. Busboy enforces these
  // as the body streams in, so an oversize upload is cut off rather than
  // buffered.
  app.register(multipart, {
    limits: { files: 1, fileSize: maxBytes, fields: 0, parts: 1 },
    throwFileSizeLimit: false,
  });

  // One origin may call this from a browser: the site. Anything else gets no
  // CORS headers and the browser refuses on its behalf.
  app.addHook('onRequest', async (request, reply) => {
    if (request.headers.origin === allowedOrigin) {
      reply.header('access-control-allow-origin', allowedOrigin);
      reply.header('vary', 'origin');
    }
  });
  app.options('/recognize', async (request, reply) => {
    if (request.headers.origin === allowedOrigin) {
      reply.header('access-control-allow-methods', 'POST');
      reply.header('access-control-allow-headers', 'content-type');
      reply.header('access-control-max-age', '600');
    }
    return reply.code(204).send();
  });

  app.get('/health', async () => ({ ok: true, enabled }));

  app.post('/recognize', async (request, reply) => {
    // Off means absent. A stale client cannot tell this from a service that
    // was never deployed, which is the point.
    if (!enabled) return reply.code(404).send({ error: 'Not found.' });

    let part;
    try {
      part = await request.file();
    } catch (cause) {
      // Busboy's limits arrive as errors with codes; only the size one is
      // the client's file being too big, the rest are the request's shape.
      if (cause?.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.code(413).send({ error: 'The file is larger than 10 MB.' });
      }
      return reply.code(400).send({ error: 'Send one file, as the field "sheet".' });
    }
    if (!part || part.fieldname !== 'sheet') {
      return reply.code(400).send({ error: 'Send one file, as the field "sheet".' });
    }

    const bytes = await part.toBuffer();
    if (part.file.truncated) {
      return reply.code(413).send({ error: 'The file is larger than 10 MB.' });
    }

    const kind = sniff(bytes);
    if (kind === null) {
      return reply.code(415).send({ error: 'Send a PNG, JPEG, WebP or PDF.' });
    }
    if (kind === 'pdf' && pdfPages(bytes) > MAX_PDF_PAGES) {
      return reply
        .code(413)
        .send({ error: `A PDF may have at most ${MAX_PDF_PAGES} pages.` });
    }

    // Everything from here on happens inside one directory that is removed
    // on the way out, whichever way out that is.
    const workDir = await mkdtemp(join(workRoot, 'perfect-pitch-omr-'));
    try {
      const input = join(workDir, `sheet.${kind}`);
      const output = join(workDir, 'out');
      await writeFile(input, bytes);

      const result = await run(
        command,
        [
          '-batch',
          '-transcribe',
          '-export',
          // Plain XML rather than the compressed .mxl; both are read anyway.
          '-option',
          'org.audiveris.omr.sheet.BookManager.useCompression=false',
          '-output',
          output,
          '--',
          input,
        ],
        timeoutMs,
      );

      if (result.timedOut) {
        return reply
          .code(504)
          .send({ error: 'Recognition took too long and was stopped.' });
      }

      const found = await exportsUnder(output).catch(() => []);
      if (found.length !== 1) {
        return reply.code(422).send({
          error:
            found.length === 0
              ? 'No music could be read from that sheet.'
              : 'The sheet produced more than one score; send a single melody line.',
        });
      }

      const raw = await readFile(found[0]);
      const musicXml = found[0].toLowerCase().endsWith('.mxl')
        ? unzipScore(raw)
        : raw.toString('utf8');

      if (
        !musicXml ||
        !/<score-partwise[\s>]/.test(musicXml) ||
        /<!DOCTYPE/i.test(musicXml) ||
        musicXml.length > MAX_SCORE_XML
      ) {
        return reply
          .code(422)
          .send({ error: 'The engine produced a score this cannot use.' });
      }

      const warnings = [];
      if (result.code !== 0) {
        warnings.push(
          'The engine reported problems while reading the sheet; check the result carefully.',
        );
      }
      if ((musicXml.match(/<part\s/g) ?? []).length > 1) {
        warnings.push(
          'More than one part was found; only a single melody line can be imported.',
        );
      }

      return reply.send({ musicXml, warnings });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  return app;
}

// Started directly, rather than imported by a test: serve.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = buildApp({ logger: true });
  const port = Number(process.env.PORT) || 8080;
  app.listen({ port, host: '0.0.0.0' }).catch((cause) => {
    app.log.error(cause);
    process.exit(1);
  });
}
