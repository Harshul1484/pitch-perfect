import { describe, expect, it } from 'vitest';
import { MAX_SCORE_XML, isScoreData, type ScoreData } from './score';

/**
 * Score data is read back out of Firestore, which means it is whatever is in
 * the document rather than whatever we last wrote. The guard is the boundary:
 * past it the rest of the app may assume the shape, so everything it lets
 * through has to be bounded as well as well-formed.
 */
const valid: ScoreData = {
  version: 1,
  musicXml: '<score-partwise/>',
  source: 'generated',
  timeSignature: { beats: 4, beatType: 4 },
  tempo: 80,
};

/** The valid score with one field replaced, so each test varies one thing. */
const withField = (field: string, value: unknown) => ({ ...valid, [field]: value });

describe('isScoreData', () => {
  it('accepts a complete score', () => {
    expect(isScoreData(valid)).toBe(true);
    expect(isScoreData({ ...valid, source: 'imported' })).toBe(true);
  });

  it('rejects anything that is not an object', () => {
    for (const value of [null, undefined, 'x', 7, [], true]) {
      expect(isScoreData(value), String(value)).toBe(false);
    }
  });

  it('rejects a version it was not written for', () => {
    for (const version of [undefined, 0, 2, '1']) {
      expect(isScoreData(withField('version', version)), String(version)).toBe(false);
    }
  });

  it('rejects a source outside the two it knows', () => {
    for (const source of [undefined, '', 'scanned', 'IMPORTED']) {
      expect(isScoreData(withField('source', source)), String(source)).toBe(false);
    }
  });

  it('rejects empty and non-string music', () => {
    for (const musicXml of [undefined, '', 7, {}]) {
      expect(isScoreData(withField('musicXml', musicXml)), String(musicXml)).toBe(false);
    }
  });

  it('accepts music up to the cap and rejects one character past it', () => {
    expect(isScoreData(withField('musicXml', 'x'.repeat(MAX_SCORE_XML)))).toBe(true);
    expect(isScoreData(withField('musicXml', 'x'.repeat(MAX_SCORE_XML + 1)))).toBe(false);
  });

  it('holds the time signature to whole numbers in range', () => {
    for (const beats of [1, 4, 32]) {
      expect(isScoreData(withField('timeSignature', { beats, beatType: 4 })), String(beats)).toBe(
        true,
      );
    }

    for (const beats of [0, -1, 33, 2.5, '4', undefined]) {
      expect(
        isScoreData(withField('timeSignature', { beats, beatType: 4 })),
        String(beats),
      ).toBe(false);
    }

    for (const beatType of [0, 33, 4.5, '4', undefined]) {
      expect(
        isScoreData(withField('timeSignature', { beats: 4, beatType })),
        String(beatType),
      ).toBe(false);
    }

    expect(isScoreData(withField('timeSignature', undefined))).toBe(false);
    expect(isScoreData(withField('timeSignature', '4/4'))).toBe(false);
  });

  it('holds the tempo to the range the metronome itself allows', () => {
    expect(isScoreData(withField('tempo', 30))).toBe(true);
    expect(isScoreData(withField('tempo', 260))).toBe(true);

    for (const tempo of [29, 261, 0, -1, '80', undefined, Number.NaN]) {
      expect(isScoreData(withField('tempo', tempo)), String(tempo)).toBe(false);
    }
  });
});
