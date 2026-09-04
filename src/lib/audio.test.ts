import { describe, expect, it } from 'vitest';
import { playFrequency } from './audio';

describe('playFrequency', () => {
  it('reports failure rather than throwing where Web Audio is unavailable', () => {
    // jsdom provides no AudioContext, which is the same situation as a browser
    // that blocks audio outright.
    expect(window.AudioContext).toBeUndefined();
    expect(playFrequency(440)).toBe(false);
  });
});
