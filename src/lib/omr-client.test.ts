import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recognizeSheet } from './omr-client';

/**
 * One request, one response, and a sentence for each way it can go wrong.
 * The service is the only thing outside this app a scan is ever sent to, so
 * what is sent — and what is done with the answer — is pinned down exactly.
 */
const scan = new File([new Uint8Array(16)], 'scan.png', { type: 'image/png' });
const ENDPOINT = 'https://omr.example';

const reply = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('recognizeSheet', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the file as one multipart field named sheet', async () => {
    fetchMock.mockResolvedValue(
      reply(200, { musicXml: '<score-partwise/>', warnings: [] }),
    );

    const result = await recognizeSheet(scan, ENDPOINT);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://omr.example/recognize',
      expect.objectContaining({ method: 'POST' }),
    );
    const init = fetchMock.mock.calls[0][1]!;
    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(Array.from(body.keys())).toEqual(['sheet']);
    const sent = body.get('sheet') as File;
    expect(sent.name).toBe('scan.png');
    expect(sent.type).toBe('image/png');
    expect(sent.size).toBe(scan.size);

    expect(result).toEqual({ musicXml: '<score-partwise/>', warnings: [] });
  });

  it('tolerates a trailing slash on the endpoint', async () => {
    fetchMock.mockResolvedValue(
      reply(200, { musicXml: '<score-partwise/>', warnings: [] }),
    );

    await recognizeSheet(scan, 'https://omr.example/');

    expect(fetchMock.mock.calls[0][0]).toBe('https://omr.example/recognize');
  });

  it('refuses to send anything when no endpoint is configured', async () => {
    await expect(recognizeSheet(scan, '')).rejects.toThrow(/not set up/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says the service is switched off when it answers 404', async () => {
    fetchMock.mockResolvedValue(reply(404, { error: 'disabled' }));
    await expect(recognizeSheet(scan, ENDPOINT)).rejects.toThrow(/switched off/i);
  });

  it('relays the service’s own reasons for refusing a file', async () => {
    fetchMock.mockResolvedValue(reply(415, { error: 'unsupported' }));
    await expect(recognizeSheet(scan, ENDPOINT)).rejects.toThrow(/format/i);

    fetchMock.mockResolvedValue(reply(413, { error: 'too large' }));
    await expect(recognizeSheet(scan, ENDPOINT)).rejects.toThrow(/large/i);

    fetchMock.mockResolvedValue(reply(422, { error: 'no music found' }));
    await expect(recognizeSheet(scan, ENDPOINT)).rejects.toThrow(/could not read/i);

    fetchMock.mockResolvedValue(reply(504, { error: 'timeout' }));
    await expect(recognizeSheet(scan, ENDPOINT)).rejects.toThrow(/too long/i);
  });

  it('reports a service that cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(recognizeSheet(scan, ENDPOINT)).rejects.toThrow(/could not be reached/i);
  });

  it('refuses an answer that is not the shape it asked for', async () => {
    fetchMock.mockResolvedValue(reply(200, { music: 'nope' }));
    await expect(recognizeSheet(scan, ENDPOINT)).rejects.toThrow(/unexpected/i);

    fetchMock.mockResolvedValue(reply(200, 'not json'));
    await expect(recognizeSheet(scan, ENDPOINT)).rejects.toThrow(/unexpected/i);

    fetchMock.mockResolvedValue(reply(200, { musicXml: '', warnings: [] }));
    await expect(recognizeSheet(scan, ENDPOINT)).rejects.toThrow(/unexpected/i);
  });

  it('keeps only the warnings that are strings', async () => {
    fetchMock.mockResolvedValue(
      reply(200, { musicXml: '<score-partwise/>', warnings: ['faint staff', 7, null] }),
    );

    const result = await recognizeSheet(scan, ENDPOINT);
    expect(result.warnings).toEqual(['faint staff']);
  });

  it('passes an abort signal through, so a scan can be cancelled', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    });

    const pending = recognizeSheet(scan, ENDPOINT, controller.signal);
    controller.abort();

    await expect(pending).rejects.toThrow(/cancelled/i);
  });
});
