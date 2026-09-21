import {
  midiFor,
  tokenFromMidi,
  type Line,
  type NoteToken,
  type Token,
} from './composition';
import { MAX_BPM, MIN_BPM } from './metronome';
import { MAX_SCORE_XML, isScoreData, type ScoreData } from './score';

/**
 * The compact notation and MusicXML, each way.
 *
 * Neither direction is lossless, and this file is honest about which way the
 * loss runs. The notation knows pitch relative to Sa, one beat per note, holds,
 * bars, and notes squeezed together into a beat. It has no rests, no dotted
 * rhythms, no dynamics, and no idea what a triplet is. So a score becomes
 * notation by rounding to that grid and saying what was rounded, while the
 * notation becomes a score exactly, because everything it can say a score can
 * say too.
 */

const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
type Step = (typeof STEPS)[number];
/** Semitones above C for each natural letter. */
const STEP_PC = [0, 2, 4, 5, 7, 9, 11];

/**
 * How each tonic is spelled, and the key it implies. The flat spelling is
 * chosen wherever it has fewer accidentals: D flat rather than C sharp.
 */
const TONICS: { step: number; fifths: number }[] = [
  { step: 0, fifths: 0 }, // C
  { step: 1, fifths: -5 }, // Db
  { step: 1, fifths: 2 }, // D
  { step: 2, fifths: -3 }, // Eb
  { step: 2, fifths: 4 }, // E
  { step: 3, fifths: -1 }, // F
  { step: 3, fifths: 6 }, // F#
  { step: 4, fifths: 1 }, // G
  { step: 5, fifths: -4 }, // Ab
  { step: 5, fifths: 3 }, // A
  { step: 6, fifths: -2 }, // Bb
  { step: 6, fifths: 5 }, // B
];

/**
 * Which letter each degree lands on, counted from the tonic's letter. Komal
 * degrees are the lowered form of the letter above, tivra Ma the raised
 * fourth — so komal re above C is D flat and not C sharp, which is how a
 * reader of either notation expects to see it.
 */
const DEGREE_STEPS = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

/** Divisions of a quarter note in generated scores: enough for a beat split in two, three or four. */
const DIVISIONS = 12;
const BEAT = DIVISIONS;
const BEATS_PER_BAR = 4;

/** When a score has no line breaks of its own, this many bars go on a line. */
const BARS_PER_LINE = 4;

const DEFAULT_TEMPO = 80;

/** Written note values, largest first, in divisions. */
const VALUES: { divisions: number; type: string; dot: boolean; triplet: boolean }[] = [
  { divisions: 48, type: 'whole', dot: false, triplet: false },
  { divisions: 36, type: 'half', dot: true, triplet: false },
  { divisions: 24, type: 'half', dot: false, triplet: false },
  { divisions: 18, type: 'quarter', dot: true, triplet: false },
  { divisions: 12, type: 'quarter', dot: false, triplet: false },
  { divisions: 9, type: 'eighth', dot: true, triplet: false },
  { divisions: 6, type: 'eighth', dot: false, triplet: false },
  { divisions: 4, type: 'eighth', dot: false, triplet: true },
  { divisions: 3, type: '16th', dot: false, triplet: false },
  { divisions: 2, type: '16th', dot: false, triplet: true },
  { divisions: 1, type: '32nd', dot: false, triplet: true },
];

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// ---------------------------------------------------------------------------
// Notation → score
// ---------------------------------------------------------------------------

interface Sounding {
  token: NoteToken;
  /** In divisions. */
  duration: number;
  /** Continues the note before it, across a bar line. */
  tiedFrom: boolean;
  tiedTo: boolean;
}

interface Measure {
  notes: Sounding[];
  /** The first bar of a new line of notation. */
  newSystem: boolean;
}

