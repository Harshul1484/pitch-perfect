import { NavLink } from 'react-router';
import { Mark } from './mark';

/* Hover lives on the off state only — see the note in routes/notes.tsx. */
const KEY = 'keycap keycap-pressable active:keycap-pressed';
const KEY_OFF = `${KEY} hover:border-engrave hover:bg-white text-engrave`;
const KEY_ON = `${KEY} border-graphite bg-graphite bg-none text-panel`;

const PAGES = [
  { to: '/', label: 'tuner' },
  { to: '/notes', label: 'notes' },
];

/**
 * The mark, and the two places this app has.
 *
 * Notes was a cap in a row of tools, styled exactly like `record` and
 * `controls` and sitting among them — which said it was another control you
 * reach for while playing. It is not: it is half the app, and the half the
 * notebook lives in. Two tabs beside the mark say that, and say which one you
 * are on, which an arrow pointing away never did.
 *
 * It also settles a smaller inconsistency. The tuner offered "notes →" and the
 * notes page answered with "← home": one relationship described two ways, and
 * neither of them told you where you were.
 */
export function Pages() {
  return (
    <div className="flex shrink-0 items-center gap-3 short:gap-2">
      <span className="flex items-center gap-2 short:gap-1.5">
        <Mark />
        <span className="text-[18px] font-semibold leading-none tracking-[-0.02em] narrow:sr-only short:text-[14px]">
          Perfect Pitch
        </span>
      </span>

      <nav aria-label="pages" className="flex items-center gap-1">
        {PAGES.map((page) => (
          <NavLink
            key={page.to}
            to={page.to}
            end
            className={({ isActive }) =>
              `${
                isActive ? KEY_ON : KEY_OFF
              } inline-flex h-7 items-center px-2.5 font-mono text-[10px] lowercase tracking-[0.08em] short:h-6 short:px-2 short:text-[9px]`
            }
          >
            {page.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
