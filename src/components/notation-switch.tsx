import { NOTATIONS, type Notation } from '../lib/notation';
import { Segmented } from './segmented';

interface NotationSwitchProps {
  notation: Notation;
  onNotationChange: (notation: Notation) => void;
}

/**
 * Notation selector.
 *
 * The tonic itself lives on the control rail, because it is also the drone's
 * root and so matters in both notations.
 */
export function NotationSwitch({ notation, onNotationChange }: NotationSwitchProps) {
  return (
    <Segmented
      label="notation"
      value={notation}
      options={NOTATIONS}
      onChange={onNotationChange}
    />
  );
}