/** A pitch as MusicXML writes it, spelled from the degree rather than the key. */
function spell(
  token: NoteToken,
  tonic: number,
): { step: Step; alter: number; octave: number } {
  const stepIndex = (TONICS[tonic].step + DEGREE_STEPS[token.degree]) % 7;
  const midi = midiFor(token, tonic);

  let alter = ((((midi % 12) - STEP_PC[stepIndex]) % 12) + 12) % 12;
  if (alter > 6) alter -= 12;

  return { step: STEPS[stepIndex], alter, octave: Math.floor((midi - alter) / 12) - 1 };
}

/** Nearly-equal integer parts of a beat, for notes that share one. */
function split(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const extra = total - base * parts;
  return Array.from({ length: parts }, (_, i) => Math.max(1, base + (i < extra ? 1 : 0)));
}

/**
 * Lay the notation out in measures.
 *
 * Bars in the notation are the bars of the score. A line without any is
 * measured out four beats at a time; a line with them is left as written, even
 * where a bar runs long, because those are the player's bars and not ours.
 */
function measuresOf(lines: Line[]): Measure[] {
  const measures: Measure[] = [];
  let current: Measure | null = null;
  /** The last note of the piece so far, for a hold that crosses a bar. */
  let last: Sounding | null = null;
  /** Index into current.notes where the beat being filled began. */
  let beatStart: number | null = null;

  const open = (newSystem: boolean) => {
    current = { notes: [], newSystem };
    measures.push(current);
    beatStart = null;
  };
  const close = () => {
    if (current !== null && current.notes.length === 0) measures.pop();
    current = null;
    beatStart = null;
  };
  const filled = (measure: Measure) =>
    measure.notes.reduce((sum, n) => sum + n.duration, 0);

  lines.forEach((line, lineIndex) => {
    const barred = line.some((token) => token.kind === 'bar');
    let first = true;

    const ensure = (): Measure => {
      if (current === null) open(lineIndex > 0 && first);
      first = false;
      return current!;
    };

    for (const token of line) {
      if (token.kind === 'bar') {
        close();
        continue;
      }

      if (token.kind === 'sustain') {
        if (last === null) continue;
        const measure = ensure();

        if (!barred && filled(measure) + BEAT > BEAT * BEATS_PER_BAR) {
          close();
          ensure();
        }

        if (current!.notes.length === 0) {
          // A hold at the start of a bar continues the note before it.
          last.tiedTo = true;
          const carried: Sounding = {
            token: last.token,
            duration: BEAT,
            tiedFrom: true,
            tiedTo: false,
          };
          current!.notes.push(carried);
          last = carried;
        } else {
          last.duration += BEAT;
        }
        beatStart = null;
        continue;
      }

      const measure = ensure();
      const grouped = token.grouped === true && beatStart !== null;

      if (!grouped) {
        if (!barred && filled(measure) + BEAT > BEAT * BEATS_PER_BAR) {
          close();
          ensure();
        }
        const sounding: Sounding = {
          token,
          duration: BEAT,
          tiedFrom: false,
          tiedTo: false,
        };
        current!.notes.push(sounding);
        last = sounding;
        beatStart = current!.notes.length - 1;
        continue;
      }

      // Squeeze this note into the beat with the ones before it.
      const sounding: Sounding = { token, duration: 0, tiedFrom: false, tiedTo: false };
      current!.notes.push(sounding);
      last = sounding;

      const group = current!.notes.slice(beatStart!);
      const beatLength = group.reduce((sum, n) => sum + n.duration, 0) || BEAT;
      split(beatLength, group.length).forEach((part, i) => {
        group[i].duration = part;
      });
    }

    close();
  });

  return measures;
}

