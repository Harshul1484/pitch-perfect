import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { NumberField } from './number-field';

/**
 * A typed setting is typed one digit at a time, and the digits on the way to a
 * number are usually not themselves valid.
 *
 * Every field here used to clamp on each keystroke, so reaching a tempo of 100
 * was impossible: the "1" became 30, the next "0" made 300, and that became
 * 260. The field ended up on a number nobody asked for and the player had no
 * way to get past it.
 */
function Harness({
  min,
  max,
  step = 1,
  initial,
}: {
  min: number;
  max: number;
  step?: number;
  initial: number;
}) {
  const [value, setValue] = useState(initial);

  return (
    <>
      <NumberField
        label="tempo"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={setValue}
      />
      <output>{value}</output>
    </>
  );
}

const tempo = () => screen.getByRole('spinbutton', { name: 'tempo' });
const committed = () => screen.getByRole('status').textContent;

describe('NumberField', () => {
  it('lets a number be typed through values below the minimum', async () => {
    const user = userEvent.setup();
    render(<Harness min={30} max={260} initial={90} />);

    await user.clear(tempo());
    await user.type(tempo(), '100');

    expect(tempo()).toHaveValue(100);
    expect(committed()).toBe('100');
  });

  it('keeps a half-typed decimal rather than rewriting it', async () => {
    const user = userEvent.setup();
    render(<Harness min={0.2} max={3} step={0.1} initial={1.4} />);

    await user.clear(tempo());
    await user.type(tempo(), '1.4');

    expect(committed()).toBe('1.4');
  });

  it('commits as soon as the typed number is in range', async () => {
    const user = userEvent.setup();
    render(<Harness min={30} max={260} initial={90} />);

    await user.clear(tempo());
    await user.type(tempo(), '120');

    expect(committed()).toBe('120');
  });

  it('clamps a number that is out of range once you leave the field', async () => {
    const user = userEvent.setup();
    render(<Harness min={30} max={260} initial={90} />);

    await user.clear(tempo());
    await user.type(tempo(), '4');
    await user.tab();

    expect(committed()).toBe('30');
    expect(tempo()).toHaveValue(30);
  });

  it('clamps above the maximum too', async () => {
    const user = userEvent.setup();
    render(<Harness min={30} max={260} initial={90} />);

    await user.clear(tempo());
    await user.type(tempo(), '900');
    await user.tab();

    expect(committed()).toBe('260');
  });

  it('keeps the old value when the field is left empty', async () => {
    const user = userEvent.setup();
    render(<Harness min={30} max={260} initial={90} />);

    await user.clear(tempo());
    await user.tab();

    expect(committed()).toBe('90');
    expect(tempo()).toHaveValue(90);
  });

  it('commits on Enter without waiting for the field to be left', async () => {
    const user = userEvent.setup();
    render(<Harness min={30} max={260} initial={90} />);

    await user.clear(tempo());
    await user.type(tempo(), '5{Enter}');

    expect(committed()).toBe('30');
  });
});
