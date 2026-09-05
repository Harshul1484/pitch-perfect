import { expect, type Page } from '@playwright/test';

/**
 * Measuring what the browser actually laid out.
 *
 * A screen 'fitting' is not a matter of opinion: either every box sits inside
 * the frame that holds it, or something has been cut off. This walks the page
 * and says which.
 */
interface Offender {
  what: string;
  detail: string;
}

interface Audit {
  frame: { width: number; height: number };
  /** Visible things sticking out past the edge of the frame. */
  outside: Offender[];
  /** Boxes that hide their overflow while holding more than they can show. */
  clipped: Offender[];
  /** The page itself having grown a scrollbar. */
  documentOverflow: { x: number; y: number };
}

/**
 * Walk the rendered page and measure it. Runs in the browser, because only the
 * browser knows what a box ended up being.
 */
export async function audit(page: Page): Promise<Audit> {
  return page.evaluate(() => {
    const root = document.getElementById('root');
    if (!root) throw new Error('no #root');

    const frame = root.getBoundingClientRect();
    const outside: { what: string; detail: string }[] = [];
    const clipped: { what: string; detail: string }[] = [];

    /** Enough to find the thing again in the source. */
    const describe = (el: Element) => {
      const label = el.getAttribute('aria-label') ?? '';
      const text = (el.textContent ?? '').trim().slice(0, 24);
      const cls = el.className.toString().split(' ').slice(0, 3).join('.');
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${
        label ? ` [${label}]` : ''
      }${text ? ` "${text}"` : ''}`;
    };

    /** Inside a scrollable ancestor, being out of view means scrollable. */
    const scrollableAncestor = (el: Element) => {
      for (let node = el.parentElement; node && node !== root; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
          return true;
        }
        if (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth) {
          return true;
        }
      }
      return false;
    };

    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (el === root || root.contains(el) === false) continue;

      const style = getComputedStyle(el);
      // Things deliberately not on show: tooltips, collapsed panels.
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (Number(style.opacity) === 0) continue;

      const rect = el.getBoundingClientRect();
      // A box of a pixel or less in both directions shows nothing. That is
      // how sr-only text is hidden — clipped to 1x1 on purpose — and it would
      // otherwise be reported as content that does not fit, which is true and
      // entirely intended. A 1px hairline is taller than it is wide, so it is
      // still measured.
      if (rect.width <= 1 && rect.height <= 1) continue;

      if (
        rect.left < frame.left - 1 ||
        rect.top < frame.top - 1 ||
        rect.right > frame.right + 1 ||
        rect.bottom > frame.bottom + 1
      ) {
        if (!scrollableAncestor(el)) {
          outside.push({
            what: describe(el),
            detail: `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(
              rect.width,
            )}x${Math.round(rect.height)} vs frame ${Math.round(frame.width)}x${Math.round(
              frame.height,
            )}`,
          });
        }
      }

      const hidesX = style.overflowX === 'hidden' || style.overflowX === 'clip';
      const hidesY = style.overflowY === 'hidden' || style.overflowY === 'clip';
      // A truncated label is meant to run out of room; it says so in the CSS.
      const truncates = style.textOverflow === 'ellipsis';

      if (hidesX && !truncates && el.scrollWidth > el.clientWidth + 1) {
        clipped.push({
          what: describe(el),
          detail: `${el.scrollWidth}px of content in ${el.clientWidth}px across`,
        });
      }
      // Truncation hides overflow on both axes, so a label that declares
      // ellipsis is opting out of both checks, not only the one across.
      if (hidesY && !truncates && el.scrollHeight > el.clientHeight + 1) {
        clipped.push({
          what: describe(el),
          detail: `${el.scrollHeight}px of content in ${el.clientHeight}px down`,
        });
      }
    }

    const doc = document.documentElement;
    return {
      frame: { width: Math.round(frame.width), height: Math.round(frame.height) },
      outside,
      clipped,
      documentOverflow: {
        x: doc.scrollWidth - doc.clientWidth,
        y: doc.scrollHeight - doc.clientHeight,
      },
    };
  });
}

/** Everything the audit found, as one assertion so a failure names the culprit. */
export function expectNothingCutOff(result: Audit) {
  const problems = [
    ...result.outside.map((o) => `outside the frame: ${o.what} — ${o.detail}`),
    ...result.clipped.map((o) => `clipped: ${o.what} — ${o.detail}`),
  ];

  expect(problems, problems.join('\n')).toEqual([]);
  expect(result.documentOverflow.x).toBeLessThanOrEqual(0);
  expect(result.documentOverflow.y).toBeLessThanOrEqual(0);
}