function noteXml(sounding: Sounding, tonic: number): string {
  const { step, alter, octave } = spell(sounding.token, tonic);
  const pitch = `<pitch><step>${step}</step>${
    alter === 0 ? '' : `<alter>${alter}</alter>`
  }<octave>${octave}</octave></pitch>`;

  // A held note is written as one longer note where a note value exists, and
  // as tied notes where it does not: three beats is a dotted half, five beats
  // a whole tied to a quarter.
  const pieces: (typeof VALUES)[number][] = [];
  let remaining = sounding.duration;
  while (remaining > 0) {
    const value =
      VALUES.find((v) => v.divisions <= remaining) ?? VALUES[VALUES.length - 1];
    pieces.push(value);
    remaining -= value.divisions;
  }

  return pieces
    .map((value, i) => {
      const tieFrom = sounding.tiedFrom || i > 0;
      const tieTo = sounding.tiedTo || i < pieces.length - 1;
      const ties =
        (tieFrom ? '<tie type="stop"/>' : '') + (tieTo ? '<tie type="start"/>' : '');
      const tied =
        tieFrom || tieTo
          ? `<notations>${tieFrom ? '<tied type="stop"/>' : ''}${
              tieTo ? '<tied type="start"/>' : ''
            }</notations>`
          : '';

      return (
        `<note>${pitch}<duration>${value.divisions}</duration>${ties}` +
        `<type>${value.type}</type>${value.dot ? '<dot/>' : ''}` +
        (value.triplet
          ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>'
          : '') +
        `${tied}</note>`
      );
    })
    .join('');
}

/**
 * A printable score for a piece written in the compact notation.
 *
 * Treble clef, the key of the tonic, four-four. One beat per plain note, holds
 * extending the note before them, and grouped notes dividing their beat. The
 * first bar carries a system break as well as the attributes, so a score made
 * here always says where its lines fall — which is what lets the other
 * direction tell a score with no line breaks from one whose lines are exactly
 * where they were.
 */
