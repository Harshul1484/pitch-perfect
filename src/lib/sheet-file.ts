/**
 * Whether a file is one we would even try to scan.
 *
 * This is the gate before any byte leaves the browser, and it decides from
 * the file's declared type and size alone. Nothing here reads the contents:
 * reading them would mean holding them, and the one promise this feature
 * makes about a scan is that nothing holds it longer than the scan takes.
 * The recognition service checks the real bytes again on its side.
 */

export const MAX_SHEET_BYTES = 10 * 1024 * 1024;

/** Printed sheets arrive as a photo, a scan, or a PDF. Nothing else, yet. */
const SHEET_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

/**
 * Null when the file may be sent, otherwise the reason it may not, worded for
 * the person who picked it.
 */
export function checkSheetFile(file: File): string | null {
  if (!SHEET_TYPES.has(file.type)) {
    return 'That is not a format this can read. Use a PNG, JPEG, WebP, or PDF of the printed sheet.';
  }

  if (file.size === 0) {
    return 'That file is empty.';
  }

  if (file.size > MAX_SHEET_BYTES) {
    return 'That file is larger than 10 MB. A photo of one page is usually well under that.';
  }

  return null;
}
