import { describe, expect, it } from 'vitest';
import { parseNotation, serializeLines } from './composition';
import { linesFromMusicXml, scoreFromLines } from './musicxml';
import { MAX_SCORE_XML, isScoreData } from './score';

/**
 * Two directions of one mapping: the compact notation to a score, and a score
 * back to the notation. Neither is lossless — the notation has no rests and no
 * rhythm finer than "shares a beat" — so the tests pin down exactly what is
 * kept, what is rounded, and what is reported rather than silently dropped.
 */

/** A minimal single-part score. Measures are supplied by the caller. */
function score(measures: string, head = '') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  ${head}
  <part-list><score-part id="P1"><part-name>Violin</part-name></score-part></part-list>
  <part id="P1">${measures}</part>
</score-partwise>`;
}

const attributes = (divisions: number, beats: number, beatType: number, fifths = 0) =>
  `<attributes><divisions>${divisions}</divisions><key><fifths>${fifths}</fifths></key>
   <time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>
   <clef><sign>G</sign><line>2</line></clef></attributes>`;

const note = (
  step: string,
  octave: number,
  duration: number,
  extra = '',
  alter?: number,
) =>
  `<note><pitch><step>${step}</step>${
    alter === undefined ? '' : `<alter>${alter}</alter>`
  }<octave>${octave}</octave></pitch><duration>${duration}</duration>${extra}</note>`;

/** Two bars of 2/4: two quarters, then a half. */
const FIXTURE = score(
  `<measure number="1">${attributes(1, 2, 4)}${note('C', 4, 1)}${note('D', 4, 1)}</measure>
   <measure number="2">${note('E', 4, 2)}</measure>`,
  '<work><work-title>Etude</work-title></work>',
);

describe('linesFromMusicXml', () => {
  it('projects notes, bars and holds into the compact notation', () => {
    const result = linesFromMusicXml(FIXTURE, 0);

    expect(serializeLines(result.lines)).toBe('S R | G -');
    expect(result.title).toBe('Etude');
    expect(result.warnings).toEqual([]);
  });

  it('returns score data that passes the guard, marked as imported', () => {
    const { score: data } = linesFromMusicXml(FIXTURE, 0);

    expect(isScoreData(data)).toBe(true);
    expect(data.source).toBe('imported');
    expect(data.timeSignature).toEqual({ beats: 2, beatType: 4 });
  });

  it('reads the tempo from the score and falls back when there is none', () => {
    const marked = score(
      `<measure number="1">${attributes(1, 4, 4)}<direction><sound tempo="112"/></direction>${note('C', 4, 4)}</measure>`,
    );
    expect(linesFromMusicXml(marked, 0).score.tempo).toBe(112);
    expect(linesFromMusicXml(FIXTURE, 0).score.tempo).toBe(80);
  });

  it('writes degrees relative to the tonic it is given', () => {
    // The same C, D, E read against D as Sa: mandra ni, Sa, Re.
    expect(serializeLines(linesFromMusicXml(FIXTURE, 2).lines)).toBe('n, S | R -');
  });

  it('groups notes that share a beat', () => {
    const eighths = score(
      `<measure number="1">${attributes(2, 2, 4)}${note('C', 4, 1)}${note('D', 4, 1)}${note('E', 4, 2)}</measure>`,
    );
    expect(serializeLines(linesFromMusicXml(eighths, 0).lines)).toBe('S ~R G');
  });

  it('continues a tied note as a hold rather than striking it again', () => {
    const tied = score(
      `<measure number="1">${attributes(1, 2, 4)}${note('C', 4, 1)}${note('D', 4, 1, '<tie type="start"/>')}</measure>
       <measure number="2">${note('D', 4, 1, '<tie type="stop"/>')}${note('E', 4, 1)}</measure>`,
    );
    expect(serializeLines(linesFromMusicXml(tied, 0).lines)).toBe('S R | - G');
  });

  it('starts a new line where the score starts a new system', () => {
    const systems = score(
      `<measure number="1">${attributes(1, 2, 4)}${note('C', 4, 2)}</measure>
       <measure number="2"><print new-system="yes"/>${note('D', 4, 2)}</measure>`,
    );
    expect(serializeLines(linesFromMusicXml(systems, 0).lines)).toBe('S -\nR -');
  });

  it('drops rests, and says so, because the notation cannot write silence', () => {
    const rests = score(
      `<measure number="1">${attributes(1, 2, 4)}${note('C', 4, 1)}<note><rest/><duration>1</duration></note></measure>`,
    );
    const result = linesFromMusicXml(rests, 0);

    expect(serializeLines(result.lines)).toBe('S');
    expect(result.warnings.join(' ')).toMatch(/rest/i);
  });

  it('rounds a rhythm the notation cannot hold and reports it', () => {
    // A dotted quarter and an eighth: three half-beats then one.
    const dotted = score(
      `<measure number="1">${attributes(2, 2, 4)}${note('C', 4, 3)}${note('D', 4, 1)}</measure>`,
    );
    const result = linesFromMusicXml(dotted, 0);

    expect(result.warnings.join(' ')).toMatch(/round/i);
    // Whatever was chosen, it is still two notes in order.
    expect(result.lines.flat().filter((token) => token.kind === 'note')).toHaveLength(2);
  });

  it('refuses a document that is not one melody line', () => {
    const two = score(
      `<measure number="1">${attributes(1, 4, 4)}${note('C', 4, 4)}</measure></part>
       <part id="P2"><measure number="1">${note('C', 3, 4)}</measure>`,
    );
    expect(() => linesFromMusicXml(two, 0)).toThrow(/one part|single/i);
  });

  it('refuses a document with a DOCTYPE, which could name an external entity', () => {
    const withDoctype = FIXTURE.replace(
      '<score-partwise',
      '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise',
    );
    expect(() => linesFromMusicXml(withDoctype, 0)).toThrow(/doctype/i);
  });

  it('refuses text that is not XML at all', () => {
    expect(() => linesFromMusicXml('not a score', 0)).toThrow();
    expect(() => linesFromMusicXml('<score-partwise><part>', 0)).toThrow();
  });

  it('refuses a score too large to store', () => {
    const padded = FIXTURE.replace(
      '</part>',
      `<!--${'x'.repeat(MAX_SCORE_XML)}--></part>`,
    );
    expect(() => linesFromMusicXml(padded, 0)).toThrow(/large|size/i);
  });
});

describe('scoreFromLines', () => {
  const lines = parseNotation('S R | G -');

  it('engraves a piece as a single treble part in 4/4', () => {
    const data = scoreFromLines(lines, 0, 'Etude', 80);
    const xml = data.musicXml;

    expect(isScoreData(data)).toBe(true);
    expect(data.source).toBe('generated');
    expect(data.timeSignature).toEqual({ beats: 4, beatType: 4 });
    expect(data.tempo).toBe(80);

    expect(xml).toContain('<work-title>Etude</work-title>');
    expect(xml).toContain('<sign>G</sign>');
    expect(xml).toContain('<beats>4</beats>');
    expect(xml).toContain('<step>C</step>');
    expect(xml).toContain('<sound tempo="80"');
    expect(xml.match(/<part /g)).toHaveLength(1);
  });

  it('turns a held note into one longer note, not a run of tied quarters', () => {
    const xml = scoreFromLines(parseNotation('S - - -'), 0, 'Held', 80).musicXml;

    expect(xml.match(/<note>/g)).toHaveLength(1);
    expect(xml).toContain('<type>whole</type>');
  });

  it('writes a group sharing a beat as shorter notes that add up to it', () => {
    const xml = scoreFromLines(parseNotation('S ~R G'), 0, 'Pair', 80).musicXml;

    expect(xml.match(/<type>eighth<\/type>/g)).toHaveLength(2);
    expect(xml.match(/<type>quarter<\/type>/g)).toHaveLength(1);
  });

  it('spells degrees from the tonic, flat side down and sharp side up', () => {
    // Komal re above C is D flat; tivra Ma above C is F sharp.
    const xml = scoreFromLines(parseNotation('r M'), 0, 'Spelling', 80).musicXml;

    expect(xml).toContain('<step>D</step><alter>-1</alter>');
    expect(xml).toContain('<step>F</step><alter>1</alter>');
  });

  it('carries the key of the tonic', () => {
    expect(scoreFromLines(lines, 7, 'G', 80).musicXml).toContain('<fifths>1</fifths>');
    expect(scoreFromLines(lines, 5, 'F', 80).musicXml).toContain('<fifths>-1</fifths>');
  });

  it('survives the round trip back to notation', () => {
    for (const text of ['S R | G -', 'S ~R G | m P D N', 'S - - -\nR - G -']) {
      const data = scoreFromLines(parseNotation(text), 0, 'Round', 80);
      const back = linesFromMusicXml(data.musicXml, 0);

      expect(serializeLines(back.lines), text).toBe(text);
      expect(back.warnings, text).toEqual([]);
    }
  });

  it('escapes a title that would otherwise break the document', () => {
    const xml = scoreFromLines(lines, 0, 'Tom & Jerry <live>', 80).musicXml;

    expect(xml).toContain('<work-title>Tom &amp; Jerry &lt;live&gt;</work-title>');
    expect(() => linesFromMusicXml(xml, 0)).not.toThrow();
  });
});

describe('the key signature', () => {
  const inKey = (fifths: number, mode = '') =>
    score(
      `<measure number="1">${attributes(1, 4, 4, fifths).replace(
        '</key>',
        `${mode ? `<mode>${mode}</mode>` : ''}</key>`,
      )}${note('C', 4, 4)}</measure>`,
    );

  it('suggests Sa on the tonic of the key', () => {
    expect(linesFromMusicXml(inKey(0), 0).suggestedTonic).toBe(0); // C
    expect(linesFromMusicXml(inKey(1), 0).suggestedTonic).toBe(7); // G
    expect(linesFromMusicXml(inKey(2), 0).suggestedTonic).toBe(2); // D
    expect(linesFromMusicXml(inKey(-1), 0).suggestedTonic).toBe(5); // F
    expect(linesFromMusicXml(inKey(-3), 0).suggestedTonic).toBe(3); // E flat
  });

  it('puts Sa on the minor tonic when the key says minor', () => {
    expect(linesFromMusicXml(inKey(0, 'minor'), 0).suggestedTonic).toBe(9); // A minor
    expect(linesFromMusicXml(inKey(-1, 'minor'), 0).suggestedTonic).toBe(2); // D minor
  });

  it('suggests nothing when the score has no key', () => {
    const keyless = score(
      `<measure number="1"><attributes><divisions>1</divisions></attributes>${note('C', 4, 4)}</measure>`,
    );
    expect(linesFromMusicXml(keyless, 0).suggestedTonic).toBeNull();
  });
});
