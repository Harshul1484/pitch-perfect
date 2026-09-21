import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { buildApp } from '../src/server.mjs';

/**
 * The service, end to end, with a stand-in for Audiveris.
 *
 * What is under test is everything around the engine: which files get as
 * far as it, what its output has to look like to be returned, and — above
 * all — that nothing it was given or produced is still on disk afterwards.
 */
const here = dirname(fileURLToPath(import.meta.url));
const FAKE = join(here, 'fake-audiveris.mjs');

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBP'),
  Buffer.alloc(64),
]);
const pdfWithPages = (pages) =>
  Buffer.from(
    `%PDF-1.4\n` +
      Array.from(
        { length: pages },
        (_, i) => `${i + 2} 0 obj << /Type /Page >> endobj\n`,
      ).join('') +
      `1 0 obj << /Type /Pages /Count ${pages} >> endobj\n%%EOF`,
  );

/** A multipart body with one file field, the way a browser's FormData sends it. */
function multipart(name, filename, type, bytes, extraField) {
  const boundary = '----perfectpitch' + Math.random().toString(16).slice(2);
  const parts = [];
  if (extraField) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${extraField[0]}"\r\n\r\n${extraField[1]}\r\n`,
    );
  }
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`,
  );
  const head = Buffer.from(parts.join(''));
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, bytes, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

describe('the recognition service', () => {
  let workRoot;
  let app;

  const start = async (overrides = {}) => {
    if (app) await app.close();
    app = buildApp({
      enabled: true,
      workRoot,
      command: [process.execPath, FAKE],
      timeoutMs: 5_000,
      allowedOrigin: 'https://pitch-perfect-ashen.vercel.app',
      ...overrides,
    });
    await app.ready();
    return app;
  };

  // The stand-in reads its mode from FAKE_AUDIVERIS in the environment of the
  // process the service spawns, which inherits this one's.
  const recognize = (body) => app.inject({ method: 'POST', url: '/recognize', ...body });

  before(async () => {
    workRoot = await mkdtemp(join(tmpdir(), 'omr-test-'));
    await start();
  });

  after(async () => {
    await app?.close();
    await rm(workRoot, { recursive: true, force: true });
    delete process.env.FAKE_AUDIVERIS;
  });

  it('answers health whether or not recognition is on', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true, enabled: true });
  });

  it('turns a scan into MusicXML and leaves nothing behind', async () => {
    process.env.FAKE_AUDIVERIS = 'export';
    const response = await recognize(multipart('sheet', 'scan.png', 'image/png', PNG));

    assert.equal(response.statusCode, 200, response.body);
    const body = response.json();
    assert.match(body.musicXml, /<score-partwise/);
    assert.ok(Array.isArray(body.warnings));
    assert.deepEqual(await readdir(workRoot), []);
  });

  it('takes the other three formats too, judged by their bytes', async () => {
    process.env.FAKE_AUDIVERIS = 'export';
    for (const [name, type, bytes] of [
      ['scan.jpg', 'image/jpeg', JPEG],
      ['scan.webp', 'image/webp', WEBP],
      ['scan.pdf', 'application/pdf', pdfWithPages(2)],
    ]) {
      const response = await recognize(multipart('sheet', name, type, bytes));
      assert.equal(response.statusCode, 200, `${name}: ${response.body}`);
    }
  });

  it('unpacks a compressed .mxl export', async () => {
    process.env.FAKE_AUDIVERIS = 'mxl';
    const response = await recognize(multipart('sheet', 'scan.png', 'image/png', PNG));

    assert.equal(response.statusCode, 200, response.body);
    assert.match(response.json().musicXml, /<score-partwise/);
    assert.deepEqual(await readdir(workRoot), []);
  });

  it('is not there at all while the feature is off', async () => {
    await start({ enabled: false });
    const response = await recognize(multipart('sheet', 'scan.png', 'image/png', PNG));
    assert.equal(response.statusCode, 404);

    const health = await app.inject({ method: 'GET', url: '/health' });
    assert.deepEqual(health.json(), { ok: true, enabled: false });
    await start();
  });

  it('refuses a file whose bytes are not one of the four formats', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    // Declared as PNG, which is what a renamed file looks like.
    const response = await recognize(multipart('sheet', 'scan.png', 'image/png', svg));
    assert.equal(response.statusCode, 415);
    assert.deepEqual(await readdir(workRoot), []);
  });

  it('refuses a file over the size limit', async () => {
    await start({ maxBytes: 1024 });
    const big = Buffer.concat([PNG, Buffer.alloc(2048)]);
    const response = await recognize(multipart('sheet', 'scan.png', 'image/png', big));
    assert.equal(response.statusCode, 413);
    assert.deepEqual(await readdir(workRoot), []);
    await start();
  });

  it('refuses a PDF with more pages than it will read', async () => {
    const response = await recognize(
      multipart('sheet', 'scan.pdf', 'application/pdf', pdfWithPages(11)),
    );
    assert.equal(response.statusCode, 413);
    assert.match(response.json().error, /pages/i);
  });

  it('refuses a request with a second field or the wrong field name', async () => {
    const extra = await recognize(
      multipart('sheet', 'scan.png', 'image/png', PNG, ['note', 'hello']),
    );
    assert.equal(extra.statusCode, 400);

    const misnamed = await recognize(multipart('file', 'scan.png', 'image/png', PNG));
    assert.equal(misnamed.statusCode, 400);
  });

  it('reports an engine that produced nothing', async () => {
    process.env.FAKE_AUDIVERIS = 'nothing';
    const response = await recognize(multipart('sheet', 'scan.png', 'image/png', PNG));
    assert.equal(response.statusCode, 422);
    assert.deepEqual(await readdir(workRoot), []);
  });

  it('reports an engine that produced more than one score', async () => {
    process.env.FAKE_AUDIVERIS = 'twice';
    const response = await recognize(multipart('sheet', 'scan.png', 'image/png', PNG));
    assert.equal(response.statusCode, 422);
  });

  it('refuses an export that declares a DOCTYPE', async () => {
    process.env.FAKE_AUDIVERIS = 'doctype';
    const response = await recognize(multipart('sheet', 'scan.png', 'image/png', PNG));
    assert.equal(response.statusCode, 422);
    assert.deepEqual(await readdir(workRoot), []);
  });

  it('gives up on an engine that does not finish, and still cleans up', async () => {
    await start({ timeoutMs: 300 });
    process.env.FAKE_AUDIVERIS = 'hang';
    const response = await recognize(multipart('sheet', 'scan.png', 'image/png', PNG));
    assert.equal(response.statusCode, 504);
    assert.deepEqual(await readdir(workRoot), []);
    await start();
  });

  it('answers a browser preflight for the one allowed origin only', async () => {
    const allowed = await app.inject({
      method: 'OPTIONS',
      url: '/recognize',
      headers: {
        origin: 'https://pitch-perfect-ashen.vercel.app',
        'access-control-request-method': 'POST',
      },
    });
    assert.equal(allowed.statusCode, 204);
    assert.equal(
      allowed.headers['access-control-allow-origin'],
      'https://pitch-perfect-ashen.vercel.app',
    );

    const other = await app.inject({
      method: 'OPTIONS',
      url: '/recognize',
      headers: {
        origin: 'https://evil.example',
        'access-control-request-method': 'POST',
      },
    });
    assert.equal(other.headers['access-control-allow-origin'], undefined);
  });
});
