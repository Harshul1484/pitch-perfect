import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CentsMeter } from './cents-meter';

describe('CentsMeter', () => {
  it('says nothing definite when no note is sounding', () => {
    render(<CentsMeter cents={null} />);

    expect(screen.getByText('flat / sharp')).toBeInTheDocument();
  });

  it('calls a near-centre reading in tune', () => {
    render(<CentsMeter cents={4} />);

    expect(screen.getByText('in tune')).toBeInTheDocument();
  });

  it('labels sharp and flat readings with a sign', () => {
    const { rerender } = render(<CentsMeter cents={23} />);
    expect(screen.getByText('+23¢ sharp')).toBeInTheDocument();

    rerender(<CentsMeter cents={-31} />);
    expect(screen.getByText('-31¢ flat')).toBeInTheDocument();
  });

  it('treats exactly 10 cents as the edge of in tune', () => {
    const { rerender } = render(<CentsMeter cents={10} />);
    expect(screen.getByText('in tune')).toBeInTheDocument();

    rerender(<CentsMeter cents={11} />);
    expect(screen.getByText('+11¢ sharp')).toBeInTheDocument();
  });
});
