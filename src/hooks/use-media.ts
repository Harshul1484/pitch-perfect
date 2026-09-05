import { useEffect, useState } from 'react';

/**
 * Whether a media query currently matches.
 *
 * Used where CSS cannot finish the job: hiding a duplicate with `display:none`
 * still leaves it in the document, so two copies of the same control answer to
 * the same label and the same click. Where only one should exist, only one is
 * rendered.
 */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);

    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}
