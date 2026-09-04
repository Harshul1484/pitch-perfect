import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IN_TUNE_CENTS, noteAt } from '../lib/notes';
import { NoteTile } from './note-tile';

const middleC = noteAt(60);
const cSharp4 = noteAt(61);

describe('NoteTile', () => {
  it('shows the note name and its reference frequency', () => {
    render(
      <NoteTile
        note={middleC}
        onPlay={() => {}}
        isActive={false}
        tolerance={IN_TUNE_CENTS}
      />,
    );

    expect(screen.getByText('C4')).toBeInTheDocument();
    expect(screen.getByText('262')).toBeInTheDocument();
  });

  it('labels the button for screen readers with the exact frequency', () => {
    render(
      <NoteTile
        note={cSharp4}
        onPlay={() => {}}
        isActive={false}
        tolerance={IN_TUNE_CENTS}
      />,
    );

    expect(
      screen.getByRole('button', { name: /play C♯4, 277\.18 hertz/i }),
    ).toBeInTheDocument();
  });

  it('reports the note upward when clicked', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();
    render(
      <NoteTile
        note={middleC}
        onPlay={onPlay}
        isActive={false}
        tolerance={IN_TUNE_CENTS}
      />,
    );

    await user.click(screen.getByRole('button'));

    expect(onPlay).toHaveBeenCalledExactlyOnceWith(middleC);
  });

  it('looks physically depressed while flashing from a click', () => {
    const { rerender } = render(
      <NoteTile
        note={middleC}
        onPlay={() => {}}
        isActive={false}
        tolerance={IN_TUNE_CENTS}
      />,
    );
    expect(screen.getByRole('button').className).not.toContain('keycap-pressed');

    rerender(
      <NoteTile note={middleC} onPlay={() => {}} isActive tolerance={IN_TUNE_CENTS} />,
    );
    expect(screen.getByRole('button').className).toContain('keycap-pressed');
  });
});

describe('NoteTile while a note is being heard', () => {
  it('shows cents off instead of the reference frequency', () => {
    render(
      <NoteTile
        note={middleC}
        onPlay={() => {}}
        isActive={false}
        detectedCents={-14}
        tolerance={IN_TUNE_CENTS}
      />,
    );

    expect(screen.getByText('-14')).toBeInTheDocument();
    expect(screen.queryByText('262')).not.toBeInTheDocument();
  });

  it('signs a sharp reading', () => {
    render(
      <NoteTile
        note={middleC}
        onPlay={() => {}}
        isActive={false}
        detectedCents={7}
        tolerance={IN_TUNE_CENTS}
      />,
    );

    expect(screen.getByText('+7')).toBeInTheDocument();
  });

  it('borders green when in tune and red when not', () => {
    const { rerender } = render(
      <NoteTile
        note={middleC}
        onPlay={() => {}}
        isActive={false}
        detectedCents={3}
        tolerance={IN_TUNE_CENTS}
      />,
    );
    expect(screen.getByRole('button').className).toContain('border-intune');

    rerender(
      <NoteTile
        note={middleC}
        onPlay={() => {}}
        isActive={false}
        detectedCents={35}
        tolerance={IN_TUNE_CENTS}
      />,
    );
    expect(screen.getByRole('button').className).toContain('border-signal');
  });

  it('respects a widened tolerance', () => {
    // 18 cents is out of tune at the default, in tune at ±25.
    const { rerender } = render(
      <NoteTile
        note={middleC}
        onPlay={() => {}}
        isActive={false}
        detectedCents={18}
        tolerance={10}
      />,
    );
    expect(screen.getByRole('button').className).toContain('border-signal');

    rerender(
      <NoteTile
        note={middleC}
        onPlay={() => {}}
        isActive={false}
        detectedCents={18}
        tolerance={25}
      />,
    );
    expect(screen.getByRole('button').className).toContain('border-intune');
  });

  it('marks the heard tile as current for assistive tech', () => {
    render(
      <NoteTile
        note={middleC}
        onPlay={() => {}}
        isActive={false}
        detectedCents={0}
        tolerance={IN_TUNE_CENTS}
      />,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'true');
  });

  it('lets the heard state win over the click flash', () => {
    render(
      <NoteTile
        note={middleC}
        onPlay={() => {}}
        isActive
        detectedCents={2}
        tolerance={IN_TUNE_CENTS}
      />,
    );

    const className = screen.getByRole('button').className;
    expect(className).toContain('border-intune');
    expect(className).not.toContain('keycap-pressed');
  });
});
