import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNumberPreference, usePreference } from './use-preference';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('usePreference', () => {
  it('starts from the fallback when nothing is stored', () => {
    const { result } = renderHook(() =>
      usePreference('k', 'violin', ['violin', 'piano'] as const),
    );

    expect(result.current[0]).toBe('violin');
  });

  it('reads a stored choice back', () => {
    window.localStorage.setItem('k', 'piano');
    const { result } = renderHook(() =>
      usePreference('k', 'violin', ['violin', 'piano'] as const),
    );

    expect(result.current[0]).toBe('piano');
  });

  it('ignores a stored value that is no longer one of the options', () => {
    window.localStorage.setItem('k', 'harpsichord');
    const { result } = renderHook(() =>
      usePreference('k', 'violin', ['violin', 'piano'] as const),
    );

    expect(result.current[0]).toBe('violin');
  });

  it('remembers a change', () => {
    const { result } = renderHook(() =>
      usePreference('k', 'violin', ['violin', 'piano'] as const),
    );

    act(() => result.current[1]('piano'));

    expect(result.current[0]).toBe('piano');
    expect(window.localStorage.getItem('k')).toBe('piano');
  });

  it('still works when storage throws, as in a private window', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const { result } = renderHook(() =>
      usePreference('k', 'violin', ['violin', 'piano'] as const),
    );
    expect(result.current[0]).toBe('violin');

    // The choice still applies for this session, it simply is not remembered.
    act(() => result.current[1]('piano'));
    expect(result.current[0]).toBe('piano');
  });
});

describe('useNumberPreference', () => {
  it('starts from the fallback when nothing is stored', () => {
    const { result } = renderHook(() => useNumberPreference('n', 90, 30, 260));

    expect(result.current[0]).toBe(90);
  });

  it('does not mistake a missing value for zero', () => {
    // Number(null) is 0, which would pass a range starting at zero.
    const { result } = renderHook(() => useNumberPreference('n', 7, 0, 11));

    expect(result.current[0]).toBe(7);
  });

  it('reads a stored number back', () => {
    window.localStorage.setItem('n', '120');
    const { result } = renderHook(() => useNumberPreference('n', 90, 30, 260));

    expect(result.current[0]).toBe(120);
  });

  it('ignores a stored number outside the range', () => {
    window.localStorage.setItem('n', '9000');
    const { result } = renderHook(() => useNumberPreference('n', 90, 30, 260));

    expect(result.current[0]).toBe(90);
  });

  it('ignores something that is not a number at all', () => {
    window.localStorage.setItem('n', 'presto');
    const { result } = renderHook(() => useNumberPreference('n', 90, 30, 260));

    expect(result.current[0]).toBe(90);
  });

  it('remembers a change', () => {
    const { result } = renderHook(() => useNumberPreference('n', 90, 30, 260));

    act(() => result.current[1](144));

    expect(result.current[0]).toBe(144);
    expect(window.localStorage.getItem('n')).toBe('144');
  });
});
