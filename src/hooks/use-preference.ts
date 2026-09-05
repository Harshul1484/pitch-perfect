import { useCallback, useState } from 'react';

/**
 * A setting that outlives the page and is shared between routes.
 *
 * The tuner and the notes page are separate routes with separate state, but
 * choices like the instrument voice or the notation belong to the person, not
 * to the page. localStorage is read once on mount rather than watched: these
 * change from a click on this page, not from elsewhere.
 *
 * Every access is guarded. Private windows and browsers set to block site data
 * throw on the accessor itself, and a preference is never worth a blank page.
 */
export function usePreference<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null && (allowed as readonly string[]).includes(stored)
        ? (stored as T)
        : fallback;
    } catch {
      return fallback;
    }
  });

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Not being able to remember the choice is not a reason to ignore it.
      }
    },
    [key],
  );

  return [value, update];
}
