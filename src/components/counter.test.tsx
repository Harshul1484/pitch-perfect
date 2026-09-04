import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Counter } from './counter';

describe('Counter', () => {
  it('starts at zero', () => {
    render(<Counter />);

    expect(screen.getByText(/count:/i)).toHaveTextContent('Count: 0');
  });

  it('increments when the button is clicked', async () => {
    const user = userEvent.setup();
    render(<Counter />);

    await user.click(screen.getByRole('button', { name: /increment/i }));
    await user.click(screen.getByRole('button', { name: /increment/i }));

    expect(screen.getByText(/count:/i)).toHaveTextContent('Count: 2');
  });
});
