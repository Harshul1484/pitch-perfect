import { describe, expect, it } from 'vitest';
import { isSheetMusicEnabled } from './feature-flags';

/**
 * A flag that gates an unfinished feature has to fail closed.
 *
 * Vite inlines environment variables as strings at build time, so an unset
 * variable is `undefined` and a set one is never a boolean. Anything loose
 * here — truthiness, a case-insensitive match, trimming — turns a typo or an
 * empty value in a deployment's settings into a shipped feature.
 */
describe('isSheetMusicEnabled', () => {
  it('is off when the variable is not set at all', () => {
    expect(isSheetMusicEnabled(undefined)).toBe(false);
    expect(isSheetMusicEnabled('')).toBe(false);
  });

  it('is off for the string false', () => {
    expect(isSheetMusicEnabled('false')).toBe(false);
  });

  it('is on only for the literal string true', () => {
    expect(isSheetMusicEnabled('true')).toBe(true);
  });

  it('is off for anything that merely looks true', () => {
    for (const raw of ['TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'truthy']) {
      expect(isSheetMusicEnabled(raw), raw).toBe(false);
    }
  });
});
