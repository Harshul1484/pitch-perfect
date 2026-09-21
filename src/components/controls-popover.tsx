import { useEffect, useRef, useState, type ReactNode } from 'react';
import { VOICES, type Voice } from '../lib/audio';
import { NOTATIONS, TONICS, type Notation } from '../lib/notation';
import { NumberField } from './number-field';
import { Segmented } from './segmented';

interface ControlsPopoverProps {
  notation: Notation;
  onNotationChange: (notation: Notation) => void;
  tolerance: number;
  onToleranceChange: (value: number) => void;
  sustain: number;
  onSustainChange: (value: number) => void;
  tonic: number;
  onTonicChange: (tonic: number) => void;
  droneOn: boolean;
  onDroneToggle: () => void;
  voice: Voice;
  onVoiceChange: (voice: Voice) => void;
}

/* Hover lives on the off state only — see the note in routes/notes.tsx. */
const KEY = 'keycap keycap-pressable active:keycap-pressed';
const KEY_OFF = `${KEY} hover:border-engrave hover:bg-white`;
const KEY_ON = `${KEY} border-graphite bg-graphite bg-none text-panel`;

const SELECT_ARROW =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='5'><path d='M0 0h8L4 5z' fill='%238a8a84'/></svg>\")";

/**
 * The settings that are set once and then left alone: tolerance, sustain,
 * tonic and the drone.
 *
 * There is no output level here on purpose. The operating system already has
 * a volume control that people know how to reach, and duplicating it would
 * only create two places to look when something is too quiet.
 *
 * They used to occupy a permanent rail beside the key bed, which spent a
 * column of the screen on controls that are touched rarely. Folded away here,
 * the instrument itself gets the room.
 */
export function ControlsPopover(props: ControlsPopoverProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape, as any panel like this should.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`${KEY_OFF} flex h-7 items-center gap-1.5 px-2.5 font-mono text-[10px] lowercase tracking-[0.08em] short:h-6 short:px-2 ${
          props.droneOn ? 'text-graphite' : 'text-engrave'
        }`}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-[1px] ${
            props.droneOn ? 'bg-signal' : 'bg-hairline'
          }`}
        />
        controls
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="controls"
          className="keycap absolute right-0 top-[calc(100%+8px)] z-30 flex w-[248px] flex-col gap-3 bg-tile p-4"
        >
          <Controls {...props} />
        </div>
      )}
    </div>
  );
}

/**
 * The same controls as a panel rather than a popover.
 *
 * On a screen tall enough to leave the readout column half empty, these belong
 * in that space: a permanent panel is one fewer click than a popover, and a
 * popover covers the key bed it is sitting over. On a shorter screen there is
 * no space to put them in, and the button comes back — which is why both
 * shapes exist rather than one replacing the other.
 */
export function ControlsPanel(props: ControlsPopoverProps) {
  return (
    <div
      role="group"
      aria-label="controls"
      className="keycap flex w-[170px] shrink-0 flex-col gap-3 bg-tile p-3 tall:w-[196px] narrow:w-[126px]"
    >
      <span className="mono-label">controls</span>
      {/* Stacked here. This column is 170px wide, and a label beside a pair of
          caps needs closer to 250 — "sargam" and "piano" were running off the
          panel's right edge. */}
      <Controls {...props} stacked />
    </div>
  );
}

/**
 * What both shapes show.
 *
 * Wide enough, and it is one grid of two columns: every label in the first and
 * every control in the second, so they share a left edge. Before this each row
 * invented its own arrangement — labels above, labels beside, one pushed to
 * the far right — and nothing lined up with anything else.
 *
 * In the narrow column the same rows stack, label above control. They still
 * share a left edge, which is what the alignment was for; there simply is not
 * room for two columns.
 */
function Controls({
  stacked = false,
  ...props
}: ControlsPopoverProps & { stacked?: boolean }) {
  return (
    <>
      <div
        className={
          stacked
            ? 'flex flex-col gap-2.5'
            : 'grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5'
        }
      >
        {/*
         * Typed, not turned. These were knobs, which look like the panel they
         * sit on but are a poor way to reach a particular number — you drag,
         * overshoot, and drag back. Both are set to a value you already have
         * in mind.
         */}
        <Row stacked={stacked} label="tolerance">
          <Field
            label="tolerance"
            unit="&cent;"
            value={props.tolerance}
            min={2}
            max={30}
            step={1}
            onChange={props.onToleranceChange}
          />
        </Row>

        <Row stacked={stacked} label="sustain">
          <Field
            label="sustain"
            unit="s"
            /* Stored in tenths, entered in seconds. */
            value={props.sustain / 10}
            min={0.2}
            max={3}
            step={0.1}
            onChange={(seconds) => props.onSustainChange(Math.round(seconds * 10))}
          />
        </Row>

        <span
          aria-hidden="true"
          className={`h-px w-full bg-hairline-soft ${stacked ? '' : 'col-span-2'}`}
        />

        {/* Notation belongs here, with the other things you set once. It held a
            permanent two-cap switch in a header full of controls you reach for
            while playing, which is not what it is. */}
        <Row stacked={stacked} label="notation">
          <Segmented
            label="notation"
            value={props.notation}
            options={NOTATIONS}
            onChange={props.onNotationChange}
          />
        </Row>

        <Row stacked={stacked} label="voice">
          <Segmented
            label="voice"
            value={props.voice}
            options={VOICES}
            onChange={props.onVoiceChange}
          />
        </Row>

        <Row stacked={stacked} label="tonic">
          <select
            value={props.tonic}
            onChange={(event) => props.onTonicChange(Number(event.target.value))}
            aria-label="tonic"
            className="keycap keycap-pressable w-[86px] cursor-pointer appearance-none py-1.5 pl-2.5 pr-5 text-center font-mono text-[11px] tabular-nums text-graphite hover:border-engrave"
            style={{
              backgroundImage: SELECT_ARROW,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 6px center',
            }}
          >
            {TONICS.map((name, pitchClass) => (
              <option key={name} value={pitchClass}>
                {name}
              </option>
            ))}
          </select>
        </Row>
      </div>

      {/* An action rather than a setting, so it sits below the rule and takes
          the width instead of pretending to be another row of the grid. */}
      <span aria-hidden="true" className="h-px w-full bg-hairline-soft" />

      <button
        type="button"
        onClick={props.onDroneToggle}
        aria-pressed={props.droneOn}
        className={`${
          props.droneOn ? KEY_ON : KEY_OFF
        } flex h-9 w-full items-center justify-center gap-1.5 text-[12px] font-medium lowercase tracking-wide`}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-[1px] ${
            props.droneOn ? 'bg-signal' : 'bg-hairline'
          }`}
        />
        drone
      </button>
    </>
  );
}

/** One labelled setting, beside its label or above it. */
function Row({
  stacked,
  label,
  children,
}: {
  stacked: boolean;
  label: string;
  children: ReactNode;
}) {
  if (!stacked) {
    return (
      <>
        <span className="mono-label">{label}</span>
        {children}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="mono-label">{label}</span>
      {children}
    </div>
  );
}

/**
 * One typed setting: a number and its unit. The grid draws the label, so this
 * only names itself for assistive technology.
 *
 * The typing rules live in NumberField, which the tempo field on the
 * metronome shares: a number is only clamped once you have finished typing
 * it, never while you are still on your way to it.
 */
function Field({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <NumberField
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        className="w-[70px]"
      />
      <span
        aria-hidden="true"
        className="font-mono text-[11px] leading-none text-engrave"
      >
        {unit}
      </span>
    </span>
  );
}
