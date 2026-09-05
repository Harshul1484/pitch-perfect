import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IN_TUNE_CENTS } from '../lib/notes';
import { PitchMeter } from './pitch-meter';

describe('PitchMeter', () => {
  it('shows nothing definite when no note is sounding', () => {
    render(<PitchMeter cents={null} tolerance={IN_TUNE_CENTS} />);

    expect(screen.getByText('––')).toBeInTheDocument();
  });

  it('calls a near-centre reading in tune', () => {
    render(<PitchMeter cents={4} tolerance={IN_TUNE_CENTS} />);

    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('signs a reading that is out', () => {
    const { rerender } = render(<PitchMeter cents={23} tolerance={IN_TUNE_CENTS} />);
    expect(screen.getByText('+23')).toBeInTheDocument();

    rerender(<PitchMeter cents={-31} tolerance={IN_TUNE_CENTS} />);
    expect(screen.getByText('-31')).toBeInTheDocument();
  });

  it('treats exactly the tolerance as in tune', () => {
    const { rerender } = render(<PitchMeter cents={10} tolerance={10} />);
    expect(screen.getByText('ok')).toBeInTheDocument();

    rerender(<PitchMeter cents={11} tolerance={10} />);
    expect(screen.getByText('+11')).toBeInTheDocument();
  });

  it('marks the ends of the window with the tolerance', () => {
    render(<PitchMeter cents={0} tolerance={12} />);

    expect(screen.getByText('+12')).toBeInTheDocument();
    expect(screen.getByText('−12')).toBeInTheDocument();
  });
});
