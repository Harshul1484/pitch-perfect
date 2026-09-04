import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { noteAt } from '../lib/notes';
import { NoteTile } from './note-tile';

const middleC = noteAt(60);
const cSharp4 = noteAt(61);

describe('NoteTile', () => {
  it('shows the note name and its frequency', () => {
    render(<NoteTile note={middleC} onPlay={() => {}} isActive={false} />);

    expect(screen.getByText('C4')).toBeInTheDocument();
    expect(screen.getByText('261.6 Hz')).toBeInTheDocument();
  });

  it('labels the button for screen readers', () => {
    render(<NoteTile note={cSharp4} onPlay={() => {}} isActive={false} />);

    expect(
      screen.getByRole('button', { name: /play C♯4, 277\.18 hertz/i }),
    ).toBeInTheDocument();
  });

  it('reports the note upward when clicked', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();
    render(<NoteTile note={middleC} onPlay={onPlay} isActive={false} />);

    await user.click(screen.getByRole('button'));

    expect(onPlay).toHaveBeenCalledExactlyOnceWith(middleC);
  });

  it('marks the active tile', () => {
    const { rerender } = render(
      <NoteTile note={middleC} onPlay={() => {}} isActive={false} />,
    );
    expect(screen.getByRole('button').className).not.toContain('ring-accent');

    rerender(<NoteTile note={middleC} onPlay={() => {}} isActive />);
    expect(screen.getByRole('button').className).toContain('ring-accent');
  });
});

describe('NoteTile while a note is being heard', () => {
  it('shows cents off instead of the reference frequency', () => {
    render(
      <NoteTile note={middleC} onPlay={() => {}} isActive={false} detectedCents={-14} />,
    );

    expect(screen.getByText('-14¢')).toBeInTheDocument();
    expect(screen.queryByText('261.6 Hz')).not.toBeInTheDocument();
  });

  it('rings green when in tune and amber when not', () => {
    const { rerender } = render(
      <NoteTile note={middleC} onPlay={() => {}} isActive={false} detectedCents={3} />,
    );
    expect(screen.getByRole('button').className).toContain('ring-intune');

    rerender(
      <NoteTile note={middleC} onPlay={() => {}} isActive={false} detectedCents={35} />,
    );
    expect(screen.getByRole('button').className).toContain('ring-offtune');
  });

  it('marks the heard tile as current for assistive tech', () => {
    render(
      <NoteTile note={middleC} onPlay={() => {}} isActive={false} detectedCents={0} />,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'true');
  });

  it('lets the heard state win over the click flash', () => {
    render(
      <NoteTile note={middleC} onPlay={() => {}} isActive detectedCents={2} />,
    );

    const className = screen.getByRole('button').className;
    expect(className).toContain('ring-intune');
    expect(className).not.toContain('ring-accent');
  });
});