export function scoreFromLines(
  lines: Line[],
  tonic: number,
  title: string,
  tempo: number,
): ScoreData {
  const measures = measuresOf(lines);
  const bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(tempo)));

  const attributes =
    `<attributes><divisions>${DIVISIONS}</divisions>` +
    `<key><fifths>${TONICS[tonic].fifths}</fifths></key>` +
    `<time><beats>${BEATS_PER_BAR}</beats><beat-type>4</beat-type></time>` +
    `<clef><sign>G</sign><line>2</line></clef></attributes>`;
  const direction =
    `<direction placement="above"><direction-type><metronome>` +
    `<beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute>` +
    `</metronome></direction-type><sound tempo="${bpm}"/></direction>`;

  const body = measures
    .map((measure, i) => {
      const print = i === 0 || measure.newSystem ? '<print new-system="yes"/>' : '';
      const head = i === 0 ? attributes + direction : '';
      const notes = measure.notes.map((n) => noteXml(n, tonic)).join('');
      return `<measure number="${i + 1}">${print}${head}${notes}</measure>`;
    })
    .join('\n');

  const musicXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<score-partwise version="4.0">\n` +
    `<work><work-title>${escapeXml(title)}</work-title></work>\n` +
    `<part-list><score-part id="P1"><part-name>${escapeXml(title)}</part-name></score-part></part-list>\n` +
    `<part id="P1">\n${body}\n</part>\n` +
    `</score-partwise>\n`;

  return {
    version: 1,
    musicXml,
    source: 'generated',
    timeSignature: { beats: BEATS_PER_BAR, beatType: 4 },
    tempo: bpm,
  };
}

// ---------------------------------------------------------------------------
// Score → notation
// ---------------------------------------------------------------------------

const MAX_TITLE = 200;

function text(parent: ParentNode, selector: string): string | null {
  const value = parent.querySelector(selector)?.textContent?.trim();
  return value ? value : null;
}

function integer(parent: ParentNode, selector: string, fallback: number): number {
  const value = Number(text(parent, selector));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function parse(xml: string): Document {
  if (xml.length > MAX_SCORE_XML) {
    throw new Error('That score is too large to keep with a piece.');
  }
  // A DOCTYPE can name an external entity, and a parser that honours it will
  // fetch whatever the document says. Nothing this reads has any need of one.
  if (/<!DOCTYPE/i.test(xml)) {
    throw new Error('That score declares a DOCTYPE, which this does not accept.');
  }

  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (
    doc.querySelector('parsererror') ||
    doc.documentElement.nodeName !== 'score-partwise'
  ) {
    throw new Error('That is not a MusicXML score this can read.');
  }

  return doc;
}

/**
 * A score as the engraver may have it.
 *
 * Score data read back out of Firestore is checked for shape and size but
 * not parsed, so this is where a stored score meets a parser for the first
 * time. It is parsed as data — never handed to anything as markup — with no
 * DOCTYPE and within the size cap, and what comes out is the parser's own
 * serialisation rather than the stored string.
 */
export function sanitizeMusicXml(xml: string): string {
  return new XMLSerializer().serializeToString(parse(xml));
}

/** Direct children matching a name, in document order; querySelector cannot say "direct". */
function children(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter((child) => child.nodeName === name);
}

/**
 * The compact notation for a score, and what was lost getting there.
 *
 * Bars become bars, system breaks become lines, and pitches are written
 * relative to the tonic. Rhythm is snapped to the notation's grid: a note of
 * one or more beats is a note and holds, a note shorter than a beat shares
 * its beat with its neighbours, and anything that fits neither — a dotted
 * quarter, a note across a beat — is rounded and reported. Rests are dropped
 * and reported, because the notation has no way to write one. The score is
 * kept alongside, and remains the authority for whatever the notation cannot
 * carry.
 */
export function linesFromMusicXml(
  xml: string,
  tonic: number,
): {
  title: string;
  lines: Line[];
  score: ScoreData;
  warnings: string[];
  /** Where the key signature puts Sa, or null when the score has no key. */
  suggestedTonic: number | null;
} {
  const doc = parse(xml);
  const root = doc.documentElement;

  const parts = children(root, 'part');
  if (parts.length !== 1) {
    throw new Error(
      parts.length === 0
        ? 'That score has no music in it.'
        : 'That score has more than one part. This reads a single melody line.',
    );
  }
  const part = parts[0];

  const title = (
    text(root, 'work > work-title') ??
    text(root, 'movement-title') ??
    text(root, 'credit > credit-words') ??
    'Untitled'
  ).slice(0, MAX_TITLE);

  const warnings = new Set<string>();
  const warn = (message: string) => warnings.add(message);

  let divisions = 1;
  let beats = 4;
  let beatType = 4;
  let tempo: number | null = null;
  let suggestedTonic: number | null = null;

  const measures = children(part, 'measure');
  const hasBreaks = measures.some((m) => m.querySelector('print') !== null);

  const lines: Line[] = [];
  let line: Line = [];
  let previous: Token | null = null;
  /** Whether any note has sounded yet, so a tie has something to continue. */
  let sounded = false;
  const push = (token: Token) => {
    line.push(token);
    previous = token;
    if (token.kind === 'note') sounded = true;
  };

  measures.forEach((measure, index) => {
    const attributes = measure.querySelector('attributes');
    if (attributes) {
      divisions = integer(attributes, 'divisions', divisions);
      beats = integer(attributes, 'time > beats', beats);
      beatType = integer(attributes, 'time > beat-type', beatType);

      // The key signature names the tonic: G major puts Sa on G, and a
      // minor key on its own tonic rather than the relative major's. Read
      // once, from the first key the score declares.
      const declared = text(attributes, 'key > fifths');
      const fifths = declared === null ? Number.NaN : Number(declared);
      if (suggestedTonic === null && Number.isInteger(fifths) && Math.abs(fifths) <= 7) {
        const major = (((fifths * 7) % 12) + 12) % 12;
        const minor = text(attributes, 'key > mode') === 'minor';
        suggestedTonic = minor ? (major + 9) % 12 : major;
      }

      const clef = attributes.querySelector('clef');
      if (clef && !(text(clef, 'sign') === 'G' && integer(clef, 'line', 2) === 2)) {
        warn(
          'The score is not in the treble clef; the notes have been read at their written pitch.',
        );
      }
    }

    if (tempo === null) {
      const sound = measure.querySelector('sound[tempo]');
      const marked = Number(sound?.getAttribute('tempo'));
      if (Number.isFinite(marked) && marked > 0) {
        tempo = Math.round(marked);
        if (tempo < MIN_BPM || tempo > MAX_BPM) {
          warn(
            `The marked tempo of ${tempo} is outside what the metronome can play; it has been brought into range.`,
          );
          tempo = Math.min(MAX_BPM, Math.max(MIN_BPM, tempo));
        }
      }
    }

    const print = measure.querySelector('print');
    const breaks = hasBreaks
      ? print?.getAttribute('new-system') === 'yes' ||
        print?.getAttribute('new-page') === 'yes'
      : index > 0 && index % BARS_PER_LINE === 0;

    if (breaks && line.length > 0) {
      lines.push(line);
      line = [];
    } else if (index > 0 && line.length > 0) {
      push({ kind: 'bar' });
    }

    // Durations are compared in units scaled by the beat type, so a beat is a
    // whole number of them whatever the time signature.
    const beatUnits = divisions * 4;
    let position = 0;
    let secondVoice = false;

    for (const child of Array.from(measure.children)) {
      if (child.nodeName === 'backup') {
        secondVoice = true;
        warn('The score has more than one voice; only the first has been read.');
        continue;
      }
      if (child.nodeName === 'forward') {
        position += integer(child, 'duration', 0) * beatType;
        continue;
      }
      if (child.nodeName !== 'note' || secondVoice) continue;

      if (child.querySelector('grace')) {
        warn('Grace notes have been left out.');
        continue;
      }
      if (child.querySelector('chord')) {
        warn('Chords have been reduced to their first note.');
        continue;
      }

      const duration = integer(child, 'duration', 0) * beatType;

      if (child.querySelector('rest')) {
        warn('Rests have been left out: the notation has no way to write silence.');
        position += duration;
        continue;
      }

      const pitch = child.querySelector('pitch');
      if (!pitch) {
        position += duration;
        continue;
      }

      const step = text(pitch, 'step') as Step | null;
      const stepIndex = step ? STEPS.indexOf(step) : -1;
      if (stepIndex === -1) {
        position += duration;
        continue;
      }
      const alter = Number(text(pitch, 'alter') ?? 0);
      const octave = Number(text(pitch, 'octave') ?? 4);
      const midi = (octave + 1) * 12 + STEP_PC[stepIndex] + alter;

      const token = tokenFromMidi(midi, tonic);
      if (Math.abs(token.saptak) > 2) {
        warn(
          'Some notes lie more than two octaves from Sa and have been written at the edge of the range.',
        );
        token.saptak = Math.sign(token.saptak) * 2;
      }

      const onBeat = position % beatUnits === 0;
      const wholeBeats = duration / beatUnits;
      const exact = duration % beatUnits === 0;
      // A tie continues whatever sounded last, across a bar or a line break
      // as readily as within a beat.
      const continues =
        child.querySelector('tie[type="stop"], tied[type="stop"]') !== null && sounded;

      if (continues) {
        // The note before this one goes on sounding; write that as holds.
        const holds = Math.round(wholeBeats);
        if (!exact) warn('Some rhythms have been rounded to whole beats.');
        for (let i = 0; i < holds; i++) push({ kind: 'sustain' });
      } else if (wholeBeats >= 1) {
        if (!exact || !onBeat) warn('Some rhythms have been rounded to whole beats.');
        push(token);
        for (let i = 1; i < Math.round(wholeBeats); i++) push({ kind: 'sustain' });
      } else {
        if ((position % beatUnits) + duration > beatUnits) {
          warn('Some rhythms have been rounded to whole beats.');
        }
        const shares = !onBeat && previous !== null && previous.kind === 'note';
        push(shares ? { ...token, grouped: true } : token);
      }

      position += duration;
    }
  });

  if (line.length > 0) lines.push(line);
  if (lines.length === 0) lines.push([]);

  const score: ScoreData = {
    version: 1,
    musicXml: xml,
    source: 'imported',
    timeSignature: { beats, beatType },
    tempo: tempo ?? DEFAULT_TEMPO,
  };
  if (!isScoreData(score)) {
    throw new Error('That score describes a time signature or tempo this cannot keep.');
  }

  return { title, lines, score, warnings: Array.from(warnings), suggestedTonic };
}
