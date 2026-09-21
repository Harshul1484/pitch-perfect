import { describe, expect, it } from 'vitest';
import { MAX_SHEET_BYTES, checkSheetFile } from './sheet-file';

/**
 * The first gate a scan passes through, before a byte leaves the browser.
 * It answers one question — is this a file we would even try — and answers it
 * from the file's declared type and size alone, without reading the contents.
 */
const file = (name: string, type: string, bytes = 1) =>
  new File([new Uint8Array(bytes)], name, { type });

describe('checkSheetFile', () => {
  it('accepts each of the four printed-sheet formats', () => {
    expect(checkSheetFile(file('scan.png', 'image/png'))).toBeNull();
    expect(checkSheetFile(file('scan.jpg', 'image/jpeg'))).toBeNull();
    expect(checkSheetFile(file('scan.webp', 'image/webp'))).toBeNull();
    expect(checkSheetFile(file('scan.pdf', 'application/pdf'))).toBeNull();
  });

  it('names the formats it takes when given something else', () => {
    expect(checkSheetFile(file('scan.svg', 'image/svg+xml'))).toMatch(
      /png, jpeg, webp, or pdf/i,
    );
    expect(checkSheetFile(file('scan.gif', 'image/gif'))).toMatch(
      /png, jpeg, webp, or pdf/i,
    );
    expect(checkSheetFile(file('score.musicxml', 'application/xml'))).toMatch(
      /png, jpeg, webp, or pdf/i,
    );
    expect(checkSheetFile(file('scan', ''))).toMatch(/png, jpeg, webp, or pdf/i);
  });

  it('accepts a file at the size cap and refuses one byte over it', () => {
    expect(checkSheetFile(file('scan.png', 'image/png', MAX_SHEET_BYTES))).toBeNull();
    expect(checkSheetFile(file('scan.png', 'image/png', MAX_SHEET_BYTES + 1))).toMatch(
      /10 MB/,
    );
  });

  it('refuses an empty file rather than sending nothing to be scanned', () => {
    expect(checkSheetFile(file('scan.png', 'image/png', 0))).toMatch(/empty/i);
  });
});
