import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as registerSw from '../lib/register-sw';
import { UpdateControl } from './update-control';

/**
 * The cap is absent until a newer build is installed and waiting, which only
 * happens when a deploy lands under a session that is still open.
 */
describe('UpdateControl', () => {
  /** Fires the module's listeners, the way a waiting worker would. */
  let announce: () => void;

  beforeEach(() => {
    const listeners = new Set<() => void>();
    announce = () => {
      act(() => {
        for (const listener of listeners) listener();
      });
    };

    vi.spyOn(registerSw, 'isUpdateReady').mockReturnValue(false);
    vi.spyOn(registerSw, 'onUpdateReady').mockImplementation((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    });
    vi.spyOn(registerSw, 'applyUpdate').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows nothing while this is the newest build', () => {
    render(<UpdateControl />);
    expect(screen.queryByRole('button', { name: /update/ })).toBeNull();
  });

  it('appears when a newer build is waiting', () => {
    render(<UpdateControl />);

    announce();

    expect(screen.getByRole('button', { name: 'update' })).toBeVisible();
  });

  it('is already there when the update arrived before this page opened', () => {
    vi.mocked(registerSw.isUpdateReady).mockReturnValue(true);
    render(<UpdateControl />);

    expect(screen.getByRole('button', { name: 'update' })).toBeVisible();
  });

  it('hands the page over when pressed, and says it is doing so', async () => {
    const user = userEvent.setup();
    render(<UpdateControl />);
    announce();

    await user.click(screen.getByRole('button', { name: 'update' }));

    expect(registerSw.applyUpdate).toHaveBeenCalledTimes(1);
    // The reload is the worker's doing, so in the meantime the cap says what
    // is happening rather than sitting there looking unpressed.
    expect(screen.getByRole('button', { name: 'updating' })).toBeVisible();
  });
});
