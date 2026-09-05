import { DEGREE_LETTERS } from '../lib/composition';
import { swaraOfDegree } from '../lib/notation';
import { Swara } from './swara';

interface SwaraKeyboardProps {
  /** Saptak applied to the next note entered: -1, 0 or +1. */
  saptak: number;
  onSaptakChange: (saptak: number) => void;
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

const KEY =
  'keycap keycap-pressable hover:border-engrave hover:bg-white active:keycap-pressed';

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
  tie,
  onTieToggle,
  onNote,
  onSustain,
  onBar,
  onNewLine,
  onBackspace,
}: SwaraKeyboardProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="mono-label">swaras</span>

        <div role="group" aria-label="saptak" className="flex gap-1">
          {SAPTAKS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSaptakChange(option.value)}
              aria-pressed={saptak === option.value}
              className={`${KEY} px-2 py-1 font-mono text-[10px] lowercase tracking-[0.08em] ${
                saptak === option.value
                  ? 'border-graphite bg-graphite bg-none text-panel hover:bg-graphite'
                  : 'text-engrave'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
        {DEGREE_LETTERS.map((letter, degree) => {
          const swara = { ...swaraOfDegree(degree), saptak };

          return (
            <button
              key={letter}
              type="button"
              onClick={() => onNote(degree)}
              aria-label={`insert ${swara.komal ? 'komal ' : ''}${swara.tivra ? 'tivra ' : ''}${swara.text}`}
              className={`${KEY} flex aspect-square flex-col items-center justify-center gap-1 ${
                swara.komal || swara.tivra ? 'bg-cap-dark bg-none' : ''
              }`}
            >
              <Swara swara={swara} className="text-[13px] font-medium" />
              <span className="font-mono text-[9px] leading-none text-engrave">
                {letter}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={onTieToggle}
          aria-pressed={tie}
          title="Join the next note to the beat before it"
          className={`${KEY} flex-1 py-1.5 font-mono text-[11px] lowercase tracking-[0.08em] ${
            tie ? 'border-graphite bg-graphite bg-none text-panel hover:bg-graphite' : ''
          }`}
        >
          tie &#8635;
        </button>
        <button
          type="button"
          onClick={onBar}
          className={`${KEY} flex-1 py-1.5 font-mono text-[11px] lowercase tracking-[0.08em]`}
        >
          bar |
        </button>
        <button
          type="button"
          onClick={onSustain}
          className={`${KEY} flex-1 py-1.5 font-mono text-[11px] lowercase tracking-[0.08em]`}
        >
          hold &mdash;
        </button>
        <button
          type="button"
          onClick={onNewLine}
          className={`${KEY} flex-1 py-1.5 font-mono text-[11px] lowercase tracking-[0.08em]`}
        >
          new line
        </button>
        <button
          type="button"
          onClick={onBackspace}
          className={`${KEY} flex-1 py-1.5 font-mono text-[11px] lowercase tracking-[0.08em]`}
        >
          backspace
        </button>
      </div>
    </div>
  );
}
