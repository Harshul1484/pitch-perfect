/**
 * Build-time feature flags.
 *
 * Vite inlines `import.meta.env` values as strings when the bundle is built,
 * so a flag is never a boolean by the time it gets here: it is `"false"`, or
 * `""`, or missing entirely. `"false"` is a non-empty string and therefore
 * truthy, which is the way this goes wrong — a flag meant to be off ships on.
 *
 * So the parser is deliberately narrow. Exactly one string turns a feature on,
 * and everything else — unset, empty, `"TRUE"`, `"1"`, a stray space — leaves
 * it off. Anything unrecognised failing closed is the whole point of a gate on
 * a feature that is not finished.
 */
export function isSheetMusicEnabled(raw?: string): boolean {
  return raw === 'true';
}

/**
 * A query-string override, honoured in development only.
 *
 * The same seam the Firebase emulators use: an end-to-end test can switch the
 * feature on and point recognition at a stub for one page load, without a
 * rebuild. The DEV check means a production build ignores the parameter
 * entirely — there, the environment variable is the only word.
 */
function devOverride(name: string): string | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Whether this build has sheet music turned on.
 *
 * Read once here rather than at each call site, so there is one place the
 * variable's name is spelled and one place the rule is applied.
 */
export const SHEET_MUSIC_ENABLED =
  isSheetMusicEnabled(import.meta.env.VITE_SHEET_MUSIC_ENABLED) ||
  devOverride('sheet') === '1';

/**
 * Where scans are sent for recognition. Empty when unset, which the import
 * flow treats as "recognition is unavailable" rather than guessing a host.
 */
export const OMR_API_URL: string =
  devOverride('omr') ?? import.meta.env.VITE_OMR_API_URL ?? '';
