import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IN_TUNE_CENTS, noteAt } from '../lib/notes';
import { NoteTile } from './note-tile';

const middleC = noteAt(60);
const cSharp4 = noteAt(61);

const base = {
  onPlay: () => {},
  isActive: false,
  tolerance: IN_TUNE_CENTS,
  notation: 'western' as const,
  tonic: 0,
};

describe('NoteTile', () => {
  it('shows the pitch class with its octave as a superscript', () => {
    render(<NoteTile {...base} note={middleC} />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('C4');
    expect(button.querySelector('sup')).toHaveTextContent('4');
  });

  it('names the exact frequency for screen readers and on hover', () => {
    render(<NoteTile {...base} note={cSharp4} />);

    const button = screen.getByRole('button', { name: /play C♯4, 277\.18 hertz/i });
    expect(button).toHaveAttribute('title', expect.stringContaining('277.18 Hz'));
  });

  it('reports the note upward when clicked', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();
    render(<NoteTile {...base} note={middleC} onPlay={onPlay} />);

    await user.click(screen.getByRole('button'));

    expect(onPlay).toHaveBeenCalledExactlyOnceWith(middleC);
  });

  it('tints while flashing from a click', () => {
    const { rerender } = render(<NoteTile {...base} note={middleC} />);
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'idle');

    rerender(<NoteTile {...base} note={middleC} isActive />);
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'active');
  });

  it('sets accidentals apart without leaving the light palette', () => {
    render(<NoteTile {...base} note={cSharp4} />);
    expect(screen.getByRole('button').className).toContain('bg-recess');

    render(<NoteTile {...base} note={middleC} />);
    expect(screen.getAllByRole('button')[1].className).toContain('bg-panel');
  });
});

describe('NoteTile while a note is being heard', () => {
  it('shows how far off it is, signed', () => {
    const { rerender } = render(
      <NoteTile {...base} note={middleC} detectedCents={-14} />,
    );
    expect(screen.getByText('-14')).toBeInTheDocument();

    rerender(<NoteTile {...base} note={middleC} detectedCents={7} />);
    expect(screen.getByText('+7')).toBeInTheDocument();
  });

  it('turns green when in tune and stays neutral when not', () => {
    const { rerender } = render(<NoteTile {...base} note={middleC} detectedCents={3} />);
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'in-tune');

    rerender(<NoteTile {...base} note={middleC} detectedCents={35} />);
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'out');
  });

  it('respects a widened tolerance', () => {
    // 18 cents is out at the default, in tune at ±25.
    const { rerender } = render(
      <NoteTile {...base} note={middleC} detectedCents={18} tolerance={10} />,
    );
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'out');

    rerender(<NoteTile {...base} note={middleC} detectedCents={18} tolerance={25} />);
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'in-tune');
  });

  it('marks the heard tile as current for assistive tech', () => {
    render(<NoteTile {...base} note={middleC} detectedCents={0} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'true');
  });

  it('lets the heard state win over the click flash', () => {
    render(<NoteTile {...base} note={middleC} isActive detectedCents={2} />);

    // Hearing a note outranks the click flash.
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'in-tune');
  });
});
