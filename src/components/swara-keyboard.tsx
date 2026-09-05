import { DEGREE_LETTERS } from '../lib/composition';
import { swaraOfDegree, type Notation } from '../lib/notation';
import { NOTE_NAMES } from '../lib/notes';
import { Swara } from './swara';

interface SwaraKeyboardProps {
  /** Saptak applied to the next note entered: -1, 0 or +1. */
  saptak: number;
  onSaptakChange: (saptak: number) => void;
  notation: Notation;
  /** Pitch class of Sa, needed to name the keys the Western way. */
  tonic: number;
  /** Whether the next note joins the beat before it. */
  tie: boolean;
  onTieToggle: () => void;
  onNote: (degree: number) => void;
  onSustain: () => void;
  onBar: () => void;
  onNewLine: () => void;
  onBackspace: () => void;
}

const SAPTAKS = [
  { value: -1, label: 'mandra' },
  { value: 0, label: 'madhya' },
  { value: 1, label: 'taar' },
];

/* Hover lives on the off state only — see the note in routes/notes.tsx. */
const KEY = 'keycap keycap-pressable active:keycap-pressed';
const KEY_OFF = `${KEY} hover:border-engrave hover:bg-white`;
const KEY_ON = `${KEY} border-graphite bg-graphite bg-none text-panel`;

/**
 * The swara keyboard.
 *
 * Every key shows the swara as it will appear on the page — komal underlined,
 * tivra overlined — rather than a letter you have to translate. The typing
 * shortcut is printed beneath, so the keyboard teaches itself and then gets
 * out of the way.
 */
export function SwaraKeyboard({
  saptak,
  onSaptakChange,
  notation,
  tonic,
  tie,
  onTieToggle,
  onNote,
  onSustain,
  onBar,
  onNewLine,
  onBackspace,
}: SwaraKeyboardProps) {
  return (
    <div className="flex flex-col gap-2 short:gap-1">
      <div className="flex items-center justify-between">
        <span className="mono-label">{notation === 'western' ? 'notes' : 'swaras'}</span>

        <div role="group" aria-label="saptak" className="flex gap-1">
          {SAPTAKS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSaptakChange(option.value)}
              aria-pressed={saptak === option.value}
              className={`${
                saptak === option.value ? KEY_ON : `${KEY_OFF} text-engrave`
              } px-2 py-1 font-mono text-[10px] lowercase tracking-[0.08em]`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-1 short:gap-0.5">
        {DEGREE_LETTERS.map((letter, degree) => {
          const swara = { ...swaraOfDegree(degree), saptak };

          return (
            <button
              key={letter}
              type="button"
              onClick={() => onNote(degree)}
              aria-label={
                notation === 'western'
                  ? `insert ${NOTE_NAMES[(tonic + degree) % 12]}`
                  : `insert ${swara.komal ? 'komal ' : ''}${swara.tivra ? 'tivra ' : ''}${swara.text}`
              }
              className={`${KEY_OFF} flex aspect-square flex-col items-center justify-center gap-1 short:aspect-auto short:h-[34px] short:gap-0.5 ${
                swara.komal || swara.tivra ? 'bg-cap-dark bg-none' : ''
              }`}
            >
              {notation === 'western' ? (
                <span className="text-[13px] font-medium leading-none">
                  {NOTE_NAMES[(tonic + degree) % 12]}
                </span>
              ) : (
                <Swara swara={swara} className="text-[13px] font-medium" />
              )}
              <span className="font-mono text-[9px] leading-none text-engrave">
                {letter}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-1 short:gap-0.5">
        <button
          type="button"
          onClick={onTieToggle}
          aria-pressed={tie}
          title="Join the next note to the beat before it"
          className={`${
            tie ? KEY_ON : KEY_OFF
          } flex-1 py-1.5 font-mono text-[11px] lowercase tracking-[0.08em]`}
        >
          tie &#8635;
        </button>
        <button
          type="button"
          onClick={onBar}
          className={`${KEY_OFF} flex-1 py-1.5 font-mono text-[11px] lowercase tracking-[0.08em]`}
        >
          bar |
        </button>
        <button
          type="button"
          onClick={onSustain}
          className={`${KEY_OFF} flex-1 py-1.5 font-mono text-[11px] lowercase tracking-[0.08em]`}
        >
          hold &mdash;
        </button>
        <button
          type="button"
          onClick={onNewLine}
          className={`${KEY_OFF} flex-1 py-1.5 font-mono text-[11px] lowercase tracking-[0.08em]`}
        >
          new line
        </button>
        <button
          type="button"
          onClick={onBackspace}
          className={`${KEY_OFF} flex-1 py-1.5 font-mono text-[11px] lowercase tracking-[0.08em]`}
        >
          backspace
        </button>
      </div>
    </div>
  );
}
