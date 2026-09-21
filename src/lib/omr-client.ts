/**
 * The one request this app makes to anything other than Firebase.
 *
 * A scan goes to the recognition service as a single multipart field and
 * comes back as MusicXML plus whatever the service wants to say about it.
 * Nothing is retried, nothing is cached and the file is not held here: the
 * caller owns it, this borrows it for the duration of one request.
 *
 * Every way the request can fail has its own sentence, because the person
 * reading it has a photo of a sheet in front of them and needs to know
 * whether to try again, try a better photo, or give up for today.
 */

export interface Recognition {
  musicXml: string;
  warnings: string[];
}

/** What the service says, by status, in words for the player. */
const REASONS: Record<number, string> = {
  404: 'Recognition is switched off on the service at the moment.',
  413: 'The service found that file too large to scan.',
  415: 'The service does not accept that file format.',
  422: 'The service could not read music from that sheet. A clearer, straighter photo of a single printed line usually helps.',
  504: 'The scan took too long and was stopped. A smaller or sharper image may go through.',
};

export async function recognizeSheet(
  file: File,
  endpoint: string,
  signal?: AbortSignal,
): Promise<Recognition> {
  const base = endpoint.trim().replace(/\/+$/, '');
  if (base === '') {
    throw new Error('Recognition is not set up on this deployment.');
  }

  const body = new FormData();
  body.append('sheet', file, file.name);

  let response: Response;
  try {
    response = await fetch(`${base}/recognize`, { method: 'POST', body, signal });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw new Error('The scan was cancelled.', { cause });
    }
    throw new Error('The recognition service could not be reached.', { cause });
  }

  if (!response.ok) {
    throw new Error(
      REASONS[response.status] ?? `The recognition service answered ${response.status}.`,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (cause) {
    throw new Error('The recognition service gave an unexpected answer.', { cause });
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    typeof (data as { musicXml?: unknown }).musicXml !== 'string' ||
    (data as { musicXml: string }).musicXml.length === 0
  ) {
    throw new Error('The recognition service gave an unexpected answer.');
  }

  const { musicXml, warnings } = data as { musicXml: string; warnings?: unknown };

  return {
    musicXml,
    warnings: Array.isArray(warnings)
      ? warnings.filter((w): w is string => typeof w === 'string')
      : [],
  };
}
